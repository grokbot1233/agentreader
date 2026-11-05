import { Actor } from "apify";

await Actor.init();
const input = (await Actor.getInput()) || {};
let vat = (input.vat || "").replace(/[\s.]+/g, "").toUpperCase();
if (!vat && input.country && input.number) vat = String(input.country).toUpperCase() + String(input.number).replace(/[\s.]+/g, "").toUpperCase();
if (!vat || vat.length < 4) throw new Error("Provide vat (e.g. IE6388047V) or country+number");
const country = vat.slice(0, 2);
const number = vat.slice(2);
const res = await fetch(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${country}/vat/${number}`);
const body = await res.json().catch(async () => ({ raw: await res.text() }));
if (!res.ok) throw new Error(`VIES HTTP ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
const out = {
  source: "EU VIES",
  vat,
  country,
  number,
  valid: body.isValid ?? body.valid ?? null,
  name: body.name || null,
  address: body.address || null,
  requestDate: body.requestDate || null,
  raw: body,
};
await Actor.pushData(out, "vat-check");
await Actor.setValue("OUTPUT", out);
await Actor.exit();
