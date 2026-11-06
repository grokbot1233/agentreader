import { parseHTML } from "linkedom";
import { UserError, safeFetch, LIMITS } from "./core";

const DISCLAIMER =
  "Live HTML head/meta extract via SSRF-safe fetch. Open Graph / Twitter / JSON-LD as published — not a ranking, brand-safety, or phishing verdict.";

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

function metaContent(doc: any, ...names: string[]): string | null {
  for (const n of names) {
    const el = doc.querySelector(`meta[property="${n}"]`) || doc.querySelector(`meta[name="${n}"]`) || doc.querySelector(`meta[itemprop="${n}"]`);
    const v = el?.getAttribute("content")?.trim();
    if (v) return v;
  }
  return null;
}

function allMeta(doc: any, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const el of doc.querySelectorAll("meta[property], meta[name]")) {
    const key = (el.getAttribute("property") || el.getAttribute("name") || "").trim();
    const val = (el.getAttribute("content") || "").trim();
    if (!key || !val) continue;
    if (key.toLowerCase().startsWith(prefix.toLowerCase())) {
      const short = key.includes(":") ? key.slice(key.indexOf(":") + 1) : key;
      if (!(short in out)) out[short] = val.slice(0, 2000);
    }
  }
  return out;
}

function absUrl(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  try { return new URL(href, base).toString(); } catch { return null; }
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > LIMITS.maxBytes) {
        try { await reader.cancel(); } catch { /* ignore */ }
        break;
      }
      chunks.push(value);
    }
  }
  const buf = new Uint8Array(total > LIMITS.maxBytes ? LIMITS.maxBytes : chunks.reduce((n, c) => n + c.byteLength, 0));
  let off = 0;
  for (const c of chunks) {
    const n = Math.min(c.byteLength, buf.byteLength - off);
    buf.set(c.subarray(0, n), off);
    off += n;
    if (off >= buf.byteLength) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf.subarray(0, off));
}

export async function pageMeta(input: { url?: string }) {
  const url = normalizeUrl(input.url == null ? "" : String(input.url));
  const { res, finalUrl, chain } = await safeFetch(url);
  const status = res.status;
  const contentType = res.headers.get("content-type") || "";
  if (status >= 400) {
    try { res.body?.cancel(); } catch { /* ignore */ }
    throw new UserError(`upstream returned HTTP ${status}`, 502);
  }
  const text = await readCapped(res);
  if (!/html|xml/i.test(contentType) && !/^\s*</.test(text)) {
    return {
      product: "meta",
      price: "$0.001",
      disclaimer: DISCLAIMER,
      url,
      final_url: finalUrl,
      status,
      redirects: Math.max(0, chain.length - 1),
      content_type: contentType,
      title: null,
      description: null,
      canonical_url: finalUrl,
      language: null,
      site_name: null,
      og: {} as Record<string, string>,
      twitter: {} as Record<string, string>,
      favicons: [] as string[],
      json_ld_types: [] as string[],
      headings: { h1: [] as string[], h2: [] as string[] },
      note: "not html — no meta tags extracted",
      source: "AgentReader safeFetch + linkedom",
      upsell: {
        read: { path: "/read", price: "$0.002", why: "full page as Markdown + links" },
        links: { path: "/links", price: "$0.001", why: "all absolute links on the page" },
        redirects: { path: "/redirects", price: "$0.001", why: "unwrap redirect chain only" },
      },
    };
  }

  const { document } = parseHTML(text);
  const title =
    metaContent(document, "og:title", "twitter:title") ||
    document.querySelector("title")?.textContent?.trim() ||
    null;
  const description = metaContent(document, "description", "og:description", "twitter:description");
  const canonicalHref = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
  const canonical = absUrl(canonicalHref, finalUrl) || finalUrl;
  const language = document.documentElement?.getAttribute("lang") || metaContent(document, "og:locale") || null;
  const site_name = metaContent(document, "og:site_name");
  const og = allMeta(document, "og:");
  const twitter = allMeta(document, "twitter:");

  const favicons: string[] = [];
  const seenFav = new Set<string>();
  for (const rel of ["icon", "shortcut icon", "apple-touch-icon"]) {
    for (const link of document.querySelectorAll(`link[rel="${rel}"]`)) {
      const abs = absUrl(link.getAttribute("href"), finalUrl);
      if (abs && !seenFav.has(abs)) { seenFav.add(abs); favicons.push(abs); }
      if (favicons.length >= 8) break;
    }
    if (favicons.length >= 8) break;
  }

  const jsonLdTypes: string[] = [];
  const seenType = new Set<string>();
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const j = JSON.parse(s.textContent || "");
      const arr = Array.isArray(j) ? j : j["@graph"] || [j];
      for (const o of arr) {
        const t = o?.["@type"];
        for (const x of [].concat(t || [])) {
          const label = String(x);
          if (label && !seenType.has(label)) { seenType.add(label); jsonLdTypes.push(label); }
        }
      }
    } catch { /* ignore bad JSON-LD */ }
    if (jsonLdTypes.length >= 20) break;
  }

  const takeText = (sel: string, n: number) =>
    [...document.querySelectorAll(sel)]
      .map((el: any) => (el.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, n);

  return {
    product: "meta",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    url,
    final_url: finalUrl,
    status,
    redirects: Math.max(0, chain.length - 1),
    content_type: contentType,
    title,
    description,
    canonical_url: canonical,
    language,
    site_name,
    og,
    twitter,
    favicons,
    json_ld_types: jsonLdTypes,
    headings: { h1: takeText("h1", 5), h2: takeText("h2", 10) },
    source: "AgentReader safeFetch + linkedom",
    upsell: {
      read: { path: "/read", price: "$0.002", why: "full page as Markdown + links" },
      links: { path: "/links", price: "$0.001", why: "all absolute links on the page" },
      redirects: { path: "/redirects", price: "$0.001", why: "unwrap redirect chain only" },
      check: { path: "/check", price: "$0.001", why: "DNS/TLS/MX posture for the host" },
    },
  };
}
