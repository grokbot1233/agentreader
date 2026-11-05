"""LlamaIndex tools for Axiom Works AgentReader (x402 USDC on Base)."""
from __future__ import annotations

from typing import Any, Callable, Optional

from agentreader_tools.client import ORIGIN, call_tool, paying_session, select

__version__ = "0.1.0"
__all__ = ["AgentReaderToolSpec", "agentreader_function_tools"]


def agentreader_function_tools(
    private_key: str,
    tools: Optional[list[str]] = None,
    max_price_usd: float = 0.05,
    origin: str = ORIGIN,
):
    """Return a list of llama_index FunctionTool instances."""
    from llama_index.core.tools import FunctionTool

    session = paying_session(private_key)
    out = []
    for t in select(tools, max_price_usd):
        params = t["params"]

        def _make(tool=t, params=params) -> Callable[..., str]:
            # Build a function with an explicit signature for schema inference
            names = [p["name"] for p in params]
            required = {p["name"] for p in params if p["required"]}

            def _fn(**kwargs: Any) -> str:
                return call_tool(session, tool, kwargs, origin)

            # Annotate for LlamaIndex / pydantic schema
            ann = {n: str for n in names}
            ann["return"] = str
            _fn.__annotations__ = ann
            _fn.__name__ = f"agentreader_{tool['name']}"
            _fn.__doc__ = f"{tool['description']} (Paid via x402: {tool['price']} USDC on Base.)"
            # default None for optional
            import inspect

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
            return _fn

        out.append(
            FunctionTool.from_defaults(
                fn=_make(),
                name=f"agentreader_{t['name']}",
                description=f"{t['description']} (Paid via x402: {t['price']} USDC on Base.)",
            )
        )
    return out


class AgentReaderToolSpec:
    """Thin ToolSpec-style wrapper; prefer `.to_tool_list()` for agents."""

    def __init__(
        self,
        private_key: str,
        tools: Optional[list[str]] = None,
        max_price_usd: float = 0.05,
        origin: str = ORIGIN,
    ):
        self._tools = agentreader_function_tools(private_key, tools, max_price_usd, origin)

    def to_tool_list(self):
        return list(self._tools)
