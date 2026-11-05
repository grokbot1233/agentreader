"""CrewAI tools for Axiom Works AgentReader (x402 USDC on Base)."""
from __future__ import annotations

from typing import Any, Optional, Type

from pydantic import BaseModel, Field, create_model

from agentreader_tools.client import ORIGIN, call_tool, paying_session, select

__version__ = "1.10.0"
__all__ = ["agentreader_crewai_tools"]


def agentreader_crewai_tools(
    private_key: str,
    tools: Optional[list[str]] = None,
    max_price_usd: float = 0.05,
    origin: str = ORIGIN,
):
    """Return CrewAI BaseTool instances that settle each call via x402."""
    from crewai.tools import BaseTool

    session = paying_session(private_key)
    out = []
    for t in select(tools, max_price_usd):
        fields: dict[str, Any] = {
            p["name"]: (
                (str, Field(..., description=p["description"] or p["name"]))
                if p["required"]
                else (Optional[str], Field(None, description=p["description"] or p["name"]))
            )
            for p in t["params"]
        }
        # CrewAI requires at least one field on args_schema
        if not fields:
            fields = {"_unused": (Optional[str], Field(None, description="unused"))}
        ArgsModel: Type[BaseModel] = create_model(f"CrewAI_AgentReader_{t['name']}", **fields)

        class _Tool(BaseTool):
            name: str = f"agentreader_{t['name']}"
            description: str = f"{t['description']} (Paid via x402: {t['price']} USDC on Base.)"
            args_schema: Type[BaseModel] = ArgsModel

            def _run(self, **kwargs: Any) -> str:
                kwargs.pop("_unused", None)
                return call_tool(session, t, kwargs, origin)

        out.append(_Tool())
    return out
