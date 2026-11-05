// Paid verification of /token-check ($0.01) then /tx ($0.003) on the settlement hash. Total $0.013.
import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
const key = readFileSync(new URL("../.test_wallet_key", import.meta.url), "utf8").trim() as `0x${string}`;
const account = privateKeyToAccount(key);
const client = new x402Client((_v: number, reqs: any[]) => { const r = reqs.find((x) => x.network === "eip155:8453" && BigInt(x.amount) <= 10000n); if (!r) throw new Error("cap"); return r; })
  .register("eip155:8453", new ExactEvmScheme(account as any));
const pay = wrapFetchWithPayment(fetch, client);
async function go(url: string) { const res = await pay(url); const pr = res.headers.get("PAYMENT-RESPONSE"); const s = pr ? decodePaymentResponseHeader(pr) : null; const b = await res.json(); console.log(res.status, url, s?.transaction, JSON.stringify(b).slice(0, 400)); return s; }
const s = await go("https://api.axiomworks.co.uk/token-check?address=0x940181a94A35A4569E4529A3CDfB74e38FD98631&chain=base");
await new Promise((r) => setTimeout(r, 4000));
await go(`https://api.axiomworks.co.uk/tx?hash=${s?.transaction}&chain=base`);
