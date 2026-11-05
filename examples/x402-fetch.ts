/** Minimal @x402/fetch client — settle any AgentReader paid route */
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const client = new x402Client().register("eip155:8453", new ExactEvmScheme(account));
const fetchPaid = wrapFetchWithPayment(fetch, client);

const r = await fetchPaid("https://api.axiomworks.co.uk/uk-company-lite?number=00445790");
console.log(r.status, await r.json());
