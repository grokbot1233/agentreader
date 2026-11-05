import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const MAX_ATOMIC = 30000n;
const key = readFileSync(new URL("../.test_wallet_key", import.meta.url), "utf8").trim() as `0x${string}`;
const account = privateKeyToAccount(key);
const client = new x402Client((_v, reqs: any[]) => {
  const r = reqs.find((x) => x.network === "eip155:8453" && BigInt(x.amount) <= MAX_ATOMIC);
  if (!r) throw new Error("no req");
  return r;
}).register("eip155:8453", new ExactEvmScheme(account as any));
const pay = wrapFetchWithPayment(fetch, client);
const url = "https://api.axiomworks.co.uk/convert?url=" + encodeURIComponent("https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf") + "&format=markdown";
console.log("payer", account.address);
const res = await pay(url);
console.log("status", res.status);
const pr = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
if (pr) console.log("settlement", decodePaymentResponseHeader(pr));
const body: any = await res.json();
console.log({ format: body.detected_format, pages: body.pages, words: body.word_count, err: body.error, preview: (body.markdown || body.text || "").slice(0, 100) });
