#!/usr/bin/env python3
"""List recent info@axiomworks.co.uk inbox messages via Zoho Mail API (EU). Usage: zoho-inbox.py [limit]"""
import os,sys,json,urllib.request,urllib.parse,datetime
here=os.path.dirname(os.path.abspath(__file__))
cfg=json.load(open(os.path.join(here,"..",".zoho_oauth.json")))
data=urllib.parse.urlencode({"refresh_token":cfg["refresh_token"],"client_id":os.environ["ZOHO_CLIENT_ID"],"client_secret":os.environ["ZOHO_CLIENT_SECRET"],"grant_type":"refresh_token"}).encode()
tok=json.load(urllib.request.urlopen(f"https://accounts.zoho.{cfg['dc']}/oauth/v2/token",data,timeout=20))["access_token"]
base=f"https://mail.zoho.{cfg['dc']}/api/accounts/274884000000002002"
lim=int(sys.argv[1]) if len(sys.argv)>1 else 20
req=urllib.request.Request(f"{base}/messages/view?limit={lim}&sortorder=false",headers={"Authorization":"Zoho-oauthtoken "+tok})
for m in json.load(urllib.request.urlopen(req,timeout=20)).get("data",[]):
    t=datetime.datetime.fromtimestamp(int(m["receivedTime"])/1000).strftime("%Y-%m-%d %H:%M")
    print(t,"|",m.get("fromAddress"),"|",m.get("subject"),"|",(m.get("summary") or "")[:120].replace("\n"," "))
