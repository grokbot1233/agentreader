"""Minimal Python x402 settle via x402 package (pip install x402 eth-account)."""
import os
from eth_account import Account
# Official helpers vary by release; pattern: wrap requests Session with payment.
# Prefer the TS @x402/fetch example if your Python SDK version differs.
from x402.clients.requests import x402_requests  # type: ignore

account = Account.from_key(os.environ["PRIVATE_KEY"])
session = x402_requests(account)
r = session.get("https://api.axiomworks.co.uk/convert", params={
    "url": "https://pdfobject.com/pdf/sample.pdf",
    "format": "markdown",
})
print(r.status_code, r.json().keys())
