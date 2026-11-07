import { parseHTML } from "linkedom";
import { safeFetch, doh, UserError, LIMITS } from "./core";

const UA = "AgentReader/1.0 (+https://api.axiomworks.co.uk)";
const KEY_PATHS = [
  /about/, /about-us/, /company/, /who-we-are/, /our-story/,
  /contact/, /contact-us/, /get-in-touch/,
  /pricing/, /plans/, /price/,
  /careers/, /jobs/, /work-with-us/, /join/,
];
const SOCIAL_HOSTS: Record<string, string> = {
  "twitter.com": "twitter", "x.com": "twitter", "linkedin.com": "linkedin",
  "facebook.com": "facebook", "fb.com": "facebook", "instagram.com": "instagram",
  "youtube.com": "youtube", "github.com": "github", "tiktok.com": "tiktok",
  "crunchbase.com": "crunchbase", "threads.net": "threads",
};
const TECH: [RegExp, string][] = [
  [/wp-content|wordpress/i, "WordPress"], [/cdn\.shopify\.com|Shopify\.theme/i, "Shopify"],
  [/__NEXT_DATA__|_next\/static/i, "Next.js"], [/nuxt|__NUXT__/i, "Nuxt"],
  [/react(?:-dom)?[.-]/i, "React"], [/vue(?:\.runtime)?[.-]/i, "Vue"],
  [/angular(?:\.min)?\.js/i, "Angular"], [/cdn\.webflow\.com/i, "Webflow"],
  [/squarespace/i, "Squarespace"], [/wix\.com|wixstatic/i, "Wix"],
  [/cloudflare/i, "Cloudflare"], [/google-analytics|gtag\/js|googletagmanager/i, "Google Analytics"],
  [/hotjar/i, "Hotjar"], [/segment\.(com|io)|analytics\.js/i, "Segment"],
  [/stripe/i, "Stripe"], [/intercom/i, "Intercom"], [/hubspot/i, "HubSpot"],
  [/jquery/i, "jQuery"], [/bootstrap/i, "Bootstrap"], [/tailwind/i, "Tailwind"],
  [/webflow/i, "Webflow"], [/ghost\.org|ghost-/i, "Ghost"],
];

function meta(doc: any, ...names: string[]): string | null {
  for (const n of names) {
    const el = doc.querySelector(`meta[property="${n}"]`) || doc.querySelector(`meta[name="${n}"]`) || doc.querySelector(`meta[itemprop="${n}"]`);
    const v = el?.getAttribute("content")?.trim(); if (v) return v;
  }
  return null;
}

function emailsIn(text: string): string[] {
  const re = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const skip = /example\.com|sentry\.|wixpress|schema\.org|godaddy|domain\.com|email\.com|yourdomain|placeholder|png|jpg|jpeg|webp|svg$/i;
  const out: string[] = []; const seen = new Set<string>();
  for (const m of text.match(re) || []) {
    const e = m.toLowerCase(); if (skip.test(e) || seen.has(e)) continue;
    seen.add(e); out.push(e); if (out.length >= 20) break;
  }
  return out;
}
function phonesIn(text: string): string[] {
  const re = /(?:\+|00)?\d[\d\s().\-]{7,18}\d/g;
  const out: string[] = []; const seen = new Set<string>();
  for (const m of text.match(re) || []) {
    const digits = m.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) continue;
    if (/^0+$/.test(digits) || /^123456/.test(digits)) continue;
    const n = m.replace(/\s+/g, " ").trim();
    if (seen.has(digits)) continue; seen.add(digits); out.push(n);
    if (out.length >= 15) break;
  }
  return out;
}

