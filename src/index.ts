import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { readUrl, linksFor, checkDomain, UserError } from "./core";
import { handleMcp } from "./mcp";
import { dashboardHtml } from "./dashboard";

type Env = { LOG: KVNamespace; STATS_SECRET: string; DASHBOARD_KEY: string; PAY_TO: string; FACILITATOR_URL: string };
const NETWORK = "eip155:8453";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PRICES = { "/read": "$0.002", "/links": "$0.001", "/check": "$0.001" } as const;
const ATOMIC: Record<string, number> = { "/read": 2000, "/links": 1000, "/check": 1000 };

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

const DESC = {
  "/read": "Fetch any public web page and return clean Markdown plus metadata (title, description, canonical URL, author, publish date, language, word count, outbound links) as JSON.",
  "/links": "Fetch a public web page and return all extracted, de-duplicated absolute links with anchor text and internal/external flag.",
  "/check": "Domain health check: DNS records via DNS-over-HTTPS (A, AAAA, CNAME, MX, TXT, NS, CAA, SOA, DNSSEC), HTTPS/TLS reachability, HTTP status and redirect chain, HSTS, email auth (MX, SPF, DMARC) and a list of issues.",
};
const OUT: any = { "/read": readOut, "/links": linksOut, "/check": checkOut };
const EX: any = { "/read": { url: "https://example.com" }, "/links": { url: "https://example.com" }, "/check": { domain: "example.com" } };
const IN: any = { "/read": urlIn, "/links": urlIn, "/check": checkIn };

