# agentreader-agents

Function tools for **PydanticAI** and the **OpenAI Agents SDK** wrapping [Axiom Works AgentReader](https://api.axiomworks.co.uk). Each call pays via x402 (USDC on Base) from the agent's wallet key.

```bash
pip install "agentreader-agents[all]"
# or: pip install "agentreader-agents[pydantic-ai]" / "agentreader-agents[openai-agents]"
```

```python
from agentreader_agents import pydantic_ai_tools, openai_agents_tools

pai_tools = pydantic_ai_tools(private_key=KEY, max_price_usd=0.01)
oai_tools = openai_agents_tools(private_key=KEY, max_price_usd=0.01)
```
