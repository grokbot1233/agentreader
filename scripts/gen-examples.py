# Build src/examples.json (Bazaar output.example) from free ?preview=1 responses.
import json,urllib.request,urllib.parse,re
src=open('src/index.ts').read()
EX=json.loads(open('/dev/stdin').read())
def trim(o):
  if isinstance(o,dict): return {k:trim(v) for k,v in list(o.items())[:14] if k not in('preview','note','upgrade','paid_url','full')}
  if isinstance(o,list): return [trim(v) for v in o[:2]]
  if isinstance(o,str): return o[:160]
  return o
out={}
for p,q in EX.items():
  try:
    rq=urllib.request.Request("https://api.axiomworks.co.uk%s?%s&preview=1"%(p,urllib.parse.urlencode(q)),headers={"user-agent":"agentreader-examples/1.0"})
    r0=json.load(urllib.request.urlopen(rq,timeout=60)); out[p]=trim(r0.get('data',r0) if 'paid_call' in r0 else r0); print(p,len(json.dumps(out[p])))
  except Exception as e: print(p,'ERR',e)
old=json.load(open('src/examples.json')); old.update(out); json.dump(old,open('src/examples.json','w'))
