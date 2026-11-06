import { UserError, doh } from "./core";

const DISCLAIMER =
  "Heuristics over public DNS only. Not a guarantee of deliverability, inbox placement, or identity. No SMTP RCPT probe (catch-all unknown). Screening aid for agents — confirm before sending.";

const DISPOSABLE = new Set(
  "mailinator.com guerrillamail.com guerrillamailblock.com sharklasers.com grr.la guerrillamail.info guerrillamail.net guerrillamail.org guerrillamail.de yopmail.com yopmail.fr trashmail.com trashmail.me trashmail.net 10minutemail.com 10minutemail.net tempmail.com temp-mail.org tempmailo.com temp-mail.io throwawaymail.com getnada.com nada.email discard.email discarded.email mailnesia.com maildrop.cc mohmal.com emailondeck.com fakeinbox.com mailcatch.com mytemp.email tmpmail.org tmpmail.net mailtemporaire.fr tempail.com tempr.email dispostable.com mailnull.com spamgourmet.com spam.la burnermail.io inboxkitten.com mailforspam.com trash-mail.com wegwerfmail.de wegwerfmail.net einrot.com koszmail.pl".split(
    /\s+/,
  ),
);

const FREE = new Set(
  "gmail.com googlemail.com yahoo.com yahoo.co.uk ymail.com outlook.com hotmail.com hotmail.co.uk live.com msn.com icloud.com me.com mac.com aol.com proton.me protonmail.com pm.me gmx.com gmx.net mail.com zoho.com yandex.com yandex.ru tutanota.com tuta.com fastmail.com hey.com".split(
    /\s+/,
  ),
);

const ROLE_LOCAL = new Set(
  "admin administrator info contact support help sales marketing office hello team enquiries inquiry billing accounts hr jobs careers noreply no-reply donotreply do-not-reply postmaster webmaster hostmaster abuse security privacy legal press media".split(
    /\s+/,
  ),
);

function s(v: any) {
  return (v == null ? "" : String(v)).trim();
}

function parseEmail(raw: string): { local: string; domain: string } | null {
  const e = raw.toLowerCase().replace(/\s+/g, "");
  if (e.length < 5 || e.length > 254) return null;
  const at = e.lastIndexOf("@");
  if (at < 1) return null;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return null;
  if (local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(domain)) return null;
  return { local, domain: domain.toLowerCase() };
}

function disposableHeuristic(domain: string): boolean {
  if (DISPOSABLE.has(domain)) return true;
  return /(^|\.)(temp|tmp|trash|dispos|throwaway|mailinator|yopmail|guerrillamail|10minute|fake|spam|dump|bin|nada|maildrop|burner)[a-z0-9-]*\./i.test(
    `.${domain}.`,
  );
}

export async function emailCheck(input: { email?: string }) {
  const raw = s(input.email);
  if (!raw) throw new UserError("email required", 400);
  const parsed = parseEmail(raw);
  if (!parsed) {
    return {
      product: "email-check",
      price: "$0.002",
      disclaimer: DISCLAIMER,
      email: raw,
      syntax_ok: false,
      verdict: "invalid",
      score: 0,
      flags: ["invalid_syntax"],
      checks: { mx: null, a: null, disposable: null, free_provider: null, role_account: null },
      provider: null,
      mx_hosts: [] as string[],
      sources: { dns: "Cloudflare DNS-over-HTTPS" },
    };
  }
  const { local, domain } = parsed;
  const email = `${local}@${domain}`;
  const [mxR, aR] = await Promise.all([doh(domain, "MX").catch(() => null), doh(domain, "A").catch(() => null)]);
  const mxRaw = (mxR?.Answer || []).map((x: any) => String(x.data || "").replace(/\.$/, "").trim()).filter(Boolean);
  const mxHosts = mxRaw
    .map((x: string) => x.replace(/^\d+\s+/, ""))
    .filter(Boolean)
    .slice(0, 5);
  const hasA = !!(aR?.Answer || []).length;
  const disposable = disposableHeuristic(domain);
  const free = FREE.has(domain);
  const role = ROLE_LOCAL.has(local.split("+")[0]);
  const flags: string[] = [];
  if (disposable) flags.push("disposable_domain");
  if (free) flags.push("free_provider");
  if (role) flags.push("role_account");
  if (!mxHosts.length && !hasA) flags.push("no_mx_or_a");
  else if (!mxHosts.length) flags.push("no_mx_has_a");

  let score = 100;
  if (disposable) score -= 70;
  if (!mxHosts.length && !hasA) score -= 50;
  else if (!mxHosts.length) score -= 25;
  if (role) score -= 10;
  if (free) score -= 5;
  score = Math.max(0, Math.min(100, score));

  let verdict = "deliverable_likely";
  if (disposable || (!mxHosts.length && !hasA)) verdict = "undeliverable_likely";
  else if (!mxHosts.length || role) verdict = "risky";

  let provider: string | null = null;
  const mxBlob = mxHosts.join(" ").toLowerCase();
  if (/google|googlemail|aspmx/.test(mxBlob)) provider = "Google Workspace / Gmail";
  else if (/outlook|protection\.outlook|microsoft/.test(mxBlob)) provider = "Microsoft 365 / Outlook";
  else if (/protonmail|proton\.me/.test(mxBlob)) provider = "Proton";
  else if (/yahoodns|yahoo/.test(mxBlob)) provider = "Yahoo";
  else if (/icloud|apple/.test(mxBlob)) provider = "Apple iCloud";
  else if (free) provider = "free consumer mailbox";
  else if (mxHosts.length) provider = "custom / other";

  return {
    product: "email-check",
    price: "$0.002",
    disclaimer: DISCLAIMER,
    email,
    syntax_ok: true,
    verdict,
    score,
    flags,
    checks: { mx: mxHosts.length > 0, a: hasA, disposable, free_provider: free, role_account: role },
    provider,
    mx_hosts: mxHosts,
    upsell: {
      dns: { path: "/dns", price: "$0.001", why: "raw A/AAAA/MX/TXT/NS for the domain" },
      domain: { path: "/domain", price: "$0.002", why: "RDAP registrar/age for the domain" },
      domain_posture: { path: "/check", price: "$0.001", why: "SPF/DMARC/TLS for the domain" },
      kyb: { path: "/kyb", price: "$2.50", why: "full company due-diligence pack" },
    },
    sources: { dns: "Cloudflare DNS-over-HTTPS https://cloudflare-dns.com/dns-query" },
  };
}
