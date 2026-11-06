import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

export const LIMITS = { maxBytes: 3_000_000, timeoutMs: 10_000, maxRedirects: 5, maxLinks: 500 };
const UA = "AgentReader/1.12 (+https://api.axiomworks.co.uk)";

export class UserError extends Error { constructor(msg: string, public status = 400) { super(msg); } }

function ipv4Private(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}
function ipv6Private(ip: string): boolean {
  const s = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (s === "::" || s === "::1") return true;
  if (s.startsWith("::ffff:")) return ipv4Private(s.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s);
}
export function isPrivateIp(ip: string) { return ip.includes(":") ? ipv6Private(ip) : ipv4Private(ip); }

export async function doh(name: string, type: string): Promise<any> {
  const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`DoH ${r.status}`);
  return r.json();
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new UserError("invalid url"); }
  if (!["http:", "https:"].includes(u.protocol)) throw new UserError("only http/https urls allowed");
  if (u.username || u.password) throw new UserError("credentials in url not allowed");
  if (u.port && !["80", "443", "8080", "8443"].includes(u.port)) throw new UserError("port not allowed");
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (raw.length > 2048) throw new UserError("url too long");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".") && !host.includes(":"))
    throw new UserError("internal host not allowed", 403);
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    if (isPrivateIp(host)) throw new UserError("private ip not allowed", 403);
    return u;
  }
  const [a, aaaa] = await Promise.all([doh(host, "A").catch(() => null), doh(host, "AAAA").catch(() => null)]);
  const ips = [...(a?.Answer ?? []), ...(aaaa?.Answer ?? [])].filter((x: any) => x.type === 1 || x.type === 28).map((x: any) => x.data);
  if (!ips.length) throw new UserError("host does not resolve", 422);
  if (ips.some(isPrivateIp)) throw new UserError("host resolves to private ip", 403);
  return u;
}

