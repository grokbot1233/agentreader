import { UserError } from "./core";

const UA = "AxiomWorksAgentReader/1.11 (+https://api.axiomworks.co.uk; info@axiomworks.co.uk)";
const KV_KEY = "sanctions:index:v1";
const THRESHOLD = 0.75;
const DISCLAIMER =
  "Screening aid over public sanctions lists only. Not a regulated AML/KYC/KYB determination, legal advice, or a guarantee of match/non-match. Confirm hits at the issuing authority before acting.";

type EnvKV = { LOG: KVNamespace };

export type SanctionsEntry = {
  id: string;
  list: string;
  name: string;
  aliases: string[];
  type: "individual" | "entity";
  program: string | null;
  dob: string | null;
  nationality: string | null;
  n: string;
};

export type SanctionsIndex = {
  built_at: string;
  sources: Record<string, { url: string; licence: string; count: number; pub?: string | null; error?: string }>;
  entries: SanctionsEntry[];
};

type Indexed = SanctionsIndex & { byToken: Map<string, number[]> };

function buildTokenIndex(index: SanctionsIndex): Indexed {
  const byToken = new Map<string, number[]>();
  index.entries.forEach((e, i) => {
    const toks = new Set<string>();
    for (const t of e.n.split(" ")) if (t.length >= 2) toks.add(t);
    for (const al of e.aliases) for (const t of tokenSort(al).split(" ")) if (t.length >= 2) toks.add(t);
    for (const t of toks) {
      const arr = byToken.get(t);
      if (arr) arr.push(i); else byToken.set(t, [i]);
    }
  });
  return { ...index, byToken };
}

type ScreenInput = {
  name?: string;
  country?: string;
  dob?: string;
  year?: string | number;
  type?: string;
};

const TR: Record<string, string> = {
  á: "a", à: "a", ä: "a", â: "a", ã: "a", å: "a",
  é: "e", è: "e", ë: "e", ê: "e",
  í: "i", ì: "i", ï: "i", î: "i",
  ó: "o", ò: "o", ö: "o", ô: "o", õ: "o", ø: "o",
  ú: "u", ù: "u", ü: "u", û: "u",
  ñ: "n", ç: "c", ß: "ss", æ: "ae", œ: "oe",
};

function s(v: any) {
  return v == null ? "" : String(v).trim();
}

const TR2: Record<string, string> = { ø: "o", ß: "ss", æ: "ae", œ: "oe", ł: "l", đ: "d", ð: "d", þ: "th", ı: "i" };

// Unicode-aware: Latin diacritics fold to ASCII; non-Latin scripts (CJK, Cyrillic, Arabic, Greek…) are KEPT
// rather than stripped. Stripping them made every non-Latin query normalise to "" and "match" every
// non-Latin list entry at score 1 (false positives) — fixed v1.39.3.
export function normalizeName(raw: string): string {
  let out = raw.normalize("NFKC").toLowerCase();
  out = out.replace(/[áàäâãåéèëêíìïîóòöôõøúùüûñçßæœ]/g, (c) => TR[c] || c);
  out = out.replace(/[øßæœłđðþı]/g, (c) => TR2[c] || c);
  out = out.normalize("NFD").replace(/(\p{Script=Latin})\p{M}+/gu, "$1").normalize("NFC");
  out = out.replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return out;
}

export function tokenSort(raw: string): string {
  return normalizeName(raw).split(" ").filter(Boolean).sort().join(" ");
}

