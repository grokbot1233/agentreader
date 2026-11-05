import { Actor } from "apify";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

await Actor.init();
const input = (await Actor.getInput()) || {};
const { sic, location, postcodeArea, days = 1, withDirectors = true, limit = 25, agentreaderPrivateKey } = input;
if (!agentreaderPrivateKey) throw new Error("agentreaderPrivateKey required (Base USDC x402 payer)");
if (!sic && !location && !postcodeArea) throw new Error("Provide sic and/or location and/or postcodeArea");

const account = privateKeyToAccount(agentreaderPrivateKey.startsWith("0x") ? agentreaderPrivateKey : `0x${agentreaderPrivateKey}`);
const client = new x402Client().register("eip155:8453", new ExactEvmScheme(account));
const pay = wrapFetchWithPayment(fetch, client);
const path = withDirectors ? "uk-leads" : "uk-leads-lite";
const q = new URLSearchParams({ days: String(days), limit: String(limit) });
if (sic) q.set("sic", sic);
if (location) q.set("location", location);
if (postcodeArea) q.set("postcode_area", postcodeArea);
const res = await pay(`https://api.axiomworks.co.uk/${path}?${q}`);
if (!res.ok) throw new Error(`AgentReader ${res.status}: ${(await res.text()).slice(0, 300)}`);
const data = await res.json();
for (const c of data.companies || []) await Actor.pushData(c);
await Actor.setValue("SUMMARY", { returned: data.returned, hits: data.hits_total_unfiltered_by_postcode, query: data.query, attribution: data.attribution });
await Actor.exit();
