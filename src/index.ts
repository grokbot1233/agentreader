import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { readUrl, linksFor, checkDomain, UserError } from "./core";
import { companyResearch } from "./company";
import { ukCompany } from "./uk-company";
import { companyFull } from "./company-full";
import { convertDocument } from "./convert";
import { createMonitor, getMonitor, runMonitors } from "./monitor";
import { checkPreviewQuota, clientIp, truncateSample, STATIC_SAMPLES, type PreviewKind } from "./previews";
import { handleMcp } from "./mcp";
import { facilitatorClient, CANONICAL, CONTACT } from "./facilitator";
import { dashboardHtml } from "./dashboard";

type Env = { LOG: KVNamespace; STATS_SECRET: string; DASHBOARD_KEY: string; PAY_TO: string; FACILITATOR_URL: string; CDP_API_KEY_ID?: string; CDP_API_KEY_SECRET?: string; FACILITATOR?: string; CH_API_KEY?: string };
const NETWORK = "eip155:8453";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const PRICES = {
  "/read": "$0.002",
  "/links": "$0.001",
  "/check": "$0.001",
  "/company": "$0.25",
  "/uk-company": "$0.50",
  "/uk-company-lite": "$0.05",
  "/company-full": "$0.65",
  "/convert": "$0.03",
  "/monitor": "$1.00",
} as const;
const ATOMIC: Record<string, number> = {
  "/read": 2000, "/links": 1000, "/check": 1000,
  "/company": 250000, "/uk-company": 500000, "/uk-company-lite": 50000, "/company-full": 650000,
  "/convert": 30000, "/monitor": 1000000,
};

const urlIn = { type: "object", properties: { url: { type: "string", format: "uri", description: "Public http(s) URL to fetch" } }, required: ["url"] };
const linkSchema = { type: "object", properties: { url: { type: "string" }, text: { type: "string" }, internal: { type: "boolean" } } };
const readOut = { type: "object", properties: {
  url: { type: "string" }, final_url: { type: "string" }, title: { type: ["string", "null"] }, description: { type: ["string", "null"] },
  canonical_url: { type: "string" }, author: { type: ["string", "null"] }, published: { type: ["string", "null"] }, language: { type: ["string", "null"] },
  word_count: { type: "integer" }, markdown: { type: "string" }, links_count: { type: "integer" }, links: { type: "array", items: linkSchema } } };
const linksOut = { type: "object", properties: { url: { type: "string" }, final_url: { type: "string" }, count: { type: "integer" }, links: { type: "array", items: linkSchema } } };
const checkIn = { type: "object", properties: { domain: { type: "string", description: "Domain name, e.g. example.com" } }, required: ["domain"] };
const checkOut = { type: "object", properties: { domain: { type: "string" }, dns: { type: "object" }, dnssec_validated: { type: ["boolean", "null"] },
  tls: { type: "object" }, http: { type: "object" }, email: { type: "object", properties: { mx: { type: "array" }, spf: { type: "array" }, dmarc: { type: "array" }, dmarc_policy: { type: ["string", "null"] } } },
  issues: { type: "array", items: { type: "string" } }, score: { type: "integer" } } };

const companyIn = { type: "object", properties: {
  domain: { type: "string", description: "Company website domain, e.g. stripe.com" },
  name: { type: "string", description: "Alias for domain if it looks like a hostname" },
}, anyOf: [{ required: ["domain"] }, { required: ["name"] }] };
const companyOut = { type: "object", properties: {
  domain: { type: "string" }, homepage: { type: "object" }, key_pages: { type: "object" }, tech_stack: { type: "object" },
  social_links: { type: "object" }, contacts: { type: "object" }, dns: { type: "object" }, domain_registration: { type: "object" },
  ssl: { type: "object" }, sitemap: { type: "object" }, news: { type: "object" }, sources: { type: "object" } } };

const ukIn = { type: "object", properties: {
  number: { type: "string", description: "UK Companies House number, e.g. 00445790" },
  name: { type: "string", description: "Registered company name to search" },
}, anyOf: [{ required: ["number"] }, { required: ["name"] }] };
const ukOut = { type: "object", properties: {
  company_number: { type: "string" }, profile: { type: "object" }, overview: { type: "object" }, officers: { type: "object" },
  persons_with_significant_control: { type: "object" }, filing_history_highlights: { type: "object" }, charges: { type: "object" },
  compliance: { type: "object" }, red_flags: { type: "array", items: { type: "object" } }, sources: { type: "object" } } };

