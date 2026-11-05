#!/usr/bin/env python3
"""Corporations Canada active federal corporations CSVs -> JSON shards.
usage: ca-shards.py OUTDIR cbca.csv noncbca.csv  -> OUTDIR/n/NNNN.json (corp number zero-padded 8, prefix 4), OUTDIR/b/BBB.json (BN9 prefix 3 -> [corp numbers])"""
import csv, json, os, sys
from collections import defaultdict
out = sys.argv[1]; os.makedirs(out + "/n", exist_ok=True); os.makedirs(out + "/b", exist_ok=True)
N = defaultdict(dict); B = defaultdict(lambda: defaultdict(list))
for f in sys.argv[2:]:
    r = csv.reader(open(f, encoding='utf-8-sig', newline='')); h = next(r); I = {k: i for i, k in enumerate(h)}
    for row in r:
        if len(row) < len(h): continue
        g = lambda k: (row[I[k]].strip() or None)
        num = row[0].strip().zfill(8); bn = (g('Business number (BN)') or '')[:9]
        N[num[:4]][num] = {k: v for k, v in {'n': g('Corporate name - form 1'), 'n2': g('Corporate name - form 2'), 'bn': bn or None, 'l': g('Governing legislation'),
            's': g('Status'), 'sd': g('Status Detail'), 'a': g('Anniversary date'), 'y': g('Year of last annual filing'), 'm': g('Date of last annual meeting'),
            'ad': ', '.join(x for x in [g('Street'), g('Street 2'), g('City/town'), g('Province/territory'), g('Postal code'), g('Country')] if x) or None,
            'dmin': g('Minimum number of directors'), 'dmax': g('Maximum number of directors')}.items() if v is not None}
        if len(bn) == 9 and bn.isdigit(): B[bn[:3]][bn].append(num)
for p, d in N.items(): json.dump(d, open(f"{out}/n/{p}.json", 'w'), separators=(',', ':'))
for p, d in B.items(): json.dump(d, open(f"{out}/b/{p}.json", 'w'), separators=(',', ':'))
print("n shards", len(N), "b shards", len(B), "corps", sum(len(d) for d in N.values()))
