import { readFileSync } from "fs";
import { ukCharity } from "../src/uk-charity.ts";
const key = readFileSync(new URL("../.charity_key", import.meta.url), "utf8").trim();
const mem = new Map<string,string>();
const env: any = { CHARITY_KEY: key, LOG: { get: async (k: string, t?: any) => { const v = mem.get(k); if (!v) return null; return t==="json"?JSON.parse(v):v; }, put: async (k: string, v: string) => { mem.set(k,v); } } };
const lite = await ukCharity(env, { number: "1089464" });
console.log("LITE", lite.name, lite.status, lite.income, lite.trustees_count, lite.contact?.website, String(lite.source||"").includes("Open Government"));
const byName = await ukCharity(env, { name: "OXFAM" });
console.log("NAME", byName.name, byName.registered_number, byName.status);
const full = await ukCharity(env, { number: "1089464", full: true });
console.log("FULL", full.trustees?.length, full.financial_history?.length, full.red_flag_count, full.areas_of_operation?.length, full.linked_charities?.length);
const lite2 = await ukCharity(env, { number: "1089464" });
console.log("CACHE", lite2.cache);
try { await ukCharity(env, {} as any); } catch(e:any) { console.log("MISSING", e.message); }
try { await ukCharity(env, { number: "abc" }); } catch(e:any) { console.log("BADNUM", e.message); }
