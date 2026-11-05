// Settle /sanctions ($0.05) hit + miss. Batch ($1) needs wallet balance >= $1.
import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const MAX_ATOMIC = 100000n; // $0.10 — raise to 1000000n for batch
const key = readFileSync(new URL("../.test_wallet_key", import.meta.url), "utf8").trim() as `0x${string}`;
const account = privateKeyToAccount(key);
const client = new x402Client((_v: number, reqs: any[]) => {
  const r = reqs.find((x: any) => x.network === "eip155:8453" && BigInt(x.amount) <= MAX_ATOMIC);
  if (!r) throw new Error("No acceptable requirement");
  return r;
}).register("eip155:8453", new ExactEvmScheme(account as any));
const pay = wrapFetchWithPayment(fetch, client);
console.log("payer", account.address);

async function settle(label: string, url: string, init?: RequestInit) {
  console.log("\n==>", label, url);
  const res = await pay(url, init);
  console.log("status", res.status);
  const pr = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
  let settlement: any = null;
  if (pr) { settlement = decodePaymentResponseHeader(pr); console.log("settlement", settlement); }
  const body: any = await res.json();
  if (body.error) console.log("error", body.error);
  if (body.possible_match != null) console.log("possible_match", body.possible_match, "match_count", body.match_count, "highest", body.highest_score);
  if (body.matches?.[0]) console.log("top", body.matches[0].list, body.matches[0].name, body.matches[0].score);
  return { status: res.status, settlement, body };
}

const hit = await settle("sanctions-hit", "https://api.axiomworks.co.uk/sanctions?name=" + encodeURIComponent("BANCO NACIONAL DE CUBA"));
const miss = await settle("sanctions-miss", "https://api.axiomworks.co.uk/sanctions?name=" + encodeURIComponent("Alice Wonderland XYZ Quux"));
console.log("\nDONE", JSON.stringify({
  hit_tx: hit.settlement?.transaction || null,
  miss_tx: miss.settlement?.transaction || null,
  hit_ok: hit.status === 200 && hit.body?.possible_match === true,
  miss_ok: miss.status === 200 && miss.body?.possible_match === false,
}, null, 2));
