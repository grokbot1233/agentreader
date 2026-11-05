import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const MAX_ATOMIC = 1100000n; // $1.10 per-call cap (covers monitor $1)
const key = readFileSync(new URL("../.test_wallet_key", import.meta.url), "utf8").trim() as `0x${string}`;
const account = privateKeyToAccount(key);
const client = new x402Client((_v: number, reqs: any[]) => {
  const r = reqs.find((x) => x.network === "eip155:8453" && BigInt(x.amount) <= MAX_ATOMIC);
  if (!r) throw new Error("No acceptable requirement within cap: " + JSON.stringify(reqs.map((x) => ({ n: x.network, a: x.amount }))));
  return r;
}).register("eip155:8453", new ExactEvmScheme(account as any));
const pay = wrapFetchWithPayment(fetch, client);
console.log("payer", account.address);

async function settle(label: string, url: string, init?: RequestInit) {
  console.log("\n==>", label, url, init?.method || "GET");
  const res = await pay(url, init);
  console.log("status", res.status);
  const pr = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
  let settlement: any = null;
  if (pr) {
    try { settlement = decodePaymentResponseHeader(pr); } catch { settlement = pr.slice(0, 80); }
    console.log("settlement", settlement);
  }
  const text = await res.text();
  let body: any; try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }
  console.log("summary", {
    error: body.error,
    name: body.name || body.profile?.name,
    mode: body.mode,
    flags: body.red_flags?.map?.((f: any) => f.flag) || body.red_flag_names,
    domain: body.domain,
    uk_included: body.uk_included,
    monitor_id: body.id,
    status_url: body.status_url,
  });
  return { status: res.status, settlement, body };
}

const results: any = {};
results.lite = await settle("uk-company-lite", "https://api.axiomworks.co.uk/uk-company-lite?number=00445790");
results.uk = await settle("uk-company", "https://api.axiomworks.co.uk/uk-company?number=00445790");
results.monitor = await settle("monitor", "https://api.axiomworks.co.uk/monitor", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url: "https://example.com",
    webhook: "https://api.axiomworks.co.uk/hooks/sink",
    keyword: "Example",
  }),
});
results.full = await settle("company-full", "https://api.axiomworks.co.uk/company-full?domain=tesco.com");

function tx(s: any) {
  return s?.transaction || s?.tx || s?.hash || s;
}
console.log("\nDONE", JSON.stringify({
  lite_tx: tx(results.lite.settlement), lite_ok: results.lite.status === 200,
  uk_tx: tx(results.uk.settlement), uk_ok: results.uk.status === 200,
  monitor_tx: tx(results.monitor.settlement), monitor_ok: results.monitor.status === 200, monitor_id: results.monitor.body?.id,
  full_tx: tx(results.full.settlement), full_ok: results.full.status === 200, uk_included: results.full.body?.uk_included,
  approx_spend_usd: 0.05 + 0.50 + 1.00 + 0.65,
}, null, 2));
