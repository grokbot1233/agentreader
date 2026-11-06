#!/usr/bin/env python3
"""AgentReader buyer-signal scanner (stdlib only, zero cost).

Sources:
  (a) onchain  - CDP x402 Bazaar discovery -> payTo addresses -> Base USDC Transfer logs
                 (free public RPC, eth_getLogs) -> active paying agent wallets + what they buy.
  (b) github   - code/repo/issue search for x402 clients and agent projects needing our data
                 (uses `gh api`, so needs a logged-in gh CLI or GH_TOKEN env).
  (c) demand   - HN Algolia + Reddit JSON search for demand posts; optional X results merged
                 from research/leads/x-YYYY-MM-DD.json (fetched by an agent with X tools).
Output: research/leads/YYYY-MM-DD.json (ranked).

Run:  python3 scripts/outbound/scan.py [--skip onchain,github,demand] [--blocks 20000]
"""
import json, os, re, subprocess, sys, time, urllib.parse, urllib.request, datetime, argparse, collections

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "research", "leads")
UA = {"User-Agent": "agentreader-lead-scanner/1.0 (+https://api.axiomworks.co.uk)"}
USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
RPCS = ["https://base-rpc.publicnode.com", "https://base.drpc.org", "https://mainnet.base.org"]
OUR_PAYTO = "0x88b1c747c33a5868a34057d8c57318e5602b3ff6"

# keyword -> product mapping (used to score fit for any text)
PRODUCTS = [
    (r"uk compan|companies house|uk business|company number|\bcrn\b", "/uk-company ($0.50) · /uk-company-lite ($0.05)"),
    (r"\bkyb\b|know your business|business verification|due diligence|onboarding check", "/kyb ($2)"),
    (r"\bsec\b.*(filing|edgar)|edgar|10-k|10-q|8-k", "/us-sec ($0.05) · /us-sec-full ($0.25)"),
    (r"\bvat\b|vies", "/eu-vat ($0.01)"),
    (r"charity commission|uk charit", "/uk-charity ($0.05)"),
    (r"lead gen|new compan(y|ies) (list|feed)|sales leads", "/uk-leads ($1) · /uk-leads-feed ($25)"),
    (r"web.?to.?markdown|html to markdown|scrap|readab|crawl|fetch (a |the )?(web|url|page)", "/read ($0.002) · /convert ($0.03)"),
    (r"pdf to (markdown|text)|docx", "/convert ($0.03)"),
    (r"wallet (lookup|balance|risk)|token (risk|honeypot)|on-?chain (data|lookup)|tx lookup", "/wallet · /token-check · /tx"),
    (r"company (research|enrich|data)|firmographic|enrichment", "/company ($0.25) · /company-full ($0.65)"),
    (r"x402", "MCP /mcp + any route (x402-native buyer)"),
]
def match_product(text):
    t = (text or "").lower(); hits = [p for rx, p in PRODUCTS if re.search(rx, t)]
    return hits

def get(url, headers=None, data=None, timeout=25):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})}, data=data)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())

def rpc(method, params):
    last = None
    for u in RPCS:
        try:
            d = get(u, {"content-type": "application/json"}, json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode())
            if "result" in d: return d["result"]
            last = d.get("error")
        except Exception as e: last = str(e)
    raise RuntimeError(f"rpc {method} failed: {last}")

# ---------------- (a) on-chain ----------------
def bazaar(max_items=600):
    items, off = [], 0
    while off < max_items:
        try: d = get(f"https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources?limit=100&offset={off}")
        except Exception as e: print("bazaar err", e, file=sys.stderr); break
        b = d.get("items") or []
        items += b
        if len(b) < 100: break
        off += 100; time.sleep(0.3)
    return items

def categorize(desc, url):
    t = f"{desc} {url}".lower()
    for k, rx in [("company/kyb", r"compan|kyb|business|registry"), ("finance/markets", r"price|stock|market|trading|token|defi|swap"),
                  ("web/scrape", r"scrap|read|markdown|crawl|fetch|search"), ("ai/llm", r"llm|gpt|image|generat|ai "),
                  ("onchain/data", r"wallet|chain|tx|nft|balance"), ("social", r"twitter|x\.com|tweet|social|farcaster")]:
        if re.search(rx, t): return k
    return "other"

