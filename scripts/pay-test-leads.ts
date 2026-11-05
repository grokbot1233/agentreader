import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const MAX_ATOMIC = 300000n; // $0.30 cap — lite only
const key = readFileSync(new URL("../.test_wallet_key", import.meta.url), "utf8").trim() as `0x${string}`;
const account = privateKeyToAccount(key);
const client = new x402Client((_v: number, reqs: any[]) => {
  const r = reqs.find((x) => x.network === "eip155:8453" && BigInt(x.amount) <= MAX_ATOMIC);
  if (!r) throw new Error("No acceptable requirement within cap: " + JSON.stringify(reqs.map((x) => ({ n: x.network, a: x.amount }))));
  return r;
}).register("eip155:8453", new ExactEvmScheme(account as any));
const pay = wrapFetchWithPayment(fetch, client);
console.log("payer", account.address);

const url = "https://api.axiomworks.co.uk/uk-leads-lite?sic=62012&days=1&limit=10";
const res = await pay(url);
console.log("status", res.status);
const pr = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
let settlement: any = null;
if (pr) { try { settlement = decodePaymentResponseHeader(pr); } catch { settlement = pr.slice(0, 120); } }
const body: any = await res.json();
console.log(JSON.stringify({
  ok: res.status === 200,
  settlement,
  returned: body.returned,
  hits: body.hits_total_unfiltered_by_postcode,
  sample: (body.companies || [])[0],
  product: body.product,
  spend_usd: 0.25,
}, null, 2));
