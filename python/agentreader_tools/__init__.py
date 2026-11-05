"""LangChain (Python) tools for Axiom Works AgentReader, paid per call via x402 (USDC on Base).

Requires: pip install agentreader-tools  (pulls x402[requests,evm], langchain-core, eth-account)
"""
from __future__ import annotations

from typing import Any, Optional

from .client import CATALOG, ORIGIN, call_tool, paying_session, select

__all__ = [
    "CATALOG",
    "ORIGIN",
    "agentreader_tools",
    "call_tool",
    "paying_session",
    "select",
]
__version__ = "1.10.0"


def agentreader_tools(
    private_key: str,
    tools: Optional[list[str]] = None,
    max_price_usd: float = 0.05,
    origin: str = ORIGIN,
):
    """Return LangChain StructuredTools; each call pays its listed price from `private_key`'s Base USDC."""
    from pydantic import Field, create_model
    from langchain_core.tools import StructuredTool

    session = paying_session(private_key)
    out = []
    for t in select(tools, max_price_usd):
        fields: dict[str, Any] = {
            p["name"]: (
                (str, Field(description=p["description"] or p["name"]))
                if p["required"]
                else (Optional[str], Field(default=None, description=p["description"] or p["name"]))
            )
            for p in t["params"]
        }
        model = create_model(f"AgentReader_{t['name']}", **fields)

        def run(_t=t, **kw):
            return call_tool(session, _t, kw, origin)

        out.append(
            StructuredTool.from_function(
                func=run,
                name=f"agentreader_{t['name']}",
                args_schema=model,
                description=f"{t['description']} (Paid via x402: {t['price']} USDC on Base.)",
            )
        )
    return out
