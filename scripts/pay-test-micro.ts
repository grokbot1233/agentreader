// One paid call per micro-lookup route (total $0.012) so Bazaar indexes them.
import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
const account = privateKeyToAccount(readFileSync(new URL("../.test_wallet_key", import.meta.url), "utf8").trim() as `0x${string}`);
const client = new x402Client((_v: number, reqs: any[]) => { const r = reqs.find((x) => x.network === "eip155:8453" && BigInt(x.amount) <= 10000n); if (!r) throw new Error("cap"); return r; })
  .register("eip155:8453", new ExactEvmScheme(account as any));
const pay = wrapFetchWithPayment(fetch, client);
const B = "https://api.axiomworks.co.uk";
const urls = (process.argv[2] ? process.argv[2].split(",") : ["/ens?name=vitalik.eth", "/token?address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&chain=base",
  "/allowance?token=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&owner=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&spender=0x000000000022D473030F116dDEE9F6B43aC78BA3&chain=base",
  "/contract?address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&chain=base", "/gas?chain=base", "/block?timestamp=2026-01-01T00:00:00Z&chain=base",
  "/nft?contract=0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D&token_id=1&chain=ethereum"]);
for (const u of urls) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 45000);
  try { const r = await pay(B + u, { signal: ac.signal }); const pr = r.headers.get("PAYMENT-RESPONSE"); console.log(r.status, u.split("?")[0], pr ? decodePaymentResponseHeader(pr).transaction : null, (await r.text()).slice(0, 300)); }
  catch (e: any) { console.log("ERR", u.split("?")[0], e.message); } finally { clearTimeout(t); }
}
