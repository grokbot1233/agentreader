// Settle /lei ($0.005) + /read-batch ($0.015) from test wallet. Cap $0.05.
import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const MAX_ATOMIC = 50000n; // $0.05
const key = readFileSync(new URL("../.test_wallet_key", import.meta.url), "utf8").trim() as `0x${string}`;
const account = privateKeyToAccount(key);
const client = new x402Client((_v: number, reqs: any[]) => {
  const r = reqs.find((x) => x.network === "eip155:8453" && BigInt(x.amount) <= MAX_ATOMIC);
  if (!r) throw new Error("No acceptable requirement within cap");
  return r;
}).register("eip155:8453", new ExactEvmScheme(account as any));
const pay = wrapFetchWithPayment(fetch, client);
console.log("payer", account.address);

async function settle(label: string, url: string) {
  console.log("\n==>", label, url);
  const res = await pay(url);
  console.log("status", res.status);
  const pr = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
  let settlement: any = null;
  if (pr) { settlement = decodePaymentResponseHeader(pr); console.log("settlement", settlement); }
  const body: any = await res.json();
  console.log("keys", Object.keys(body).slice(0, 14).join(","));
  if (body.error) console.log("error", body.error);
  if (body.lei) console.log("lei", body.lei, body.legal_name, "parents", JSON.stringify(body.parents));
  if (body.count != null) console.log("count", body.count, "ok", body.ok_count);
  return { status: res.status, settlement, body };
}

const lei = await settle("lei", "https://api.axiomworks.co.uk/lei?lei=HWUPKR0MPOU8FGXBT394");
const batch = await settle("read-batch", "https://api.axiomworks.co.uk/read-batch?urls=https://example.com,https://example.org");
console.log("\nDONE", JSON.stringify({
  lei_ok: lei.status === 200,
  lei_tx: lei.settlement?.transaction || lei.settlement,
  lei_name: lei.body?.legal_name,
  lei_parents: lei.body?.parents,
  batch_ok: batch.status === 200,
  batch_tx: batch.settlement?.transaction || batch.settlement,
  batch_count: batch.body?.count,
  batch_ok_count: batch.body?.ok_count,
}, null, 2));
