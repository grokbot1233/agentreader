// Settle /chain/pending $0.001 from AgentReader test wallet. Cap $0.01.
import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const MAX_ATOMIC = 10000n; // $0.01
const key = readFileSync(new URL("../.test_wallet_key", import.meta.url), "utf8").trim() as `0x${string}`;
const account = privateKeyToAccount(key);
const client = new x402Client((_v: number, reqs: any[]) => {
  const r = reqs.find((x) => x.network === "eip155:8453" && BigInt(x.amount) <= MAX_ATOMIC);
  if (!r) throw new Error("No acceptable requirement within cap");
  return r;
}).register("eip155:8453", new ExactEvmScheme(account as any));
const pay = wrapFetchWithPayment(fetch, client);
console.log("payer", account.address);
const url = "https://api.axiomworks.co.uk/chain/pending?chain=base";
const res = await pay(url);
console.log("status", res.status);
const pr = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
if (pr) console.log("settlement", decodePaymentResponseHeader(pr));
const body: any = await res.json();
console.log(JSON.stringify(body, null, 2));
