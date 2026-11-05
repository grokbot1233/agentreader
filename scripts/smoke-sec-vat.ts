// Local smoke of usSec / euVat without payment (direct module call).
import { usSec } from "../src/us-sec.ts";
import { euVat } from "../src/eu-vat.ts";

const mem = new Map<string, string>();
const env: any = {
  LOG: {
    async get(k: string, type?: string) {
      const v = mem.get(k);
      if (v == null) return null;
      return type === "json" ? JSON.parse(v) : v;
    },
    async put(k: string, v: string) { mem.set(k, v); },
  },
};

const lite = await usSec(env, { ticker: "AAPL" });
console.log("lite", lite.cik, lite.name, lite.tickers, "filings", lite.recent_filings?.length);

const full = await usSec(env, { ticker: "AAPL", full: true });
console.log("full facts", Object.keys(full.companyfacts_highlights || {}), "flags", full.red_flag_count);

const vat = await euVat(env, { vat: "IE6388047V" });
console.log("vat", vat.valid, vat.name, vat.countryCode);

const vat2 = await euVat(env, { vat: "DE811111125" });
console.log("vat invalid ok", vat2.valid === false, vat2.userError);
