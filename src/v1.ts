// x402 v1 compatibility: legacy clients (x402-fetch, x402-axios, Python x402 <2, older AgentKit)
// read the 402 JSON body (x402Version:1) and pay with an X-PAYMENT header. v2 clients use PAYMENT-REQUIRED header.
import { facilitatorClient } from "./facilitator";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export function v1Reqs(o: { url: string; method: string; atomic: number; desc: string; payTo: string; input?: any; output?: any }) {
  return { scheme: "exact", network: "base", maxAmountRequired: String(o.atomic), resource: o.url, description: o.desc, mimeType: "application/json",
    payTo: o.payTo, maxTimeoutSeconds: 120, asset: USDC,
    outputSchema: { input: { type: "http", method: o.method, discoverable: true, ...(o.method === "GET" ? { queryParams: o.input } : { bodyType: "json", bodyFields: o.input }) }, output: o.output },
    extra: { name: "USD Coin", version: "2" } };
}
export function v1Body(req: any, error = "X-PAYMENT header is required") { return { x402Version: 1, error, accepts: [req] }; }
export function decodeV1(h: string | undefined) {
  if (!h) return null;
  try { const p = JSON.parse(atob(h)); return p?.x402Version === 1 ? p : null; } catch { return null; }
}
// Returns a Response (error) or runs next() and settles.
export async function handleV1(c: any, next: any, payload: any, req: any, log: (r: any) => Promise<void>) {
  const fac: any = facilitatorClient(c.env);
  if (payload.network && payload.network !== "base") return c.json(v1Body(req, "unsupported network; use base"), 402);
  let v: any; try { v = await fac.verify(payload, req); } catch (e: any) { return c.json(v1Body(req, "verify failed: " + String(e?.message || e).slice(0, 200)), 402); }
  if (!v?.isValid) return c.json(v1Body(req, v?.invalidReason || "invalid payment"), 402);
  await next();
  if (c.res.status >= 400) return; // don't charge for failures
  let s: any; try { s = await fac.settle(payload, req); } catch (e: any) { s = { success: false, errorReason: String(e?.message || e).slice(0, 200) }; }
  if (!s?.success) { c.res = new Response(JSON.stringify(v1Body(req, "settle failed: " + (s?.errorReason || "unknown"))), { status: 402, headers: { "content-type": "application/json" } }); return; }
  const h = btoa(JSON.stringify({ success: true, transaction: s.transaction, network: s.network || "base", payer: s.payer || v.payer }));
  c.res = new Response(c.res.body, c.res); c.res.headers.set("X-PAYMENT-RESPONSE", h);
  await log({ endpoint: new URL(req.resource).pathname, payer: s.payer || v.payer || null, amount: req.maxAmountRequired, asset: USDC, network: "eip155:8453", tx: s.transaction, success: true, v: 1 });
}
