#!/usr/bin/env python3
"""Create/update an Apify SOURCE_FILES actor from apify/<name>/ (token read from ../.apify_token; never printed).
Usage: python3 apify/_build/deploy.py <actor-dir-name> [--public]"""
import json, os, sys, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN = open(os.path.join(os.path.dirname(ROOT), ".apify_token")).read().strip()
API = "https://api.apify.com/v2"
def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {TOKEN}", "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path} -> {e.code}: {e.read().decode()[:800]}")
name = sys.argv[1]; d = os.path.join(ROOT, name)
files = []
for rel in ["Dockerfile", "package.json", "README.md", "MONETIZATION.md", ".actor/actor.json", ".actor/input_schema.json",
            ".actor/dataset_schema.json", ".actor/output_schema.json"] + sorted("src/" + f for f in os.listdir(os.path.join(d, "src"))):
    files.append({"name": rel, "format": "TEXT", "content": open(os.path.join(d, rel), encoding="utf-8").read()})
meta = json.load(open(os.path.join(d, ".actor/actor.json")))
mon = open(os.path.join(d, "MONETIZATION.md")).read()
seo_t = next(l.split(": ", 1)[1] for l in mon.splitlines() if l.startswith("SEO title:"))
seo_d = next(l.split(": ", 1)[1] for l in mon.splitlines() if l.startswith("SEO description:"))
body = {"name": name, "title": meta["title"], "description": meta["description"], "seoTitle": seo_t, "seoDescription": seo_d,
        "categories": meta["categories"], "isPublic": "--public" in sys.argv,
        "defaultRunOptions": {"build": "latest", "timeoutSecs": 3600, "memoryMbytes": 1024},
        "versions": [{"versionNumber": "1.0", "sourceType": "SOURCE_FILES", "buildTag": "latest", "envVars": [], "sourceFiles": files}]}
mine = call("GET", "/acts?my=1&limit=100")["data"]["items"]
ex = next((a for a in mine if a["name"] == name), None)
if ex:
    if "--public" not in sys.argv: body.pop("isPublic")
    r = call("PUT", f"/acts/{ex['id']}", body)
else:
    r = call("POST", "/acts", body)
a = r["data"]
print(json.dumps({"id": a["id"], "name": a["name"], "isPublic": a.get("isPublic"), "categories": a.get("categories"), "seoTitle": a.get("seoTitle")}))
