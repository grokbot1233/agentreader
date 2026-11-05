"""PydanticAI + OpenAI Agents SDK tools for Axiom Works AgentReader (x402 USDC on Base)."""
from __future__ import annotations

import inspect
from typing import Any, Callable, Optional

from agentreader_tools.client import ORIGIN, call_tool, paying_session, select

__version__ = "1.10.0"
__all__ = ["plain_callables", "pydantic_ai_tools", "openai_agents_tools"]


def _make_callable(session, tool: dict, origin: str) -> Callable[..., str]:
    params = tool["params"]

    def _fn(**kwargs: Any) -> str:
        return call_tool(session, tool, kwargs, origin)

    params_list = []
    for p in params:
        default = inspect.Parameter.empty if p["required"] else None
        params_list.append(
            inspect.Parameter(
                p["name"],
                inspect.Parameter.KEYWORD_ONLY,
                default=default,
                annotation=str,
            )
        )
    _fn.__signature__ = inspect.Signature(params_list, return_annotation=str)
    _fn.__annotations__ = {p["name"]: str for p in params} | {"return": str}
    _fn.__name__ = f"agentreader_{tool['name']}"
    _fn.__doc__ = f"{tool['description']} (Paid via x402: {tool['price']} USDC on Base.)"
    return _fn


def plain_callables(
    private_key: str,
    tools: Optional[list[str]] = None,
    max_price_usd: float = 0.05,
    origin: str = ORIGIN,
) -> list[Callable[..., str]]:
    """Return plain Python callables (one per selected AgentReader tool)."""
    session = paying_session(private_key)
    return [_make_callable(session, t, origin) for t in select(tools, max_price_usd)]


def pydantic_ai_tools(
    private_key: str,
    tools: Optional[list[str]] = None,
    max_price_usd: float = 0.05,
    origin: str = ORIGIN,
):
    """Return pydantic_ai.Tool instances. Requires: pip install 'agentreader-agents[pydantic-ai]'."""
    from pydantic_ai import Tool

    return [Tool(fn, takes_ctx=False) for fn in plain_callables(private_key, tools, max_price_usd, origin)]


def openai_agents_tools(
    private_key: str,
    tools: Optional[list[str]] = None,
    max_price_usd: float = 0.05,
    origin: str = ORIGIN,
):
    """Return OpenAI Agents SDK FunctionTools. Requires: pip install 'agentreader-agents[openai-agents]'."""
    from agents import function_tool

    return [
        function_tool(fn, name_override=fn.__name__)
        for fn in plain_callables(private_key, tools, max_price_usd, origin)
    ]
