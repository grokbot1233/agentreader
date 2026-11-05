# llama-index-tools-agentreader

LlamaIndex tools for **Axiom Works AgentReader** — pay-per-call x402 (USDC on Base).

```bash
pip install llama-index-tools-agentreader
```

```python
from llama_index.tools.agentreader import AgentReaderToolSpec
tools = AgentReaderToolSpec(private_key=KEY, max_price_usd=0.05).to_tool_list()
```
