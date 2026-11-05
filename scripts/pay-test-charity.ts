// Settle /uk-charity ($0.05) + /uk-charity-full ($0.25) = $0.30 total. Keep spend tiny.
import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const MAX_ATOMIC = 250000n; // $0.25
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
  console.log("name", body.name, "status", body.status, "income", body.income, "flags", body.red_flag_count ?? body.trustees_count);
  if (body.error) console.log("error", body.error);
  if (body.source) console.log("licence_ok", String(body.source).includes("Open Government Licence"));
  return { status: res.status, settlement, body };
}

const lite = await settle("uk-charity", "https://api.axiomworks.co.uk/uk-charity?number=1089464");
const full = await settle("uk-charity-full", "https://api.axiomworks.co.uk/uk-charity-full?number=1089464");
console.log("\nDONE", JSON.stringify({
  lite_tx: lite.settlement?.transaction || lite.settlement,
  full_tx: full.settlement?.transaction || full.settlement,
  lite_ok: lite.status === 200,
  full_ok: full.status === 200,
  lite_name: lite.body?.name,
  full_trustees: full.body?.trustees?.length,
  full_flags: full.body?.red_flag_count,
}, null, 2));