function jaccard(a: string, b: string): number {
  const sa = new Set(a.split(" ").filter(Boolean));
  const sb = new Set(b.split(" ").filter(Boolean));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function fetchText(url: string, timeoutMs = 120000): Promise<string> {
  const r = await fetch(url, {
    headers: { "user-agent": UA, accept: "*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return await r.text();
}

/** Try URLs in order; used for OFAC which often 525s on treasury.gov from Workers. */
async function fetchTextFirst(urls: string[], timeoutMs = 120000): Promise<{ text: string; url: string }> {
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const text = await fetchText(url, timeoutMs);
      if (text && text.length > 100) return { text, url };
      errors.push(`${url}: empty`);
    } catch (e: any) {
      errors.push(`${url}: ${e?.message || e}`);
    }
  }
  throw new Error(errors.join(" | "));
}

const OFAC_SDN = [
  "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV",
  "https://www.treasury.gov/ofac/downloads/sdn.csv",
];
const OFAC_ALT = [
  "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/ALT.CSV",
  "https://www.treasury.gov/ofac/downloads/alt.csv",
];
const OFAC_CONS = [
  "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/CONS_PRIM.CSV",
  "https://www.treasury.gov/ofac/downloads/consolidated/cons_prim.csv",
];
/** OpenSanctions daily mirrors — used when treasury.gov / OFAC API returns 5xx (often 525 from Workers). */
const OFAC_SDN_OS = "https://data.opensanctions.org/datasets/latest/us_ofac_sdn/targets.simple.csv";
const OFAC_CONS_OS = "https://data.opensanctions.org/datasets/latest/us_ofac_cons/targets.simple.csv";

async function gzipJson(obj: any): Promise<ArrayBuffer> {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return await new Response(cs.readable).arrayBuffer();
}

async function gunzipJson(buf: ArrayBuffer | string): Promise<any> {
  let ab: ArrayBuffer;
  if (typeof buf === "string") {
    // legacy plaintext JSON
    return JSON.parse(buf);
  }
  ab = buf;
  const ds = new DecompressionStream("gzip");
  const stream = new Blob([ab]).stream().pipeThrough(ds);
  const text = await new Response(stream).text();
  return JSON.parse(text);
}

function ofacType(t: string): "individual" | "entity" {
  return /individual/i.test(t) ? "individual" : "entity";
}

function parseOfacSdn(sdnText: string, altText: string): SanctionsEntry[] {
  const byId = new Map<string, SanctionsEntry>();
  for (const line of sdnText.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const row = parseCsvLine(line);
    if (row.length < 4) continue;
    const [eid, name, typ, prog] = row;
    if (!name || name === "-0-") continue;
    const remarks = row[11] || "";
    const dobM = remarks.match(/DOB\s+([^;]+)/i);
    const natM = remarks.match(/nationality\s+([^;]+)/i);
    byId.set(eid, {
      id: eid,
      list: "OFAC-SDN",
      name,
      aliases: [],
      type: ofacType(typ),
      program: prog && prog !== "-0-" ? prog : null,
      dob: dobM ? dobM[1].trim() : null,
      nationality: natM ? natM[1].trim() : null,
      n: tokenSort(name),
    });
  }
  for (const line of altText.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const row = parseCsvLine(line);
    if (row.length < 4) continue;
    const eid = row[0];
    const alias = row[3];
    const e = byId.get(eid);
    if (e && alias && alias !== "-0-") e.aliases.push(alias);
  }
  return [...byId.values()];
}

function parseOfacCons(text: string): SanctionsEntry[] {
  const out: SanctionsEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const row = parseCsvLine(line);
    if (row.length < 4) continue;
    const [eid, name, typ, prog] = row;
    if (!name || name === "-0-") continue;
    const remarks = row[11] || "";
    const dobM = remarks.match(/DOB\s+([^;]+)/i);
    out.push({
      id: eid,
      list: "OFAC-CONS",
      name,
      aliases: [],
      type: ofacType(typ),
      program: prog && prog !== "-0-" ? prog : null,
      dob: dobM ? dobM[1].trim() : null,
      nationality: null,
      n: tokenSort(name),
    });
  }
  return out;
}

function parseUn(xml: string): { entries: SanctionsEntry[]; pub: string | null } {
  const pubM = xml.match(/dateGenerated="([^"]+)"/);
  const pub = pubM ? pubM[1] : null;
  const entries: SanctionsEntry[] = [];
  const pull = (block: string, tag: string) => {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    return m ? m[1].trim() : "";
  };
  for (const block of xml.match(/<INDIVIDUAL>[\s\S]*?<\/INDIVIDUAL>/g) || []) {
    const ref = pull(block, "REFERENCE_NUMBER") || pull(block, "DATAID");
    const parts = ["FIRST_NAME", "SECOND_NAME", "THIRD_NAME", "FOURTH_NAME"].map((t) => pull(block, t)).filter(Boolean);
    const name = parts.join(" ");
    if (!name) continue;
    const aliases: string[] = [];
    for (const a of block.match(/<ALIAS>[\s\S]*?<\/ALIAS>/g) || []) {
      const an = pull(a, "ALIAS_NAME");
      if (an) aliases.push(an);
    }
    let dob: string | null = null;
    for (const d of block.match(/<INDIVIDUAL_DATE_OF_BIRTH>[\s\S]*?<\/INDIVIDUAL_DATE_OF_BIRTH>/g) || []) {
      dob = pull(d, "DATE") || pull(d, "YEAR") || dob;
    }
    const nats: string[] = [];
    for (const n of block.match(/<NATIONALITY>[\s\S]*?<\/NATIONALITY>/g) || []) {
      const v = pull(n, "VALUE");
      if (v) nats.push(v);
    }
    entries.push({
      id: ref,
      list: "UN-SC",
      name,
      aliases: aliases.slice(0, 20),
      type: "individual",
      program: pull(block, "UN_LIST_TYPE") || null,
      dob,
      nationality: nats.slice(0, 3).join(", ") || null,
      n: tokenSort(name),
    });
  }
  for (const block of xml.match(/<ENTITY>[\s\S]*?<\/ENTITY>/g) || []) {
    const ref = pull(block, "REFERENCE_NUMBER") || pull(block, "DATAID");
    const name = pull(block, "FIRST_NAME");
    if (!name) continue;
    const aliases: string[] = [];
    for (const a of block.match(/<ALIAS>[\s\S]*?<\/ALIAS>/g) || []) {
      const an = pull(a, "ALIAS_NAME");
      if (an) aliases.push(an);
    }
    entries.push({
      id: ref,
      list: "UN-SC",
      name,
      aliases: aliases.slice(0, 20),
      type: "entity",
      program: pull(block, "UN_LIST_TYPE") || null,
      dob: null,
      nationality: null,
      n: tokenSort(name),
    });
  }
  return { entries, pub };
}

