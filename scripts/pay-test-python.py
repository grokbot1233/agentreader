# Paid call via the official Python x402 SDK (requests adapter).
import pathlib, base64, json
from eth_account import Account
from x402 import x402ClientSync
from x402.http.clients import x402_requests
from x402.mechanisms.evm.signers import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client
acct = Account.from_key(pathlib.Path(__file__).resolve().parent.parent.joinpath(".test_wallet_key").read_text().strip())
c = x402ClientSync(); register_exact_evm_client(c, EthAccountSigner(acct))
s = x402_requests(c)
for u in ["/fx?base=GBP&symbols=USD", "/token?address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&chain=base"]:
    r = s.get("https://api.axiomworks.co.uk" + u, timeout=60)
    pr = r.headers.get("PAYMENT-RESPONSE") or r.headers.get("X-PAYMENT-RESPONSE")
    print(r.status_code, u.split("?")[0], json.loads(base64.b64decode(pr)).get("transaction") if pr else None, r.text[:120])
