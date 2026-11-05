import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const key = readFileSync(new URL("../.test_wallet_key", import.meta.url), "utf8").trim() as `0x${string}`;
const account = privateKeyToAccount(key);
const client = new x402Client((_v: number, reqs: any[]) => {
  const r = reqs.find((x) => x.network === "eip155:8453" && BigInt(x.amount) <= 700000n);
  if (!r) throw new Error("no req"); return r;
}).register("eip155:8453", new ExactEvmScheme(account as any));
const pay = wrapFetchWithPayment(fetch, client);

async function main() {
  const res = await pay("https://api.axiomworks.co.uk/company-full?domain=tesco.com");
  const pr = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
  let settlement: any = null; if (pr) settlement = decodePaymentResponseHeader(pr);
  const body: any = await res.json();
  console.log(JSON.stringify({
    status: res.status,
    tx: settlement?.transaction,
    domain: body.domain,
    uk_included: body.uk_included,
    uk_name: body.uk?.profile?.name || body.uk?.name,
    company_error: body.company_error,
    company_title: body.company?.homepage?.title,
    uk_skip: body.uk_skip_reason,
    flags: body.uk?.red_flags?.map((f: any) => f.flag),
  }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