function parseUk(csvText: string): { entries: SanctionsEntry[]; pub: string | null } {
  const lines = csvText.split(/\r?\n/);
  let pub: string | null = null;
  let start = 0;
  if (lines[0] && /^Report Date/i.test(lines[0])) {
    pub = lines[0].replace(/^Report Date:\s*/i, "").trim() || null;
    start = 1;
  }
  const header = parseCsvLine(lines[start] || "");
  const idx = (name: string) => header.findIndex((h) => h.trim() === name);
  const iUid = idx("Unique ID");
  const iType = idx("Name type");
  const iDes = idx("Designation Type");
  const iReg = idx("Regime Name");
  const iDob = idx("D.O.B");
  const iNat = idx("Nationality(/ies)");
  const nameIdxs = [1, 2, 3, 4, 5, 6].map((n) => idx(`Name ${n}`)).filter((i) => i >= 0);
  type G = { primary: string | null; aliases: string[]; meta: any };
  const groups = new Map<string, G>();
  for (let li = start + 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line || !line.trim()) continue;
    const row = parseCsvLine(line);
    const uid = (row[iUid] || "").trim();
    if (!uid) continue;
    const parts = nameIdxs.map((i) => (row[i] || "").trim()).filter(Boolean);
    const n6 = idx("Name 6") >= 0 ? (row[idx("Name 6")] || "").trim() : "";
    const n1 = idx("Name 1") >= 0 ? (row[idx("Name 1")] || "").trim() : "";
    const full = n6 && !n1 ? n6 : parts.join(" ");
    if (!full) continue;
    let g = groups.get(uid);
    if (!g) {
      const dtype = (row[iDes] || "").toLowerCase();
      g = {
        primary: null,
        aliases: [],
        meta: {
          program: (row[iReg] || "").trim() || null,
          dob: (row[iDob] || "").trim() || null,
          nationality: (row[iNat] || "").trim() || null,
          type: /individual/i.test(dtype) ? "individual" : "entity",
        },
      };
      groups.set(uid, g);
    }
    const ntype = (row[iType] || "").toLowerCase();
    if (ntype.includes("primary") || !g.primary) {
      if (ntype.includes("primary")) g.primary = full;
      else if (!g.primary) g.primary = full;
      else if (full !== g.primary) g.aliases.push(full);
    } else if (full !== g.primary) g.aliases.push(full);
  }
  const entries: SanctionsEntry[] = [];
  for (const [uid, g] of groups) {
    const name = g.primary || g.aliases[0];
    if (!name) continue;
    entries.push({
      id: uid,
      list: "UK-FCDO",
      name,
      aliases: g.aliases.filter((a) => a !== name).slice(0, 25),
      type: g.meta.type,
      program: g.meta.program,
      dob: g.meta.dob,
      nationality: g.meta.nationality,
      n: tokenSort(name),
    });
  }
  return { entries, pub };
}

