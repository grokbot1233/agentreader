import { UserError, safeFetch } from "./core";

const DISCLAIMER =
  "Live HTTP response-header probe with SSRF guards (public http/https only). Not a security audit, penetration test, or malware/phishing verdict — confirm before acting.";

const INTEREST = [
  "strict-transport-security",
  "content-security-policy",
  "content-security-policy-report-only",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "cross-origin-embedder-policy",
  "access-control-allow-origin",
  "server",
  "x-powered-by",
  "content-type",
] as const;

function normalizeTarget(input: { url?: string; domain?: string }): string {
  let raw = (input.url ?? input.domain ?? "").toString().trim();
  if (!raw) throw new UserError("url or domain required", 400);
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new UserError("url/domain must be a valid http(s) URL or hostname", 400); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new UserError("only http/https urls allowed", 400);
  if (!parsed.hostname.includes(".") && !parsed.hostname.includes(":")) throw new UserError("url needs a public hostname", 400);
  if (raw.length > 2048) throw new UserError("url too long", 400);
  return parsed.toString();
}

function cancelBody(res: Response | null | undefined) {
  try { res?.body?.cancel(); } catch { /* ignore */ }
}

async function fetchHeaders(url: string): Promise<{ res: Response; finalUrl: string; method: "HEAD" | "GET" }> {
  try {
    const r = await safeFetch(url, { method: "HEAD" });
    cancelBody(r.res);
    if (r.res.status === 405 || r.res.status === 501) {
      // fall through to GET
    } else {
      return { res: r.res, finalUrl: r.finalUrl, method: "HEAD" };
    }
  } catch {
    // HEAD failed (network / method) — try GET
  }
  const g = await safeFetch(url, { method: "GET" });
  cancelBody(g.res);
  return { res: g.res, finalUrl: g.finalUrl, method: "GET" };
}

function pickHeaders(h: Headers): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const k of INTEREST) out[k] = h.get(k);
  return out;
}

function grade(headers: Record<string, string | null>, finalUrl: string) {
  const https = finalUrl.startsWith("https:");
  const hsts = !!headers["strict-transport-security"];
  const csp = !!(headers["content-security-policy"] || headers["content-security-policy-report-only"]);
  const xfo = !!headers["x-frame-options"] || /frame-ancestors/i.test(headers["content-security-policy"] || "");
  const xcto = /nosniff/i.test(headers["x-content-type-options"] || "");
  const referrer = !!headers["referrer-policy"];
  const permissions = !!headers["permissions-policy"];
  const coop = !!headers["cross-origin-opener-policy"];
  const corp = !!headers["cross-origin-resource-policy"];
  const coep = !!headers["cross-origin-embedder-policy"];

  const missing_critical: string[] = [];
  if (https && !hsts) missing_critical.push("strict-transport-security");
  if (!csp) missing_critical.push("content-security-policy");
  if (!xfo) missing_critical.push("x-frame-options");
  if (!xcto) missing_critical.push("x-content-type-options");

  const ok = {
    https,
    hsts: https ? hsts : null,
    csp,
    x_frame_options: xfo,
    x_content_type_options: xcto,
    referrer_policy: referrer,
    permissions_policy: permissions,
    coop,
    corp,
    coep,
  };

  let score = 0;
  if (https) score += 15; else score -= 20;
  if (hsts && https) score += 20;
  if (csp) score += 20;
  if (xfo) score += 15;
  if (xcto) score += 15;
  if (referrer) score += 5;
  if (permissions) score += 5;
  if (coop) score += 3;
  if (corp) score += 2;
  if (coep) score += 2;
  // Mild leak penalty for server fingerprints
  if (headers["server"]) score -= 2;
  if (headers["x-powered-by"]) score -= 3;
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return { missing_critical, ok, score };
}

export async function headersAudit(input: { url?: string; domain?: string }) {
  const url = normalizeTarget(input);
  const { res, finalUrl, method } = await fetchHeaders(url);
  const headers = pickHeaders(res.headers);
  const summary = grade(headers, finalUrl);

  return {
    product: "headers",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    url,
    final_url: finalUrl,
    status: res.status,
    method,
    headers,
    missing_critical: summary.missing_critical,
    ok: summary.ok,
    score: summary.score,
    source: "AgentReader safeFetch HEAD→GET (redirect:manual + assertPublicUrl SSRF)",
    upsell: {
      check: { path: "/check", price: "$0.001", why: "DNS/TLS/HTTPS/email posture score for the host" },
      redirects: { path: "/redirects", price: "$0.001", why: "follow Location hops to the final URL" },
      meta: { path: "/meta", price: "$0.001", why: "title/OG/Twitter/canonical without full body" },
      dns: { path: "/dns", price: "$0.001", why: "raw A/AAAA/MX/TXT/NS via DoH" },
    },
  };
}
