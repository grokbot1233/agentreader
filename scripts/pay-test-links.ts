// Targets the CDP-facilitated canonical endpoint so the first settlement indexes AgentReader in the Coinbase Bazaar.
// ONE paid /read call using @x402/fetch. Max spend: $0.002 (2000 atomic USDC). Run: npx tsx scripts/pay-test.ts
import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const MAX_ATOMIC = 1000n; // $0.001
const key = readFileSync(new URL("../.test_wallet_key", import.meta.url), "utf8").trim() as `0x${string}`;
const account = privateKeyToAccount(key);
const client = new x402Client((_v: number, reqs: any[]) => {
  const r = reqs.find((x) => x.network === "eip155:8453" && BigInt(x.amount) <= MAX_ATOMIC);
  if (!r) throw new Error("No acceptable requirement within $0.001 cap");
  return r;
}).register("eip155:8453", new ExactEvmScheme(account as any));
const pay = wrapFetchWithPayment(fetch, client);
console.log("payer", account.address);
const res = await pay("https://api.axiomworks.co.uk/links?url=https://example.com");
console.log("status", res.status);
const pr = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
if (pr) console.log("settlement", decodePaymentResponseHeader(pr));
const body: any = await res.json(); console.log("title", "links", body.count);
