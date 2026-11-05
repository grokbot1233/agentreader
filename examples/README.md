# AgentReader integration examples

Base URL: `https://api.axiomworks.co.uk` · MCP: `https://api.axiomworks.co.uk/mcp` · Free samples: `/samples/{kind}`

| File | Stack |
|---|---|
| `mcp-claude-desktop.json` / `mcp-cursor.json` | MCP via `npx -y @axiomworks/agentreader-mcp` + `AGENTREADER_PRIVATE_KEY` |
| `x402-fetch.ts` | TypeScript `@x402/fetch` |
| `x402-axios.ts` | TypeScript `x402-axios` |
| `x402_fetch.py` | Python `x402` |
| `langchain_tool.py` | LangChain tool |
| `vercel-ai-sdk.ts` | Vercel AI SDK `tool()` |
| `openai-agents-tool.ts` | OpenAI Agents SDK function tool |
| `crewai_tool.py` | CrewAI tool |

Set `AGENTREADER_PRIVATE_KEY` / `PRIVATE_KEY` (Base wallet with USDC) for paid settles.

```bash
npm i @axiomworks/agentreader
npx -y @axiomworks/agentreader-mcp
```

