// Paid verification: /fx $0.002 + /wallet $0.003
import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
const key = readFileSync(new URL("../.test_wallet_key", import.meta.url), "utf8").trim() as `0x${string}`;
const account = privateKeyToAccount(key);
const client = new x402Client((_v: number, reqs: any[]) => { const r = reqs.find((x) => x.network === "eip155:8453" && BigInt(x.amount) <= 3000n); if (!r) throw new Error("cap"); return r; })
  .register("eip155:8453", new ExactEvmScheme(account as any));
const pay = wrapFetchWithPayment(fetch, client);
async function go(url: string) { const res = await pay(url); const pr = res.headers.get("PAYMENT-RESPONSE"); const s = pr ? decodePaymentResponseHeader(pr) : null; const b = await res.json(); console.log(res.status, url, s?.transaction, JSON.stringify(b).slice(0, 400)); return s; }


await go("https://api.axiomworks.co.uk/fx?base=GBP&symbols=USD,EUR,JPY&amount=250");