const ukLiteIn = ukIn;
const ukLiteOut = { type: "object", properties: {
  company_number: { type: "string" }, name: { type: ["string", "null"] }, status: { type: ["string", "null"] },
  incorporation_date: { type: ["string", "null"] }, sic_codes: { type: "array" }, registered_office_text: { type: ["string", "null"] },
  compliance: { type: "object" }, red_flags: { type: "array", items: { type: "object" } }, mass_formation_office: { type: "object" } } };
const companyFullIn = companyIn;
const companyFullOut = { type: "object", properties: {
  domain: { type: "string" }, bundle: { type: "string" }, price: { type: "string" },
  company: companyOut, uk: ukOut, uk_included: { type: "boolean" }, uk_skip_reason: { type: ["string", "null"] }, note: { type: "string" } } };
const convertIn = { type: "object", properties: {
  url: { type: "string", format: "uri", description: "Public URL of a PDF, DOCX, HTML or text document" },
  format: { type: "string", enum: ["markdown", "text"], description: "Output format (default markdown)" },
}, required: ["url"] };
const convertOut = { type: "object", properties: {
  url: { type: "string" }, final_url: { type: "string" }, detected_format: { type: "string" }, title: { type: ["string", "null"] },
  markdown: { type: "string" }, text: { type: "string" }, pages: { type: "integer" }, word_count: { type: "integer" }, truncated: { type: "boolean" } } };

const monitorIn = { type: "object", properties: {
  url: { type: "string", format: "uri", description: "Page URL to monitor hourly" },
  webhook: { type: "string", format: "uri", description: "HTTPS endpoint to POST JSON on change" },
  selector: { type: "string", description: "Optional CSS selector (id/class/tag) to hash a page fragment" },
  keyword: { type: "string", description: "Optional keyword; hash includes whether it is present" },
}, required: ["url", "webhook"] };
const monitorOut = { type: "object", properties: {
  id: { type: "string" }, url: { type: "string" }, webhook: { type: "string" }, created: { type: "string" }, expires: { type: "string" },
  last_hash: { type: "string" }, status_url: { type: "string" }, active: { type: "boolean" } } };

const DESC: Record<string, string> = {
  "/read": "Use this when you need the clean text of a public web page as Markdown + metadata (title, author, date, language, word count, links). Better than raw fetch/HTML: Readability extraction, structured JSON, ~1s. Example in: {url:\"https://example.com\"} → {title, markdown, word_count, links}. $0.002 USDC.",
  "/links": "Use this when you only need every absolute link on a page (crawl maps, sitemaps-lite). Faster/cheaper than /read. Example: {url} → {count, links:[{url,text,internal}]}. $0.001.",
  "/check": "Use this when vetting a domain's health before outreach or onboarding: DNS (DoH), DNSSEC, TLS/HTTPS, redirects, HSTS, MX/SPF/DMARC + score/issues. Structured JSON beats dig+openssl. Example: {domain:\"stripe.com\"} → {score, issues, email}. $0.001.",
  "/company": "Use this when researching any company from its website domain — not Companies House. Returns sourced tech stack, socials, emails/phones, DNS/MX/SPF/DMARC, RDAP age/registrar, SSL, sitemap, news. No LLM inventing facts. Example: {domain:\"stripe.com\"} → {homepage, tech_stack, contacts, dns, news, sources}. Prefer /uk-company* for UK filings. $0.25.",
  "/uk-company": "Use this for UK due diligence on a Companies House number or name: official API profile, officers, PSCs, filings, charges, insolvency + rule-based red flags (overdue, dissolved, churn, mass-formation office). Sourced JSON. Example: {number:\"00445790\"} or {name:\"TESCO\"}. Prefer /uk-company-lite ($0.05) for status/flags only. $0.50.",
  "/uk-company-lite": "Use this for a cheap UK company snapshot before paying for the full pack: status, SIC, office, compliance overdue, mass-formation check, red-flag names. Example: {number:\"00445790\"} → {name,status,red_flags,compliance}. Upsell: /uk-company for officers/PSC/filings/charges/insolvency. $0.05.",
  "/company-full": "Use this when you have a company website and also want UK Companies House DD in one call ($0.65 vs $0.75 separate). Runs /company then attaches /uk-company when a UK number/name is detected (.uk TLD or CH number on site). Example: {domain:\"tesco.com\"} → {company, uk, uk_included}. $0.65.",
  "/convert": "Use this when an agent needs PDF/DOCX/HTML/text as clean markdown or plain text (RAG, summarisation). PDF via unpdf; DOCX via mammoth. Example: {url, format:\"markdown\"} → {detected_format, markdown, pages, word_count}. $0.03.",
  "/monitor": "Use this when you need 30 days of hourly page-change alerts to your webhook (pricing pages, status, jobs). Returns id; GET /monitor/:id free. Example POST {url, webhook, selector?}. $1.00/30d.",
};
const OUT: any = { "/read": readOut, "/links": linksOut, "/check": checkOut, "/company": companyOut, "/uk-company": ukOut, "/uk-company-lite": ukLiteOut, "/company-full": companyFullOut, "/convert": convertOut, "/monitor": monitorOut };
const EX: any = {
  "/read": { url: "https://example.com" }, "/links": { url: "https://example.com" }, "/check": { domain: "example.com" },
  "/company": { domain: "stripe.com" }, "/uk-company": { number: "00445790" }, "/uk-company-lite": { number: "00445790" }, "/company-full": { domain: "tesco.com" },
  "/convert": { url: "https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf", format: "markdown" },
  "/monitor": { url: "https://example.com", webhook: "https://api.axiomworks.co.uk/hooks/sink" },
};
const IN: any = { "/read": urlIn, "/links": urlIn, "/check": checkIn, "/company": companyIn, "/uk-company": ukIn, "/uk-company-lite": ukLiteIn, "/company-full": companyFullIn, "/convert": convertIn, "/monitor": monitorIn };
const METHODS: Record<string, ("GET" | "POST")[]> = {
  "/read": ["GET", "POST"], "/links": ["GET", "POST"], "/check": ["GET", "POST"],
  "/company": ["GET", "POST"], "/uk-company": ["GET", "POST"], "/uk-company-lite": ["GET", "POST"], "/company-full": ["GET", "POST"], "/convert": ["GET", "POST"],
  "/monitor": ["POST"],
};

