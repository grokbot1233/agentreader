import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { assertPublicUrl, safeFetch, UserError, LIMITS } from "./core";

const MAX_OUT = 400_000;

async function readBytes(res: Response, max = LIMITS.maxBytes): Promise<Uint8Array> {
  const len = Number(res.headers.get("content-length") || 0);
  if (len > max) throw new UserError("document too large", 413);
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.length; if (total > max) { reader.cancel(); throw new UserError("document too large", 413); }
    chunks.push(value);
  }
  const buf = new Uint8Array(total); let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
  return buf;
}

function truncate(s: string) {
  if (s.length <= MAX_OUT) return { text: s, truncated: false };
  return { text: s.slice(0, MAX_OUT) + "\n\n[truncated]", truncated: true };
}

function htmlToMarkdown(html: string, base: string) {
  const { document } = parseHTML(html);
  const article = new Readability(document as any, { charThreshold: 100 }).parse();
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
  td.remove(["script", "style", "noscript", "iframe", "form", "button"] as any);
  const htmlForMd = article?.content || document.body?.innerHTML || html;
  const { document: d2 } = parseHTML(`<!doctype html><html><body><div id="r">${htmlForMd}</div></body></html>`);
  for (const a of d2.querySelectorAll("a[href]")) { try { a.setAttribute("href", new URL(a.getAttribute("href")!, base).toString()); } catch {} }
  for (const i of d2.querySelectorAll("img[src]")) { try { i.setAttribute("src", new URL(i.getAttribute("src")!, base).toString()); } catch {} }
  const md = td.turndown(d2.getElementById("r") as any).replace(/\n{3,}/g, "\n\n").trim();
  return { markdown: md, title: article?.title || document.querySelector("title")?.textContent?.trim() || null };
}

function sniff(ct: string, url: string, bytes: Uint8Array): "pdf" | "docx" | "html" | "text" | "unknown" {
  const c = (ct || "").toLowerCase();
  const path = new URL(url).pathname.toLowerCase();
  if (c.includes("application/pdf") || path.endsWith(".pdf") || (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) return "pdf";
  if (c.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document") || path.endsWith(".docx") ||
      (bytes[0] === 0x50 && bytes[1] === 0x4b && (path.endsWith(".docx") || c.includes("officedocument")))) return "docx";
  if (c.includes("html") || path.endsWith(".html") || path.endsWith(".htm")) return "html";
  if (c.includes("text/plain") || c.includes("text/markdown") || c.includes("text/csv")) return "text";
  // HTML sniff
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 256)).trim().toLowerCase();
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) return "html";
  if (c.includes("text/")) return "text";
  return "unknown";
}

export async function convertDocument(urlRaw: string, format: "markdown" | "text" = "markdown") {
  const u = await assertPublicUrl(urlRaw);
  const { res, finalUrl } = await safeFetch(u.toString(), { headers: { accept: "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html,text/plain,*/*;q=0.8" } });
  if (res.status >= 400) throw new UserError(`upstream returned HTTP ${res.status}`, 502);
  const ct = res.headers.get("content-type") || "";
  const bytes = await readBytes(res);
  const kind = sniff(ct, finalUrl, bytes);
  const base = { url: urlRaw, final_url: finalUrl, content_type: ct, detected_format: kind, bytes: bytes.byteLength };

  if (kind === "pdf") {
    const pdf = await getDocumentProxy(bytes);
    if (pdf.numPages > 100) throw new UserError("PDF too many pages (max 100)", 413);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const body = typeof text === "string" ? text : (text as string[]).join("\n\n");
    const t = truncate(body.trim());
    return {
      ...base, pages: totalPages, format: format === "text" ? "text" : "text",
      title: null, markdown: format === "markdown" ? t.text : undefined,
      text: t.text, truncated: t.truncated, word_count: t.text.split(/\s+/).filter(Boolean).length,
      note: "PDF text extraction via unpdf (PDF.js). Scanned/image-only PDFs may return little text.",
    };
  }

  if (kind === "docx") {
    const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer });
    const { markdown, title } = htmlToMarkdown(result.value || "", finalUrl);
    const plain = result.value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const out = format === "markdown" ? markdown : plain;
    const t = truncate(out);
    return {
      ...base, format, title, markdown: format === "markdown" ? t.text : undefined, text: format === "text" ? t.text : plain.slice(0, MAX_OUT),
      truncated: t.truncated, word_count: (format === "markdown" ? markdown : plain).split(/\s+/).filter(Boolean).length,
      messages: (result.messages || []).slice(0, 10),
    };
  }

  if (kind === "html") {
    const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const { markdown, title } = htmlToMarkdown(html, finalUrl);
    const plain = markdown.replace(/[#>*_`\[\]()]/g, " ").replace(/\s+/g, " ").trim();
    const out = format === "markdown" ? markdown : plain;
    const t = truncate(out);
    return {
      ...base, format, title, markdown: format === "markdown" ? t.text : undefined, text: format === "text" ? t.text : undefined,
      truncated: t.truncated, word_count: out.split(/\s+/).filter(Boolean).length,
    };
  }

  if (kind === "text") {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const t = truncate(text);
    return { ...base, format: "text", title: null, text: t.text, markdown: format === "markdown" ? t.text : undefined, truncated: t.truncated, word_count: t.text.split(/\s+/).filter(Boolean).length };
  }

  throw new UserError(`unsupported format (${ct || "unknown"}). Supported: PDF, DOCX, HTML, plain text`, 415);
}
