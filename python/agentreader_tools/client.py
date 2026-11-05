"""Shared x402-paying HTTP client for Axiom Works AgentReader (USDC on Base)."""
from __future__ import annotations

import json
from importlib.resources import files
from typing import Any, Optional

ORIGIN = "https://api.axiomworks.co.uk"
CATALOG: list[dict] = json.loads(files(__package__).joinpath("catalog.json").read_text())
UA = "agentreader-tools/1.10.0"


def select(tools: Optional[list[str]] = None, max_price_usd: float = 0.05) -> list[dict]:
    """Filter the catalog by tool name and max per-call USD price."""
    return [
        t
        for t in CATALOG
        if (tools is None or t["name"] in tools) and float(t["price"].lstrip("$")) <= max_price_usd
    ]


def paying_session(private_key: str):
    """Build a requests Session that settles HTTP 402 via x402 from `private_key`'s Base USDC."""
    from eth_account import Account
    from x402 import x402ClientSync
    from x402.http.clients import x402_requests
    from x402.mechanisms.evm.signers import EthAccountSigner
    from x402.mechanisms.evm.exact.register import register_exact_evm_client

    client = x402ClientSync()
    register_exact_evm_client(client, EthAccountSigner(Account.from_key(private_key)))
    return x402_requests(client)


def call_tool(session, tool: dict, args: dict[str, Any], origin: str = ORIGIN) -> str:
    """GET `tool['path']` with query args; returns response text (truncated) or error JSON."""
    q = {k: v for k, v in (args or {}).items() if v not in (None, "")}
    r = session.get(
        origin + tool["path"],
        params=q,
        headers={"accept": "application/json", "user-agent": UA},
        timeout=60,
    )
    text = r.text
    if not r.ok:
        return json.dumps({"error": f"HTTP {r.status_code}", "body": text[:2000]})
    return text if len(text) <= 60000 else text[:60000] + "…[truncated]"