function parseEu(xml: string): { entries: SanctionsEntry[]; pub: string | null } {
  const pubM = xml.match(/generationDate="([^"]+)"/);
  const pub = pubM ? pubM[1] : null;
  const entries: SanctionsEntry[] = [];
  const re = /<sanctionEntity\b([^>]*)>([\s\S]*?)<\/sanctionEntity>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs = m[1];
    const body = m[2];
    const eref = attrs.match(/euReferenceNumber="([^"]+)"/);
    const lid = attrs.match(/logicalId="(\d+)"/);
    const rid = (eref && eref[1]) || (lid && lid[1]);
    if (!rid) continue;
    const st = body.match(/classificationCode="([^"]+)"/);
    const typ: "individual" | "entity" = st && st[1] === "P" ? "individual" : "entity";
    const names = [...body.matchAll(/wholeName="([^"]+)"/g)].map((x) => x[1].trim()).filter(Boolean);
    if (!names.length) continue;
    const prog = body.match(/programme="([^"]+)"/);
    const bd = body.match(/birthdate="([^"]+)"/) || body.match(/<birthdate[^>]*year="([^"]+)"/);
    const nat = body.match(/countryDescription="([^"]+)"/);
    entries.push({
      id: rid,
      list: "EU-FSF",
      name: names[0],
      aliases: names.slice(1, 21),
      type: typ,
      program: prog ? prog[1] : null,
      dob: bd ? bd[1] : null,
      nationality: nat ? nat[1] : null,
      n: tokenSort(names[0]),
    });
  }
  return { entries, pub };
}


/** OpenSanctions targets.simple.csv → SanctionsEntry[] (EU FSF / OFAC SDN / OFAC CONS mirrors). */
function parseOpenSanctionsSimple(csvText: string, list: string): { entries: SanctionsEntry[]; pub: string | null } {
  const lines = csvText.split(/\r?\n/);
  if (!lines.length) return { entries: [], pub: null };
  const header = parseCsvLine(lines[0] || "");
  const idx = (name: string) => header.findIndex((h) => h.trim() === name);
  const iId = idx("id");
  const iSchema = idx("schema");
  const iName = idx("name");
  const iAliases = idx("aliases");
  const iDob = idx("birth_date");
  const iCountries = idx("countries");
  const iProgram = idx("program_ids");
  const iLastSeen = idx("last_seen");
  const entries: SanctionsEntry[] = [];
  let pub: string | null = null;
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line || !line.trim()) continue;
    const row = parseCsvLine(line);
    const name = (row[iName] || "").trim();
    const id = (row[iId] || "").trim();
    if (!name || !id) continue;
    const schema = (row[iSchema] || "").toLowerCase();
    const typ: "individual" | "entity" = schema === "person" ? "individual" : "entity";
    const aliases = (row[iAliases] || "")
      .split(";")
      .map((a) => a.trim())
      .filter((a) => a && a !== name)
      .slice(0, 20);
    const dob = (row[iDob] || "").trim() || null;
    const nationality = (row[iCountries] || "").trim() || null;
    const program = (row[iProgram] || "").trim() || null;
    const seen = (row[iLastSeen] || "").trim();
    if (seen && (!pub || seen > pub)) pub = seen;
    entries.push({
      id,
      list,
      name,
      aliases,
      type: typ,
      program,
      dob,
      nationality,
      n: tokenSort(name),
    });
  }
  return { entries, pub };
}

/** OpenSanctions daily mirror of EU FSF (used when webgate XML returns 5xx). */
function parseEuOpenSanctions(csvText: string): { entries: SanctionsEntry[]; pub: string | null } {
  return parseOpenSanctionsSimple(csvText, "EU-FSF");
}

let cached: Indexed | null = null;
let cachedAt = 0;

export function clearSanctionsCache() {
  cached = null;
  cachedAt = 0;
}

