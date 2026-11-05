import { UserError } from "./core";

const CH_API = "https://api.company-information.service.gov.uk";
const CH_WEB = "https://find-and-update.company-information.service.gov.uk";
const UA = "AgentReader/1.12 (+https://api.axiomworks.co.uk; UK officer search)";
const CACHE_PREFIX = "ukoff:v1:";
const MAX_APPTS_PER_OFFICER = 20;

/** Known UK mass-formation / virtual-office address fingerprints (lowercase substrings). */
const MASS_AGENT_PATTERNS: { pattern: string; label: string }[] = [
  { pattern: "71-75 shelton street", label: "Shelton Street / Covent Garden (common formation agent)" },
  { pattern: "167-169 great portland street", label: "Great Portland Street (common virtual office)" },
  { pattern: "20-22 wenlock road", label: "Wenlock Road (common formation agent)" },
  { pattern: "86-90 paul street", label: "Paul Street (common virtual office)" },
  { pattern: "124 city road", label: "124 City Road (common formation agent address)" },
  { pattern: "kemp house", label: "Kemp House City Road (common formation agent)" },
  { pattern: "international house, 12 constance street", label: "Constance Street International House" },
  { pattern: "unit 3, vista place", label: "Vista Place Coy Pond (common formation agent)" },
  { pattern: "coy pond business park", label: "Coy Pond Business Park (common formation agent)" },
];

const HIGH_APPOINTMENT_THRESHOLDS = [
  { min: 100, flag: "extreme_appointment_count", severity: "high" as const, reason: (n: number) => `${n} appointments - typical of formation agents / nominee directors` },
  { min: 50, flag: "high_appointment_count", severity: "medium" as const, reason: (n: number) => `${n} appointments - elevated; often professional / formation-agent profiles` },
  { min: 25, flag: "elevated_appointment_count", severity: "low" as const, reason: (n: number) => `${n} appointments - above typical personal director load` },
];

type EnvKV = { LOG: KVNamespace; CH_API_KEY?: string };

function basicAuth(key: string) {
  return "Basic " + btoa(`${key}:`);
}

function addrString(a: any): string {
  if (!a) return "";
  if (typeof a === "string") return a;
  return [a.premises, a.address_line_1, a.address_line_2, a.locality, a.region, a.postal_code, a.country].filter(Boolean).join(", ");
}

function massAgent(address: string | null) {
  const s = (address || "").toLowerCase().replace(/\s+/g, " ");
  if (!s) return { matched: false, label: null as string | null };
  for (const { pattern, label } of MASS_AGENT_PATTERNS) if (s.includes(pattern)) return { matched: true, label };
  return { matched: false, label: null };
}

function appointmentFlags(count: number) {
  for (const t of HIGH_APPOINTMENT_THRESHOLDS) {
    if (count >= t.min) return [{ flag: t.flag, severity: t.severity, reason: t.reason(count) }];
  }
  return [] as { flag: string; severity: "high" | "medium" | "low"; reason: string }[];
}

function parseLimit(v: any, max: number, def: number) {
  const n = Number(v ?? def);
  if (!Number.isFinite(n) || n < 1 || n > max) throw new UserError(`limit must be 1-${max}`);
  return Math.floor(n);
}

