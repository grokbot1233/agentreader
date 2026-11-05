// Paid MCP tool call via the official @x402/mcp client (Streamable HTTP).
import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { wrapMCPClientWithPayment, x402Client } from "@x402/mcp";
import { ExactEvmScheme } from "@x402/evm/exact/client";
const account = privateKeyToAccount(readFileSync(new URL("../.test_wallet_key", import.meta.url), "utf8").trim() as `0x${string}`);
const pc = new x402Client().register("eip155:8453", new ExactEvmScheme(account as any));
const mcp = new Client({ name: "paytest", version: "1" });
await mcp.connect(new StreamableHTTPClientTransport(new URL("https://api.axiomworks.co.uk/mcp")));
const paid: any = wrapMCPClientWithPayment(mcp as any, pc as any, { autoPayment: true } as any);
const r: any = await paid.callTool("gas_fees", { chain: "base" });
console.log(JSON.stringify(r.paymentResponse ?? r._meta ?? {}).slice(0, 300)); console.log(JSON.stringify(r.content).slice(0, 200)); process.exit(0);
