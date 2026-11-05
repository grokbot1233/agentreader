import { Actor } from "apify";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

await Actor.init();
const input = (await Actor.getInput()) || {};
const url = (input.url || "").trim();
const maxChars = Math.min(200000, Math.max(1000, Number(input.maxChars) || 50000));
if (!/^https?:\/\//i.test(url)) throw new Error("url must start with http:// or https://");

const res = await fetch(url, {
  redirect: "follow",
  signal: AbortSignal.timeout(20000),
  headers: { "User-Agent": "AxiomWorks-WebToMarkdown/1.0 (+https://axiomworks.co.uk)", Accept: "text/html,application/xhtml+xml" },
});
if (!res.ok) throw new Error(`Fetch HTTP ${res.status}`);
const html = await res.text();
const { document } = parseHTML(html);
const title = document.querySelector("title")?.textContent?.trim() || null;
const description = document.querySelector('meta[name="description"]')?.getAttribute("content") || null;
for (const sel of ["script", "style", "noscript", "iframe", "svg"]) document.querySelectorAll(sel).forEach((n) => n.remove());
const main = document.querySelector("article, main, #content, .content, body") || document.body;
const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
let markdown = turndown.turndown(main.innerHTML || "");
if (markdown.length > maxChars) markdown = markdown.slice(0, maxChars) + "\n\n<!-- truncated -->";
const links = [...document.querySelectorAll("a[href]")].map((a) => a.href).filter((h) => /^https?:/i.test(h));
const uniq = [...new Set(links)].slice(0, 100);
const out = {
  url: res.url || url,
  status: res.status,
  title,
  description,
  markdown,
  links: uniq,
  chars: markdown.length,
};
await Actor.pushData(out, "page-markdown");
await Actor.setValue("OUTPUT", out);
await Actor.exit();
