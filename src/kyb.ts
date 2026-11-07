import { UserError } from "./core";
import { companyResearch } from "./company";
import { ukCompany } from "./uk-company";
import { euVat } from "./eu-vat";
import { leiLookup } from "./lei";
import { kybSanctionsScreen } from "./sanctions";
import { ukOfficerSearch } from "./uk-officer";
import { frCompany } from "./fr-company";
import { noCompany } from "./no-company";
import { dkCompany } from "./dk-company";
import { fiCompany, normalizeYtunnus } from "./fi-company";
import { chCompany, normalizeUid } from "./ch-company";
import { plCompany, normalizeKrs, normalizeNip } from "./pl-company";
import { czCompany, normalizeIco } from "./cz-company";
import { beCompany, normalizeEnterpriseNumber } from "./be-company";
import { skCompany, normalizeSkIco } from "./sk-company";
import { ieCompany, normalizeIeNumber } from "./ie-company";
import { eeCompany, normalizeEeRegCode } from "./ee-company";
import { lvCompany, normalizeLvRegcode } from "./lv-company";
import { usEntity, parseUsStates } from "./us-entity";
export function bindingRegistries(env: any): KybRegistries {
  const call = async (q: string) => { if (!env.AU) throw new Error("registry backend not bound"); const r = await env.AU.fetch(`https://au.internal/internal/${q}`, { headers: { "x-internal-key": env.AU_INTERNAL_KEY || "" } }); const j: any = await r.json(); if (!r.ok) throw new Error(r.status === 404 ? "not found in register snapshot" : j?.error || "registry error"); return j; };
  return {
    au: (b) => { const raw = String(b.acn || b.abn || "").replace(/\s/g, ""); const acn = /^\d{11}$/.test(raw) ? raw.slice(2) : raw; if (!/^\d{9}$/.test(acn)) throw new Error("acn must be 9 digits (or abn 11)"); return call(`au?acn=${acn}`); },
    ca: (b) => { const n = String(b.number || "").replace(/\D/g, ""), bn = String(b.bn || "").replace(/\D/g, "").slice(0, 9); if (n && n.length <= 8) return call(`ca?number=${n}`); if (bn.length === 9) return call(`ca?bn=${bn}`); throw new Error("ca_number or 9-digit bn required"); },
  };
}
export type KybRegistries = { au?: (b: any) => Promise<any>; ca?: (b: any) => Promise<any> };

type Env = { LOG: KVNamespace; CH_API_KEY?: string };

function s(v: any) {
  return (v == null ? "" : String(v)).trim();
}

function domainish(v: string) {
  return v.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./i, "").toLowerCase();
}

