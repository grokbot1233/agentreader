import { createClient, PaymentRequiredError } from "./dist/index.js";

const client = createClient({ preview: true });
console.log("paying:", client.paying, "origin:", client.origin);

const pricing = await client.pricing();
console.log("pricing keys:", Object.keys(pricing).slice(0, 8).join(", "));
console.log("pricing name:", pricing.name || pricing.resources?.[0]);

const check = await client.checkDomain({ domain: "example.com" });
console.log("check preview:", {
  preview: check.preview,
  domain: check.domain,
  score: check.score,
  price: check.full_report_price,
});
if (!check.preview) throw new Error("expected preview:true");

const gas = await client.gasFees({ chain: "base" });
console.log("gas preview-ish:", {
  preview: gas.preview,
  keys: Object.keys(gas).slice(0, 10),
});

console.log("SDK preview test PASSED");
