# agentreader-crewai

CrewAI `BaseTool` wrappers for [Axiom Works AgentReader](https://api.axiomworks.co.uk) — pay per call in USDC on Base via x402 (agent wallet key; no API keys).

```bash
pip install agentreader-crewai
```

```python
from agentreader_crewai import agentreader_crewai_tools
tools = agentreader_crewai_tools(private_key=KEY, max_price_usd=0.05)
# pass `tools` into a CrewAI Agent
```
