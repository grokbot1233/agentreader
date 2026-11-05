"""LangChain tool wrapping AgentReader /company (pay outside or via x402 session)."""
from langchain_core.tools import tool
import requests, os

BASE = "https://api.axiomworks.co.uk"

@tool
def company_research(domain: str) -> str:
    """Research a company website (tech, contacts, DNS, news). Costs $0.25 USDC via x402."""
    # Use an x402-enabled session in production; this shows the HTTP shape.
    r = requests.get(f"{BASE}/company", params={"domain": domain}, timeout=120)
    if r.status_code == 402:
        return "Payment required: retry with x402 PAYMENT-SIGNATURE (see examples/x402_fetch.py)."
    return r.text
