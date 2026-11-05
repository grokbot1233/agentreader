# Build src/examples.json (Bazaar output.example) from free ?preview=1 responses.
# Skips writing error/rate-limit snapshots over a previously good example.
import json, urllib.request, urllib.parse, re, sys

src = open("src/index.ts").read()
EX = json.loads(open("/dev/stdin").read())

def trim(o):
  if isinstance(o, dict):
    return {k: trim(v) for k, v in list(o.items())[:14] if k not in ("preview", "note", "upgrade", "paid_url", "full")}
  if isinstance(o, list):
    return [trim(v) for v in o[:2]]
  if isinstance(o, str):
    return o[:160]
  return o

def looks_bad(o):
  s = json.dumps(o).lower()
  if "rate limit" in s or "allnodes.com" in s:
    return True
  if isinstance(o, dict) and o.get("reverted") is True and "error" in o:
    return True
  if isinstance(o, dict) and o.get("would_revert") is True and "error" in o:
    return True
  return False

out = {}
for p, q in EX.items():
  try:
    qs = urllib.parse.urlencode({k: v if not isinstance(v, (dict, list)) else json.dumps(v) for k, v in q.items()})
    rq = urllib.request.Request(
      "https://api.axiomworks.co.uk%s?%s&preview=1" % (p, qs),
      headers={"user-agent": "agentreader-examples/1.0"},
    )
    r0 = json.load(urllib.request.urlopen(rq, timeout=60))
    sample = trim(r0.get("data", r0) if "paid_call" in r0 else r0)
    if looks_bad(sample):
      print(p, "SKIP_BAD", json.dumps(sample)[:120])
      continue
    out[p] = sample
    print(p, len(json.dumps(out[p])))
  except Exception as e:
    print(p, "ERR", e)

old = json.load(open("src/examples.json"))
old.update(out)
json.dump(old, open("src/examples.json", "w"), separators=(",", ":"), ensure_ascii=False)
print("wrote", len(old), "examples; updated", len(out))
