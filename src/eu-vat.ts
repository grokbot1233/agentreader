import { UserError } from "./core";

const UA = "AxiomWorksAgentReader/1.7 (+https://api.axiomworks.co.uk; info@axiomworks.co.uk)";
const REST = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms";
const CACHE_PREFIX = "vies:v1:";
const CACHE_TTL = 86400; // 24h — valid results only
const EU = new Set([
  "AT","BE","BG","CY","CZ","DE","DK","EE","EL","ES","FI","FR","HR","HU","IE","IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK","XI",
]);

type EnvKV = { LOG: KVNamespace };

function s(v: any) {
  return v == null ? "" : String(v).trim();
}

/** Parse vat like DE123456789 or country+number. EL is Greece (not GR) in VIES. */
export function parseVat(input: {
  vat?: string;
  country?: string;
  number?: string;
}): { country: string; number: string } {
  let vat = s(input.vat).toUpperCase().replace(/[\s.-]/g, "");
  let country = s(input.country).toUpperCase().replace(/[^A-Z]/g, "");
  let number = s(input.number).toUpperCase().replace(/[\s.-]/g, "");

  if (vat) {
    // GR → EL for VIES
    if (vat.startsWith("GR")) vat = "EL" + vat.slice(2);
    const m = vat.match(/^([A-Z]{2})(.+)$/);
    if (!m) throw new UserError("vat must start with a 2-letter country code, e.g. DE123456789 or IE6388047V");
    country = m[1];
    number = m[2];
  } else {
    if (country === "GR") country = "EL";
  }

  if (!country || !number) throw new UserError("missing vat (e.g. DE123456789) or country+number");
  if (!/^[A-Z]{2}$/.test(country)) throw new UserError("country must be a 2-letter EU code (use EL for Greece)");
  if (!EU.has(country)) throw new UserError(`unsupported country '${country}' for VIES (EU + XI Northern Ireland)`);
  if (!/^[A-Z0-9]{2,12}$/.test(number)) throw new UserError("vat number looks invalid (2-12 alphanumeric after country)");
  return { country, number };
}

async function kvGet(env: EnvKV, k: string) {
  try {
    return await env.LOG.get(k, "json");
  } catch {
    return null;
  }
}
async function kvPut(env: EnvKV, k: string, v: any, ttl = CACHE_TTL) {
  try {
    await env.LOG.put(k, JSON.stringify(v), { expirationTtl: ttl });
  } catch {}
}

const DOWNTIME = new Set(["MS_UNAVAILABLE", "MS_MAX_CONCURRENT_REQ", "SERVICE_UNAVAILABLE", "TIMEOUT", "GLOBAL_MAX_CONCURRENT_REQ"]);

export async function euVat(
  env: EnvKV,
  opts: { vat?: string; country?: string; number?: string },
) {
  const { country, number } = parseVat(opts);
  const ck = `${CACHE_PREFIX}${country}${number}`;
  const hit = await kvGet(env, ck);
  if (hit && (hit as any).valid === true) {
    return { ...(hit as any), queried_at: new Date().toISOString(), cache: "HIT" };
  }

  const url = `${REST}/${country}/vat/${encodeURIComponent(number)}`;
  let data: any;
  try {
    const r = await fetch(url, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) {
      if (r.status >= 500) throw new UserError("VIES service unavailable; try again shortly", 503);
      throw new UserError(`VIES HTTP ${r.status}`, r.status);
    }
    data = await r.json();
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    throw new UserError(`VIES request failed: ${String(e?.message || e)}`, 503);
  }

  const userError = s(data.userError || data.user_error);
  if (DOWNTIME.has(userError) || /unavailable|timeout|concurrent/i.test(userError)) {
    throw new UserError(`VIES temporarily unavailable (${userError || "downtime"}); retry later`, 503);
  }

  const valid = data.isValid === true || userError === "VALID";
  const out = {
    queried_at: new Date().toISOString(),
    bundle: "eu-vat",
    price: "$0.01",
    valid,
    countryCode: country,
    vatNumber: number,
    vat: `${country}${number}`,
    name: valid && data.name && data.name !== "---" ? data.name : null,
    address: valid && data.address && data.address !== "---" ? data.address : null,
    requestDate: data.requestDate || null,
    userError: userError || null,
    cache: "MISS",
    source: "EU VIES (ec.europa.eu taxation_customs)",
  };

  if (valid) await kvPut(env, ck, { ...out, cache: undefined });
  return out;
}
