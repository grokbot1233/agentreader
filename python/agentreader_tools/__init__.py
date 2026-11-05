"""LangChain (Python) tools for Axiom Works AgentReader, paid per call via x402 (USDC on Base).

Requires: pip install "x402[requests,evm]>=2.27" langchain-core eth-account
"""
from __future__ import annotations
import json
from importlib.resources import files
from typing import Any, Optional

ORIGIN = "https://api.axiomworks.co.uk"
CATALOG: list[dict] = json.loads(files(__package__).joinpath("catalog.json").read_text())


def select(tools: Optional[list[str]] = None, max_price_usd: float = 0.05) -> list[dict]:
    return [t for t in CATALOG if (tools is None or t["name"] in tools) and float(t["price"].lstrip("$")) <= max_price_usd]


def agentreader_tools(private_key: str, tools: Optional[list[str]] = None, max_price_usd: float = 0.05, origin: str = ORIGIN):
    """Return LangChain StructuredTools; each call pays its listed price from `private_key`'s Base USDC."""
    from eth_account import Account
    from pydantic import Field, create_model
    from langchain_core.tools import StructuredTool
    from x402 import x402ClientSync
    from x402.http.clients import x402_requests
    from x402.mechanisms.evm.signers import EthAccountSigner
    from x402.mechanisms.evm.exact.register import register_exact_evm_client

    client = x402ClientSync()
    register_exact_evm_client(client, EthAccountSigner(Account.from_key(private_key)))
    session = x402_requests(client)
    out = []
    for t in select(tools, max_price_usd):
        fields: dict[str, Any] = {
            p["name"]: ((str, Field(description=p["description"] or p["name"])) if p["required"]
                        else (Optional[str], Field(default=None, description=p["description"] or p["name"])))
            for p in t["params"]}
        model = create_model(f"AgentReader_{t['name']}", **fields)

        def run(_t=t, **kw):
            q = {k: v for k, v in kw.items() if v not in (None, "")}
            r = session.get(origin + _t["path"], params=q, headers={"accept": "application/json"}, timeout=60)
            return r.text[:60000] if r.ok else json.dumps({"error": f"HTTP {r.status_code}", "body": r.text[:2000]})

        out.append(StructuredTool.from_function(func=run, name=f"agentreader_{t['name']}", args_schema=model,
                                                description=f"{t['description']} (Paid via x402: {t['price']} USDC on Base.)"))
    return out