export async function safeFetch(raw: string, init: RequestInit = {}) {
  let url = raw; const chain: { url: string; status: number }[] = [];
  const deadline = AbortSignal.timeout(LIMITS.timeoutMs);
  for (let i = 0; i <= LIMITS.maxRedirects; i++) {
    const u = await assertPublicUrl(url);
    const res = await fetch(u.toString(), { ...init, redirect: "manual", signal: deadline,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5", ...(init.headers || {}) } });
    chain.push({ url: u.toString(), status: res.status });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) { url = new URL(loc, u).toString(); continue; }
    return { res, finalUrl: u.toString(), chain };
  }
  const err = new UserError("too many redirects", 422);
  (err as any).chain = chain;
  throw err;
}

async function readCapped(res: Response): Promise<string> {
  const len = Number(res.headers.get("content-length") || 0);
  if (len > LIMITS.maxBytes) throw new UserError("document too large", 413);
  const reader = res.body!.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.length; if (total > LIMITS.maxBytes) { reader.cancel(); throw new UserError("document too large", 413); }
    chunks.push(value);
  }
  const buf = new Uint8Array(total); let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

function meta(doc: any, ...names: string[]): string | null {
  for (const n of names) {
    const el = doc.querySelector(`meta[property="${n}"]`) || doc.querySelector(`meta[name="${n}"]`) || doc.querySelector(`meta[itemprop="${n}"]`);
    const v = el?.getAttribute("content")?.trim(); if (v) return v;
  }
  return null;
}

function extractLinks(doc: any, base: string) {
  const baseHost = new URL(base).hostname; const seen = new Set<string>(); const out: { url: string; text: string; internal: boolean }[] = [];
  for (const a of doc.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") || "";
    if (/^(javascript:|mailto:|tel:|#)/i.test(href)) continue;
    let abs: string; try { const u = new URL(href, base); if (!/^https?:$/.test(u.protocol)) continue; u.hash = ""; abs = u.toString(); } catch { continue; }
    if (seen.has(abs)) continue; seen.add(abs);
    out.push({ url: abs, text: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200), internal: new URL(abs).hostname === baseHost });
    if (out.length >= LIMITS.maxLinks) break;
  }
  return out;
}

async function loadDoc(target: string) {
  const { res, finalUrl, chain } = await safeFetch(target);
  if (res.status >= 400) throw new UserError(`upstream returned HTTP ${res.status}`, 502);
  const ct = res.headers.get("content-type") || "";
  const text = await readCapped(res);
  return { text, ct, finalUrl, chain, status: res.status };
}

export async function linksFor(target: string) {
  const d = await loadDoc(target);
  if (!/html|xml/i.test(d.ct)) return { url: target, final_url: d.finalUrl, links: [], count: 0, note: "not html" };
  const { document } = parseHTML(d.text);
  const links = extractLinks(document, d.finalUrl);
  return { url: target, final_url: d.finalUrl, count: links.length, links };
}

export async function readUrl(target: string) {
  const d = await loadDoc(target);
  if (!/html|xml/i.test(d.ct)) {
    const md = d.text.slice(0, 200_000);
    return { url: target, final_url: d.finalUrl, content_type: d.ct, title: null, description: null, canonical_url: d.finalUrl,
      author: null, published: null, language: null, word_count: md.split(/\s+/).filter(Boolean).length, markdown: md, links: [] };
  }
  const { document } = parseHTML(d.text);
  const links = extractLinks(document, d.finalUrl);
  const canonicalHref = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
  let canonical = d.finalUrl; try { if (canonicalHref) canonical = new URL(canonicalHref, d.finalUrl).toString(); } catch {}
  const title = meta(document, "og:title", "twitter:title") || document.querySelector("title")?.textContent?.trim() || null;
  const description = meta(document, "description", "og:description", "twitter:description");
  let author = meta(document, "author", "article:author", "parsely-author");
  let published = meta(document, "article:published_time", "datePublished", "date", "pubdate", "parsely-pub-date");
  const modified = meta(document, "article:modified_time", "dateModified", "og:updated_time");
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { const j = JSON.parse(s.textContent || ""); const arr = Array.isArray(j) ? j : j["@graph"] || [j];
      for (const o of arr) { if (!author && o.author) author = [].concat(o.author).map((x: any) => x?.name || x).filter((x: any) => typeof x === "string").join(", ") || null;
        if (!published && o.datePublished) published = o.datePublished; } } catch {}
  }
  const lang = document.documentElement?.getAttribute("lang") || null;
  const article = new Readability(document as any, { charThreshold: 200 }).parse();
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
  td.remove(["script", "style", "noscript", "iframe", "form", "button"] as any);
  const htmlForMd = article?.content || document.body?.innerHTML || "";
  const { document: d2 } = parseHTML(`<!doctype html><html><body><div id="r">${htmlForMd}</div></body></html>`);
  // absolutize links/images
  for (const a of d2.querySelectorAll("a[href]")) { try { a.setAttribute("href", new URL(a.getAttribute("href")!, d.finalUrl).toString()); } catch {} }
  for (const i of d2.querySelectorAll("img[src]")) { try { i.setAttribute("src", new URL(i.getAttribute("src")!, d.finalUrl).toString()); } catch {} }
  let markdown = td.turndown(d2.getElementById("r") as any).replace(/\n{3,}/g, "\n\n").trim();
  if (markdown.length > 300_000) markdown = markdown.slice(0, 300_000) + "\n\n[truncated]";
  const plain = (article?.textContent || document.body?.textContent || "");
  return {
    url: target, final_url: d.finalUrl, status: d.status, redirects: d.chain.length - 1, content_type: d.ct,
    title: article?.title || title, description: description || article?.excerpt || null, canonical_url: canonical,
    author: author || article?.byline || null, published, modified, language: lang, site_name: meta(document, "og:site_name") || article?.siteName || null,
    word_count: plain.split(/\s+/).filter(Boolean).length, markdown, links_count: links.length, links: links.filter((l) => !l.internal).concat(links.filter((l) => l.internal)),
  };
}

const TYPES: Record<number, string> = { 1: "A", 28: "AAAA", 5: "CNAME", 15: "MX", 16: "TXT", 2: "NS", 6: "SOA", 257: "CAA" };
export async function checkDomain(domainRaw: string) {
  const domain = domainRaw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) throw new UserError("invalid domain");
  const qtypes = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "CAA", "SOA"];
  const results = await Promise.all(qtypes.map((t) => doh(domain, t).catch((e) => ({ error: String(e) }))));
  const dns: Record<string, string[]> = {}; let dnssec: boolean | null = null; let rcode: number | null = null;
  results.forEach((r: any, i) => { dns[qtypes[i]] = (r.Answer || []).filter((a: any) => TYPES[a.type] === qtypes[i]).map((a: any) => a.data);
    if (r.AD !== undefined && dnssec === null) dnssec = r.AD; if (rcode === null && r.Status !== undefined) rcode = r.Status; });
  const dmarcR = await doh(`_dmarc.${domain}`, "TXT").catch(() => null);
  const unq = (s: string) => s.replace(/^"|"$/g, "").replace(/" "/g, "");
  const spf = dns.TXT.map(unq).filter((t) => t.toLowerCase().startsWith("v=spf1"));
  const dmarc = (dmarcR?.Answer || []).filter((a: any) => a.type === 16).map((a: any) => unq(a.data)).filter((t: string) => t.toLowerCase().startsWith("v=dmarc1"));
  const dmarcPolicy = dmarc[0]?.match(/;\s*p=(\w+)/i)?.[1] || null;
  const probe = async (scheme: "https" | "http") => {
    const t0 = Date.now();
    try { const { res, finalUrl, chain } = await safeFetch(`${scheme}://${domain}/`, { method: "GET" });
      try { await res.body?.cancel(); } catch {}
      return { reachable: true, status: res.status, final_url: finalUrl, redirect_chain: chain, ms: Date.now() - t0,
        server: res.headers.get("server"), hsts: res.headers.get("strict-transport-security") };
    } catch (e: any) { return { reachable: false, error: String(e?.message || e), ms: Date.now() - t0 }; }
  };
  const [https, http] = await Promise.all([probe("https"), probe("http")]);
  const issues: string[] = [];
  if (rcode === 3) issues.push("NXDOMAIN: domain does not exist");
  if (!dns.A.length && !dns.AAAA.length) issues.push("no A/AAAA records");
  if (!https.reachable) issues.push("HTTPS not reachable (TLS/connection failure)");
  if (http.reachable && !String((http as any).final_url).startsWith("https://")) issues.push("HTTP does not redirect to HTTPS");
  if (https.reachable && !(https as any).hsts) issues.push("no HSTS header");
  if (!dns.MX.length) issues.push("no MX records");
  if (!spf.length) issues.push("no SPF record"); if (spf.length > 1) issues.push("multiple SPF records");
  if (!dmarc.length) issues.push("no DMARC record"); else if (dmarcPolicy === "none") issues.push("DMARC policy is p=none");
  if (!dns.CAA.length) issues.push("no CAA records");
  return { domain, checked_at: new Date().toISOString(), dns, dnssec_validated: dnssec,
    tls: { https_reachable: https.reachable, note: "TLS validity inferred from a successful certificate-verified HTTPS fetch" },
    http: { https, http }, email: { mx: dns.MX, spf, dmarc, dmarc_policy: dmarcPolicy },
    issues, score: Math.max(0, 100 - issues.length * 10) };
}

