# Unpaid x402 health suite: every listed resource must answer 402 with a v1 body (accepts[0].maxAmountRequired == listed atomic) + PAYMENT-REQUIRED header.
import json, urllib.request, urllib.error, sys, concurrent.futures as cf
B = sys.argv[1] if len(sys.argv) > 1 else "https://api.axiomworks.co.uk"
d = json.load(urllib.request.urlopen(urllib.request.Request(B + "/.well-known/x402", headers={"user-agent": "ar-suite/1"}), timeout=30))
def chk(it):
  url = it["resource"].replace("https://api.axiomworks.co.uk", B); m = it["methods"][0]
  rq = urllib.request.Request(url, method=m, data=(b"{}" if m == "POST" else None), headers={"user-agent": "ar-suite/1", "content-type": "application/json"})
  try:
    r = urllib.request.urlopen(rq, timeout=30); return (url, m, r.status, "no402")
  except urllib.error.HTTPError as e:
    if e.code != 402: return (url, m, e.code, "FAIL")
    try: body = json.loads(e.read())
    except Exception: return (url, m, 402, "FAIL badjson")
    want = it["accepts"][0]["amount"]; got = body.get("accepts", [{}])[0].get("maxAmountRequired")
    ok = got == want and e.headers.get("payment-required")
    return (url, m, 402, "PASS" if ok else f"FAIL amount {got}!={want}")
  except Exception as e: return (url, m, 0, f"FAIL {e}")
with cf.ThreadPoolExecutor(8) as ex: res = list(ex.map(chk, d["items"]))
for r in res:
  if r[3] != "PASS": print(*r)
print(f"PASS402 {sum(r[3]=='PASS' for r in res)}/{len(res)}")
