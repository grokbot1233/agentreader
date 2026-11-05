import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { createSIWxPayload, encodeSIWxHeader } from "@x402/extensions/sign-in-with-x";

const key = readFileSync(new URL("../.test_wallet_key", import.meta.url), "utf8").trim() as `0x${string}`;
const account = privateKeyToAccount(key);
const ORIGIN = "https://api.axiomworks.co.uk";
const paths = ["/company", "/uk-company", "/uk-company-lite", "/convert", "/monitor"];
const regUrl = "https://www.x402scan.com/api/x402/registry/register";

async function register(path: string) {
  const url = ORIGIN + path;
  const first = await fetch(regUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
  const body: any = await first.json();
  if (first.status !== 402) {
    console.log(path, "unexpected", first.status, JSON.stringify(body).slice(0, 400));
    return;
  }
  const ext = body.extensions?.["sign-in-with-x"];
  const info = { ...ext.info, chainId: ext.info.chainId || "eip155:8453", type: ext.info.type || "eip191" };
  const payload = await createSIWxPayload(info as any, account as any, first.url || regUrl);
  const header = encodeSIWxHeader(payload);
  const second = await fetch(regUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "SIGN-IN-WITH-X": header },
    body: JSON.stringify({ url }),
  });
  const out = await second.text();
  console.log(path, second.status, out.slice(0, 500));
}

for (const p of paths) await register(p);
