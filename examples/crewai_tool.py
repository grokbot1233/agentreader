"""CrewAI tools for AgentReader via the published package (real x402 payment)."""
import os
from agentreader_crewai import agentreader_crewai_tools

tools = agentreader_crewai_tools(private_key=os.environ["AGENTREADER_PRIVATE_KEY"], max_price_usd=0.05)
# pass `tools` into a CrewAI Agent