/** Composite agent KYB / due-diligence pack. Screening only — not a regulated determination. */
export async function kybReport(env: Env, input: {
  domain?: string; number?: string; name?: string; vat?: string; country?: string; vat_number?: string;
  acn?: string; abn?: string; ca_number?: string; bn?: string; lei?: string; siren?: string; siret?: string; orgnr?: string; cvr?: string; ytunnus?: string; businessId?: string; fi?: string; uid?: string; che?: string; ch?: string; krs?: string; nip?: string; pl?: string; ico?: string; cz?: string; enterprise_number?: string; be?: string; bce?: string; kbo?: string; sk?: string; ico_sk?: string; rpo?: string; ie?: string; ee?: string; lv?: string; preview?: boolean;
}, reg: KybRegistries = {}) {
  const preview = !!input.preview;
  const acn = s(input.acn) || s(input.abn), caNum = s(input.ca_number), bn = s(input.bn);
  const siren = s(input.siren).replace(/\D/g, ""), siret = s(input.siret).replace(/\D/g, "");
  const orgnr = s(input.orgnr).replace(/\D/g, "");
  let cvr = s(input.cvr).replace(/[\s\-.]/g, "").toUpperCase();
  if (cvr.startsWith("DK")) cvr = cvr.slice(2);
  cvr = cvr.replace(/\D/g, "");
  let ytunnus = "";
  const rawFi = s(input.ytunnus) || s(input.businessId) || s(input.fi);
  if (rawFi) {
    try { ytunnus = normalizeYtunnus(rawFi); } catch (e: any) {
      if (e?.status === 400 || e?.name === "UserError" || /ytunnus|businessId|check digit/i.test(String(e?.message || e))) throw e;
      throw e;
    }
  }

  let uid = "";
  const rawCh = s(input.uid) || s(input.che) || s((input as any).ch);
  if (rawCh) {
    try { uid = normalizeUid(rawCh); } catch (e: any) {
      if (e?.status === 400 || e?.name === "UserError" || /uid|CHE|check digit/i.test(String(e?.message || e))) throw e;
      throw e;
    }
  }

  let krs = "";
  let nip = "";
  const rawKrs = s(input.krs) || s((input as any).pl);
  if (rawKrs) {
    try { krs = normalizeKrs(rawKrs); } catch (e: any) {
      if (e?.status === 400 || e?.name === "UserError" || /krs/i.test(String(e?.message || e))) throw e;
      throw e;
    }
  }
  const rawNip = s(input.nip);
  if (rawNip) {
    try { nip = normalizeNip(rawNip); } catch (e: any) {
      if (e?.status === 400 || e?.name === "UserError" || /nip/i.test(String(e?.message || e))) throw e;
      throw e;
    }
  }

  let ico = "";
  const rawCz = s(input.ico) || s((input as any).cz);
  if (rawCz) {
    try { ico = normalizeIco(rawCz); } catch (e: any) {
      if (e?.status === 400 || e?.name === "UserError" || /ico|IČO|check digit/i.test(String(e?.message || e))) throw e;
      throw e;
    }
  }

  let beNum = "";
  const rawBe = s((input as any).enterprise_number) || s((input as any).be) || s((input as any).bce) || s((input as any).kbo);
  if (rawBe) {
    try { beNum = normalizeEnterpriseNumber(rawBe); } catch (e: any) {
      if (e?.status === 400 || e?.name === "UserError" || /enterprise|check digit|Belgian/i.test(String(e?.message || e))) throw e;
      throw e;
    }
  }

  let skIco = "";
  const rawSk = s((input as any).sk) || s((input as any).ico_sk) || s((input as any).rpo);
  if (rawSk) {
    try { skIco = normalizeSkIco(rawSk); } catch (e: any) {
      if (e?.status === 400 || e?.name === "UserError" || /ico|IČO/i.test(String(e?.message || e))) throw e;
      throw e;
    }
  }
  let ieNum = "";
  const rawIe = s((input as any).ie);
  if (rawIe) {
    try { ieNum = normalizeIeNumber(rawIe); } catch (e: any) {
      if (e?.status === 400 || e?.name === "UserError") throw e;
      throw e;
    }
  }
  let eeCode = "";
  const rawEe = s((input as any).ee);
  if (rawEe) {
    try { eeCode = normalizeEeRegCode(rawEe); } catch (e: any) {
      if (e?.status === 400 || e?.name === "UserError") throw e;
      throw e;
    }
  }
  let lvNum = "";
  const rawLv = s((input as any).lv);
  if (rawLv) {
    try { lvNum = normalizeLvRegcode(rawLv); } catch (e: any) {
      if (e?.status === 400 || e?.name === "UserError") throw e;
      throw e;
    }
  }
  const usState = s((input as any).us_state).toUpperCase();
  const usId = s((input as any).us_id).replace(/[^\w-]/g, "");
  const usName = s((input as any).us_name);
  if (usState) parseUsStates(usState);
  if (usId && (!usState || usState.includes(",") || usState === "ALL")) throw new UserError("us_id needs us_state (one of NY, CO, CT, OR, TX)", 400);
  const usWanted = !!(usId || usName);
  const rawDomain = s(input.domain) || (s(input.name).includes(".") ? s(input.name) : "");
  const domain = domainish(rawDomain);
  const number = s(input.number);
  const name = !domain && s(input.name) && !s(input.name).includes(".") ? s(input.name) : "";
  const vat = s(input.vat) || (s(input.country) && s(input.vat_number) ? s(input.country) + s(input.vat_number) : "");
  const lei = s(input.lei).toUpperCase().replace(/[\s-]/g, "");

  if (!domain && !number && !name && !vat && !acn && !caNum && !bn && !lei && !siren && !siret && !orgnr && !cvr && !ytunnus && !uid && !krs && !nip && !ico && !beNum && !skIco && !ieNum && !eeCode && !lvNum && !usWanted) {
    throw new UserError("provide domain and/or UK company number/name, AU acn/abn, CA ca_number/bn, FR siren/siret, NO orgnr, DK cvr, FI ytunnus/businessId, CH uid, PL krs/nip, CZ ico, BE enterprise_number, SK sk/ico_sk/rpo, IE ie, EE ee, LV lv, US us_state+us_id or us_name, EU VAT and/or lei");
  }

  const out: any = {
    product: "kyb",
    price: "$2.50",
    disclaimer: "Screening over public registries and public sanctions lists only. Not a KYC/KYB/AML determination, credit score, or investment advice. Sanctions matches are scored candidates — never a certainty. Confirm identifiers at source before onboarding, contracting, or paying.",
    inputs: { domain: domain || null, number: number || null, name: name || null, vat: vat || null, acn: acn || null, ca_number: caNum || null, bn: bn || null, lei: lei || null, siren: siren || null, siret: siret || null, orgnr: orgnr || null, cvr: cvr || null, ytunnus: ytunnus || null, uid: uid || null, krs: krs || null, nip: nip || null, ico: ico || null, enterprise_number: beNum || null, sk: skIco || null, ie: ieNum || null, ee: eeCode || null, lv: lvNum || null, us_state: usState || null, us_id: usId || null, us_name: usName || null },
    au: null as any,
    ca: null as any,
    fr: null as any,
    no: null as any,
    dk: null as any,
    fi: null as any,
    ch: null as any,
    pl: null as any,
    cz: null as any,
    be: null as any,
    sk: null as any,
    ie: null as any,
    ee: null as any,
    lv: null as any,
    us: null as any,
    directors_appointments: null as any,
    website: null as any,
    uk: null as any,
    eu_vat: null as any,
    lei: null as any,
    trust: { flag: "INSUFFICIENT_DATA" as string, reasons: [] as string[], score: 0 },
    sources: {} as any,
  };

  const tasks: Promise<void>[] = [];

  if (domain) {
    tasks.push((async () => {
      try {
        out.website = await companyResearch({ domain });
        out.sources.website = out.website?.sources || true;
      } catch (e: any) {
        out.website = { error: String(e?.message || e) };
      }
    })());
  }

  if (number || name) {
    tasks.push((async () => {
      try {
        out.uk = await ukCompany(env, { number: number || undefined, name: name || undefined, lite: preview });
        out.sources.uk_companies_house = out.uk?.sources || true;
      } catch (e: any) {
        out.uk = { error: String(e?.message || e) };
      }
    })());
  } else if (domain && /\.uk$/i.test(domain)) {
    // best-effort: try company name from domain label
    const guess = domain.split(".")[0].replace(/-/g, " ");
    if (guess.length >= 3) {
      tasks.push((async () => {
        try {
          out.uk = await ukCompany(env, { name: guess, lite: preview });
          out.uk_guessed_from_domain = guess;
          out.sources.uk_companies_house = out.uk?.sources || true;
        } catch (e: any) {
          out.uk = { error: String(e?.message || e), note: "optional UK lookup from domain label failed" };
        }
      })());
    }
  }

  if (acn && reg.au) tasks.push((async () => { try { out.au = await reg.au!(/^\d{11}$/.test(acn.replace(/\s/g, "")) ? { abn: acn } : { acn }); out.sources.asic = true; } catch (e: any) { out.au = { error: String(e?.message || e) }; } })());
  if ((caNum || bn) && reg.ca) tasks.push((async () => { try { out.ca = await reg.ca!(caNum ? { number: caNum } : { bn }); if (out.ca?.matches) out.ca = out.ca.matches[0]; out.sources.corporations_canada = true; } catch (e: any) { out.ca = { error: String(e?.message || e) }; } })());
  if (siren || siret) tasks.push((async () => { try { out.fr = await frCompany({ siren: siren || undefined, siret: siret || undefined, lite: preview }); out.sources.fr_recherche_entreprises = true; } catch (e: any) { out.fr = { error: String(e?.message || e) }; } })());
  if (orgnr) tasks.push((async () => { try { out.no = await noCompany({ orgnr, lite: preview }); out.sources.no_brreg = true; } catch (e: any) { out.no = { error: String(e?.message || e) }; } })());
  if (cvr) tasks.push((async () => { try { out.dk = await dkCompany({ cvr, lite: preview }); out.sources.dk_cvr = true; } catch (e: any) { out.dk = { error: String(e?.message || e) }; } })());
  if (ytunnus) tasks.push((async () => { try { out.fi = await fiCompany({ ytunnus, lite: preview }); out.sources.fi_prh = true; } catch (e: any) { out.fi = { error: String(e?.message || e) }; } })());
  if (uid) tasks.push((async () => { try { out.ch = await chCompany({ uid, lite: preview }); out.sources.ch_zefix = true; } catch (e: any) { out.ch = { error: String(e?.message || e) }; } })());
  if (krs || nip) tasks.push((async () => { try { out.pl = await plCompany({ krs: krs || undefined, nip: nip || undefined, lite: preview }); out.sources.pl_krs = true; } catch (e: any) { out.pl = { error: String(e?.message || e) }; } })());
  if (ico) tasks.push((async () => { try { out.cz = await czCompany({ ico, lite: preview }); out.sources.cz_ares = true; } catch (e: any) { out.cz = { error: String(e?.message || e) }; } })());
  if (beNum) tasks.push((async () => { try { out.be = await beCompany({ enterprise_number: beNum, lite: preview }); out.sources.be_kbo = true; } catch (e: any) { out.be = { error: String(e?.message || e) }; } })());
  if (usWanted) tasks.push((async () => { try { const r: any = await usEntity({ state: usState || undefined, id: usId || undefined, name: usId ? undefined : usName, limit: 5, lite: preview }); out.us = { ...r.best_match, other_matches: (r.results || []).slice(1, 4).map((x: any) => ({ state: x.state, id: x.id, name: x.name, status: x.status })), red_flags: r.red_flags, per_state: preview ? undefined : r.per_state }; out.sources.us_state_sos = true; } catch (e: any) { out.us = { error: String(e?.message || e) }; } })());
  if (skIco) tasks.push((async () => { try { out.sk = await skCompany({ ico: skIco, lite: preview }); out.sources.sk_rpo = true; } catch (e: any) { out.sk = { error: String(e?.message || e) }; } })());
  if (ieNum) tasks.push((async () => { try { out.ie = await ieCompany({ number: ieNum, lite: preview }); out.sources.ie_cro = true; } catch (e: any) { out.ie = { error: String(e?.message || e) }; } })());
  if (eeCode) tasks.push((async () => { try { out.ee = await eeCompany({ registry_code: eeCode, lite: preview }); out.sources.ee_ariregister = true; } catch (e: any) { out.ee = { error: String(e?.message || e) }; } })());
  if (lvNum) tasks.push((async () => { try { out.lv = await lvCompany({ registration_number: lvNum, lite: preview }); out.sources.lv_ur = true; } catch (e: any) { out.lv = { error: String(e?.message || e) }; } })());
  if (vat) {
    tasks.push((async () => {
      try {
        out.eu_vat = await euVat(env, { vat });
        out.sources.eu_vies = true;
      } catch (e: any) {
        out.eu_vat = { error: String(e?.message || e) };
      }
    })());
  }
  if (lei) {
    tasks.push((async () => {
      try {
        out.lei = await leiLookup(env, { lei });
        out.sources.gleif = true;
      } catch (e: any) {
        // Soft-fail: GLEIF 404/errors must not fail whole KYB
        out.lei = { error: String(e?.message || e) };
      }
    })());
  }

  await Promise.all(tasks);

  // Sanctions screen (entity + directors) — soft-fail; does not change $2 price
  out.sanctions = null as any;
  try {
    const entityName =
      out.uk?.name ||
      out.uk?.profile?.name ||
      out.uk?.profile?.company_name ||
      out.uk?.overview?.company_name ||
      out.eu_vat?.name ||
      out.au?.name ||
      out.ca?.name ||
      out.fr?.name ||
      out.no?.name ||
      out.dk?.name ||
      out.fi?.name ||
      out.ch?.name ||
      out.pl?.name ||
      out.cz?.name ||
      out.be?.name ||
      out.sk?.name ||
      out.ie?.name ||
      out.ee?.name ||
      out.lv?.name ||
      out.us?.name ||
      name ||
      null;
    const officers = out.uk?.officers?.items || out.uk?.officers || [];
    const directors: string[] = [];
    if (Array.isArray(officers)) {
      for (const o of officers) {
        if (directors.length >= 3) break;
        const n = o?.name;
        if (!n) continue;
        const role = String(o?.officer_role || o?.role || "").toLowerCase();
        const resigned = !!(o?.resigned_on || o?.resignedOn);
        if (resigned) continue;
        if (!role || /director|member/.test(role)) directors.push(String(n));
      }
    }
    if (preview) {
      // Free preview must stay under Workers CPU limit: lite UK + entity-only sanctions, no officer appointment fan-out.
      out.sanctions = entityName
        ? await kybSanctionsScreen(env, { entityName, directors: [] }).catch((e: any) => ({ error: String(e?.message || e), skipped: true }))
        : { skipped: true, reason: "preview: no entity name yet" };
      out.directors_appointments = null;
      out.preview_omitted = ["director appointment skim", "director sanctions", "full UK officers/PSC/filings/charges"];
    } else {
      const dirs = directors.slice(0, 2); // paid: cap to 2 directors to stay under CPU on large PLCs
      const [sanc, appts] = await Promise.all([
        kybSanctionsScreen(env, { entityName, directors: dirs }),
        Promise.all(dirs.map(async (d) => { try { const r: any = await ukOfficerSearch(env as any, { name: d, limit: 1 }); const o = r?.officers?.[0]; return o ? { director: d, best_match: o.name, active_appointments: o.active_count, appointments_total: o.appointments_total, flags: o.flags || [], note: "best name match on CH officer search; confirm DOB" } : { director: d, found: false }; } catch (e: any) { return { director: d, error: String(e?.message || e) }; } })),
      ]);
      out.sanctions = sanc; out.directors_appointments = appts.length ? appts : null;
      if (directors.length > dirs.length) out.notes = [...(out.notes || []), `director skim capped at ${dirs.length} of ${directors.length} active directors (CPU)`];
    }
    out.sources.sanctions_lists = out.sanctions?.skipped ? false : true;
  } catch (e: any) {
    out.sanctions = { error: String(e?.message || e), disclaimer: "Screening aid only; not a regulated AML/KYC determination." };
  }

  // Composite trust heuristic (transparent, non-regulatory)
  let score = 0;
  const reasons: string[] = [];
  const ukStatus = String(out.uk?.status || out.uk?.profile?.status || out.uk?.company?.status || out.uk?.profile?.company_status || out.uk?.overview?.status || "").toLowerCase();
  const flags: any[] = out.uk?.red_flags || [];
  const high = flags.filter((f: any) => f.severity === "high").length;
  // Outstanding charges (secured lending) are normal for established companies: count as a minor -3, not a medium red flag.
  const isCharge = (f: any) => /charge/i.test(String(f.code || f.id || f.name || f.flag || ""));
  const charges = flags.filter((f: any) => f.severity === "medium" && isCharge(f)).length;
  const medium = flags.filter((f: any) => f.severity === "medium" && !isCharge(f)).length;

  if (out.uk && !out.uk.error) {
    if (ukStatus === "active") { score += 40; reasons.push("UK company status active"); }
    else if (ukStatus) { score -= 30; reasons.push(`UK company status: ${ukStatus}`); }
    if (high) { score -= 25 * high; reasons.push(`${high} high-severity UK red flag(s)`); }
    if (charges) { score -= 3; reasons.push("outstanding registered charges (secured lending; common for established companies)"); }
    if (medium) { score -= 10 * medium; reasons.push(`${medium} medium-severity UK red flag(s)`); }
    if (out.uk.mass_formation_office?.matched || out.uk.overview?.mass_formation_office?.matched) {
      score -= 15; reasons.push("registered office matches common formation-agent / virtual-office pattern");
    }
  }
  for (const [k, lbl] of [["au", "AU ASIC"], ["ca", "CA Corporations Canada"]] as const) {
    const r = out[k]; if (!r || r.error) continue;
    const st = String(r.status || "").toUpperCase();
    if (st === "REGD" || st === "ACTIVE") { score += 40; reasons.push(`${lbl} status ${st.toLowerCase()}`); }
    else if (st) { score -= 30; reasons.push(`${lbl} status: ${r.status_desc || r.status_detail || st}`); }
    if (r.status_detail && /dissolution/i.test(r.status_detail)) { score -= 20; reasons.push(`${lbl}: ${r.status_detail}`); }
  }
  if (out.fr && !out.fr.error) {
    const st = String(out.fr.status || "").toUpperCase();
    if (st === "A" || out.fr.status_label === "active") { score += 40; reasons.push("FR company status active"); }
    else if (st) { score -= 30; reasons.push(`FR company status: ${out.fr.status_label || st}`); }
    const frHigh = (out.fr.red_flags || []).filter((f: any) => f.severity === "high").length;
    if (frHigh) { score -= 25 * frHigh; reasons.push(`${frHigh} high-severity FR red flag(s)`); }
  }
  if (out.no && !out.no.error) {
    const st = String(out.no.status || "").toLowerCase();
    if (st === "active") { score += 40; reasons.push("NO Brreg status active"); }
    else if (st) { score -= 30; reasons.push(`NO Brreg status: ${st}`); }
    const noHigh = (out.no.red_flags || []).filter((f: any) => f.severity === "high").length;
    if (noHigh) { score -= 25 * noHigh; reasons.push(`${noHigh} high-severity NO red flag(s)`); }
  }
  if (out.dk && !out.dk.error) {
    const st = String(out.dk.status || "");
    if (/^NORMAL$/i.test(st) || /^Aktiv$/i.test(st)) { score += 40; reasons.push("DK CVR status " + st); }
    else if (st) { score -= 30; reasons.push(`DK CVR status: ${st}`); }
    const dkHigh = (out.dk.red_flags || []).filter((f: any) => f.severity === "high").length;
    if (dkHigh) { score -= 25 * dkHigh; reasons.push(`${dkHigh} high-severity DK red flag(s)`); }
  }
  if (out.fi && !out.fi.error) {
    const st = String(out.fi.status || "").toLowerCase();
    if (st === "registered") { score += 40; reasons.push("FI PRH status registered"); }
    else if (st) { score -= 30; reasons.push(`FI PRH status: ${st}`); }
    const fiHigh = (out.fi.red_flags || []).filter((f: any) => f.severity === "high").length;
    if (fiHigh) { score -= 25 * fiHigh; reasons.push(`${fiHigh} high-severity FI red flag(s)`); }
  }
  if (out.ch && !out.ch.error) {
    const st = String(out.ch.status || "").toLowerCase();
    if (st === "existing") { score += 40; reasons.push("CH Zefix status existing"); }
    else if (st) { score -= 30; reasons.push(`CH Zefix status: ${st}`); }
    const chHigh = (out.ch.red_flags || []).filter((f: any) => f.severity === "high").length;
    if (chHigh) { score -= 25 * chHigh; reasons.push(`${chHigh} high-severity CH red flag(s)`); }
  }
  if (out.pl && !out.pl.error) {
    const st = String(out.pl.status_hint || "").toLowerCase();
    if (st === "current_extract") { score += 40; reasons.push("PL KRS current extract found"); }
    else if (out.pl.name) { score += 30; reasons.push("PL KRS extract returned"); }
    const plHigh = (out.pl.red_flags || []).filter((f: any) => f.severity === "high").length;
    if (plHigh) { score -= 25 * plHigh; reasons.push(`${plHigh} high-severity PL red flag(s)`); }
  }
  if (out.cz && !out.cz.error) {
    const st = String(out.cz.status || "").toLowerCase();
    if (st === "active") { score += 40; reasons.push("CZ ARES status active"); }
    else if (st) { score -= 30; reasons.push(`CZ ARES status: ${st}`); }
    const czHigh = (out.cz.red_flags || []).filter((f: any) => f.severity === "high").length;
    if (czHigh) { score -= 25 * czHigh; reasons.push(`${czHigh} high-severity CZ red flag(s)`); }
  }
  if (out.be && !out.be.error) {
    const st = String(out.be.status || "").toLowerCase();
    if (st === "active") { score += 40; reasons.push("BE CBE/KBO status active"); }
    else if (st) { score -= 30; reasons.push(`BE CBE/KBO status: ${st}`); }
    const beHigh = (out.be.red_flags || []).filter((f: any) => f.severity === "high").length;
    if (beHigh) { score -= 25 * beHigh; reasons.push(`${beHigh} high-severity BE red flag(s)`); }
  }
  if (out.sk && !out.sk.error) {
    const st = String(out.sk.status || "").toLowerCase();
    if (st === "active") { score += 40; reasons.push("SK RPO status active"); }
    else if (st) { score -= 30; reasons.push(`SK RPO status: ${st}`); }
    const skHigh = (out.sk.red_flags || []).filter((f: any) => f.severity === "high").length;
    if (skHigh) { score -= 25 * skHigh; reasons.push(`${skHigh} high-severity SK red flag(s)`); }
  }
  if (out.ie && !out.ie.error) {
    const st = String(out.ie.status || "").toLowerCase();
    if (/normal/i.test(st)) { score += 40; reasons.push("IE CRO status normal"); }
    else if (st) { score -= 30; reasons.push(`IE CRO status: ${st}`); }
    const ieHigh = (out.ie.red_flags || []).filter((f: any) => f.severity === "high").length;
    if (ieHigh) { score -= 25 * ieHigh; reasons.push(`${ieHigh} high-severity IE red flag(s)`); }
  }
  if (out.ee && !out.ee.error) {
    const st = String(out.ee.status || "").toLowerCase();
    if (st === "registered" || String(out.ee.status_code || "").toUpperCase() === "R") { score += 40; reasons.push("EE äriregister status registered"); }
    else if (st) { score -= 30; reasons.push(`EE äriregister status: ${st}`); }
    const eeHigh = (out.ee.red_flags || []).filter((f: any) => f.severity === "high").length;
    if (eeHigh) { score -= 25 * eeHigh; reasons.push(`${eeHigh} high-severity EE red flag(s)`); }
  }
  if (out.lv && !out.lv.error) {
    const st = String(out.lv.status || "").toLowerCase();
    if (st === "active") { score += 40; reasons.push("LV Register of Enterprises status active"); }
    else if (st) { score -= 30; reasons.push(`LV Register of Enterprises status: ${st}`); }
    const lvHigh = (out.lv.red_flags || []).filter((f: any) => f.severity === "high").length;
    if (lvHigh) { score -= 25 * lvHigh; reasons.push(`${lvHigh} high-severity LV red flag(s)`); }
  }
  if (out.us && !out.us.error) {
    const st = String(out.us.status || "").toLowerCase();
    if (/active|good standing/.test(st)) { score += 40; reasons.push(`US ${out.us.state} state registry status: ${out.us.status}`); }
    else if (st) { score -= 30; reasons.push(`US ${out.us.state} state registry status: ${out.us.status}`); }
    if ((out.us.red_flags || []).some((f: string) => /formed < 6 months/.test(f))) { score -= 10; reasons.push("US entity formed < 6 months ago"); }
  }
  for (const d of out.directors_appointments || []) if ((d.active_appointments || 0) >= 20) { score -= 10; reasons.push(`director ${d.director} has ${d.active_appointments} active appointments (nominee/formation pattern?)`); }
  if (out.eu_vat && !out.eu_vat.error) {
    if (out.eu_vat.valid === true || out.eu_vat.isValid === true) { score += 30; reasons.push("EU VIES VAT valid"); }
    else if (out.eu_vat.valid === false || out.eu_vat.isValid === false) { score -= 20; reasons.push("EU VIES VAT not valid"); }
  }
  if (out.website && !out.website.error) {
    score += 15; reasons.push("website research completed");
    const issues = out.website?.dns?.issues || out.website?.issues || [];
    if (Array.isArray(issues) && issues.length >= 3) { score -= 5; reasons.push("website has multiple DNS/email issues"); }
  }
  if (out.sanctions && !out.sanctions.error && !out.sanctions.skipped && out.sanctions.possible_match) {
    const hs = Number(out.sanctions.highest_score || 0);
    if (hs >= 0.92) { score -= 35; reasons.push(`possible sanctions match (score ${hs}) — review required`); }
    else if (hs >= 0.8) { score -= 15; reasons.push(`possible sanctions match (score ${hs})`); }
  }

  score = Math.max(0, Math.min(100, score));
  let flag = "INSUFFICIENT_DATA";
  if (out.lei && !out.lei.error && out.lei.lei) { score += 20; reasons.push("GLEIF LEI resolved" + (out.lei.parents?.ultimate?.lei ? " (ultimate parent present)" : out.lei.parents?.direct?.lei ? " (direct parent present)" : "")); }
  const have = [out.uk && !out.uk.error, out.au && !out.au.error, out.ca && !out.ca.error, out.fr && !out.fr.error, out.no && !out.no.error, out.dk && !out.dk.error, out.fi && !out.fi.error, out.ch && !out.ch.error, out.pl && !out.pl.error, out.cz && !out.cz.error, out.be && !out.be.error, out.sk && !out.sk.error, out.ie && !out.ie.error, out.ee && !out.ee.error, out.lv && !out.lv.error, out.us && !out.us.error, out.eu_vat && !out.eu_vat.error, out.website && !out.website.error, out.lei && !out.lei.error].filter(Boolean).length;
  if (have === 0) flag = "INSUFFICIENT_DATA";
  else if (high > 0 || score < 30) flag = "REVIEW";
  else if (score < 55 || medium >= 2) flag = "CAUTION";
  else flag = "CLEAR";

  out.trust = { flag, score, reasons, checks_completed: have };
  out.upsell = {
    deeper_uk: { path: "/uk-company", price: "$0.50" },
    monitor: { path: "/uk-watch", price: "$5.00/30d", why: "webhook when officers/status/filings change" },
    leads: { path: "/uk-leads", price: "$1.00", why: "new incorporations by SIC/area with directors" },
    sanctions: { path: "/sanctions", price: "$0.05", why: "screen any extra names (OFAC/UK/UN/EU)" },
  };
  return out;
}
