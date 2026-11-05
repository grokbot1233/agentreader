import { UserError } from "./core";

const BASE = "https://api.charitycommission.gov.uk/register/api";
const UA = "AxiomWorksAgentReader/1.6 (+https://api.axiomworks.co.uk; info@axiomworks.co.uk)";
const CACHE_TTL = 86400; // 24h
const CACHE_PREFIX = "cc:v1:";
const LICENCE =
  "Contains public sector information licensed under the Open Government Licence v3.0 (Charity Commission for England and Wales)";

type EnvKV = { LOG: KVNamespace; CHARITY_KEY?: string };

const REG_STATUS: Record<string, string> = {
  R: "Registered",
  RM: "Removed",
};

function s(v: any) {
  return v == null ? "" : String(v).trim();
}

export function normalizeCharityNumber(n: string): { number: string; suffix: number } {
  const raw = n.trim().toUpperCase().replace(/\s+/g, "");
  // Accept 1089464, 1089464-0, 1089464/0
  const m = raw.match(/^(\d{5,8})(?:[-\/](\d{1,2}))?$/);
  if (!m) throw new UserError("number must be a Charity Commission registered number, e.g. 1089464 or 1089464/0");
  return { number: m[1], suffix: m[2] ? Number(m[2]) : 0 };
}

async function ccGet(env: EnvKV, path: string): Promise<{ ok: true; status: number; data: any } | { ok: false; status: number; error: string }> {
  const key = (env.CHARITY_KEY || "").trim();
  if (!key) return { ok: false, status: 0, error: "CHARITY_KEY not configured" };
  const url = `${BASE}/${path.replace(/^\//, "")}`;
  try {
    const r = await fetch(url, {
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        accept: "application/json",
        "user-agent": UA,
      },
      signal: AbortSignal.timeout(12000),
    });
    if (r.status === 404) return { ok: false, status: 404, error: "not found" };
    if (r.status === 429) return { ok: false, status: 429, error: "rate limited" };
    if (!r.ok) return { ok: false, status: r.status, error: `http ${r.status}` };
    const text = await r.text();
    if (!text || text === "null") return { ok: false, status: 404, error: "not found" };
    return { ok: true, status: r.status, data: JSON.parse(text) };
  } catch (e: any) {
    return { ok: false, status: 0, error: String(e?.message || e) };
  }
}

async function kvGet(env: EnvKV, k: string) {
  try {
    return await env.LOG.get(k, "json");
  } catch {
    return null;
  }
}
async function kvPut(env: EnvKV, k: string, v: any, ttl = CACHE_TTL) {
  try {
    await env.LOG.put(k, JSON.stringify(v), { expirationTtl: ttl });
  } catch {}
}

async function cachedCc(env: EnvKV, path: string): Promise<
  | { ok: true; status: number; data: any; cache: "HIT" | "MISS" }
  | { ok: false; status: number; error: string; cache?: "HIT" | "MISS" }
> {
  const ck = `${CACHE_PREFIX}${path}`;
  const hit = await kvGet(env, ck);
  if (hit != null) return { ok: true, status: 200, data: hit, cache: "HIT" };
  const r = await ccGet(env, path);
  if (!r.ok) return r;
  await kvPut(env, ck, r.data);
  return { ok: true, status: r.status, data: r.data, cache: "MISS" };
}

