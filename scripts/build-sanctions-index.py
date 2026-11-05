#!/usr/bin/env python3
"""Offline sanctions index builder (OFAC SDN/CONS, UK FCDO, UN SC, EU FSF) → gzip JSON for KV seed."""
import csv, gzip, io, json, re, urllib.request
from collections import defaultdict
UA = "AxiomWorksAgentReader/1.11 (+https://api.axiomworks.co.uk)"
def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as r: return r.read()
def norm(s):
    s=(s or "").lower()
    for a,b in {"á":"a","à":"a","ä":"a","â":"a","ã":"a","å":"a","é":"e","è":"e","ë":"e","ê":"e","í":"i","ì":"i","ï":"i","î":"i","ó":"o","ò":"o","ö":"o","ô":"o","õ":"o","ú":"u","ù":"u","ü":"u","û":"u","ñ":"n","ç":"c","ß":"ss","ø":"o","æ":"ae"}.items():
        s=s.replace(a,b)
    return re.sub(r"\s+"," ", re.sub(r"[^a-z0-9\s]"," ", s)).strip()
def tokensort(s): return " ".join(sorted(norm(s).split()))
print("Use Worker refreshSanctionsIndex in production; this script is a local seed helper.")
print("Prefer: npx wrangler kv key put --binding LOG sanctions:index:v1 --path index.json.gz")
