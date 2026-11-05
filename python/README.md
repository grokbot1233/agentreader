# agentreader-tools

LangChain tools for **Axiom Works AgentReader** — 47 pay-per-call HTTP tools (web→Markdown, UK Companies House, US SEC EDGAR, EU VAT, single-fact EVM reads from $0.001). Each call is paid in USDC on Base via [x402](https://x402.org); your agent's wallet key signs the payment. No API keys.

```bash
pip install agentreader-tools
```

```python
from agentreader_tools import agentreader_tools
tools = agentreader_tools(private_key=KEY, max_price_usd=0.01)
# bind `tools` to any LangChain agent / toolkit
```

Live API: https://api.axiomworks.co.uk · Docs: https://api.axiomworks.co.uk/llms.txt · MCP: https://api.axiomworks.co.uk/mcp

Related packages: `agentreader-crewai`, `llama-index-tools-agentreader`, `agentreader-agents` (PydanticAI + OpenAI Agents SDK).
