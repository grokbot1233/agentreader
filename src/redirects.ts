import { UserError, safeFetch, LIMITS } from "./core";

const DISCLAIMER =
  "Live HTTP redirect follow with SSRF guards (public http/https only). Not a malware, phishing, or link-safety verdict — confirm before acting.";

function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!u) throw new UserError("url required", 400);
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  let parsed: URL;
  try { parsed = new URL(u); } catch { throw new UserError("url must be a valid http(s) URL", 400); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new UserError("only http/https urls allowed", 400);
  if (!parsed.hostname.includes(".") && !parsed.hostname.includes(":")) throw new UserError("url needs a public hostname", 400);
  if (u.length > 2048) throw new UserError("url too long", 400);
  return parsed.toString();
}

function cancelBody(res: Response | null | undefined) {
  try { res?.body?.cancel(); } catch { /* ignore */ }
}

export async function redirectsLookup(input: { url?: string }) {
  const raw = input.url == null ? "" : String(input.url);
  const url = normalizeUrl(raw);

  let finalUrl = url;
  let status: number | null = null;
  let chain: { url: string; status: number }[] = [];
  let contentType: string | null = null;
  let truncated_chain = false;

  try {
    const r = await safeFetch(url);
    finalUrl = r.finalUrl;
    status = r.res.status;
    chain = r.chain;
    contentType = r.res.headers.get("content-type");
    cancelBody(r.res);
  } catch (e: any) {
    if (e instanceof UserError && /too many redirects/i.test(String(e.message || ""))) {
      truncated_chain = true;
      const prior = Array.isArray(e.chain) ? e.chain as { url: string; status: number }[] : [];
      chain = prior.slice(0, LIMITS.maxRedirects + 1);
      const last = chain[chain.length - 1];
      finalUrl = last?.url || url;
      status = last?.status ?? null;
      contentType = null;
    } else {
      throw e;
    }
  }

  const hops = chain.length;
  const redirect_count = Math.max(0, hops - 1);
  const ok = status != null && status < 400 && !truncated_chain;

  return {
    product: "redirects",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    url,
    final_url: finalUrl,
    status,
    hops,
    redirect_count,
    chain,
    content_type: contentType,
    ok,
    truncated_chain,
    source: "AgentReader safeFetch (redirect:manual + assertPublicUrl SSRF)",
    upsell: {
      read: { path: "/read", price: "$0.002", why: "fetch final page as Markdown + metadata" },
      check: { path: "/check", price: "$0.001", why: "DNS/TLS/HTTPS/email posture for the final host" },
      links: { path: "/links", price: "$0.001", why: "extract absolute links from the final page" },
    },
  };
}