function routes(payTo: string) {
  const r: any = {};
  for (const p of Object.keys(PRICES) as (keyof typeof PRICES)[]) {
    for (const method of ["GET", "POST"]) {
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
  const fac = new HTTPFacilitatorClient({ url: env.FACILITATOR_URL || "https://facilitator.payai.network" });
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

function base(c: any) { return new URL(c.req.url).origin; }
function discovery(c: any) {
  const b = base(c);
  return { x402Version: 2, name: "AgentReader", description: "Pay-per-call web reading & domain health API for AI agents. USDC on Base via x402.",
    resources: Object.keys(PRICES).map((p) => `${b}${p}`),
    items: Object.entries(PRICES).map(([p, price]) => ({ resource: `${b}${p}`, methods: ["GET", "POST"], description: (DESC as any)[p], mimeType: "application/json",
      accepts: [{ scheme: "exact", network: NETWORK, amount: String(ATOMIC[p]), price, asset: USDC, payTo: c.env.PAY_TO, maxTimeoutSeconds: 120, extra: { name: "USD Coin", version: "2" } }],
      input: { type: "http", method: "GET", queryParams: IN[p] }, output: OUT[p] })),
    ownershipProofs: [] };
}

app.get("/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));
app.get("/.well-known/x402", (c) => c.json(discovery(c)));
app.get("/.well-known/x402.json", (c) => c.json(discovery(c)));
app.get("/openapi.json", (c) => {
  const b = base(c); const paths: any = {};
  for (const [p, price] of Object.entries(PRICES)) {
    const params = Object.entries(IN[p].properties).map(([k, v]: any) => ({ name: k, in: "query", required: true, schema: { type: "string" }, description: v.description }));
    const resp = { "200": { description: "Success", content: { "application/json": { schema: OUT[p] } } }, "402": { description: `Payment required: ${price} USDC on Base (x402 v2, see PAYMENT-REQUIRED header)` }, "400": { description: "Bad input" } };
    paths[p] = { get: { summary: (DESC as any)[p], parameters: params, responses: resp, "x-price": price, "x-402": { network: NETWORK, asset: USDC, amount: String(ATOMIC[p]) } },
      post: { summary: (DESC as any)[p], requestBody: { content: { "application/json": { schema: IN[p] } } }, responses: resp, "x-price": price } };
  }
  return c.json({ openapi: "3.1.0", info: { title: "AgentReader", version: "1.0.0", description: "x402 pay-per-call web reader for AI agents. Payments: USDC on Base mainnet (eip155:8453)." },
    servers: [{ url: b }], paths });
});
const llms = (b: string, payTo: string) => `# AgentReader

> Pay-per-call web reading and domain-health API for AI agents. No API keys or accounts: pay per request with the x402 protocol (HTTP 402), USDC on Base mainnet (eip155:8453), payTo ${payTo}.

## Paid endpoints (x402 v2, scheme "exact")
- GET|POST ${b}/read?url=URL  - $0.002 - clean Markdown + metadata (title, description, canonical, author, date, language, word count, links)
- GET|POST ${b}/links?url=URL - $0.001 - extracted absolute links with anchor text
- GET|POST ${b}/check?domain=DOMAIN - $0.001 - DNS (DoH), TLS/HTTPS reachability, redirects, HSTS, MX/SPF/DMARC, issues list
POST bodies are JSON: {"url": "..."} or {"domain": "..."}.

## How to pay
Call the endpoint; you get HTTP 402 with a PAYMENT-REQUIRED header (base64 JSON, x402 v2). Sign an EIP-3009 USDC authorization and retry with PAYMENT-SIGNATURE. Any x402 client works (e.g. @x402/fetch, x402-axios).

## Free endpoints
- ${b}/ - description
- ${b}/openapi.json - OpenAPI 3.1
- ${b}/.well-known/x402 - x402 discovery metadata
- ${b}/llms.txt - this file
- ${b}/health

## Limits
Public http(s) URLs only (private/internal IPs blocked), 3 MB max document, 10 s timeout, 5 redirects. Results cached ~5 minutes.
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
  const ok = recs.filter((r) => r.success !== false).sort((a, b) => a.ts < b.ts ? -1 : 1);
  const byEndpoint: any = {}, byDay: any = {}; const payers = new Set<string>(); let atomic = 0;
  for (const r of ok) { const a = Number(r.amount || 0); atomic += a; if (r.payer) payers.add(r.payer.toLowerCase());
    (byEndpoint[r.endpoint] ??= { calls: 0, revenue_usdc: 0 }).calls++; byEndpoint[r.endpoint].revenue_usdc += a / 1e6;
    const d = r.ts.slice(0, 10); (byDay[d] ??= { calls: 0, revenue_usdc: 0 }).calls++; byDay[d].revenue_usdc += a / 1e6; }
  return { paid_calls: ok.length, revenue_usdc: atomic / 1e6, unique_payers: payers.size, by_endpoint: byEndpoint, by_day: byDay, recent: ok.slice(-20).reverse(), generated: new Date().toISOString() };
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
  if (!(await keyOk(c.req.query("key") || "", c.env.DASHBOARD_KEY || ""))) return c.text("unauthorized", 401);
  c.header("cache-control", "no-store"); return c.html(dashboardHtml());
});
app.get("/dashboard/data", async (c) => {
  if (!(await keyOk(c.req.query("key") || "", c.env.DASHBOARD_KEY || ""))) return c.json({ error: "unauthorized" }, 401);
  const t = Date.now(); let health: any = { ok: true };
  try { await c.env.LOG.get("health-probe"); health.kv_ms = Date.now() - t; } catch (e: any) { health = { ok: false, error: String(e) }; }
  c.header("cache-control", "no-store"); return c.json({ ...(await stats(c.env)), health });
});
app.all("/mcp", (c) => handleMcp(c.req.raw, c.env, (r) => logPay(c.env, r)));

// Paid routes: payment middleware ALWAYS runs first. No bypass.
app.use("/read", (c, n) => getMw(c.env)(c, n));
app.use("/links", (c, n) => getMw(c.env)(c, n));
app.use("/check", (c, n) => getMw(c.env)(c, n));

async function param(c: any, k: string) {
  let v = c.req.query(k);
  if (!v && c.req.method === "POST") { try { const b = await c.req.json(); v = b?.[k]; } catch {} }
  return typeof v === "string" ? v : "";
}
async function cached(c: any, key: string, fn: () => Promise<any>) {
  const cache = (caches as any).default as Cache; const req = new Request(`https://cache.agentreader.internal/${key}`);
  const hit = await cache.match(req); if (hit) { const r = new Response(hit.body, hit); r.headers.set("x-cache", "HIT"); return r; }
  try {
    const data = await fn(); const res = new Response(JSON.stringify(data), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } });
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
  app[m]("/read", handle("read", "url", readUrl));
  app[m]("/links", handle("links", "url", linksFor));
  app[m]("/check", handle("check", "domain", checkDomain));
}
app.notFound((c) => c.json({ error: "not found", see: "/llms.txt" }, 404));
export default app;