function routes(payTo: string) {
  const r: any = {};
  for (const p of Object.keys(PRICES) as (keyof typeof PRICES)[]) {
    for (const method of METHODS[p]) {
      const ext = method === "GET"
        ? declareDiscoveryExtension({ input: EX[p], inputSchema: IN[p], output: { schema: OUT[p] } } as any)
        : declareDiscoveryExtension({ input: EX[p], inputSchema: IN[p], bodyType: "json", output: { schema: OUT[p] } } as any);
      r[`${method} ${p}`] = {
        accepts: [{ scheme: "exact", price: PRICES[p], network: NETWORK, payTo, maxTimeoutSeconds: 120 }],
        description: DESC[p], mimeType: "application/json", extensions: { ...ext },
      };
    }
  }
  return r;
}

let mw: any = null;
function getMw(env: Env) {
  if (mw) return mw;
  const fac = facilitatorClient(env);
  const server = new x402ResourceServer(fac).register(NETWORK, new ExactEvmScheme()).registerExtension(bazaarResourceServerExtension);
  server.onAfterSettle(async (ctx: any) => {
    try {
      const res = ctx.paymentPayload?.resource?.url || ctx.requirements?.resource || "";
      let endpoint = "unknown"; try { endpoint = new URL(res).pathname; } catch {}
      const rec = { ts: new Date().toISOString(), endpoint, payer: ctx.result?.payer || null, amount: ctx.result?.amount || ctx.requirements?.amount || String(ATOMIC[endpoint] ?? 0),
        asset: ctx.requirements?.asset, network: ctx.result?.network, tx: ctx.result?.transaction, success: ctx.result?.success };
      await currentEnv!.LOG.put(`pay:${rec.ts}:${crypto.randomUUID().slice(0, 8)}`, "1", { metadata: rec });
    } catch (e) { console.log("log error", e); }
  });
  mw = paymentMiddleware(routes(env.PAY_TO), server);
  return mw;
}
let currentEnv: Env | null = null;

const app = new Hono<{ Bindings: Env }>();
app.use("*", async (c, next) => { currentEnv = c.env; await next(); c.header("access-control-allow-origin", "*");
  c.header("access-control-expose-headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE"); });
