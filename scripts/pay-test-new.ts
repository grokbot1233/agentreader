// Settle new paid routes within $0.60 total budget.
// Settles: /convert $0.03 + /company $0.25 = $0.28. Skips /uk-company ($0.50) and /monitor ($1.00).
import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const MAX_ATOMIC = 300000n; // $0.30 per-call cap (covers convert + company individually)
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
  console.log("keys", Object.keys(body).slice(0, 12));
  if (body.error) console.log("error", body.error);
  if (body.domain) console.log("domain", body.domain, "title", body.homepage?.title);
  if (body.detected_format) console.log("format", body.detected_format, "words", body.word_count);
  if (body.company_number) console.log("company", body.company_number, body.profile?.name || body.overview?.name);
  return { status: res.status, settlement, body };
}

const results: any = {};
results.convert = await settle("convert", "https://api.axiomworks.co.uk/convert?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf&format=markdown");
results.company = await settle("company", "https://api.axiomworks.co.uk/company?domain=example.com");
console.log("\nDONE", JSON.stringify({
  convert_tx: results.convert.settlement?.transaction || results.convert.settlement,
  company_tx: results.company.settlement?.transaction || results.company.settlement,
  convert_ok: results.convert.status === 200,
  company_ok: results.company.status === 200,
}, null, 2));