def onchain(blocks=20000, top_services=25):
    if isinstance(blocks, bool) or not isinstance(blocks, int) or blocks <= 0:
        raise ValueError("blocks must be a positive integer")
    items = bazaar()
    svcs = []
    for it in items:
        for a in it.get("accepts") or []:
            if a.get("network") in ("eip155:8453", "base") and (a.get("asset") or "").lower() == USDC.lower() and a.get("payTo"):
                q = it.get("quality") or {}
                svcs.append({"payTo": a["payTo"].lower(), "resource": a.get("resource") or it.get("resource"), "desc": (it.get("description") or "")[:160],
                             "calls30": q.get("l30DaysTotalCalls") or 0, "payers30": q.get("l30DaysUniquePayers") or 0})
                break
    by_pay = {}
    for s in sorted(svcs, key=lambda s: -s["calls30"]):
        by_pay.setdefault(s["payTo"], s)
    chosen = [s for s in by_pay.values() if s["payTo"] != OUR_PAYTO][:top_services]
    head = int(rpc("eth_blockNumber", []), 16)
    payers = collections.defaultdict(lambda: {"tx": 0, "usdc": 0.0, "services": set(), "cats": set()})
    coverage_by_pay = {}
    for s in chosen:
        topic = "0x" + "0" * 24 + s["payTo"][2:]
        window_start = max(0, head - blocks + 1)
        coverage = {
            "from_block": window_start,
            "to_block": head,
            "complete": True,
            "completed_ranges": [],
            "failed_ranges": [],
        }
        recipient_logs = []
        start = window_start
        while start <= head:
            end = min(start + 9999, head)
            try:
                logs = rpc("eth_getLogs", [{"fromBlock": hex(start), "toBlock": hex(end), "address": USDC, "topics": [TRANSFER, None, topic]}])
            except Exception as e:
                print("logs err", s["payTo"], e, file=sys.stderr)
                coverage["complete"] = False
                coverage["failed_ranges"].append({
                    "from_block": start, "to_block": end, "error": str(e),
                })
            else:
                recipient_logs.extend(logs)
                coverage["completed_ranges"].append({"from_block": start, "to_block": end})
            start = end + 1
            if start <= head: time.sleep(0.2)
        coverage_by_pay[s["payTo"]] = coverage
        if not coverage["complete"]:
            continue
        for lg in recipient_logs:
            frm = "0x" + lg["topics"][1][-40:]
            p = payers[frm]; p["tx"] += 1; p["usdc"] += int(lg["data"], 16) / 1e6
            p["services"].add(s["resource"]); p["cats"].add(categorize(s["desc"], s["resource"] or ""))
    leads = []
    for w, p in payers.items():
        if p["tx"] < 3: continue  # ignore one-off testers
        cats = sorted(p["cats"])
        fit = "/kyb · /uk-company" if "company/kyb" in cats else ("/read · /search" if "web/scrape" in cats else ("/wallet · /token-check" if ("onchain/data" in cats or "finance/markets" in cats) else "MCP bundle"))
        leads.append({"source": "onchain", "id": w, "url": f"https://basescan.org/address/{w}",
                      "title": f"Active x402 payer: {p['tx']} payments, ${p['usdc']:.2f} USDC to {len(p['services'])} Bazaar services in ~{blocks*2//3600}h",
                      "why": f"Already pays x402 programmatically; buys {', '.join(cats)}. Services: {', '.join(list(p['services'])[:3])}",
                      "product": fit, "action": "No direct contact possible (wallet only). Ensure our Bazaar listing ranks for its categories; check ENS/x402scan for an owner identity.",
                      "score": min(90, 30 + 12 * len(p["services"]) + min(20, p["tx"] // 50))})
    market = [{"resource": s["resource"], "payTo": s["payTo"], "calls30": s["calls30"], "payers30": s["payers30"], "category": categorize(s["desc"], s["resource"] or ""), "coverage": coverage_by_pay[s["payTo"]]} for s in chosen]
    return leads, market

# ---------------- (b) GitHub ----------------
def gh(path):
    try:
        r = subprocess.run(["gh", "api", "-H", "Accept: application/vnd.github+json", path], capture_output=True, text=True, timeout=60)
        return json.loads(r.stdout) if r.returncode == 0 else {}
    except Exception: return {}

GH_ISSUE_Q = ['"companies house" api in:title,body is:issue is:open', '"KYB" api in:title,body is:issue is:open',
              '"SEC filings" tool in:title,body is:issue is:open', '"VAT" validation api agent in:title,body is:issue is:open',
              'x402 in:title,body is:issue is:open', '"html to markdown" agent tool in:title,body is:issue is:open',
              'crewai tool "company data" is:issue is:open', 'langchain "companies house" is:issue']
GH_REPO_Q = ['x402 agent', 'x402-fetch', 'x402 mcp', 'kyb agent', 'companies house agent', 'sec edgar agent langchain', 'crewai due diligence']
GH_CODE_Q = ['withPaymentInterceptor', '"x402-fetch" filename:package.json', '"@x402/fetch" filename:package.json', '"x402" filename:requirements.txt', '"x402" filename:pyproject.toml']

def github():
    leads, since = [], (datetime.date.today() - datetime.timedelta(days=120)).isoformat()
    for q in GH_ISSUE_Q:
        d = gh("search/issues?per_page=15&sort=updated&q=" + urllib.parse.quote(q + f" updated:>{since}"))
        for i in d.get("items", []):
            txt = f"{i['title']} {i.get('body') or ''}"; prods = match_product(txt)
            if not prods: continue
            repo = i["repository_url"].split("repos/")[1]
            leads.append({"source": "github-issue", "id": i["html_url"], "url": i["html_url"], "title": f"{repo}: {i['title']}"[:180],
                          "why": f"Open issue mentioning {', '.join(prods[:2])}; {i.get('comments',0)} comments, updated {i['updated_at'][:10]}",
                          "product": prods[0], "action": "Read the thread; if it asks for exactly this data, reply with a helpful answer (code snippet) disclosing we maintain AgentReader.",
                          "score": 50 + 8 * len(prods) + min(10, i.get("comments", 0)) + (10 if i["state"] == "open" else 0)})
        time.sleep(2)
    for q in GH_REPO_Q:
        d = gh("search/repositories?per_page=10&sort=updated&q=" + urllib.parse.quote(q + f" pushed:>{since}"))
        for r in d.get("items", []):
            txt = f"{r['full_name']} {r.get('description') or ''}"; prods = match_product(txt) or ["MCP /mcp"]
            leads.append({"source": "github-repo", "id": r["html_url"], "url": r["html_url"], "title": f"{r['full_name']} ★{r['stargazers_count']}: {(r.get('description') or '')[:120]}",
                          "why": f"Active ({r['pushed_at'][:10]}) project matching '{q}'", "product": prods[0],
                          "action": "Check for a tools/integrations folder or 'awesome' list accepting community entries; PR an AgentReader integration if useful.",
                          "score": 35 + min(30, r["stargazers_count"] // 20) + 5 * len(prods)})
        time.sleep(2)
    for q in GH_CODE_Q:
        d = gh("search/code?per_page=20&q=" + urllib.parse.quote(q))
        for c in d.get("items", []):
            repo = c["repository"]["full_name"]
            if repo.lower().startswith(("coinbase/", "grokbot1233/", "x402-foundation/")) or re.search(r"packages/(legacy/)?x402-(axios|fetch)|/h402-", c["path"]): continue
            leads.append({"source": "github-code", "id": f"https://github.com/{repo}", "url": c["html_url"], "title": f"{repo} uses x402 client ({q.split()[0]})",
                          "why": "Codebase already wires an x402 payment client: technically able to buy from us today", "product": "any route / MCP",
                          "action": "Look at what the agent does; if it needs company/web/chain data, open a helpful PR or issue only if the repo invites integrations; else draft outreach.",
                          "score": 55})
        time.sleep(7)  # code search is 10 req/min
    return leads

# ---------------- (c) demand posts ----------------
DEMAND_Q = ["companies house api", "uk company data api", "KYB API", "business verification API", "SEC filings API", "EDGAR API",
            "VAT validation API", "x402", "pay per call API agents", "html to markdown API", "web scraping API for LLM"]
def demand():
    leads, cutoff = [], int(time.time()) - 90 * 86400
    for q in DEMAND_Q:
        try:
            d = get("https://hn.algolia.com/api/v1/search_by_date?tags=(story,comment,ask_hn)&hitsPerPage=20&numericFilters=created_at_i>%d&query=%s" % (cutoff, urllib.parse.quote(q)))
            for h in d.get("hits", []):
                txt = f"{h.get('title') or ''} {h.get('comment_text') or h.get('story_text') or ''}"
                if re.search(r"who (is hiring|wants to be hired)", h.get("story_title") or h.get("title") or "", re.I): continue
                if not re.search(r"\bapi\b|x402", txt, re.I): continue
                if not re.search(r"\b(need|looking for|recommend|any(one)? know|alternative|best|which)\b", txt, re.I): continue
                prods = match_product(txt)
                if not prods: continue
                u = f"https://news.ycombinator.com/item?id={h['objectID']}"
                leads.append({"source": "hn", "id": u, "url": u, "title": (h.get("title") or h.get("story_title") or "")[:150] + f" — by {h.get('author')}",
                              "why": f"Demand language + matches {', '.join(prods[:2])} ({h['created_at'][:10]})", "product": prods[0],
                              "action": "Owner may reply on HN (draft provided) if genuinely helpful; disclose affiliation.", "score": 45 + 8 * len(prods)})
        except Exception as e: print("hn err", e, file=sys.stderr)
        try:
            d = get("https://www.reddit.com/search.json?sort=new&t=month&limit=25&q=" + urllib.parse.quote(q))
            for c in d.get("data", {}).get("children", []):
                p = c["data"]; txt = f"{p.get('title')} {p.get('selftext') or ''}"
                if not re.search(r"\b(need|looking for|recommend|any(one)? know|alternative|best|which|\?)", txt, re.I): continue
                prods = match_product(txt)
                if not prods: continue
                u = "https://www.reddit.com" + p["permalink"]
                leads.append({"source": "reddit", "id": u, "url": u, "title": f"r/{p['subreddit']}: {p['title']}"[:180] + f" — u/{p.get('author')}",
                              "why": f"Demand post matching {', '.join(prods[:2])}", "product": prods[0],
                              "action": "Owner may reply (draft provided) if subreddit allows tool mentions.", "score": 42 + 8 * len(prods) + min(10, p.get("num_comments", 0) // 3)})
        except Exception as e: print("reddit err", e, file=sys.stderr)
        time.sleep(1.5)
    xf = os.path.join(OUT_DIR, f"x-{datetime.date.today().isoformat()}.json")
    if os.path.exists(xf):
        for p in json.load(open(xf)):
            prods = match_product(p.get("text", "")) or ["MCP /mcp"]
            leads.append({"source": "x", "id": p["url"], "url": p["url"], "title": f"@{p.get('username','?')}: {p.get('text','')[:140]}",
                          "why": f"X post matching {', '.join(prods[:2])}", "product": prods[0], "action": "Draft a reply/DM for owner review.", "score": 45 + 8 * len(prods)})
    return leads

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--skip", default=""); ap.add_argument("--blocks", type=int, default=20000)
    a = ap.parse_args(); skip = set(a.skip.split(","))
    leads, market = [], []
    if "onchain" not in skip:
        try: l, market = onchain(a.blocks); leads += l
        except Exception as e: print("onchain failed", e, file=sys.stderr)
    if "github" not in skip: leads += github()
    if "demand" not in skip: leads += demand()
    OWN = re.compile(r"grokbot1233|agentreader|axiom ?works", re.I)
    leads = [l for l in leads if not OWN.search(l["id"] + " " + l["title"])]
    seen, uniq = set(), []
    for l in sorted(leads, key=lambda x: -x["score"]):
        if l["id"] in seen: continue
        seen.add(l["id"]); uniq.append(l)
    for i, l in enumerate(uniq, 1): l["rank"] = i
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"{datetime.date.today().isoformat()}.json")
    json.dump({"generated": datetime.datetime.now(datetime.timezone.utc).isoformat(), "counts": dict(collections.Counter(l["source"] for l in uniq)),
               "bazaar_top_services": market, "leads": uniq}, open(out, "w"), indent=1, default=list)
    print(f"wrote {out}: {len(uniq)} leads", dict(collections.Counter(l["source"] for l in uniq)))

if __name__ == "__main__": main()
