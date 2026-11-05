#!/usr/bin/env python3
"""Split ASIC COMPANY_YYYYMM.csv (REGD rows) into ACN 4-digit-prefix JSON shards.
usage: au-shards.py CSV OUTDIR [prefix ...]   (no prefixes = all ~10k shards)"""
import csv, json, os, sys
from collections import defaultdict
src, out, only = sys.argv[1], sys.argv[2], set(sys.argv[3:])
os.makedirs(out, exist_ok=True)
r = csv.reader(open(src, encoding='utf-8-sig', errors='replace', newline=''), delimiter='\t'); h = next(r)
I = {k: h.index(k) for k in ['Company Name','ACN','Type','Class','Status','Date of Registration','Date of Deregistration','ABN','Current Name Indicator','Current Name']}
def iso(d): return f"{d[6:10]}-{d[3:5]}-{d[0:2]}" if len(d) == 10 else None
sh = defaultdict(dict)
for row in r:
    if len(row) < len(h): continue
    acn = row[I['ACN']].strip().zfill(9); p = acn[:4]
    if only and p not in only: continue
    if row[I['Status']] != 'REGD' and row[I['Status']] not in ('DRGD','SOFF','EXAD'): continue
    cur = sh[p].get(acn)
    if row[I['Current Name Indicator']].strip() == 'Y' or cur is None:
        prev = cur.get('fn', []) if cur else []
        sh[p][acn] = {'n': row[I['Company Name']], 'abn': row[I['ABN']] or None, 't': row[I['Type']], 'c': row[I['Class']], 's': row[I['Status']],
                      'r': iso(row[I['Date of Registration']]), 'd': iso(row[I['Date of Deregistration']]), 'fn': prev}
    else:
        cur.setdefault('fn', []).append(row[I['Company Name']])
tot = 0
for p, d in sh.items():
    json.dump(d, open(f"{out}/{p}.json", 'w'), separators=(',', ':')); tot += len(d)
print("shards", len(sh), "companies", tot)
