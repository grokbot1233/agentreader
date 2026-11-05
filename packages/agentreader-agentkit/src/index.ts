import { ActionProvider, EvmWalletProvider, type Action, type Network } from "@coinbase/agentkit";
import { selectTools, zodSchema, payingFetch, callTool, DEFAULT_ORIGIN, type SelectOptions } from "./core.js";
export { CATALOG, type CatalogTool } from "./core.js";

export interface AgentReaderActionProviderOptions extends SelectOptions {
  /** API origin. Default https://api.axiomworks.co.uk */
  origin?: string;
}

/**
 * AgentKit action provider exposing Axiom Works AgentReader x402 tools (web read, UK/US/EU company
 * data, single-fact EVM reads, FX…). Each call is paid in USDC on Base by the agent's own EVM wallet
 * (wallet must hold Base USDC). Prices are in each action's description; default cap $0.05/call.
 */
export class AgentReaderActionProvider extends ActionProvider<EvmWalletProvider> {
  constructor(private opts: AgentReaderActionProviderOptions = {}) {
    super("agentreader", []);
  }

  getActions(walletProvider: EvmWalletProvider): Action[] {
    const f = payingFetch(walletProvider.toSigner());
    const origin = this.opts.origin ?? DEFAULT_ORIGIN;
    return selectTools(this.opts).map(t => ({
      name: `agentreader_${t.name}`,
      description: `${t.description} (Paid via x402: ${t.price} USDC on Base from this wallet.)`,
      schema: zodSchema(t),
      invoke: (args: Record<string, unknown>) => callTool(f, t, args, origin),
    }));
  }

  /** Payments settle in USDC on Base mainnet, so the wallet must be on Base. */
  supportsNetwork = (network: Network) => network.protocolFamily === "evm" && (network.networkId === "base-mainnet" || network.chainId === "8453");
}

export const agentReaderActionProvider = (opts?: AgentReaderActionProviderOptions) => new AgentReaderActionProvider(opts);