/** Batch web read: up to 8 URLs, concurrency 4, per-URL ~8s, markdown capped. */
export async function readBatch(input: { urls: string[] | string; preview?: boolean }) {
  let urls: string[] = [];
  if (Array.isArray(input.urls)) urls = input.urls.map((u) => String(u).trim()).filter(Boolean);
  else if (typeof input.urls === "string") {
    const raw = input.urls.trim();
    if (raw.startsWith("[")) {
      try { urls = (JSON.parse(raw) as any[]).map((u) => String(u).trim()).filter(Boolean); }
      catch { urls = raw.split(/[\s,]+/).map((u) => u.trim()).filter(Boolean); }
    } else {
      urls = raw.split(/[\s,]+/).map((u) => u.trim()).filter(Boolean);
    }
  }
  const preview = !!input.preview;
  const max = preview ? 2 : 8;
  const mdCap = preview ? 1500 : 8000;
  if (!urls.length) throw new UserError("missing urls (comma-separated or JSON array, max 8 http(s))");
  if (urls.length > 8) throw new UserError("max 8 urls per call");
  for (const u of urls) {
    try {
      const parsed = new URL(u);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad proto");
      if (!parsed.hostname.includes(".")) throw new Error("bad host");
    } catch {
      throw new UserError(`invalid url (must be http(s) with public hostname): ${u.slice(0, 80)}`);
    }
  }
  const selected = urls.slice(0, max);
  const results: any[] = new Array(selected.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(4, selected.length) }, async () => {
    while (i < selected.length) {
      const idx = i++;
      const url = selected[idx];
      const t0 = Date.now();
      try {
        const data = await Promise.race([
          readUrl(url),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
        ]);
        let markdown = String(data.markdown || "");
        const truncated = markdown.length > mdCap;
        if (truncated) markdown = markdown.slice(0, mdCap) + "\n\n[truncated]";
        results[idx] = {
          url,
          ok: true,
          final_url: data.final_url,
          title: data.title ?? null,
          word_count: data.word_count ?? null,
          language: data.language ?? null,
          markdown,
          markdown_truncated: truncated,
          links_count: data.links_count ?? (data.links || []).length,
          ms: Date.now() - t0,
        };
      } catch (e: any) {
        results[idx] = {
          url,
          ok: false,
          error: String(e?.message || e).slice(0, 200),
          ms: Date.now() - t0,
        };
      }
    }
  });
  await Promise.all(workers);
  return {
    product: "read-batch",
    price: "$0.015",
    count: results.length,
    ok_count: results.filter((r) => r.ok).length,
    preview: preview || undefined,
    results,
    note: preview ? "preview: first 2 URLs, markdown capped harder; pay for up to 8" : undefined,
  };
}
