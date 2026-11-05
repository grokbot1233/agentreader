# @axiomworks/agentreader-langchain

[LangChain.js](https://js.langchain.com) toolkit for **Axiom Works AgentReader** (https://api.axiomworks.co.uk). It gives your agent 44 pay-per-call [x402](https://x402.org) tools:

- web page/PDF → markdown, link extraction and search
- UK Companies House and Charity Commission, US SEC EDGAR, EU VIES VAT
- FX rates
- single-fact EVM reads from **$0.001** (ERC-20 balance, nonce, receipt, events, eth_call, proxy implementation and more, on Base, Ethereum, Arbitrum, Optimism and Polygon)

Each action is paid from the private key or viem account you pass in USDC on Base mainnet. You need no API key and no account. The wallet must hold a little Base USDC. Gas isn't needed because x402 uses EIP-3009 signatures.

```ts
import { agentReaderTools } from "@axiomworks/agentreader-langchain";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const tools = agentReaderTools({ privateKey: process.env.AGENT_KEY!, maxPriceUsd: 0.01 });
const agent = createReactAgent({ llm, tools });
```

Tools are named `agentreader_<tool>`, for example `agentreader_read`, `agentreader_uk_company` and `agentreader_chain_erc20_balance`. Each description includes the price.

Options are `privateKey` / `account` / `fetch` (one is required), plus:
- `tools`: an allow-list of tool names.
- `maxPriceUsd`: hides tools above this price. Default 0.05.
- `origin`: overrides the API origin.

Catalog and prices: https://api.axiomworks.co.uk/openapi.json. MIT licence.