async function fetchPage(url: string) {
  const { res, finalUrl } = await safeFetch(url);
  const headers: Record<string, string> = {};
  for (const k of ["server", "x-powered-by", "via", "cf-ray", "x-generator", "content-type", "strict-transport-security"]) {
    const v = res.headers.get(k); if (v) headers[k] = v;
  }
  if (res.status >= 400) return { ok: false as const, status: res.status, finalUrl, headers, html: "", title: null as string | null, description: null as string | null };
  const len = Number(res.headers.get("content-length") || 0);
  if (len > LIMITS.maxBytes) throw new UserError("document too large", 413);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > LIMITS.maxBytes) throw new UserError("document too large", 413);
  const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  let title: string | null = null, description: string | null = null;
  try {
    const { document } = parseHTML(html);
    title = meta(document, "og:title", "twitter:title") || document.querySelector("title")?.textContent?.trim() || null;
    description = meta(document, "description", "og:description", "twitter:description");
  } catch {}
  return { ok: true as const, status: res.status, finalUrl, headers, html, title, description };
}

function pickKeyPages(doc: any, base: string): Record<string, string> {
  const found: Record<string, string> = {};
  const kinds = ["about", "contact", "pricing", "careers"] as const;
  for (const a of doc.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") || "";
    if (/^(javascript:|mailto:|tel:|#)/i.test(href)) continue;
    let abs: string; try { const u = new URL(href, base); if (u.hostname !== new URL(base).hostname) continue; abs = u.toString(); } catch { continue; }
    const path = new URL(abs).pathname.toLowerCase();
    const text = ((a.textContent || "") + " " + path).toLowerCase();
    for (const k of kinds) {
      if (found[k]) continue;
      if (k === "about" && /about|who we are|our story|company/.test(text)) found[k] = abs;
      if (k === "contact" && /contact|get in touch/.test(text)) found[k] = abs;
      if (k === "pricing" && /pricing|plans|price/.test(text)) found[k] = abs;
      if (k === "careers" && /career|jobs|join us|work with us|hiring/.test(text)) found[k] = abs;
    }
  }
  // also try common paths
  const origin = new URL(base).origin;
  for (const [k, paths] of [["about", ["/about", "/about-us", "/company"]], ["contact", ["/contact", "/contact-us"]], ["pricing", ["/pricing", "/plans"]], ["careers", ["/careers", "/jobs"]]] as const) {
    if (found[k]) continue;
    found[k] = origin + paths[0]; // candidate; fetch may 404
  }
  return found;
}

function detectTech(html: string, headers: Record<string, string>): string[] {
  const blob = html + "\n" + Object.entries(headers).map(([k, v]) => `${k}:${v}`).join("\n");
  const out: string[] = [];
  for (const [re, name] of TECH) if (re.test(blob) && !out.includes(name)) out.push(name);
  if (headers.server && !out.includes(headers.server)) out.push(`server:${headers.server}`);
  if (headers["x-powered-by"]) out.push(`x-powered-by:${headers["x-powered-by"]}`);
  return out;
}

function socials(doc: any, base: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of doc.querySelectorAll("a[href]")) {
    try {
      const u = new URL(a.getAttribute("href") || "", base);
      const host = u.hostname.replace(/^www\./, "");
      for (const [h, name] of Object.entries(SOCIAL_HOSTS)) {
        if (host === h || host.endsWith("." + h)) { if (!out[name]) out[name] = u.toString(); }
      }
    } catch {}
  }
  return out;
}

function emailProvider(mx: string[]): string | null {
  const s = mx.join(" ").toLowerCase();
  if (/google|googlemail|aspmx/.test(s)) return "Google Workspace";
  if (/outlook|microsoft|protection\.outlook/.test(s)) return "Microsoft 365";
  if (/proofpoint|pphosted/.test(s)) return "Proofpoint";
  if (/mimecast/.test(s)) return "Mimecast";
  if (/zoho/.test(s)) return "Zoho";
  if (/fastmail/.test(s)) return "Fastmail";
  if (/protonmail|proton\.me/.test(s)) return "Proton";
  if (/secureserver|godaddy/.test(s)) return "GoDaddy";
  return mx[0] ? "other" : null;
}

/** Resolve p, or fallback after ms — keeps optional enrichment from stalling the whole report. */
function bounded<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(fallback); });
  });
}
const ENRICH_MS = 4000;