function addrOf(d: any): string | null {
  const parts = [d.address_line_one, d.address_line_two, d.address_line_three, d.address_line_four, d.address_line_five, d.address_post_code].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function classify(www: any[] | null | undefined) {
  const list = Array.isArray(www) ? www : [];
  const by = (t: string) => list.filter((x) => (x.classification_type || "").toLowerCase() === t.toLowerCase()).map((x) => x.classification_desc).filter(Boolean);
  return { what: by("What"), who: by("Who"), how: by("How") };
}

function statusLabel(code: string | null | undefined) {
  if (!code) return null;
  return REG_STATUS[code] || code;
}

function redFlags(input: {
  reg_status?: string | null;
  insolvent?: boolean;
  in_administration?: boolean;
  interim_manager_ind?: boolean;
  cio_dissolution_ind?: boolean;
  removal_reason?: string | null;
  reporting_status?: string | null;
  financial_history?: any[];
  regulatory?: any[];
  latest_income?: number | null;
}): { flag: string; reason: string; severity: "high" | "medium" | "low" }[] {
  const flags: { flag: string; reason: string; severity: "high" | "medium" | "low" }[] = [];
  const st = (input.reg_status || "").toUpperCase();
  if (st === "RM" || /removed/i.test(statusLabel(st) || ""))
    flags.push({ flag: "removed", reason: `Charity status is Removed${input.removal_reason ? ` (${input.removal_reason})` : ""}`, severity: "high" });
  if (input.insolvent) flags.push({ flag: "insolvent", reason: "Charity flagged insolvent on the register", severity: "high" });
  if (input.in_administration) flags.push({ flag: "in_administration", reason: "Charity in administration", severity: "high" });
  if (input.interim_manager_ind) flags.push({ flag: "interim_manager", reason: "Interim manager appointed", severity: "high" });
  if (input.cio_dissolution_ind) flags.push({ flag: "cio_dissolution", reason: "CIO dissolution indicator set", severity: "high" });
  const rep = (input.reporting_status || "").toLowerCase();
  if (/overdue|late|default|failure|not received|outstanding/i.test(rep))
    flags.push({ flag: "late_accounts", reason: `Reporting status: ${input.reporting_status}`, severity: "high" });
  const hist = input.financial_history || [];
  if (hist.length >= 2) {
    const sorted = [...hist].filter((h) => h.income != null).sort((a, b) => String(a.financial_period_end_date).localeCompare(String(b.financial_period_end_date)));
    if (sorted.length >= 2) {
      const prev = Number(sorted[sorted.length - 2].income);
      const last = Number(sorted[sorted.length - 1].income);
      if (prev > 0 && last / prev <= 0.5)
        flags.push({ flag: "income_collapse", reason: `Latest income ${last} is ≤50% of prior period ${prev}`, severity: "medium" });
    }
  } else if (input.latest_income === 0)
    flags.push({ flag: "zero_income", reason: "Latest income reported as 0", severity: "low" });
  const regs = input.regulatory || [];
  if (Array.isArray(regs) && regs.length)
    flags.push({ flag: "regulatory_alerts", reason: `${regs.length} regulatory report item(s) on record`, severity: "high" });
  return flags;
}

async function searchByName(env: EnvKV, name: string) {
  const q = encodeURIComponent(name.trim());
  const r = await cachedCc(env, `searchCharityName/${q}`);
  if (!r.ok) {
    if (r.status === 404) return { hits: [] as any[], source: `${BASE}/searchCharityName/...`, cache: r.cache };
    throw new UserError(r.error || "charity name search failed", r.status || 502);
  }
  const hits = (Array.isArray(r.data) ? r.data : []).map((h: any) => ({
    registered_number: h.reg_charity_number,
    suffix: h.group_subsid_suffix ?? 0,
    organisation_number: h.organisation_number,
    name: h.charity_name,
    status: statusLabel(h.reg_status),
    reg_status: h.reg_status,
    date_of_registration: h.date_of_registration || null,
    date_of_removal: h.date_of_removal || null,
  }));
  return { hits, source: `${BASE}/searchCharityName/...`, cache: r.cache };
}

async function resolveCharity(env: EnvKV, opts: { number?: string; name?: string; suffix?: string | number }) {
  let number = s(opts.number);
  let suffix = opts.suffix != null && opts.suffix !== "" ? Number(opts.suffix) : 0;
  let search: any = null;
  if (!number) {
    if (!s(opts.name)) throw new UserError("missing number or name");
    if (s(opts.name).length < 2) throw new UserError("name too short");
    search = await searchByName(env, s(opts.name));
    if (!search.hits.length) throw new UserError(`no Charity Commission matches for '${s(opts.name)}'`, 404);
    const q = s(opts.name).toLowerCase();
    const exact = search.hits.find((h: any) => (h.name || "").toLowerCase() === q);
    const active = search.hits.find((h: any) => h.reg_status === "R");
    const pick = exact || active || search.hits[0];
    number = String(pick.registered_number);
    suffix = Number(pick.suffix ?? 0);
  } else {
    const n = normalizeCharityNumber(number);
    number = n.number;
    if (opts.suffix == null || opts.suffix === "") suffix = n.suffix;
  }
  if (!/^\d{5,8}$/.test(number)) throw new UserError("number must be a Charity Commission registered number, e.g. 1089464");
  if (!Number.isFinite(suffix) || suffix < 0 || suffix > 99) throw new UserError("suffix must be 0-99");
  return { number, suffix, search };
}

function coreFromDetails(d: any, overview: any | null) {
  const trustees = Array.isArray(d.trustee_names) ? d.trustee_names : [];
  const activities =
    overview?.activities ||
    classify(d.who_what_where).what.join("; ") ||
    null;
  return {
    registered_number: d.reg_charity_number,
    suffix: d.group_subsid_suffix ?? 0,
    organisation_number: d.organisation_number,
    name: d.charity_name,
    charity_type: d.charity_type || null,
    status: statusLabel(d.reg_status),
    reg_status: d.reg_status || null,
    date_of_registration: d.date_of_registration || null,
    date_of_removal: d.date_of_removal || null,
    removal_reason: d.removal_reason || null,
    companies_house_number: d.charity_co_reg_number || null,
    income: d.latest_income ?? null,
    spending: d.latest_expenditure ?? null,
    financial_year_end: d.latest_acc_fin_year_end_date || null,
    reporting_status: d.reporting_status || null,
    trustees_count: overview?.trustees ?? trustees.length,
    employees: overview?.employees ?? null,
    volunteers: overview?.volunteers ?? null,
    contact: {
      address: addrOf(d),
      phone: d.phone || null,
      email: d.email || null,
      website: d.web || null,
    },
    activities,
    classifications: classify(d.who_what_where),
    insolvent: !!d.insolvent,
    in_administration: !!d.in_administration,
    interim_manager: !!d.interim_manager_ind,
  };
}

export async function ukCharity(
  env: EnvKV,
  opts: { number?: string; name?: string; suffix?: string | number; full?: boolean },
) {
  const { number, suffix, search } = await resolveCharity(env, opts);
  const packKey = `${CACHE_PREFIX}pack:${opts.full ? "full" : "lite"}:${number}/${suffix}`;
  const cached = await kvGet(env, packKey);
  if (cached) {
    const rn = (cached as any).registered_number;
    if (String(rn) === String(number) && Number((cached as any).suffix ?? 0) === Number(suffix)) {
      return { ...(cached as any), queried_at: new Date().toISOString(), cache: "HIT", search: search || (cached as any).search };
    }
  }

  const detailsR = await cachedCc(env, `allcharitydetails/${number}/${suffix}`);
  if (!detailsR.ok) {
    if (detailsR.status === 404) throw new UserError(`charity ${number}/${suffix} not found`, 404);
    throw new UserError(detailsR.error || "charity lookup failed", detailsR.status || 502);
  }
  const d = detailsR.data;

  // Overview gives activities text + trustee/employee counts (cheap enrich for both tiers)
  const overviewR = await cachedCc(env, `charityoverview/${number}/${suffix}`);
  const overview = overviewR.ok ? overviewR.data : null;

  const core = coreFromDetails(d, overview);

  if (!opts.full) {
    const lite = {
      queried_at: new Date().toISOString(),
      bundle: "uk-charity",
      price: "$0.05",
      ...core,
      // lite: no trustee names
      search,
      cache: detailsR.cache,
      source: LICENCE,
      licence: "OGL v3.0",
      registry_url: `https://register-of-charities.charitycommission.gov.uk/charity-search/-/charity-details/${number}`,
      upsell: "/uk-charity-full for trustees, 5y finances, assets, governance, areas, linked charities, red-flag summary ($0.25)",
    };
    await kvPut(env, packKey, { ...lite, search: undefined, cache: undefined });
    return lite;
  }

  const paths = [
    `charitytrusteenames/${number}/${suffix}`,
    `charityfinancialhistory/${number}/${suffix}`,
    `charityassetsliabilities/${number}/${suffix}`,
    `charitygovernanceinformation/${number}/${suffix}`,
    `charityareaofoperation/${number}/${suffix}`,
    `charityregulatoryreport/${number}/${suffix}`,
    `charityothernames/${number}/${suffix}`,
    `linkedcharities/${number}/${suffix}`,
    `charitycontactinformation/${number}/${suffix}`,
  ];
  const settled = await Promise.all(paths.map((p) => cachedCc(env, p)));
  const take = (i: number) => {
    const r = settled[i];
    return r.ok ? r.data : null;
  };

  const trusteesRaw = take(0) || d.trustee_names || [];
  const financial = Array.isArray(take(1)) ? take(1) : [];
  const assets = Array.isArray(take(2)) ? take(2) : take(2);
  const governance = take(3);
  const areas = take(4) || [];
  const regulatory = Array.isArray(take(5)) ? take(5) : [];
  const otherNames = take(6) || d.other_names || [];
  const linked = take(7) || [];
  const contactInfo = take(8);

  const flags = redFlags({
    reg_status: d.reg_status,
    insolvent: d.insolvent,
    in_administration: d.in_administration,
    interim_manager_ind: d.interim_manager_ind,
    cio_dissolution_ind: d.cio_dissolution_ind,
    removal_reason: d.removal_reason,
    reporting_status: d.reporting_status,
    financial_history: financial,
    regulatory,
    latest_income: d.latest_income,
  });

  const full = {
    queried_at: new Date().toISOString(),
    bundle: "uk-charity-full",
    price: "$0.25",
    ...core,
    trustees: (Array.isArray(trusteesRaw) ? trusteesRaw : []).map((t: any) => ({
      name: t.trustee_name || t.name || null,
    })),
    financial_history: (financial || []).map((h: any) => ({
      period_end: h.financial_period_end_date || null,
      cycle: h.ar_cycle_reference || null,
      income: h.income ?? null,
      expenditure: h.expenditure ?? null,
      income_from_government: h.income_from_govt ?? h.income_from_government ?? null,
      consolidated: h.consolidated_account ?? null,
    })),
    assets_liabilities: assets,
    governance: governance || {
      charity_type: d.charity_type,
      companies_house_number: d.charity_co_reg_number,
    },
    areas_of_operation: areas,
    areas_detail: {
      countries: d.CharityAoOCountryContinent || [],
      regions: d.CharityAoORegion || [],
      local_authorities: d.CharityAoOLocalAuthority || [],
    },
    regulatory_reports: regulatory,
    other_names: otherNames,
    linked_charities: linked,
    contact_detail: contactInfo || core.contact,
    overview: overview
      ? {
          activities: overview.activities || null,
          income_breakdown: {
            donations_legacies: overview.inc_donations_legacies ?? null,
            trading: overview.inc_other_trading_activities ?? null,
            investments: overview.inc_investments ?? null,
            charitable_activities: overview.inc_charitable_activities ?? null,
            other: overview.inc_other ?? null,
          },
          expenditure_breakdown: {
            raising_funds: overview.exp_raising_funds ?? null,
            charitable_activities: overview.exp_charitable_activities ?? null,
            other: overview.exp_other ?? null,
          },
          grant_making_main_activity: overview.grant_making_main_activity ?? null,
          trading_subsidiary: overview.trading_subsidiary ?? null,
        }
      : null,
    red_flags: flags,
    red_flag_count: flags.length,
    search,
    cache: detailsR.cache,
    source: LICENCE,
    licence: "OGL v3.0",
    registry_url: `https://register-of-charities.charitycommission.gov.uk/charity-search/-/charity-details/${number}`,
  };
  await kvPut(env, packKey, { ...full, search: undefined, cache: undefined });
  return full;
}