function officerIdFromLink(self: string | undefined | null): string | null {
  if (!self) return null;
  const m = String(self).match(/\/officers\/([^/]+)\/appointments/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function apiGet(env: EnvKV, path: string): Promise<any> {
  const key = (env.CH_API_KEY || "").trim();
  if (!key) throw new UserError("CH_API_KEY not configured", 503);
  const source = `${CH_API}${path}`;
  const r = await fetch(source, {
    headers: { authorization: basicAuth(key), accept: "application/json", "user-agent": UA },
    signal: AbortSignal.timeout(15000),
  });
  if (r.status === 429) throw new UserError("Companies House rate limited; retry shortly", 429);
  if (r.status === 401 || r.status === 403) throw new UserError("Companies House auth failed", 502);
  if (!r.ok) throw new UserError(`Companies House http ${r.status}`, r.status === 404 ? 404 : 502);
  return r.json();
}

async function cachedJson(env: EnvKV, key: string, ttl: number, fn: () => Promise<any>) {
  const hit = await env.LOG.get(CACHE_PREFIX + key, "json");
  if (hit) return hit;
  const data = await fn();
  await env.LOG.put(CACHE_PREFIX + key, JSON.stringify(data), { expirationTtl: ttl });
  return data;
}

async function fetchAppointments(env: EnvKV, officerId: string) {
  return cachedJson(env, `appt:${officerId}`, 86400, async () => {
    try {
      const data = await apiGet(env, `/officers/${encodeURIComponent(officerId)}/appointments?items_per_page=${MAX_APPTS_PER_OFFICER}`);
      const items = (data.items || []).slice(0, MAX_APPTS_PER_OFFICER).map((a: any) => {
        const to = a.appointed_to || {};
        const office = addrString(a.address);
        const mass = massAgent(office);
        const status = a.resigned_on
          ? "resigned"
          : (to.company_status || a.appointed_status || "active");
        return {
          company_number: to.company_number || null,
          company_name: to.company_name || null,
          company_status: to.company_status || null,
          role: a.officer_role || null,
          appointed_on: a.appointed_on || null,
          resigned_on: a.resigned_on || null,
          status,
          nationality: a.nationality || null,
          country_of_residence: a.country_of_residence || null,
          occupation: a.occupation || null,
          address: office || null,
          mass_formation_office: mass,
          ch_company_url: to.company_number
            ? `${CH_WEB}/company/${to.company_number}`
            : null,
        };
      });
      return {
        name: data.name || null,
        is_corporate_officer: !!data.is_corporate_officer,
        active_count: data.active_count ?? null,
        inactive_count: data.inactive_count ?? null,
        resigned_count: data.resigned_count ?? null,
        total_results: data.total_results ?? items.length,
        appointments: items,
        appointments_truncated: (data.total_results || 0) > items.length,
      };
    } catch (e: any) {
      return {
        name: null,
        is_corporate_officer: null,
        active_count: null,
        inactive_count: null,
        resigned_count: null,
        total_results: 0,
        appointments: [],
        appointments_truncated: false,
        error: String(e?.message || e).slice(0, 200),
      };
    }
  });
}

export type UkOfficerInput = {
  name?: string;
  limit?: number | string;
};

const DISCLAIMER =
  "Public Companies House register data (Open Government Licence). Screening/research aid only - not a credit check, identity verification, or regulated AML/KYC determination. Personal data is as published on Companies House; buyers must have a lawful basis for their use.";

export async function ukOfficerSearch(env: EnvKV, input: UkOfficerInput) {
  const name = (input.name == null ? "" : String(input.name)).trim();
  if (name.length < 2) throw new UserError("name must be 2-100 chars");
  if (name.length > 100) throw new UserError("name must be 2-100 chars");
  const limit = parseLimit(input.limit, 25, 10);

  const cacheKey = `q:${name.toLowerCase()}|${limit}`;
  return cachedJson(env, cacheKey, 1800, async () => {
    const search = await apiGet(env, `/search/officers?q=${encodeURIComponent(name)}&items_per_page=${limit}`);
    const hits_total = Number(search.total_results || 0);
    const rawItems = (search.items || []).slice(0, limit);

    const officers = [];
    for (const it of rawItems) {
      const officer_id = officerIdFromLink(it.links?.self);
      const address_snippet = it.address_snippet || addrString(it.address) || null;
      const appointment_count = Number(it.appointment_count ?? 0);
      const flags = appointmentFlags(appointment_count);
      const mass = massAgent(address_snippet);
      if (mass.matched) {
        flags.push({
          flag: "mass_formation_address",
          severity: "medium" as const,
          reason: `Correspondence address matches known mass-formation / virtual-office pattern: ${mass.label}`,
        });
      }
      const dob = it.date_of_birth
        ? { month: it.date_of_birth.month ?? null, year: it.date_of_birth.year ?? null }
        : null;

      let appointments_pack: any = {
        appointments: [],
        total_results: 0,
        appointments_truncated: false,
        skipped: true,
        reason: "no officer id in search hit",
      };
      if (officer_id) {
        appointments_pack = await fetchAppointments(env, officer_id);
        delete appointments_pack.skipped;
        delete appointments_pack.reason;
      }

      officers.push({
        name: it.title || appointments_pack.name || null,
        officer_id,
        address_snippet,
        appointment_count,
        date_of_birth: dob,
        links: {
          self: it.links?.self || null,
          ch_url: officer_id ? `${CH_WEB}/officers/${encodeURIComponent(officer_id)}/appointments` : null,
        },
        flags,
        mass_formation_office: mass,
        is_corporate_officer: appointments_pack.is_corporate_officer ?? null,
        active_count: appointments_pack.active_count ?? null,
        inactive_count: appointments_pack.inactive_count ?? null,
        resigned_count: appointments_pack.resigned_count ?? null,
        appointments_total: appointments_pack.total_results ?? appointment_count,
        appointments_truncated: !!appointments_pack.appointments_truncated,
        appointments: appointments_pack.appointments || [],
        appointments_error: appointments_pack.error || null,
      });
    }

    return {
      product: "uk-officer",
      price: "$0.15",
      disclaimer: DISCLAIMER,
      query: { name, limit },
      hits_total,
      returned: officers.length,
      officers,
      notes: [
        "Source: UK Companies House officer search + appointments API (public register).",
        "date_of_birth is month/year only as published by Companies House (no day).",
        `Appointments capped at ${MAX_APPTS_PER_OFFICER} per officer match; see appointments_truncated.`,
        "High appointment_count and mass-formation address flags are heuristics only.",
      ],
      attribution: "Contains public sector information licensed under the Open Government Licence v3.0.",
      sources: {
        companies_house_api: CH_API,
        search: `${CH_API}/search/officers`,
        appointments: `${CH_API}/officers/{officer_id}/appointments`,
      },
      upsell: {
        related: [
          { path: "/uk-company", price: "$0.50", why: "full company DD (officers/PSC/filings/charges/insolvency)" },
          { path: "/kyb", price: "$2.50", why: "website + UK CH + EU VAT + sanctions KYB pack" },
          { path: "/uk-leads", price: "$1.00", why: "new UK incorporations with director names" },
        ],
      },
    };
  });
}
