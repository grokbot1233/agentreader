import { readFileSync } from "node:fs";
import { ukCompany } from "../src/uk-company.ts";

async function main() {
  const key = readFileSync(new URL("../.ch_api_key", import.meta.url), "utf8").trim();
  const mem = new Map<string, string>();
  const kv = {
    async get(k: string, type?: string) {
      const v = mem.get(k); if (v == null) return null;
      return type === "json" ? JSON.parse(v) : v;
    },
    async put(k: string, v: string) { mem.set(k, v); },
  } as any;
  const env = { LOG: kv, CH_API_KEY: key };

  const full = await ukCompany(env, { number: "00445790" });
  console.log("full", { mode: full.mode, cache: full.cache, name: full.profile?.name, officers: full.officers?.total_results, flags: full.red_flags?.map((f: any) => f.flag), psc: { available: full.persons_with_significant_control?.available, reason: full.persons_with_significant_control?.reason, n: full.persons_with_significant_control?.persons?.length } });

  const lite = await ukCompany(env, { number: "00445790", lite: true });
  console.log("lite_cache", lite.cache, "name", lite.name, "keys_omit_officers", !("officers" in lite));

  // newly incorporated / mass-agent candidate via name search pick
  const neo = await ukCompany(env, { number: "17481746", lite: true }); // AXIOM ACCOMMODATION from earlier search - may be new
  console.log("neo", { name: neo.name, status: neo.status, inc: neo.incorporation_date, flags: neo.red_flags, mass: neo.mass_formation_office });

  const fb = await ukCompany({ LOG: kv, CH_API_KEY: "" }, { number: "00000006", lite: true });
  console.log("fallback_dissolved", { mode: fb.mode, name: fb.name, status: fb.status, flags: fb.red_flags?.map((f: any) => f.flag) });
}
main().catch((e) => { console.error(e); process.exit(1); });
