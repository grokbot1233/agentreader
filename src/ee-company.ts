import { UserError } from "./core";

const API = "https://ariregister.rik.ee/est/api/autocomplete";
const TIMEOUT_MS = 7000;
const UA = "AgentReader/1.43 (+https://api.axiomworks.co.uk; Estonian company research via äriregister autocomplete)";
const DISCLAIMER =
  "Estonian company profile from the official äriregister autocomplete API (RIK). Screening aid only — not a KYB/AML determination, credit score, or legal advice. Confirm identifiers at ariregister.rik.ee before onboarding, contracting, or paying. Autocomplete is free and requires no username, password or contract (RIK documentation). Full XML extract services separately require an agreement and are not used here.";

export function normalizeEeRegCode(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(d)) throw new UserError("registry code must be 8 digits (e.g. 10060701)", 400);
  return d;
}

function statusText(code: string): string {
  const c = String(code || "").trim().toUpperCase();
  if (c === "R") return "registered";
  if (c === "N") return "deleted";
  if (c === "L") return "liquidated";
  if (c === "K") return "in bankruptcy";
  return c || "unknown";
}

function redFlags(hit: any): { code: string; severity: string; detail: string }[] {
  const flags: { code: string; severity: string; detail: string }[] = [];
  const st = String(hit.status || "").trim().toUpperCase();
  if (st && st !== "R") flags.push({ code: "status", severity: "high", detail: `Äriregister status ${st} (${statusText(st)})` });
  return flags;
}

function shape(hit: any) {
  const code = hit.reg_code != null ? String(hit.reg_code) : null;
  return {
    registry_code: code,
    name: hit.name || null,
    status: statusText(hit.status),
    status_code: hit.status || null,
    legal_form: hit.legal_form != null ? String(hit.legal_form) : null,
    address: hit.legal_address || null,
    zip_code: hit.zip_code || null,
    historical_names: Array.isArray(hit.historical_names) ? hit.historical_names : [],
    register_url: hit.url || (code ? `https://ariregister.rik.ee/est/company/${code}` : null),
    red_flags: redFlags(hit),
  };
}

async function autocomplete(q: string) {
  const url = `${API}?${new URLSearchParams({ q })}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`äriregister autocomplete HTTP ${r.status}`);
    const j: any = await r.json();
    if (j?.status && String(j.status).toUpperCase() !== "OK") throw new Error(j?.message || "äriregister autocomplete failed");
    const data = Array.isArray(j?.data) ? j.data : [];
    return { data, url };
  } finally {
    clearTimeout(t);
  }
}

const UPSELL = {
  kyb: { path: "/kyb", price: "$2.50", why: "attach an Estonian registry code into one-shot KYB with VAT + LEI + sanctions" },
  registry_batch: { path: "/registry-batch", price: "$0.30", why: "batch Estonian registry codes with UK/EU/US-state ids (ee=)" },
  eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate Estonian VAT via VIES" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity name" },
};

/** Estonian company lookup via official äriregister autocomplete — free, no contract. Exact reg_code match for ID lookups. */
export async function eeCompany(input: {
  registry_code?: string;
  reg_code?: string;
  ee?: string;
  number?: string;
  name?: string;
  q?: string;
  lite?: boolean;
  preview?: boolean;
  limit?: number;
}) {
  const rawCode = String(input.registry_code || input.reg_code || input.ee || input.number || "").trim();
  const name = String(input.name || input.q || "").trim();
  const limit = Math.min(Math.max(Number(input.limit) || (rawCode ? 1 : 5), 1), 10);

  try {
    if (rawCode) {
      const code = normalizeEeRegCode(rawCode);
      const { data, url } = await autocomplete(code);
      const hit = data.find((x: any) => String(x.reg_code) === code);
      if (!hit) throw new UserError(`no Estonian company found for registry_code=${code}`, 404);
      return {
        product: "ee-company",
        price: "$0.25",
        disclaimer: DISCLAIMER,
        query: { mode: "registry_code", registry_code: code },
        ...shape(hit),
        source: "Äriregister autocomplete (Registrite ja Infosüsteemide Keskus)",
        source_url: "https://ariregister.rik.ee/",
        search_url: url,
        license: "Official public autocomplete (no contract); full XML extracts require a separate RIK agreement and are not used",
        attribution: "Contains public äriregister autocomplete data from RIK. Confirm at ariregister.rik.ee before acting.",
        upsell: UPSELL,
      };
    }
    if (!name || name.length < 2) throw new UserError("provide registry_code (8 digits, e.g. 10060701) or name", 400);
    const { data, url } = await autocomplete(name);
    if (!data.length) throw new UserError(`no Estonian company found for name=${name}`, 404);
    const q = name.toLowerCase();
    const scored = data.map((hit: any) => {
      const n = String(hit.name || "").toLowerCase();
      const hist = (hit.historical_names || []).map((x: any) => String(x).toLowerCase());
      let score = n === q ? 100 : n.startsWith(q) ? 80 : n.includes(q) ? 50 : hist.some((h: string) => h.includes(q)) ? 40 : 10;
      if (String(hit.status || "").toUpperCase() === "R") score += 8;
      return { hit, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const chosen = scored[0].hit;
    return {
      product: "ee-company",
      price: "$0.25",
      disclaimer: DISCLAIMER,
      query: { mode: "name", q: name },
      total_results: data.length,
      ...shape(chosen),
      matches: data.length > 1 ? scored.slice(0, limit).map((x) => ({ registry_code: String(x.hit.reg_code), name: x.hit.name, status: statusText(x.hit.status), address: x.hit.legal_address || null })) : undefined,
      source: "Äriregister autocomplete (Registrite ja Infosüsteemide Keskus)",
      source_url: "https://ariregister.rik.ee/",
      search_url: url,
      license: "Official public autocomplete (no contract); full XML extracts require a separate RIK agreement and are not used",
      attribution: "Contains public äriregister autocomplete data from RIK. Confirm at ariregister.rik.ee before acting.",
      upsell: UPSELL,
    };
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    if (e?.name === "TimeoutError" || e?.name === "AbortError" || /timeout|aborted/i.test(String(e?.message || ""))) {
      throw new UserError(`Äriregister autocomplete not responding within ${TIMEOUT_MS / 1000}s — retry shortly; confirm at ariregister.rik.ee`, 504);
    }
    throw new Error(`Estonian company lookup failed: ${e?.message || e}`);
  }
}

export function eeCompanySlim(d: any) {
  return {
    registry_code: d.registry_code,
    name: d.name,
    status: d.status,
    address: d.address || null,
    legal_form: d.legal_form || null,
    red_flags: (d.red_flags || []).slice(0, 2),
    omitted: ["historical_names", "matches", "register_url"],
  };
}