export async function getSanctionsIndex(env: EnvKV): Promise<Indexed> {
  if (cached && Date.now() - cachedAt < 30 * 60 * 1000) return cached;
  const raw = await env.LOG.get(KV_KEY, "arrayBuffer");
  if (!raw) {
    const text = await env.LOG.get(KV_KEY);
    if (!text) throw new UserError("sanctions index not loaded yet; try again shortly", 503);
    cached = buildTokenIndex(await gunzipJson(text));
  } else {
    cached = buildTokenIndex(await gunzipJson(raw));
  }
  cachedAt = Date.now();
  return cached!;
}

export async function refreshSanctionsIndex(env: EnvKV): Promise<{ ok: boolean; sources: SanctionsIndex["sources"]; entries: number; error?: string }> {
  const sources: SanctionsIndex["sources"] = {};
  const all: SanctionsEntry[] = [];
  const errors: string[] = [];

  // Load previous index so a transient OFAC failure does not wipe good SDN/CONS rows.
  let prev: SanctionsIndex | null = null;
  try {
    const raw = await env.LOG.get(KV_KEY, "arrayBuffer");
    if (raw) prev = await gunzipJson(raw);
    else {
      const text = await env.LOG.get(KV_KEY);
      if (text) prev = await gunzipJson(text);
    }
  } catch { prev = null; }
  const prevOfac = (prev?.entries || []).filter((e) => e.list === "OFAC-SDN" || e.list === "OFAC-CONS");
  // UK/UN/EU keep prior rows in their own catch blocks below.

  // OFAC from Workers: prefer OpenSanctions mirrors first. Official treasury.gov / OFAC API
  // routinely HTTP 525 from CF egress; trying them first burns wall+CPU then still fails (error 1102).
  try {
    try {
      const csv = await fetchText(OFAC_SDN_OS, 90000);
      const { entries, pub } = parseOpenSanctionsSimple(csv, "OFAC-SDN");
      if (entries.length < 1000) throw new Error(`OpenSanctions SDN mirror too few entries (${entries.length})`);
      all.push(...entries);
      sources["OFAC-SDN"] = {
        url: OFAC_SDN_OS,
        licence: "US OFAC SDN via OpenSanctions mirror (Worker-reachable; official treasury often 525 from CF)",
        count: entries.length,
        pub,
      };
    } catch (osErr: any) {
      const [sdn, alt] = await Promise.all([fetchTextFirst(OFAC_SDN, 20000), fetchTextFirst(OFAC_ALT, 20000)]);
      const entries = parseOfacSdn(sdn.text, alt.text);
      if (entries.length < 1000) throw new Error(`official SDN too few (${entries.length}); OS: ${osErr?.message || osErr}`);
      all.push(...entries);
      sources["OFAC-SDN"] = {
        url: sdn.url,
        licence: "US government public domain",
        count: entries.length,
        error: `OpenSanctions mirror failed (${String(osErr?.message || osErr).slice(0, 120)}); used official`,
      };
    }
  } catch (e: any) {
    errors.push(`OFAC-SDN: ${e?.message || e}`);
    const kept = prevOfac.filter((e) => e.list === "OFAC-SDN");
    if (kept.length) {
      all.push(...kept);
      sources["OFAC-SDN"] = { url: OFAC_SDN_OS, licence: "US government public domain", count: kept.length, error: `refresh failed, kept prior ${kept.length}: ${String(e?.message || e)}` };
    } else {
      sources["OFAC-SDN"] = { url: OFAC_SDN_OS, licence: "US government public domain", count: 0, error: String(e?.message || e) };
    }
  }

  // CONS is secondary to SDN. Parsing OS CONS + OS SDN + EU + UN + UK in one HTTP
  // request exceeds Worker CPU (CF 1102). Keep prior CONS when healthy; refresh via OS only if empty.
  try {
    const keptCons = prevOfac.filter((e) => e.list === "OFAC-CONS");
    if (keptCons.length >= 50) {
      all.push(...keptCons);
      sources["OFAC-CONS"] = {
        url: OFAC_CONS_OS,
        licence: "US government public domain",
        count: keptCons.length,
        error: `kept prior CONS ${keptCons.length} (skip OS/official parse to stay under Worker HTTP CPU; SDN uses OpenSanctions)`,
      };
    } else {
      try {
        const csv = await fetchText(OFAC_CONS_OS, 60000);
        const { entries, pub } = parseOpenSanctionsSimple(csv, "OFAC-CONS");
        if (entries.length < 50) throw new Error(`OpenSanctions CONS mirror too few entries (${entries.length})`);
        all.push(...entries);
        sources["OFAC-CONS"] = {
          url: OFAC_CONS_OS,
          licence: "US OFAC CONS via OpenSanctions mirror (Worker-reachable; official treasury often 525 from CF)",
          count: entries.length,
          pub,
        };
      } catch (osErr: any) {
        const cons = await fetchTextFirst(OFAC_CONS, 20000);
        const entries = parseOfacCons(cons.text);
        if (entries.length < 50) throw new Error(`official CONS too few (${entries.length}); OS: ${osErr?.message || osErr}`);
        all.push(...entries);
        sources["OFAC-CONS"] = {
          url: cons.url,
          licence: "US government public domain",
          count: entries.length,
          error: `OpenSanctions mirror failed (${String(osErr?.message || osErr).slice(0, 120)}); used official`,
        };
      }
    }
  } catch (e: any) {
    errors.push(`OFAC-CONS: ${e?.message || e}`);
    const kept = prevOfac.filter((e) => e.list === "OFAC-CONS");
    if (kept.length) {
      all.push(...kept);
      sources["OFAC-CONS"] = { url: OFAC_CONS_OS, licence: "US government public domain", count: kept.length, error: `refresh failed, kept prior ${kept.length}: ${String(e?.message || e)}` };
    } else {
      sources["OFAC-CONS"] = { url: OFAC_CONS_OS, licence: "US government public domain", count: 0, error: String(e?.message || e) };
    }
  }

  try {
    const xml = await fetchText("https://scsanctions.un.org/resources/xml/en/consolidated.xml");
    const { entries, pub } = parseUn(xml);
    all.push(...entries);
    sources["UN-SC"] = {
      url: "https://scsanctions.un.org/resources/xml/en/consolidated.xml",
      licence: "UN public data",
      count: entries.length,
      pub,
    };
  } catch (e: any) {
    errors.push(`UN-SC: ${e?.message || e}`);
    const kept = (prev?.entries || []).filter((x) => x.list === "UN-SC");
    if (kept.length) {
      all.push(...kept);
      sources["UN-SC"] = { url: "https://scsanctions.un.org/resources/xml/en/consolidated.xml", licence: "UN public data", count: kept.length, error: `refresh failed, kept prior ${kept.length}: ${String(e?.message || e)}` };
    } else {
      sources["UN-SC"] = { url: "https://scsanctions.un.org/resources/xml/en/consolidated.xml", licence: "UN public data", count: 0, error: String(e?.message || e) };
    }
  }

    try {
    const csv = await fetchText("https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv", 180000);
    const { entries, pub } = parseUk(csv);
    all.push(...entries);
    sources["UK-FCDO"] = {
      url: "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv",
      licence: "Open Government Licence v3.0",
      count: entries.length,
      pub,
    };
  } catch (e: any) {
    errors.push(`UK-FCDO: ${e?.message || e}`);
    const kept = (prev?.entries || []).filter((x) => x.list === "UK-FCDO");
    if (kept.length) {
      all.push(...kept);
      sources["UK-FCDO"] = { url: "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv", licence: "Open Government Licence v3.0", count: kept.length, error: `refresh failed, kept prior ${kept.length}: ${String(e?.message || e)}` };
    } else {
      sources["UK-FCDO"] = { url: "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv", licence: "Open Government Licence v3.0", count: 0, error: String(e?.message || e) };
    }
  }

  const EU_FSF_XML =
    "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw";
  const EU_FSF_OS = "https://data.opensanctions.org/datasets/latest/eu_fsf/targets.simple.csv";
  try {
    try {
      const xml = await fetchText(EU_FSF_XML, 180000);
      const { entries, pub } = parseEu(xml);
      if (entries.length < 500) throw new Error(`official XML too few entries (${entries.length})`);
      all.push(...entries);
      sources["EU-FSF"] = {
        url: EU_FSF_XML,
        licence: "EU open data (public token download; redistribution of screening results)",
        count: entries.length,
        pub,
      };
    } catch (officialErr: any) {
      // Official webgate file hosting has been returning HTTP 500; OpenSanctions mirrors EU FSF daily.
      const csv = await fetchText(EU_FSF_OS, 180000);
      const { entries, pub } = parseEuOpenSanctions(csv);
      if (entries.length < 500) throw new Error(`OpenSanctions mirror too few entries (${entries.length}); official: ${officialErr?.message || officialErr}`);
      all.push(...entries);
      sources["EU-FSF"] = {
        url: EU_FSF_OS,
        licence: "EU FSF via OpenSanctions mirror (official webgate XML unavailable)",
        count: entries.length,
        pub,
        error: `official XML failed (${String(officialErr?.message || officialErr).slice(0, 160)}); used OpenSanctions mirror`,
      };
    }
  } catch (e: any) {
    errors.push(`EU-FSF: ${e?.message || e}`);
    const kept = (prev?.entries || []).filter((x) => x.list === "EU-FSF");
    if (kept.length) {
      all.push(...kept);
      sources["EU-FSF"] = {
        url: EU_FSF_XML,
        licence: "EU open data (public token download; redistribution of screening results)",
        count: kept.length,
        error: `refresh failed, kept prior ${kept.length}: ${String(e?.message || e)}`,
      };
    } else {
      sources["EU-FSF"] = {
        url: EU_FSF_XML,
        licence: "EU open data (public token download)",
        count: 0,
        error: String(e?.message || e),
      };
    }
  }

    if (all.length < 1000) {
    return { ok: false, sources, entries: all.length, error: errors.join("; ") || "too few entries" };
  }

  const index: SanctionsIndex = { built_at: new Date().toISOString(), sources, entries: all };
  const gz = await gzipJson(index);
  await env.LOG.put(KV_KEY, gz, { expirationTtl: 60 * 60 * 24 * 14 });
  cached = buildTokenIndex(index);
  cachedAt = Date.now();
  return { ok: true, sources, entries: all.length, error: errors.length ? errors.join("; ") : undefined };
}

