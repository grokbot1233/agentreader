// PREVIEW ONLY: /au-company over ASIC company dataset shards in Workers Static Assets (run_worker_first => shards never public).
import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { facilitatorClient } from "../../../src/facilitator";
type Env = { AU_INTERNAL_KEY?: string; ASSETS: Fetcher; PAY_TO: string; FACILITATOR_URL?: string };
const NETWORK = "eip155:8453", PRICE = "$0.02";
const ATTR = "ASIC Company Dataset (data.gov.au), CC BY 3.0 AU. Snapshot COMPANY_202611.";
const TYPES: any = { APTY: "Australian Proprietary Company", APUB: "Australian Public Company", ASSN: "Association", BUSN: "Business Name", CHAR: "Charity", COMP: "Community Purpose", COOP: "Co-operative Society", FNOS: "Foreign Company", LTDP: "Limited Partnership", MISM: "Managed Investment Scheme", NONC: "Non Company", NRET: "Non Registered Entity", RACN: "Registered Australian Body", REBD: "Registered Body", RSVN: "Name Reservation", SOLS: "Solicitor Corporation", TRST: "Trust" };
const STATUS: any = { REGD: "Registered", DRGD: "Deregistered", SOFF: "Strike-off action in progress", EXAD: "External administration" };
async function lookup(env: Env, acn: string): Promise<any> {
  const r = await env.ASSETS.fetch(new Request(`https://assets.local/_au/${acn.slice(0, 4)}.json`)); if (!r.ok) return null;
  // CPU-light: slice just this company's object out of the shard instead of JSON.parse on up to ~640 KB
  const txt = await r.text(); const key = `"${acn}":{`; const i = txt.indexOf(key);
  return i < 0 ? null : JSON.parse(txt.slice(i + key.length - 1, txt.indexOf("]}", i) + 2));
}
function full(acn: string, e: any) { return { acn, abn: e.abn, name: e.n, former_names: e.fn || [], type: e.t, type_desc: TYPES[e.t] || null, class: e.c, status: e.s, status_desc: STATUS[e.s] || null, registered: e.r, deregistered: e.d, source: ATTR }; }
const app = new Hono<{ Bindings: Env }>();
function acnOf(c: any) { const raw = (c.req.query("acn") || c.req.query("abn") || "").replace(/\s/g, ""); if (/^\d{11}$/.test(raw)) return raw.slice(2); return /^\d{9}$/.test(raw) ? raw : null; }
app.get("/", (c) => c.json({ preview_worker: true, route: "/au-company?acn=004028077 (or ?abn=11 digits)", price: PRICE, free_preview: "/au-company?acn=004028077&preview=1", coverage: "full COMPANY_202611 snapshot, 4,022,670 companies", source: ATTR }));
app.use("/au-company", async (c, next) => {
  if (!acnOf(c)) return c.json({ error: "acn must be 9 digits (or abn 11 digits)" }, 400);
  if (c.req.query("preview") === "1") return next();
  let mw: any = (globalThis as any).__mw;
  if (!mw) {
    const server = new x402ResourceServer(facilitatorClient(c.env)).register(NETWORK, new ExactEvmScheme());
    mw = (globalThis as any).__mw = paymentMiddleware({ "GET /au-company": { accepts: [{ scheme: "exact", price: PRICE, network: NETWORK, payTo: c.env.PAY_TO, maxTimeoutSeconds: 120 }], description: "Australian company (ASIC register) lookup by ACN/ABN: name, former names, type, class, status, registration/deregistration dates, ABN. " + PRICE, mimeType: "application/json" } } as any, server);
  }
  return mw(c, next);
});
app.get("/au-company", async (c) => {
  const acn = acnOf(c)!;
  const e = await lookup(c.env, acn);
  if (!e) return c.json({ acn, found: false, source: ATTR }, 404);
  const fullR = full(acn, e);
  if (c.req.query("preview") === "1") return c.json({ preview: true, acn, name: fullR.name, status: fullR.status, omitted: ["abn", "former_names", "type", "dates"], full_price: PRICE });
  return c.json(fullR);
});
// Service-binding-only path for the production Worker (shared secret; 403 otherwise).
app.get("/internal/au", async (c) => {
  if (!c.env.AU_INTERNAL_KEY || c.req.header("x-internal-key") !== c.env.AU_INTERNAL_KEY) return c.json({ error: "forbidden" }, 403);
  const acn = c.req.query("acn") || ""; if (!/^\d{9}$/.test(acn)) return c.json({ error: "bad acn" }, 400);
  const e = await lookup(c.env, acn); if (!e) return c.json({ acn, found: false }, 404); return c.json(full(acn, e));
});
app.all("*", (c) => c.json({ error: "not found" }, 404));
export default app;
