#!/usr/bin/env bash
# Free, API-only registry submissions for AgentReader. Idempotent (re-registering updates).
set -u
B=https://api.axiomworks.co.uk
CARD=$B/.well-known/agent-card.json
echo "== 402index.io (routes not already aggregated from Bazaar)"
for spec in "kyb|GET|2.00|KYB report: UK Companies House + EU VIES VAT + domain/DNS + risk flags|business/kyb|{}" \
            "uk-leads|GET|1.00|New UK company leads by SIC/location with officers + contact signals|business/leads|{}" \
            "uk-leads-feed|POST|25.00|Daily webhook feed of new UK companies matching SIC/location (30 days)|business/leads|{\"sic\":\"62\",\"webhook\":\"https://example.com/hook\"}" \
            "uk-watch|POST|5.00|Watch a UK company for filings/officer/status changes; webhook alerts (90 days)|business/monitoring|{\"number\":\"00445790\",\"webhook\":\"https://example.com/hook\"}"; do
  IFS='|' read -r p m price desc cat body <<<"$spec"
  q="?domain=tesco.com"; [ "$p" = uk-leads ] && q="?sic=62"
  url="$B/$p"; [ "$m" = GET ] && url="$B/$p$q"
  payload=$(python3 -c "import json,sys;a=sys.argv;d={'url':a[1],'name':'Axiom Works AgentReader '+a[2],'protocol':'x402','http_method':a[3],'description':a[4],'price_usd':float(a[5]),'payment_asset':'USDC','payment_network':'Base','category':a[6],'provider':'axiomworks'};
if a[3]=='POST': d['probe_body']=a[7]
print(json.dumps(d))" "$url" "/$p" "$m" "$desc" "$price" "$cat" "$body")
  echo "/$p: $(curl -s -o /tmp/r402.json -w '%{http_code}' -X POST https://402index.io/api/v1/register -H 'content-type: application/json' -d "$payload") $(head -c 200 /tmp/r402.json)"
done
echo "== a2a-registry.org"
curl -s -X POST https://api.a2a-registry.org/public/ingest/submit -H 'content-type: application/json' -d "{\"url\":\"$CARD\"}" | head -c 400; echo
echo "== a2aregistry.org"
curl -s -X POST https://a2aregistry.org/api/agents/register -H 'content-type: application/json' -d "{\"wellKnownURI\":\"$CARD\"}" | head -c 400; echo
