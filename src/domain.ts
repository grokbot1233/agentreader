import { UserError } from "./core";
import { rdap } from "./company";

const DISCLAIMER =
  "Public RDAP registration data only (rdap.org / Nominet for .uk). Not proof of ownership, WHOIS privacy may hide registrant, and expiration dates can change. Screening aid for agents — confirm before acting.";

const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function normalizeDomain(raw: string): string | null {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./i, "");
  d = d.replace(/\.$/, "");
  if (!d || !DOMAIN_RE.test(d)) return null;
  return d;
}

export async function domainLookup(input: { domain?: string }) {
  const raw = (input.domain == null ? "" : String(input.domain)).trim();
  if (!raw) throw new UserError("domain required", 400);
  const domain = normalizeDomain(raw);
  if (!domain) throw new UserError("domain must be a hostname like example.com", 400);

  const info = await rdap(domain);
  const age_days = info.age_days;
  const flags: string[] = [];
  if (age_days != null && age_days < 90) flags.push("young_domain");
  if (age_days != null && age_days < 30) flags.push("very_young_domain");
  if (info.error) flags.push("rdap_unavailable");
  const statuses = Array.isArray(info.status) ? info.status.map(String) : [];
  if (statuses.some((s) => /clientHold|serverHold|pendingDelete|redemption/i.test(s))) flags.push("hold_or_pending");

  return {
    product: "domain",
    price: "$0.002",
    disclaimer: DISCLAIMER,
    domain,
    registrar: info.registrar ?? null,
    registered: info.registered ?? null,
    expires: info.expires ?? null,
    age_days: age_days ?? null,
    status: statuses,
    flags,
    sources: {
      rdap: info.source || null,
      upstream: ["TLD RDAP (Verisign/PIR/Nominet/…)", "https://rdap.org/domain/{domain}"],
    },
    upsell: {
      dns: { path: "/dns", price: "$0.001", why: "A/AAAA/MX/TXT/NS resolve for the same name" },
      domain_posture: { path: "/check", price: "$0.001", why: "DNS/TLS/MX/SPF/DMARC score for the same domain" },
      company: { path: "/company", price: "$0.25", why: "website research pack (includes RDAP plus tech/contacts/news)" },
      email_check: { path: "/email-check", price: "$0.002", why: "validate a contact address on this domain" },
      kyb: { path: "/kyb", price: "$2.50", why: "full KYB pack" },
    },
    ...(info.error ? { error: info.error } : {}),
  };
}