function yearFrom(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = String(v).match(/(19|20)\d{2}/);
  return m ? m[0] : null;
}

function scoreEntry(q: string, qn: string, e: SanctionsEntry, opts: { type?: string; country?: string; year?: string }): number {
  if (opts.type) {
    const t = opts.type.toLowerCase();
    if ((t === "individual" || t === "person") && e.type !== "individual") return 0;
    if ((t === "entity" || t === "company" || t === "organisation" || t === "organization") && e.type !== "entity") return 0;
  }
  if (!qn) return 0;
  const nq = normalizeName(q);
  let best = qn === e.n ? 1 : jaccard(qn, e.n);
  if (nq && nq === normalizeName(e.name)) best = Math.max(best, 1);
  for (const al of e.aliases) {
    const an = tokenSort(al);
    if (!an) continue;
    best = Math.max(best, qn === an ? 1 : jaccard(qn, an));
    if (nq && nq === normalizeName(al)) best = 1;
  }
  if (opts.country && e.nationality) {
    const c = normalizeName(opts.country);
    const n = normalizeName(e.nationality);
    if (c && n.includes(c)) best = Math.min(1, best + 0.03);
  }
  if (opts.year) {
    const ey = yearFrom(e.dob);
    if (ey && ey === opts.year) best = Math.min(1, best + 0.05);
    else if (ey && ey !== opts.year && best < 0.95) best *= 0.92;
  }
  return best;
}