/** Shared RDAP lookup used by /company and /domain. Tries TLD registries then rdap.org. */
export async function rdap(domain: string) {
  const headers = { accept: "application/rdap+json" };
  const getJson = async (url: string) => {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000), headers, redirect: "follow" as RequestRedirect });
    if (!r.ok) throw new Error(`rdap http ${r.status}`);
    return r.json();
  };
  const sources: { url: string; try: () => Promise<any> }[] = [];
  const tld = domain.split(".").pop()!.toLowerCase();
  const labels = domain.toLowerCase().split(".");
  const sld = labels.length >= 2 ? labels.slice(-2).join(".") : tld;

  // UK / Nominet
  if (tld === "uk" || sld === "co.uk" || sld === "org.uk" || sld === "me.uk" || sld === "net.uk" || sld === "ltd.uk" || sld === "plc.uk")
    sources.push({ url: `https://rdap.nominet.uk/uk/domain/${domain}`, try: () => getJson(`https://rdap.nominet.uk/uk/domain/${domain}`) });

  // Common gTLD registries (rdap.org often 403s from some egress IPs; hit registries directly)
  const TLD_RDAP: Record<string, string> = {
    com: `https://rdap.verisign.com/com/v1/domain/${domain}`,
    net: `https://rdap.verisign.com/net/v1/domain/${domain}`,
    org: `https://rdap.publicinterestregistry.org/rdap/domain/${domain}`,
    info: `https://rdap.afilias.info/rdap/domain/${domain}`,
    biz: `https://rdap.nic.biz/domain/${domain}`,
    io: `https://rdap.nic.io/domain/${domain}`,
    ai: `https://rdap.nic.ai/domain/${domain}`,
    app: `https://rdap.nic.google/domain/${domain}`,
    dev: `https://rdap.nic.google/domain/${domain}`,
    page: `https://rdap.nic.google/domain/${domain}`,
    xyz: `https://rdap.centralnic.com/xyz/rdap/domain/${domain}`,
    co: `https://rdap.nic.co/domain/${domain}`,
    me: `https://rdap.nic.me/domain/${domain}`,
    cc: `https://rdap.nic.cc/domain/${domain}`,
    tv: `https://rdap.nic.tv/domain/${domain}`,
  };
  if (TLD_RDAP[tld]) sources.push({ url: TLD_RDAP[tld], try: () => getJson(TLD_RDAP[tld]) });

  // Bootstrap / redirect helper (may 403 from some networks)
  sources.push({ url: `https://rdap.org/domain/${domain}`, try: () => getJson(`https://rdap.org/domain/${domain}`) });

  for (const s of sources) {
    try {
      const j = await s.try();
      if (!j || j.errorCode || j.title === "Error" || j.objectClassName === "error") continue;
      const reg = (j.entities || []).find((e: any) => (e.roles || []).includes("registrar"));
      let registrar: string | null = null;
      if (reg?.vcardArray?.[1]) {
        const fn = reg.vcardArray[1].find((x: any) => x[0] === "fn");
        registrar = fn?.[3] || null;
      }
      registrar = registrar || reg?.handle || null;
      const events = j.events || [];
      const regEvent = events.find((e: any) => e.eventAction === "registration");
      const expEvent = events.find((e: any) => e.eventAction === "expiration");
      let age_days: number | null = null;
      if (regEvent?.eventDate) age_days = Math.floor((Date.now() - new Date(regEvent.eventDate).getTime()) / 86400000);
      return { source: s.url, registrar, registered: regEvent?.eventDate || null, expires: expEvent?.eventDate || null, age_days, status: j.status || [] };
    } catch {}
  }
  return { source: null, registrar: null, registered: null, expires: null, age_days: null, status: [], error: "rdap unavailable" };
}

async function newsFor(q: string) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(3500) });
    if (!r.ok) return { source: url, headlines: [], note: `rss http ${r.status}` };
    const xml = await r.text();
    const items: { title: string; link: string; published: string | null; source_name: string | null }[] = [];
    const blocks = xml.split(/<item>/).slice(1);
    for (const b of blocks) {
      const title = (b.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || b.match(/<title>(.*?)<\/title>/))?.[1]?.trim();
      const link = (b.match(/<link>(.*?)<\/link>/))?.[1]?.trim();
      const pub = (b.match(/<pubDate>(.*?)<\/pubDate>/))?.[1]?.trim() || null;
      const src = (b.match(/<source[^>]*>(.*?)<\/source>/))?.[1]?.trim() || null;
      if (title && link) items.push({ title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"), link, published: pub, source_name: src });
      if (items.length >= 8) break;
    }
    return { source: url, headlines: items, note: "Google News RSS; headlines only" };
  } catch (e: any) {
    return { source: url, headlines: [], note: String(e?.message || e) };
  }
}

