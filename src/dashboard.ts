export const dashboardHtml = () => `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content=noindex><title>AgentReader Dashboard</title>
<style>body{font:15px/1.45 system-ui,sans-serif;margin:0;background:#0f1115;color:#e8e8e8}main{max-width:980px;margin:auto;padding:16px}
h1{font-size:20px;margin:4px 0 2px}.sub{color:#8a8f98;font-size:13px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}
.card{background:#181b22;border:1px solid #262a33;border-radius:10px;padding:12px}.k{color:#8a8f98;font-size:12px;text-transform:uppercase}.v{font-size:24px;font-weight:600;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:6px 4px;border-bottom:1px solid #262a33;text-align:left;vertical-align:top}th{color:#8a8f98;font-weight:500}
a{color:#7cb7ff;word-break:break-all}.ok{color:#4ade80}.bad{color:#f87171}.warn{color:#facc15}h2{font-size:15px;margin:20px 0 8px}.wrap{overflow-x:auto}ul{margin:4px 0;padding-left:20px}code{background:#222;padding:1px 4px;border-radius:4px}</style></head><body><main>
<h1>AgentReader — Agent Economy Venture</h1><div class=sub>Live · auto-refreshes every 15s · <span id=upd>loading…</span></div>
<div class=grid><div class=card><div class=k>Revenue (USDC)</div><div class=v id=rev>–</div></div><div class=card><div class=k>Paid calls</div><div class=v id=calls>–</div></div>
<div class=card><div class=k>Unique paying agents</div><div class=v id=payers>–</div></div><div class=card><div class=k>Service health</div><div class=v id=health>–</div><div class=sub id=hdet></div></div></div>
<h2>Needed from Liam</h2><div class=card id=check></div>
<h2>By endpoint</h2><div class="card wrap"><table><thead><tr><th>Endpoint</th><th>Calls</th><th>Revenue (USDC)</th></tr></thead><tbody id=ep></tbody></table></div>
<h2>By day (UTC date)</h2><div class=card id=chart></div>
<h2>Last 20 payments</h2><div class="card wrap"><table><thead><tr><th>Time (London)</th><th>Endpoint</th><th>Payer</th><th>Amount</th><th>Tx</th></tr></thead><tbody id=recent></tbody></table></div>
<h2>Services &amp; endpoints</h2><div class="card wrap"><table><thead><tr><th>Service</th><th>Price</th><th>URL</th></tr></thead><tbody id=svc></tbody></table><div class=sub id=pay></div></div>
<h2>Distribution / listings</h2><div class="card wrap"><table><thead><tr><th>Listing</th><th>Status</th><th>Link</th></tr></thead><tbody id=lst></tbody></table></div>
<h2>Grow / cut rule</h2><div class=card id=rule></div>
<h2>Next steps</h2><div class=card id=next></div>
<div class=sub id=metaupd style="margin-top:12px"></div>
</main><script>
const key=new URLSearchParams(location.search).get('key')||'';const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const lnk=u=>u?'<a target=_blank rel=noopener href="'+esc(u)+'">'+esc(u.replace(/^https?:\\/\\//,''))+'</a>':'–';
const fmt=n=>Number(n||0).toFixed(6).replace(/0{1,4}$/,'');const tz=t=>new Date(t).toLocaleString('en-GB',{timeZone:'Europe/London',dateStyle:'short',timeStyle:'medium'});
const cls=s=>/live|listed|done|merged|ok/i.test(s)?'ok':/browser|needs|todo|blocked/i.test(s)?'warn':'';
function chart(byDay){const days=[];for(let i=13;i>=0;i--){days.push(new Date(Date.now()-i*864e5).toISOString().slice(0,10))}
const vals=days.map(d=>(byDay[d]||{}).revenue_usdc||0),calls=days.map(d=>(byDay[d]||{}).calls||0),max=Math.max(...vals,0);
const W=700,H=170,bw=W/days.length;let s='<svg viewBox="0 0 '+W+' '+(H+30)+'" width="100%" role=img>';
days.forEach((d,i)=>{const h=max?vals[i]/max*H:0;s+='<rect x="'+(i*bw+4)+'" y="'+(H-h)+'" width="'+(bw-8)+'" height="'+h+'" fill="#4f8cff"><title>'+d+': '+fmt(vals[i])+' USDC, '+calls[i]+' calls</title></rect>';
s+='<text x="'+(i*bw+bw/2)+'" y="'+(H+16)+'" fill="#8a8f98" font-size="10" text-anchor="middle">'+d.slice(5)+'</text>'});
s+='<line x1=0 x2='+W+' y1='+H+' y2='+H+' stroke="#333"/></svg><div class=sub>Last 14 days. Peak: '+fmt(max)+' USDC/day'+(max?'':' (no paid calls yet)')+'</div>';$('chart').innerHTML=s}
const list=a=>a&&a.length?'<ul>'+a.map(x=>'<li>'+(typeof x==='string'?esc(x):(x.done?'✅ ':'⬜ ')+esc(x.item)+(x.detail?' — <span class=sub>'+esc(x.detail)+'</span>':''))+'</li>').join('')+'</ul>':'<span class=sub>none</span>';
async function load(){try{const r=await fetch('/dashboard/data?key='+encodeURIComponent(key),{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||r.status);
$('rev').textContent=fmt(d.revenue_usdc);$('calls').textContent=d.paid_calls;$('payers').textContent=d.unique_payers;
$('health').innerHTML=d.health&&d.health.ok?'<span class=ok>OK</span>':'<span class=bad>DOWN</span>';$('hdet').textContent='KV '+(d.health.kv_ms??'?')+'ms · facilitator: '+(d.health.facilitator||'?');
const eps=Object.entries(d.by_endpoint);$('ep').innerHTML=eps.length?eps.map(([e,v])=>'<tr><td>'+esc(e)+'</td><td>'+v.calls+'</td><td>'+fmt(v.revenue_usdc)+'</td></tr>').join(''):'<tr><td colspan=3 class=sub>No paid calls yet (0 calls, 0 USDC)</td></tr>';
chart(d.by_day);$('recent').innerHTML=d.recent.length?d.recent.map(p=>'<tr><td>'+tz(p.ts)+'</td><td>'+esc(p.endpoint)+'</td><td>'+(p.payer?esc(p.payer.slice(0,6)+'…'+p.payer.slice(-4)):'–')+'</td><td>'+fmt(Number(p.amount||0)/1e6)+'</td><td>'+(p.tx?'<a target=_blank rel=noopener href="https://basescan.org/tx/'+esc(p.tx)+'">'+esc(p.tx.slice(0,10))+'…</a>':'–')+'</td></tr>').join(''):'<tr><td colspan=5 class=sub>No payments yet</td></tr>';
$('svc').innerHTML=d.services.map(s=>'<tr><td>'+esc(s.name)+'</td><td>'+esc(s.price)+'</td><td>'+lnk(s.url)+'</td></tr>').join('');
$('pay').textContent='Payments: USDC on '+d.network+' → '+d.payTo;
const m=d.meta||{};$('lst').innerHTML=(m.listings||[]).map(l=>'<tr><td>'+esc(l.name)+'</td><td class="'+cls(l.status)+'">'+esc(l.status)+'</td><td>'+lnk(l.url)+'</td></tr>').join('')||'<tr><td colspan=3 class=sub>none recorded</td></tr>';
$('rule').innerHTML=m.rule?esc(m.rule):'<span class=sub>not set</span>';$('next').innerHTML=list(m.next_steps);$('check').innerHTML=list(m.checklist);
$('metaupd').textContent=m.updated?'Listings/next steps/checklist last updated '+tz(m.updated)+' (London)':'';
$('upd').textContent='updated '+tz(d.generated)+' (London)'}catch(e){$('upd').textContent='error: '+e.message;$('health').innerHTML='<span class=bad>ERR</span>'}}
load();setInterval(load,15000);
</script></body></html>`;
