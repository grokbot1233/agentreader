#!/usr/bin/env python3
"""Generate the tool catalog used by the AgentKit / LangChain / Python packages from docs/openapi.json."""
import json, re, os
o = json.load(open('docs/openapi.json'))
out = []
for path, ops in o['paths'].items():
    if 'get' not in ops or '{' in path: continue
    g = ops['get']
    price = g.get('x-price')
    if not price: continue
    params = [{"name": p['name'], "required": bool(p.get('required')), "type": p.get('schema', {}).get('type', 'string'),
               "description": p.get('description', '')} for p in g.get('parameters', []) if p.get('in') == 'query']
    name = re.sub(r'[^a-z0-9]+', '_', path.strip('/').lower())
    out.append({"name": name, "path": path, "price": price, "description": g['summary'], "params": params})
for d in ['packages/agentreader-agentkit/src', 'packages/agentreader-langchain/src', 'python/agentreader_tools']:
    os.makedirs(d, exist_ok=True)
    json.dump(out, open(f'{d}/catalog.json', 'w'), indent=1)
print(len(out), 'tools;', sorted({p['type'] for t in out for p in t['params']}))
