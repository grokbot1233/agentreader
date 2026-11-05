import { Actor } from "apify";

const UA = { "User-Agent": "AxiomWorksAgentReader/1.0 (info@axiomworks.co.uk)", Accept: "application/json" };

await Actor.init();
const input = (await Actor.getInput()) || {};
let ticker = (input.ticker || "").trim().toUpperCase();
let cik = (input.cik || "").trim().replace(/^0+/, "");
const maxFilings = Math.min(50, Math.max(1, Number(input.maxFilings) || 10));
if (!ticker && !cik) throw new Error("Provide ticker or cik");

if (!cik && ticker) {
  const mapRes = await fetch("https://www.sec.gov/files/company_tickers.json", { headers: UA });
  if (!mapRes.ok) throw new Error(`SEC tickers HTTP ${mapRes.status}`);
  const map = await mapRes.json();
  const hit = Object.values(map).find((x) => String(x.ticker).toUpperCase() === ticker);
  if (!hit) throw new Error(`Unknown ticker: ${ticker}`);
  cik = String(hit.cik_str);
}

const pad = String(cik).padStart(10, "0");
const subRes = await fetch(`https://data.sec.gov/submissions/CIK${pad}.json`, { headers: UA });
if (!subRes.ok) throw new Error(`SEC submissions HTTP ${subRes.status}`);
const sub = await subRes.json();
const recent = sub.filings?.recent || {};
const filings = [];
const n = Math.min(maxFilings, (recent.form || []).length);
for (let i = 0; i < n; i++) {
  filings.push({
    form: recent.form[i],
    filingDate: recent.filingDate[i],
    accessionNumber: recent.accessionNumber[i],
    primaryDocument: recent.primaryDocument?.[i],
  });
}
const out = {
  source: "SEC EDGAR",
  ticker: ticker || null,
  cik: pad,
  name: sub.name,
  sic: sub.sic,
  sicDescription: sub.sicDescription,
  ein: sub.ein,
  category: sub.category,
  fiscalYearEnd: sub.fiscalYearEnd,
  addresses: sub.addresses || null,
  tickers: sub.tickers || [],
  exchanges: sub.exchanges || [],
  recent_filings: filings,
};
const { eventChargeLimitReached } = await Actor.pushData(out, "sec-snapshot");
await Actor.setValue("OUTPUT", out);
await Actor.exit();
