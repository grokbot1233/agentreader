import { UserError, doh } from "./core";

const DISCLAIMER =
  "Public DNS via Cloudflare DNS-over-HTTPS only. Not authoritative proof of records, TTL is not guaranteed, and results can vary by resolver/cache. Screening aid for agents — confirm before acting.";

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/** Cloudflare DoH type name → numeric type in Answer.type */
const TYPE_NUM: Record<string, number> = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  PTR: 12,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  CAA: 257,
};

const ALLOWED = new Set(Object.keys(TYPE_NUM));
const DEFAULT_TYPES = ["A", "AAAA", "MX", "TXT", "NS", "CNAME"] as const;

function normalizeName(raw: string): string | null {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./i, "");
  d = d.replace(/\.$/, "");
  // PTR may be reverse zones; still require hostname-ish shape
  if (!d || !DOMAIN_RE.test(d)) return null;
  return d;
}

function parseTypes(raw: unknown): string[] {
  if (raw == null || raw === "") return [...DEFAULT_TYPES];
  const parts = String(raw)
    .split(/[\s,|]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  if (!parts.length) return [...DEFAULT_TYPES];
  const bad = parts.filter((t) => !ALLOWED.has(t));
  if (bad.length) throw new UserError(`unsupported DNS type(s): ${bad.join(",")}. allowlist: ${[...ALLOWED].join(",")}`, 400);
  return [...new Set(parts)];
}

function extractAnswers(r: any, typeName: string): string[] {
  const want = TYPE_NUM[typeName];
  const answers = Array.isArray(r?.Answer) ? r.Answer : [];
  return answers
    .filter((a: any) => a && a.type === want)
    .map((a: any) => {
      let data = String(a.data ?? "").trim();
      if (typeName === "TXT") data = data.replace(/^"|"$/g, "").replace(/" "/g, "");
      if (typeName === "NS" || typeName === "CNAME" || typeName === "PTR") data = data.replace(/\.$/, "");
      return data;
    })
    .filter(Boolean);
}

export async function dnsLookup(input: { name?: string; type?: string }) {
  const raw = (input.name == null ? "" : String(input.name)).trim();
  if (!raw) throw new UserError("name required", 400);
  const name = normalizeName(raw);
  if (!name) throw new UserError("name must be a hostname like example.com", 400);
  const types = parseTypes(input.type);

  const flags: string[] = [];
  const records: Record<string, string[]> = {};
  let failures = 0;
  let nxdomain = false;

  const results = await Promise.all(
    types.map(async (t) => {
      try {
        const r = await doh(name, t);
        return { t, r, err: null as string | null };
      } catch (e: any) {
        return { t, r: null, err: String(e?.message || e) };
      }
    }),
  );

  for (const { t, r, err } of results) {
    if (err || !r) {
      failures += 1;
      records[t] = [];
      flags.push(`doh_error_${t.toLowerCase()}`);
      continue;
    }
    if (r.Status === 3) nxdomain = true;
    records[t] = extractAnswers(r, t);
  }

  if (nxdomain) flags.push("nxdomain");
  if (failures === types.length) {
    throw new UserError("DNS-over-HTTPS lookup failed for all requested types", 502);
  }
  if (failures > 0) flags.push("partial_doh_failure");
  const empty = types.every((t) => !(records[t] || []).length);
  if (empty && !nxdomain) flags.push("no_records");

  return {
    product: "dns",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    name,
    type: types.length === 1 ? types[0] : types,
    records,
    flags,
    sources: {
      dns: "Cloudflare DNS-over-HTTPS https://cloudflare-dns.com/dns-query",
    },
    upsell: {
      domain: { path: "/domain", price: "$0.002", why: "RDAP registrar / age / expiry for the same name" },
      email_check: { path: "/email-check", price: "$0.002", why: "validate a contact address on this domain" },
      check: { path: "/check", price: "$0.001", why: "DNS + TLS/HTTPS + SPF/DMARC score" },
    },
  };
}
