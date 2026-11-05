import { UserError } from "./core";
const UA = "AxiomWorksAgentReader/1.5 (+https://api.axiomworks.co.uk; info@axiomworks.co.uk)";
const strip = (s: any) => String(s || "").replace(/<[^>]+>/g, "").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const clip = (s: string, n = 320) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
type Hit = { title: string; url: string; snippet: string; source: string; type: string; date: string | null; authors?: string[]; doi?: string | null; citations?: number | null; _rank: number };
const T = (ms: number) => AbortSignal.timeout(ms);

async function wikipedia(q: string, n: number, lang: string): Promise<Hit[]> {
  const r = await fetch(`https://${lang}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(q)}&limit=${n}`, { headers: { "user-agent": UA }, signal: T(6000) });
  if (!r.ok) throw new Error(`wikipedia ${r.status}`); const j: any = await r.json();
  return (j.pages || []).map((p: any, i: number) => ({ title: p.title, url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.key)}`, snippet: clip(strip(p.excerpt) + (p.description ? ` — ${p.description}` : "")), source: "wikipedia", type: "encyclopedia", date: null, _rank: i }));
}
async function openalex(q: string, n: number): Promise<Hit[]> {
  const r = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=${n}&select=id,doi,display_name,publication_date,authorships,cited_by_count,abstract_inverted_index,primary_location&mailto=info@axiomworks.co.uk`, { headers: { "user-agent": UA }, signal: T(7000) });
  if (!r.ok) throw new Error(`openalex ${r.status}`); const j: any = await r.json();
  return (j.results || []).map((w: any, i: number) => {
    let abs = ""; const inv = w.abstract_inverted_index; if (inv) { const arr: string[] = []; for (const [word, pos] of Object.entries(inv)) for (const k of pos as number[]) arr[k] = word; abs = arr.join(" "); }
    return { title: strip(w.display_name), url: w.doi || w.primary_location?.landing_page_url || w.id, snippet: clip(strip(abs)), source: "openalex", type: "scholarly", date: w.publication_date || null,
      authors: (w.authorships || []).slice(0, 5).map((a: any) => a.author?.display_name).filter(Boolean), doi: w.doi ? w.doi.replace("https://doi.org/", "") : null, citations: w.cited_by_count ?? null, _rank: i };
  });
}
async function arxiv(q: string, n: number): Promise<Hit[]> {
  const terms = q.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim().split(/\s+/).slice(0, 8).map((t) => `all:${t}`).join("+AND+");
  const r = await fetch(`https://export.arxiv.org/api/query?search_query=${terms}&max_results=${n}&sortBy=relevance`, { headers: { "user-agent": UA }, signal: T(8000) });
  if (!r.ok) throw new Error(`arxiv ${r.status}`); const x = await r.text();
  return [...x.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m, i) => { const e = m[1]; const g = (t: string) => (e.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || "";
    return { title: strip(g("title")), url: strip(g("id")), snippet: clip(strip(g("summary"))), source: "arxiv", type: "preprint", date: strip(g("published")).slice(0, 10) || null,
      authors: [...e.matchAll(/<name>([^<]+)<\/name>/g)].slice(0, 5).map((a) => a[1]), doi: (e.match(/<arxiv:doi[^>]*>([^<]+)</) || [])[1] || null, _rank: i }; });
}
async function crossref(q: string, n: number): Promise<Hit[]> {
  const r = await fetch(`https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=${n}&select=DOI,title,published,URL,abstract,is-referenced-by-count,author,type&mailto=info@axiomworks.co.uk`, { headers: { "user-agent": UA }, signal: T(7000) });
  if (!r.ok) throw new Error(`crossref ${r.status}`); const j: any = await r.json();
  return (j.message?.items || []).map((w: any, i: number) => ({ title: strip((w.title || [])[0]), url: w.URL, snippet: clip(strip(w.abstract)), source: "crossref", type: w.type || "scholarly",
    date: w.published?.["date-parts"]?.[0]?.join("-") || null, authors: (w.author || []).slice(0, 5).map((a: any) => [a.given, a.family].filter(Boolean).join(" ")), doi: w.DOI, citations: w["is-referenced-by-count"] ?? null, _rank: i }));
}

export const SEARCH_SOURCES = ["wikipedia", "openalex", "arxiv", "crossref"];
export async function search(p: { q: string; sources?: string; limit?: string; lang?: string }) {
  const q = (p.q || "").trim(); if (q.length < 2 || q.length > 300) throw new UserError("q must be 2-300 characters", 400);
  const want = (p.sources || SEARCH_SOURCES.join(",")).split(",").map((s) => s.trim().toLowerCase()).filter((s) => SEARCH_SOURCES.includes(s));
  const limit = Math.min(30, Math.max(1, Number(p.limit) || 15)); const per = Math.min(10, Math.max(3, Math.ceil(limit / Math.max(1, want.length)) + 2));
  const lang = /^[a-z]{2,3}$/.test(p.lang || "") ? p.lang! : "en";
  const fns: Record<string, () => Promise<Hit[]>> = { wikipedia: () => wikipedia(q, per, lang), openalex: () => openalex(q, per), arxiv: () => arxiv(q, per), crossref: () => crossref(q, per) };
  const settled = await Promise.allSettled(want.map((s) => fns[s]()));
  const status: Record<string, any> = {}; let hits: Hit[] = [];
  settled.forEach((r, i) => { const s = want[i]; if (r.status === "fulfilled") { status[s] = { ok: true, count: r.value.length }; hits.push(...r.value); } else status[s] = { ok: false, error: String((r.reason as any)?.message || r.reason).slice(0, 80) }; });
  const qt = q.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  const score = (h: Hit) => { const t = (h.title + " " + h.snippet).toLowerCase(); const cover = qt.length ? qt.filter((w) => t.includes(w)).length / qt.length : 0;
    const titleCover = qt.length ? qt.filter((w) => h.title.toLowerCase().includes(w)).length / qt.length : 0;
    return cover * 0.45 + titleCover * 0.3 + 1 / (1 + h._rank) * 0.2 + (h.citations ? Math.min(0.05, Math.log10(1 + h.citations) / 60) : 0); };
  const seen = new Map<string, Hit>(); const tk = (h: Hit) => "t:" + h.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 80);
  for (const h of hits) { if (!h.title) continue; const keys = [tk(h), ...(h.doi ? ["doi:" + h.doi.toLowerCase()] : [])]; const prev = keys.map((k) => seen.get(k)).find(Boolean);
    if (!prev) { const n = { ...h, also_in: [] } as any; keys.forEach((k) => seen.set(k, n)); } else { (prev as any).also_in.push(h.source); if (!prev.snippet && h.snippet) prev.snippet = h.snippet; if (prev.citations == null && h.citations != null) prev.citations = h.citations; } }
  const results = [...new Set(seen.values())].map((h) => ({ ...h, score: Math.round(score(h) * 1000) / 1000 })).sort((a, b) => b.score - a.score).slice(0, limit).map(({ _rank, ...h }) => h);
  return { query: q, count: results.length, results, sources: status, deduped_from: hits.length,
    note: "Free open sources only: Wikipedia (CC BY-SA, link back), OpenAlex (CC0), arXiv API (thank you to arXiv for use of its open access interoperability), Crossref (metadata, mostly CC0). Not a general web index." };
}
