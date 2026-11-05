# @axiomworks/agentreader-agentkit

[Coinbase AgentKit](https://github.com/coinbase/agentkit) action provider for **Axiom Works AgentReader** (https://api.axiomworks.co.uk). It gives your agent 44 pay-per-call [x402](https://x402.org) tools:

- web page/PDF → markdown, link extraction and search
- UK Companies House and Charity Commission, US SEC EDGAR, EU VIES VAT
- FX rates
- single-fact EVM reads from **$0.001** (ERC-20 balance, nonce, receipt, events, eth_call, proxy implementation and more, on Base, Ethereum, Arbitrum, Optimism and Polygon)

Each action is paid **from the agent's own AgentKit wallet** in USDC on Base mainnet. You need no API key and no account. The wallet must hold a little Base USDC. Gas isn't needed because x402 uses EIP-3009 signatures.

```ts
import { AgentKit } from "@coinbase/agentkit";
import { agentReaderActionProvider } from "@axiomworks/agentreader-agentkit";

const agentkit = await AgentKit.from({
  walletProvider, // any EvmWalletProvider on base-mainnet
  actionProviders: [agentReaderActionProvider({ maxPriceUsd: 0.01 /* hide pricier tools */ })],
});
```

Actions are named `agentreader_<tool>`, for example `agentreader_read`, `agentreader_uk_company` and `agentreader_chain_erc20_balance`. Each description includes the price.

Options:
- `tools`: an allow-list of tool names.
- `maxPriceUsd`: hides tools above this price. Default 0.05.
- `origin`: overrides the API origin.

Catalog and prices: https://api.axiomworks.co.uk/openapi.json. MIT licence.
