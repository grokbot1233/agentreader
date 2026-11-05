# Refresh docs/ (GitHub Pages) from the live API: llms.txt, openapi.json, agent.json and the tools table.
import json, html, re, urllib.request
B = "https://api.axiomworks.co.uk"
get = lambda p: urllib.request.urlopen(urllib.request.Request(B + p, headers={"user-agent": "build-landing"})).read().decode()
open("docs/llms.txt", "w").write(get("/llms.txt")); o = json.loads(get("/openapi.json")); json.dump(o, open("docs/openapi.json", "w"), indent=1)
open("docs/agent.json", "w").write(get("/.well-known/agent.json"))
op = lambda v: v.get("get") or v.get("post") or {}
rows = "".join(f"<tr><td><code>{html.escape(p)}</code></td><td>{html.escape(op(v).get('x-price',''))}</td><td>{html.escape(op(v).get('summary',''))}</td></tr>" for p, v in o["paths"].items() if op(v).get("x-price", "free") != "free")
s = open("docs/index.html").read()
s = re.sub(r"(<tr><th>Endpoint</th><th>Price</th><th>When to use</th></tr>).*?(</table>)", lambda m: m.group(1) + rows + m.group(2), s, flags=re.S)
open("docs/index.html", "w").write(s); print("rows", rows.count("<tr>"))
