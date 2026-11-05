import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import { privateKeyToAccount } from "viem/accounts";
import { selectTools, zodSchema, payingFetch, callTool, DEFAULT_ORIGIN, type SelectOptions } from "./core.js";
export { CATALOG, type CatalogTool, payingFetch } from "./core.js";

export interface AgentReaderToolkitOptions extends SelectOptions {
  /** EVM private key holding Base USDC. Either this, `account` (viem LocalAccount) or `fetch` is required. */
  privateKey?: `0x${string}` | string;
  account?: any;
  /** Pre-wrapped x402-paying fetch. */
  fetch?: typeof fetch;
  origin?: string;
}

/** LangChain.js tools for Axiom Works AgentReader; each call pays its listed price in USDC on Base via x402. */
export function agentReaderTools(opts: AgentReaderToolkitOptions): StructuredToolInterface[] {
  let f = opts.fetch;
  if (!f) {
    const account = opts.account ?? (opts.privateKey
      ? privateKeyToAccount((opts.privateKey.startsWith("0x") ? opts.privateKey : `0x${opts.privateKey}`) as `0x${string}`)
      : undefined);
    if (!account) throw new Error("agentReaderTools: pass privateKey, account or fetch");
    f = payingFetch(account);
  }
  const origin = opts.origin ?? DEFAULT_ORIGIN;
  return selectTools(opts).map(t =>
    tool(async (args: Record<string, unknown>) => callTool(f!, t, args, origin), {
      name: `agentreader_${t.name}`,
      description: `${t.description} (Paid via x402: ${t.price} USDC on Base.)`,
      schema: zodSchema(t),
    }) as unknown as StructuredToolInterface,
  );
}

export class AgentReaderToolkit {
  tools: StructuredToolInterface[];
  constructor(opts: AgentReaderToolkitOptions) { this.tools = agentReaderTools(opts); }
  getTools() { return this.tools; }
}
