// Settle /uk-officer ($0.15). Max spend $0.20.
import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const MAX_ATOMIC = 200000n; // $0.20
const key = readFileSync(new URL("../.test_wallet_key", import.meta.url), "utf8").trim() as `0x${string}`;
const account = privateKeyToAccount(key);
const client = new x402Client((_v: number, reqs: any[]) => {
  const r = reqs.find((x: any) => x.network === "eip155:8453" && BigInt(x.amount) <= MAX_ATOMIC);
  if (!r) throw new Error("No acceptable requirement within cap: " + JSON.stringify(reqs.map((x: any) => ({ n: x.network, a: x.amount }))));
  return r;
}).register("eip155:8453", new ExactEvmScheme(account as any));
const pay = wrapFetchWithPayment(fetch, client);
console.log("payer", account.address);

const url = "https://api.axiomworks.co.uk/uk-officer?name=" + encodeURIComponent("Ken Olisa") + "&limit=3";
const res = await pay(url);
console.log("status", res.status);
const pr = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
let settlement: any = null;
if (pr) { try { settlement = decodePaymentResponseHeader(pr); } catch { settlement = pr.slice(0, 120); } }
const body: any = await res.json();
const sample = (body.officers || [])[0];
console.log(JSON.stringify({
  ok: res.status === 200,
  settlement,
  product: body.product,
  hits_total: body.hits_total,
  returned: body.returned,
  sample_name: sample?.name,
  sample_appointment_count: sample?.appointment_count,
  sample_appts: (sample?.appointments || []).length,
  sample_flags: sample?.flags,
  disclaimer_present: !!body.disclaimer,
  spend_usd: 0.15,
  error: body.error || null,
}, null, 2));