export async function screenSanctions(env: EnvKV, input: ScreenInput) {
  const name = s(input.name);
  if (name.length < 2) throw new UserError("missing name (2+ chars)");
  if (name.length > 200) throw new UserError("name max 200 chars");
  const country = s(input.country) || undefined;
  const dob = s(input.dob) || undefined;
  const year = s(input.year) || yearFrom(dob) || undefined;
  const type = s(input.type) || undefined;

  const index = await getSanctionsIndex(env);
  const qn = tokenSort(name);
  const qTokens = qn.split(" ").filter((t) => t.length >= 2);
  const cand = new Set<number>();
  for (const t of qTokens) {
    const arr = index.byToken.get(t);
    if (arr) for (const i of arr) cand.add(i);
  }
  // Fallback: if no token overlap (unusual), sample by first token prefix buckets
  const hits: { score: number; entry: SanctionsEntry; matched_name: string }[] = [];
  const consider = cand.size ? [...cand] : index.entries.map((_, i) => i);

  for (const i of consider) {
    const e = index.entries[i];
    const score = scoreEntry(name, qn, e, { type, country, year: year || undefined });
    if (score < THRESHOLD) continue;
    let matched = e.name;
    let best = jaccard(qn, e.n);
    for (const al of e.aliases) {
      const sc = jaccard(qn, tokenSort(al));
      if (sc > best) { best = sc; matched = al; }
    }
    hits.push({ score: Math.round(score * 1000) / 1000, entry: e, matched_name: matched });
  }
  hits.sort((a, b) => b.score - a.score);
  const top = hits.slice(0, 25);

  return {
    product: "sanctions",
    price: "$0.05",
    disclaimer: DISCLAIMER,
    query: { name, country: country || null, dob: dob || null, year: year || null, type: type || null },
    screened_at: new Date().toISOString(),
    index_built_at: index.built_at,
    lists: index.sources,
    match_count: top.length,
    possible_match: top.length > 0,
    highest_score: top[0]?.score ?? 0,
    matches: top.map((h) => ({
      score: h.score,
      list: h.entry.list,
      list_entry_id: h.entry.id,
      name: h.entry.name,
      matched_name: h.matched_name,
      aliases: h.entry.aliases.slice(0, 10),
      type: h.entry.type,
      program: h.entry.program,
      dob: h.entry.dob,
      nationality: h.entry.nationality,
      list_publication: index.sources[h.entry.list]?.pub || null,
    })),
  };
}