app.options("*", (c) => c.body(null, 204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, OPTIONS" }));

function base(_c: any) { return CANONICAL; }
function discovery(c: any) {
  const b = base(c);
  return { x402Version: 2, name: "AgentReader", description: "Pay-per-call web reading, company research, UK due diligence, document conversion & change monitoring for AI agents. USDC on Base via x402.",
    resources: Object.keys(PRICES).map((p) => `${b}${p}`),
    items: Object.entries(PRICES).map(([p, price]) => ({ resource: `${b}${p}`, methods: METHODS[p], description: DESC[p], mimeType: "application/json",
      accepts: [{ scheme: "exact", network: NETWORK, amount: String(ATOMIC[p]), price, asset: USDC, payTo: c.env.PAY_TO, maxTimeoutSeconds: 120, extra: { name: "USD Coin", version: "2" } }],
      input: { type: "http", method: METHODS[p][0], queryParams: IN[p] }, output: OUT[p] })),
    contact: CONTACT, ownershipProofs: [] };
}

app.get("/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));
app.get("/.well-known/x402", (c) => c.json(discovery(c)));
app.get("/.well-known/x402.json", (c) => c.json(discovery(c)));
app.get("/.well-known/agent.json", (c) => {
  const b = base(c);
  return c.json({
    name: "AgentReader", description: "x402 pay-per-call web reader, company research, UK Companies House due diligence, document conversion and change monitoring for AI agents.",
    url: b, provider: { organization: "Axiom Works", url: "https://axiomworks.co.uk", email: CONTACT },
    version: "1.2.0", documentationUrl: `${b}/llms.txt`, openapi: `${b}/openapi.json`,
    skills: Object.entries(PRICES).map(([p, price]) => ({ id: p.slice(1), name: p, description: DESC[p], price, endpoint: `${b}${p}` })),
    mcp: `${b}/mcp`, payments: { protocol: "x402", network: NETWORK, asset: USDC, payTo: c.env.PAY_TO },
  });
});
app.get("/openapi.json", (c) => {
  const b = base(c); const paths: any = {};
  for (const [p, price] of Object.entries(PRICES)) {
    const params = Object.entries(IN[p].properties || {}).map(([k, v]: any) => ({
      name: k, in: "query", required: (IN[p].required || []).includes(k), schema: { type: "string" }, description: v.description,
    }));
    const resp = { "200": { description: "Success", content: { "application/json": { schema: OUT[p] } } }, "402": { description: `Payment required: ${price} USDC on Base (x402 v2, see PAYMENT-REQUIRED header)` }, "400": { description: "Bad input" } };
    paths[p] = {};
    const payInfo = { mode: "fixed", currency: "USD", amount: price.replace("$", ""), network: NETWORK, asset: USDC, payTo: c.env.PAY_TO, amountAtomic: String(ATOMIC[p]) };
    if (METHODS[p].includes("GET")) paths[p].get = { summary: DESC[p], parameters: params, responses: resp, "x-price": price, "x-payment-info": payInfo, "x-402": { network: NETWORK, asset: USDC, amount: String(ATOMIC[p]) } };
    if (METHODS[p].includes("POST")) paths[p].post = { summary: DESC[p], requestBody: { content: { "application/json": { schema: IN[p] } } }, responses: resp, "x-price": price, "x-payment-info": payInfo, "x-402": { network: NETWORK, asset: USDC, amount: String(ATOMIC[p]) } };
  }
  paths["/monitor/{id}"] = { get: { summary: "Free monitor status (id is the secret)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Monitor status" }, "404": { description: "Not found" } }, "x-price": "free" } };
  paths["/samples/{kind}"] = { get: { summary: "Free truncated sample (rate-limited 8/IP/day) with x402 upsell", parameters: [{ name: "kind", in: "path", required: true, schema: { type: "string", enum: ["read","company","uk-company","uk-company-lite","convert"] } }], responses: { "200": { description: "Truncated sample" }, "429": { description: "Preview quota exceeded" } }, "x-price": "free" } };
  paths["/hooks/sink"] = { post: { summary: "Free webhook test sink for /monitor", responses: { "200": { description: "Stored" } }, "x-price": "free" } };
  return c.json({ openapi: "3.1.0", info: { title: "AgentReader", version: "1.2.0", contact: { email: CONTACT, url: "https://github.com/grokbot1233/agentreader" }, description: "x402 pay-per-call APIs for AI agents: web reading, company research, UK due diligence, document conversion, change monitoring. Payments: USDC on Base mainnet (eip155:8453)." },
    servers: [{ url: b }], paths });
});
const llms = (b: string, payTo: string) => `# AgentReader

> Pay-per-call tools for AI agents. No API keys: x402 (HTTP 402) + USDC on Base (eip155:8453), payTo ${payTo}.
> Free truncated samples: ${b}/samples/{read|company|uk-company|uk-company-lite|convert} (8/IP/day). Or add &preview=1 on paid GETs (same limit).

## When to use which (pick one)

| Need | Endpoint | Price | Why ours |
|---|---|---|---|
| Page → Markdown | ${b}/read?url= | $0.002 | Readability + metadata JSON, not raw HTML |
| Links only | ${b}/links?url= | $0.001 | Cheaper than /read |
| Domain health | ${b}/check?domain= | $0.001 | DNS/TLS/MX/SPF/DMARC + score |
| Website company research | ${b}/company?domain= | $0.25 | Sourced tech/contacts/DNS/RDAP/news (no LLM fiction) |
| UK CH full DD | ${b}/uk-company?number=\|name= | $0.50 | Official API: officers/PSC/filings/charges/insolvency + red flags |
| UK CH cheap snapshot | ${b}/uk-company-lite?number=\|name= | $0.05 | Status + compliance flags; upsell full pack |
| Website + UK DD bundle | ${b}/company-full?domain= | $0.65 | $0.10 cheaper than $0.25+$0.50 when UK detected |
| PDF/DOCX → text | ${b}/convert?url= | $0.03 | Structured markdown/text for RAG |
| Hourly change alerts | POST ${b}/monitor | $1.00/30d | Webhook on change; GET /monitor/:id free |

## Free
- ${b}/samples/:kind — cached truncated real examples + upsell
- ${b}/monitor/:id — monitor status · ${b}/hooks/sink — webhook test sink (POST)
- ${b}/llms.txt · ${b}/openapi.json · ${b}/.well-known/x402 · ${b}/.well-known/agent.json · ${b}/mcp · ${b}/health

## Pay
HTTP 402 + PAYMENT-REQUIRED header (x402 v2). Retry with PAYMENT-SIGNATURE (@x402/fetch, x402-axios). MCP: ${b}/mcp

## Contact
${CONTACT} · https://github.com/grokbot1233/agentreader · examples/ in repo
`;

app.get("/llms.txt", (c) => c.text(llms(base(c), c.env.PAY_TO)));
app.get("/", (c) => {
  if ((c.req.header("accept") || "").includes("text/html"))
    return c.html(`<!doctype html><meta charset=utf-8><title>AgentReader</title><meta name=viewport content="width=device-width"><style>body{font:16px/1.5 system-ui;max-width:760px;margin:40px auto;padding:0 16px}pre{background:#f4f4f4;padding:12px;white-space:pre-wrap}</style><h1>AgentReader</h1><pre>${llms(base(c), c.env.PAY_TO).replace(/</g, "&lt;")}</pre>`);
  return c.text(llms(base(c), c.env.PAY_TO));
});

async function keyOk(given: string, s: string) {
  const enc = new TextEncoder(); const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(given)), crypto.subtle.digest("SHA-256", enc.encode(s))]);
  return s.length > 0 && new Uint8Array(x).every((v, i) => v === new Uint8Array(y)[i]);
}
async function stats(env: Env) {
  const recs: any[] = []; let cursor: string | undefined;
  do { const l: any = await env.LOG.list({ prefix: "pay:", cursor }); recs.push(...l.keys.map((k: any) => k.metadata).filter(Boolean)); cursor = l.list_complete ? undefined : l.cursor; } while (cursor);
  const TEST = new Set(["0xdefe5f9f39d0f0a5f3c83594cd65a8e70015b370"]);
  const all = recs.filter((r) => r.success !== false).sort((a, b) => a.ts < b.ts ? -1 : 1).map((r) => ({ ...r, test: TEST.has(String(r.payer || "").toLowerCase()) }));
  const tests = all.filter((r) => r.test); const ok = all.filter((r) => !r.test);
  const byEndpoint: any = {}, byDay: any = {}; const payers = new Set<string>(); let atomic = 0;
  for (const r of ok) { const a = Number(r.amount || 0); atomic += a; if (r.payer) payers.add(r.payer.toLowerCase());
    (byEndpoint[r.endpoint] ??= { calls: 0, revenue_usdc: 0 }).calls++; byEndpoint[r.endpoint].revenue_usdc += a / 1e6;
    const d = r.ts.slice(0, 10); (byDay[d] ??= { calls: 0, revenue_usdc: 0 }).calls++; byDay[d].revenue_usdc += a / 1e6; }
  return { paid_calls: ok.length, revenue_usdc: atomic / 1e6, unique_payers: payers.size, by_endpoint: byEndpoint, by_day: byDay, recent: all.slice(-20).reverse(), test_calls: tests.length, test_revenue_usdc: tests.reduce((t, r) => t + Number(r.amount || 0), 0) / 1e6, generated: new Date().toISOString() };
}
export async function logPay(env: Env, r: any) {
  const rec = { ts: new Date().toISOString(), ...r };
  await env.LOG.put(`pay:${rec.ts}:${crypto.randomUUID().slice(0, 8)}`, "1", { metadata: rec });
}
app.get("/stats", async (c) => {
  const auth = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") || c.req.query("key") || "";
  if (!(await keyOk(auth, c.env.STATS_SECRET || ""))) return c.json({ error: "unauthorized" }, 401);
  return c.json(await stats(c.env));
});
app.get("/dashboard", async (c) => {
  c.header("cache-control", "no-store"); return c.html(dashboardHtml());
});
app.get("/dashboard/data", async (c) => {
  const t = Date.now(); let health: any = { ok: true };
  try { await c.env.LOG.get("health-probe"); health.kv_ms = Date.now() - t; } catch (e: any) { health = { ok: false, error: String(e) }; }
  health.facilitator = (c.env as any).CDP_API_KEY_ID ? "Coinbase CDP" : "PayAI";
  const meta = (await c.env.LOG.get("meta:dashboard", "json")) || {};
  const mcpTools = [
    ["read_url", "$0.002"], ["extract_links", "$0.001"], ["check_domain", "$0.001"],
    ["company_research", "$0.25"], ["uk_company", "$0.50"], ["uk_company_lite", "$0.05"], ["company_full", "$0.65"], ["convert_document", "$0.03"], ["create_monitor", "$1.00"],
    ["pricing", "free"],
  ];
  const services = [
    ...Object.entries(PRICES).map(([p, price]) => ({ name: `HTTP ${p}`, url: `${CANONICAL}${p}`, price, paid: true, status: "live" })),
    { name: "HTTP GET /monitor/:id", url: `${CANONICAL}/monitor/:id`, price: "free", paid: false, status: "live" },
    ...mcpTools.map(([n, price]) => ({ name: `MCP ${n}`, url: `${CANONICAL}/mcp`, price, paid: price !== "free", status: "live" })),
    ...["/health", "/llms.txt", "/openapi.json", "/.well-known/x402", "/.well-known/agent.json", "/samples/company", "/hooks/sink"].map((p) => ({ name: p, url: `${CANONICAL}${p}`, price: "free", paid: false, status: "live" })),
  ];
  let treasury_usdc: number | null = null, treasury_err: string | undefined;
  try { const r: any = await (await fetch("https://base-rpc.publicnode.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: USDC, data: "0x70a08231" + c.env.PAY_TO.slice(2).toLowerCase().padStart(64, "0") }, "latest"] }) })).json(); treasury_usdc = Number(BigInt(r.result)) / 1e6; } catch (e: any) { treasury_err = String(e).slice(0, 200); }
  c.header("cache-control", "no-store"); return c.json({ ...(await stats(c.env)), health, services, meta, network: NETWORK, payTo: c.env.PAY_TO, treasury_usdc, treasury_err, legacy_payTo: ["0xB1A4e2C441fa896AF010222659AAbBb71E9Ef1D1", "0x560d1dbb6e973082EBd20D340EAd3a198452b3Ec"], prices: PRICES });
});
app.post("/admin/dashboard-meta", async (c) => {
  const auth = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") || c.req.query("key") || "";
  if (!(await keyOk(auth, c.env.DASHBOARD_KEY || ""))) return c.json({ error: "unauthorized" }, 401);
  let body: any; try { body = await c.req.json(); } catch { return c.json({ error: "invalid json" }, 400); }
  const cur: any = (await c.env.LOG.get("meta:dashboard", "json")) || {};
  const next = { ...cur, ...body, updated: new Date().toISOString() };
  await c.env.LOG.put("meta:dashboard", JSON.stringify(next)); return c.json({ ok: true, meta: next });
});
app.all("/mcp", (c) => handleMcp(c.req.raw, c.env, (r) => logPay(c.env, r)));

// Free webhook sink for monitor tests (stores last payload briefly)
app.post("/hooks/sink", async (c) => {
  let body: any = null; try { body = await c.req.json(); } catch { try { body = await c.req.text(); } catch { body = null; } }
  const id = crypto.randomUUID().slice(0, 12);
  await c.env.LOG.put(`hook:${id}`, JSON.stringify({ ts: new Date().toISOString(), body }), { expirationTtl: 86400 });
  await c.env.LOG.put("hook:last", id, { expirationTtl: 86400 });
  return c.json({ ok: true, id, fetch: `${CANONICAL}/hooks/sink/${id}` });
});
app.get("/hooks/sink/:id", async (c) => {
  const raw = await c.env.LOG.get(`hook:${c.req.param("id")}`, "json");
  if (!raw) return c.json({ error: "not found or expired" }, 404);
  return c.json(raw);
});
app.get("/hooks/sink", async (c) => {
  const id = await c.env.LOG.get("hook:last");
  if (!id) return c.json({ last: null });
  const raw = await c.env.LOG.get(`hook:${id}`, "json");
  return c.json({ last: id, payload: raw });
});

// Free truncated samples (rate-limited) — never full paid payloads
app.get("/samples", (c) => c.json({
  samples: Object.keys(STATIC_SAMPLES),
  live_preview: "Add ?preview=1 to paid GET routes (same IP daily quota)",
  limit: "8 previews/IP/UTC day",
  kinds: ["read","links","check","company","uk-company","uk-company-lite","convert","company-full"],
}));
app.get("/samples/:kind", async (c) => {
  const kind = c.req.param("kind") as PreviewKind;
  const ip = clientIp(c);
  const q = await checkPreviewQuota(c.env, ip);
  if (!q.ok) return c.json(q, 429);
  const base = STATIC_SAMPLES[kind];
  if (!base) return c.json({ error: "unknown kind", see: "/samples" }, 404);
  return c.json({ ...truncateSample(kind, base), preview_remaining: q.remaining, sample: "static" });
});

// Free monitor status (id is secret) — registered BEFORE paid /monitor middleware
app.get("/monitor/:id", async (c) => {
  const mon = await getMonitor(c.env, c.req.param("id"));
  if (!mon) return c.json({ error: "not found" }, 404);
  return c.json({ ...mon, status_url: `${CANONICAL}/monitor/${mon.id}`, seconds_remaining: Math.max(0, Math.floor((new Date(mon.expires).getTime() - Date.now()) / 1000)) });
});

// Live preview helper (truncated + rate-limited). Must not return full paid payload.
async function livePreview(c: any, kind: PreviewKind, runner: () => Promise<any>, exampleCall: string) {
  const ip = clientIp(c);
  const q = await checkPreviewQuota(c.env, ip);
  if (!q.ok) return c.json(q, 429);
  try {
    const data = await runner();
    return c.json({ ...truncateSample(kind, data, exampleCall), preview_remaining: q.remaining, sample: "live" });
  } catch (e: any) {
    const status = e instanceof UserError ? e.status : 502;
    return c.json({ error: e?.message || String(e), preview: true }, status as any);
  }
}

// Paid routes: payment middleware first, except ?preview=1 (free truncated).
for (const p of Object.keys(PRICES)) {
  if (p === "/monitor") {
    app.use("/monitor", async (c, next) => {
      if (c.req.method !== "POST" || c.req.path !== "/monitor") return next();
      return getMw(c.env)(c, next);
    });
  } else {
    app.use(p, async (c, next) => {
      if (c.req.query("preview") === "1" && c.req.method === "GET") return next(); // handler serves truncated preview
      return getMw(c.env)(c, next);
    });
  }
}

async function param(c: any, k: string) {
  let v = c.req.query(k);
  if (!v && c.req.method === "POST") { try { const b = await c.req.json(); v = b?.[k]; } catch {} }
  return typeof v === "string" ? v : "";
}
async function bodyObj(c: any) {
  const q: any = {};
  for (const [k, v] of Object.entries(c.req.query())) q[k] = v;
  if (c.req.method === "POST") {
    try { Object.assign(q, await c.req.json()); } catch {}
  }
  return q;
}
async function cached(c: any, key: string, fn: () => Promise<any>, maxAge = 300) {
  const cache = (caches as any).default as Cache; const req = new Request(`https://cache.agentreader.internal/${key}`);
  const hit = await cache.match(req); if (hit) { const r = new Response(hit.body, hit); r.headers.set("x-cache", "HIT"); return r; }
  try {
    const data = await fn(); const res = new Response(JSON.stringify(data), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${maxAge}` } });
    c.executionCtx.waitUntil(cache.put(req, res.clone())); return res;
  } catch (e: any) {
    const status = e instanceof UserError ? e.status : 502;
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status, headers: { "content-type": "application/json" } });
  }
}
const handle = (p: string, k: string, fn: (v: string) => Promise<any>) => async (c: any) => {
  const v = (await param(c, k)).trim(); if (!v) return c.json({ error: `missing ${k}` }, 400);
  return cached(c, `${p}?${k}=${encodeURIComponent(v)}`, () => fn(v));
};
for (const m of ["get", "post"] as const) {
  app[m]("/read", async (c) => {
    const url = (await param(c, "url")).trim(); if (!url) return c.json({ error: "missing url" }, 400);
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "read", () => readUrl(url), `${CANONICAL}/read?url=${encodeURIComponent(url)}`);
    return cached(c, `read?url=${encodeURIComponent(url)}`, () => readUrl(url));
  });
  app[m]("/links", async (c) => {
    const url = (await param(c, "url")).trim(); if (!url) return c.json({ error: "missing url" }, 400);
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "links", () => linksFor(url), `${CANONICAL}/links?url=${encodeURIComponent(url)}`);
    return cached(c, `links?url=${encodeURIComponent(url)}`, () => linksFor(url));
  });
  app[m]("/check", async (c) => {
    const domain = (await param(c, "domain")).trim(); if (!domain) return c.json({ error: "missing domain" }, 400);
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "check", () => checkDomain(domain), `${CANONICAL}/check?domain=${encodeURIComponent(domain)}`);
    return cached(c, `check?domain=${encodeURIComponent(domain)}`, () => checkDomain(domain));
  });
  app[m]("/company", async (c) => {
    const b = await bodyObj(c);
    const domain = (b.domain || b.name || "").trim();
    if (!domain) return c.json({ error: "missing domain (or name as domain)" }, 400);
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "company", () => companyResearch({ domain }), `${CANONICAL}/company?domain=${encodeURIComponent(domain)}`);
    return cached(c, `company?domain=${encodeURIComponent(domain)}`, () => companyResearch({ domain }), 600);
  });
  app[m]("/uk-company", async (c) => {
    const b = await bodyObj(c);
    if (!(b.number || b.name)) return c.json({ error: "missing number or name" }, 400);
    const key = b.number ? `number=${b.number}` : `name=${b.name}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "uk-company", () => ukCompany(c.env, { number: b.number, name: b.name }), `${CANONICAL}/uk-company?${key}`);
    return cached(c, `uk-company?${encodeURIComponent(key)}`, () => ukCompany(c.env, { number: b.number, name: b.name }), 60);
  });
  app[m]("/uk-company-lite", async (c) => {
    const b = await bodyObj(c);
    if (!(b.number || b.name)) return c.json({ error: "missing number or name" }, 400);
    const key = b.number ? `number=${b.number}` : `name=${b.name}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "uk-company-lite", () => ukCompany(c.env, { number: b.number, name: b.name, lite: true }), `${CANONICAL}/uk-company-lite?${key}`);
    return cached(c, `uk-company-lite?${encodeURIComponent(key)}`, () => ukCompany(c.env, { number: b.number, name: b.name, lite: true }), 60);
  });
  app[m]("/company-full", async (c) => {
    const b = await bodyObj(c);
    const domain = (b.domain || b.name || "").trim();
    if (!domain) return c.json({ error: "missing domain" }, 400);
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "company-full", () => companyFull(c.env, { domain }), `${CANONICAL}/company-full?domain=${encodeURIComponent(domain)}`);
    return cached(c, `company-full?domain=${encodeURIComponent(domain)}`, () => companyFull(c.env, { domain }), 60);
  });
  app[m]("/convert", async (c) => {
    const b = await bodyObj(c);
    const url = (b.url || "").trim();
    if (!url) return c.json({ error: "missing url" }, 400);
    const format = b.format === "text" ? "text" : "markdown";
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "convert", () => convertDocument(url, format), `${CANONICAL}/convert?url=${encodeURIComponent(url)}`);
    return cached(c, `convert?url=${encodeURIComponent(url)}&format=${format}`, () => convertDocument(url, format), 600);
  });
}

app.post("/monitor", async (c) => {
  try {
    const b = await bodyObj(c);
    const mon = await createMonitor(c.env, { url: b.url, webhook: b.webhook, selector: b.selector, keyword: b.keyword });
    return c.json({ ...mon, status_url: `${CANONICAL}/monitor/${mon.id}`, price_paid: PRICES["/monitor"], duration_days: 30, check_interval: "hourly" });
  } catch (e: any) {
    const status = e instanceof UserError ? e.status : 502;
    return c.json({ error: e?.message || String(e) }, status as any);
  }
});
app.notFound((c) => c.json({ error: "not found", see: "/llms.txt" }, 404));

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runMonitors(env).then((r) => console.log("monitors", r)).catch((e) => console.log("monitors error", e)));
  },
};
