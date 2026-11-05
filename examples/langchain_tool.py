"""LangChain tools for AgentReader via the published package (real x402 payment)."""
import os
from agentreader_tools import agentreader_tools

tools = agentreader_tools(private_key=os.environ["AGENTREADER_PRIVATE_KEY"], max_price_usd=0.01)
# bind `tools` to any LangChain agent