/**
 * GET-friendly names parser. JSON array wins; else newline/semicolon/pipe lists; else comma lists
 * (`names=A,B,C`). Previously a comma list was screened as ONE concatenated name → silent false negatives.
 * Names that themselves contain commas ("PUTIN, Vladimir") should be sent as JSON or `;`-separated.
 */
export function parseNamesString(raw: string): any[] {
  const t = String(raw || "").trim();
  if (!t) return [];
  if (t.startsWith("[")) { try { const j = JSON.parse(t); if (Array.isArray(j)) return j; } catch {} }
  const sep = /[\n;|]/.test(t) ? /[\n;|]/ : /,/;
  return t.split(sep).map((x) => x.trim()).filter(Boolean);
}

export async function screenSanctionsBatch(env: EnvKV, input: { names?: any }) {
  let names = input.names;
  if (typeof names === "string") {
    names = parseNamesString(names);
  }
  if (!Array.isArray(names) || !names.length) throw new UserError("missing names array (1-50)");
  if (names.length > 50) throw new UserError("names max 50 per call; split into batches");
  const results = [];
  for (const item of names) {
    const inp: ScreenInput = typeof item === "string" ? { name: item } : { name: item?.name, country: item?.country, dob: item?.dob, year: item?.year, type: item?.type };
    try {
      const r = await screenSanctions(env, inp);
      results.push({ name: inp.name, ok: true, match_count: r.match_count, possible_match: r.possible_match, highest_score: r.highest_score, matches: r.matches });
    } catch (e: any) {
      results.push({ name: inp.name, ok: false, error: String(e?.message || e) });
    }
  }
  return {
    product: "sanctions-batch",
    price: "$1.00",
    disclaimer: DISCLAIMER,
    screened_at: new Date().toISOString(),
    count: results.length,
    possible_match_count: results.filter((r: any) => r.possible_match).length,
    results,
  };
}

/** Best-effort screens for KYB pack (entity + directors). */
export async function kybSanctionsScreen(env: EnvKV, opts: { entityName?: string | null; directors?: string[] }) {
  const names: { role: string; name: string }[] = [];
  if (opts.entityName && s(opts.entityName).length >= 2) names.push({ role: "entity", name: s(opts.entityName) });
  for (const d of (opts.directors || []).slice(0, 3)) {
    const n = s(d);
    if (n.length >= 2) names.push({ role: "director", name: n });
  }
  if (!names.length) return { skipped: true, reason: "no entity/director names to screen", disclaimer: DISCLAIMER };

  const results = [];
  let high = 0;
  for (const n of names) {
    try {
      const r = await screenSanctions(env, { name: n.name });
      high = Math.max(high, r.highest_score || 0);
      results.push({
        role: n.role,
        name: n.name,
        possible_match: r.possible_match,
        highest_score: r.highest_score,
        matches: (r.matches || []).slice(0, 3),
      });
    } catch (e: any) {
      results.push({ role: n.role, name: n.name, error: String(e?.message || e) });
    }
  }
  return {
    skipped: false,
    disclaimer: DISCLAIMER,
    possible_match: results.some((r: any) => r.possible_match),
    highest_score: high,
    screened: results,
  };
}
