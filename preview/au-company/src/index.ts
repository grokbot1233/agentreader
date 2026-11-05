// PREVIEW ONLY: /au-company over ASIC company dataset shards in Workers Static Assets (run_worker_first => shards never public).
import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { facilitatorClient } from "../../../src/facilitator";
type Env = { ASSETS: Fetcher; PAY_TO: string; FACILITATOR_URL?: string };
const NETWORK = "eip155:8453", PRICE = "$0.02";
const ATTR = "ASIC Company Dataset (data.gov.au), CC BY 3.0 AU. Snapshot COMPANY_202611.";
const TYPES: any = { APTY: "Australian Proprietary Company", APUB: "Australian Public Company", ASSN: "Association", BUSN: "Business Name", CHAR: "Charity", COMP: "Community Purpose", COOP: "Co-operative Society", FNOS: "Foreign Company", LTDP: "Limited Partnership", MISM: "Managed Investment Scheme", NONC: "Non Company", NRET: "Non Registered Entity", RACN: "Registered Australian Body", REBD: "Registered Body", RSVN: "Name Reservation", SOLS: "Solicitor Corporation", TRST: "Trust" };
const STATUS: any = { REGD: "Registered", DRGD: "Deregistered", SOFF: "Strike-off action in progress", EXAD: "External administration" };
const app = new Hono<{ Bindings: Env }>();
function acnOf(c: any) { const raw = (c.req.query("acn") || c.req.query("abn") || "").replace(/\s/g, ""); if (/^\d{11}$/.test(raw)) return raw.slice(2); return /^\d{9}$/.test(raw) ? raw : null; }
app.get("/", (c) => c.json({ preview_worker: true, route: "/au-company?acn=004028077 (or ?abn=11 digits)", price: PRICE, free_preview: "/au-company?acn=004028077&preview=1", sample_prefixes: "0000,0001,0002,0004,0009,0040,0096 only", source: ATTR }));
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
  const r = await c.env.ASSETS.fetch(new Request(`https://assets.local/_au/${acn.slice(0, 4)}.json`));
  if (!r.ok) return c.json({ acn, found: false, note: "shard not loaded in preview sample" }, 404);
  const e = ((await r.json()) as any)[acn];
  if (!e) return c.json({ acn, found: false, source: ATTR }, 404);
  const full = { acn, abn: e.abn, name: e.n, former_names: e.fn || [], type: e.t, type_desc: TYPES[e.t] || null, class: e.c, status: e.s, status_desc: STATUS[e.s] || null, registered: e.r, deregistered: e.d, source: ATTR };
  if (c.req.query("preview") === "1") return c.json({ preview: true, acn, name: full.name, status: full.status, omitted: ["abn", "former_names", "type", "dates"], full_price: PRICE });
  return c.json(full);
});
app.all("*", (c) => c.json({ error: "not found" }, 404));
export default app;