async function sitemapSize(origin: string) {
  const urls = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  for (const u of urls) {
    try {
      const { res, finalUrl } = await safeFetch(u);
      if (res.status >= 400) { try { await res.body?.cancel(); } catch {}; continue; }
      const text = new TextDecoder().decode(new Uint8Array(await res.arrayBuffer()).slice(0, 500_000));
      const locs = (text.match(/<loc>/gi) || []).length;
      return { source: finalUrl, url_count_estimate: locs, bytes: text.length };
    } catch {}
  }
  return { source: null, url_count_estimate: null, note: "no sitemap found" };
}

function normalizeDomain(raw: string): string {
  let s = raw.trim().toLowerCase();
  if (!s) throw new UserError("missing domain or name");
  if (s.includes("://") || s.includes("/")) {
    try { s = new URL(s.includes("://") ? s : "https://" + s).hostname; } catch { throw new UserError("invalid domain"); }
  }
  s = s.replace(/^www\./, "").replace(/\.$/, "");
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(s))
    throw new UserError("invalid domain — pass domain=example.com (name= without a domain is not supported yet)");
  return s;
}

export async function companyResearch(opts: { domain?: string; name?: string }) {
  const domain = normalizeDomain(opts.domain || opts.name || "");
  const homeUrl = `https://${domain}/`;
  const sources: Record<string, string> = { homepage: homeUrl };

  const home = await fetchPage(homeUrl);
  sources.homepage_final = home.finalUrl;
  // Soft-fail when bots are blocked (403/401/451/5xx) or site is down — still return
  // DNS/RDAP/SSL/news so paid callers are not charged for a hard 502. Mirrors /company-full.
  if (!home.ok) {
    const [mxR, txtR, dmarcR, aR] = await Promise.all([
      doh(domain, "MX").catch(() => null),
      doh(domain, "TXT").catch(() => null),
      doh(`_dmarc.${domain}`, "TXT").catch(() => null),
      doh(domain, "A").catch(() => null),
    ]);
    sources.dns = "https://cloudflare-dns.com/dns-query";
    const unq = (s: string) => s.replace(/^"|"$/g, "").replace(/" "/g, "");
    const mx = (mxR?.Answer || []).filter((a: any) => a.type === 15).map((a: any) => a.data);
    const txt = (txtR?.Answer || []).filter((a: any) => a.type === 16).map((a: any) => unq(a.data));
    const spf = txt.filter((t: string) => t.toLowerCase().startsWith("v=spf1"));
    const dmarc = (dmarcR?.Answer || []).filter((a: any) => a.type === 16).map((a: any) => unq(a.data)).filter((t: string) => t.toLowerCase().startsWith("v=dmarc1"));
    const ips = (aR?.Answer || []).filter((a: any) => a.type === 1).map((a: any) => a.data);
    const [rdapInfo, news, sitemap, sslProbe] = await Promise.all([
      bounded(rdap(domain), ENRICH_MS * 2, { source: null, registrar: null, registered: null, expires: null, age_days: null, status: [], error: "rdap timed out" } as any),
      bounded(newsFor(`"${domain}" OR ${domain.replace(/\./g, " ")}`), ENRICH_MS, { source: null as any, headlines: [], note: "news source timed out" }),
      bounded(sitemapSize(new URL(homeUrl).origin), ENRICH_MS, { source: null, url_count_estimate: null, note: "sitemap timed out" } as any),
      bounded((async () => {
        try {
          const { res, finalUrl } = await safeFetch(homeUrl);
          try { await res.body?.cancel(); } catch {}
          return {
            https_reachable: res.status < 500, final_url: finalUrl, status: res.status,
            hsts: res.headers.get("strict-transport-security"),
            note: res.status >= 400
              ? `homepage returned HTTP ${res.status} (TLS handshake ok; body blocked or error)`
              : "TLS validity inferred from successful certificate-verified HTTPS fetch",
            source: homeUrl,
          };
        } catch (e: any) {
          return { https_reachable: false, error: String(e?.message || e), source: homeUrl };
        }
      })(), ENRICH_MS, { https_reachable: null, note: "ssl probe timed out", source: homeUrl } as any),
    ]);
    if (rdapInfo.source) sources.rdap = rdapInfo.source;
    sources.news = news.source;
    if (sitemap.source) sources.sitemap = sitemap.source;
    return {
      domain,
      queried_at: new Date().toISOString(),
      homepage: {
        url: home.finalUrl, status: home.status, reachable: false,
        error: `homepage unreachable (HTTP ${home.status})`,
        title: null, description: null, headers: home.headers, source: home.finalUrl,
      },
      homepage_unreachable: true,
      key_pages: {},
      tech_stack: { detected: [], source: null, note: "skipped — homepage unreachable" },
      social_links: { source: null, note: "skipped — homepage unreachable" },
      contacts: { emails: [], phones: [], sources: [], note: "skipped — homepage unreachable" },
      dns: {
        a: ips, mx, spf, dmarc, dmarc_policy: dmarc[0]?.match(/;\s*p=(\w+)/i)?.[1] || null,
        email_provider: emailProvider(mx), source: sources.dns,
      },
      domain_registration: rdapInfo,
      ssl: sslProbe,
      sitemap,
      news,
      sources,
      note: `Homepage returned HTTP ${home.status}; returned DNS/RDAP/SSL/news without HTML scrape. Prefer /company-full or a registry route when the site blocks bots.`,
    };
  }

  const { document } = parseHTML(home.html);
  const keyCandidates = pickKeyPages(document, home.finalUrl);
  const key_pages: Record<string, any> = {};
  const pageEntries = Object.entries(keyCandidates).slice(0, 4);
  const pageResults = await Promise.all(pageEntries.map(async ([k, u]) => {
    try {
      const p = await Promise.race([fetchPage(u), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("key page timed out")), ENRICH_MS + 1000))]);
      sources[`page_${k}`] = p.finalUrl;
      if (!p.ok || p.finalUrl === home.finalUrl && k !== "about") {
        // avoid counting homepage as pricing etc if redirected home / 404
        if (!p.ok) return [k, { url: u, reachable: false, status: p.status }] as const;
      }
      const sameAsHome = p.finalUrl.replace(/\/$/, "") === home.finalUrl.replace(/\/$/, "");
      if (sameAsHome && !new URL(u).pathname.slice(1)) return [k, { url: u, reachable: false, note: "no dedicated page" }] as const;
      // If candidate path 404'd
      if (!p.ok) return [k, { url: u, reachable: false, status: p.status }] as const;
      const { document: d2 } = parseHTML(p.html);
      return [k, {
        url: p.finalUrl, reachable: true, status: p.status,
        title: p.title, description: p.description,
        emails: emailsIn(p.html), phones: phonesIn(p.html.replace(/<script[\s\S]*?<\/script>/gi, " ")),
        word_count: (d2.body?.textContent || "").split(/\s+/).filter(Boolean).length,
      }] as const;
    } catch (e: any) {
      return [k, { url: u, reachable: false, error: String(e?.message || e) }] as const;
    }
  }));
  for (const [k, v] of pageResults) key_pages[k] = v;

  const allHtml = home.html + pageResults.map(([, v]: any) => v && (v as any).emails ? "" : "").join("");
  // re-fetch text for contact extraction from pages we have
  let contactBlob = home.html;
  for (const [, v] of pageResults) {
    // emails/phones already extracted per page; aggregate below
  }

  const tech = detectTech(home.html, home.headers);
  const social = socials(document, home.finalUrl);
  const emails = new Set<string>(emailsIn(home.html));
  const phones = new Set<string>();
  for (const p of phonesIn((document.body?.textContent || "").slice(0, 100_000))) phones.add(p);
  for (const [, v] of pageResults) {
    for (const e of (v as any).emails || []) emails.add(e);
    for (const p of (v as any).phones || []) phones.add(p);
  }
  // mailto:/tel:
  for (const a of document.querySelectorAll('a[href^="mailto:"], a[href^="tel:"]')) {
    const href = a.getAttribute("href") || "";
    if (href.startsWith("mailto:")) emails.add(href.slice(7).split("?")[0].toLowerCase());
    if (href.startsWith("tel:")) phones.add(href.slice(4));
  }

  const unq = (s: string) => s.replace(/^"|"$/g, "").replace(/" "/g, "");
  const [mxR, txtR, dmarcR, aR] = await Promise.all([
    doh(domain, "MX").catch(() => null),
    doh(domain, "TXT").catch(() => null),
    doh(`_dmarc.${domain}`, "TXT").catch(() => null),
    doh(domain, "A").catch(() => null),
  ]);
  sources.dns = "https://cloudflare-dns.com/dns-query";
  const mx = (mxR?.Answer || []).filter((a: any) => a.type === 15).map((a: any) => a.data);
  const txt = (txtR?.Answer || []).filter((a: any) => a.type === 16).map((a: any) => unq(a.data));
  const spf = txt.filter((t: string) => t.toLowerCase().startsWith("v=spf1"));
  const dmarc = (dmarcR?.Answer || []).filter((a: any) => a.type === 16).map((a: any) => unq(a.data)).filter((t: string) => t.toLowerCase().startsWith("v=dmarc1"));
  const ips = (aR?.Answer || []).filter((a: any) => a.type === 1).map((a: any) => a.data);

  const [rdapInfo, news, sitemap, sslProbe] = await Promise.all([
    bounded(rdap(domain), ENRICH_MS * 2, { source: null, registrar: null, registered: null, expires: null, age_days: null, status: [], error: "rdap timed out" } as any),
    bounded(newsFor(`"${domain}" OR ${domain.replace(/\./g, " ")}`), ENRICH_MS, { source: null as any, headlines: [], note: "news source timed out" }),
    bounded(sitemapSize(new URL(home.finalUrl).origin), ENRICH_MS, { source: null, url_count_estimate: null, note: "sitemap timed out" } as any),
    bounded((async () => {
      try {
        const { res, finalUrl } = await safeFetch(homeUrl);
        try { await res.body?.cancel(); } catch {}
        return {
          https_reachable: true, final_url: finalUrl, status: res.status,
          hsts: res.headers.get("strict-transport-security"),
          note: "TLS validity inferred from successful certificate-verified HTTPS fetch",
          source: homeUrl,
        };
      } catch (e: any) {
        return { https_reachable: false, error: String(e?.message || e), source: homeUrl };
      }
    })(), ENRICH_MS, { https_reachable: null, note: "ssl probe timed out", source: homeUrl } as any),
  ]);
  if (rdapInfo.source) sources.rdap = rdapInfo.source;
  sources.news = news.source;
  if (sitemap.source) sources.sitemap = sitemap.source;

  return {
    domain,
    queried_at: new Date().toISOString(),
    homepage: {
      url: home.finalUrl, status: home.status, title: home.title, description: home.description,
      headers: home.headers, source: home.finalUrl,
    },
    key_pages,
    tech_stack: { detected: tech, source: home.finalUrl },
    social_links: { ...social, source: home.finalUrl },
    contacts: {
      emails: [...emails].slice(0, 20),
      phones: [...phones].slice(0, 15),
      sources: [home.finalUrl, ...pageResults.filter(([, v]: any) => v.reachable).map(([, v]: any) => v.url)],
    },
    dns: {
      a: ips, mx, spf, dmarc, dmarc_policy: dmarc[0]?.match(/;\s*p=(\w+)/i)?.[1] || null,
      email_provider: emailProvider(mx), source: sources.dns,
    },
    domain_registration: rdapInfo,
    ssl: sslProbe,
    sitemap,
    news,
    sources,
  };
}
