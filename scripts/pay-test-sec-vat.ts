// Settle /us-sec ($0.05) + /us-sec-full ($0.25) + /eu-vat ($0.01) = $0.31 total.
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
  console.log("keys", Object.keys(body).slice(0, 12).join(","));
  if (body.error) console.log("error", body.error);
  if (body.name) console.log("name", body.name);
  if (body.valid != null) console.log("valid", body.valid, body.vat);
  if (body.red_flag_count != null) console.log("red_flags", body.red_flag_count);
  if (body.companyfacts_highlights) console.log("facts", Object.keys(body.companyfacts_highlights));
  return { status: res.status, settlement, body };
}

const lite = await settle("us-sec", "https://api.axiomworks.co.uk/us-sec?ticker=AAPL");
const full = await settle("us-sec-full", "https://api.axiomworks.co.uk/us-sec-full?ticker=AAPL");
const vat = await settle("eu-vat", "https://api.axiomworks.co.uk/eu-vat?vat=IE6388047V");
console.log("\nDONE", JSON.stringify({
  us_sec_tx: lite.settlement?.transaction || lite.settlement,
  us_sec_full_tx: full.settlement?.transaction || full.settlement,
  eu_vat_tx: vat.settlement?.transaction || vat.settlement,
  us_sec_ok: lite.status === 200,
  us_sec_full_ok: full.status === 200,
  eu_vat_ok: vat.status === 200,
  us_sec_name: lite.body?.name,
  us_sec_full_facts: Object.keys(full.body?.companyfacts_highlights || {}),
  eu_vat_valid: vat.body?.valid,
  eu_vat_name: vat.body?.name,
}, null, 2));
