// Settle /chain/erc721-tokens $0.002 from AgentReader test wallet. Cap $0.01.
import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const MAX_ATOMIC = 10000n; // $0.01 (>= 2000)
const key = readFileSync(new URL("../.test_wallet_key", import.meta.url), "utf8").trim() as `0x${string}`;
const account = privateKeyToAccount(key);
const client = new x402Client((_v: number, reqs: any[]) => {
  const r = reqs.find((x) => x.network === "eip155:8453" && BigInt(x.amount) <= MAX_ATOMIC);
  if (!r) throw new Error("No acceptable requirement within cap");
  return r;
}).register("eip155:8453", new ExactEvmScheme(account as any));
const pay = wrapFetchWithPayment(fetch, client);
console.log("payer", account.address);
const url = "https://api.axiomworks.co.uk/chain/erc721-tokens?contract=0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D&address=0x46efbaedc92067e6d60e84ed6395099723252496&chain=ethereum&limit=10";
const res = await pay(url);
console.log("status", res.status);
const pr = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
if (pr) console.log("settlement", decodePaymentResponseHeader(pr));
const body: any = await res.json();
console.log(JSON.stringify(body, null, 2));
