import { UserError } from "./core";

const CH_API = "https://api.company-information.service.gov.uk";
const UA = "AgentReader/1.31 (+https://api.axiomworks.co.uk; UK company watch)";
const TTL_DAYS = 30;
const MAX_WATCHES = 40;

type EnvKV = { LOG: KVNamespace; CH_API_KEY?: string };

export type UkWatch = {
  id: string;
  kind: "uk-watch";
  company_number: string;
  company_name?: string | null;
  webhook: string;
  created: string;
  expires: string;
  last_check?: string | null;
  last_hash?: string | null;
  last_change?: string | null;
  checks: number;
  changes: number;
  last_error?: string | null;
  active: boolean;
  snapshot?: any;
};

function basicAuth(key: string) {
  return "Basic " + btoa(`${key}:`);
}

function normalizeNumber(n: string) {
  const s = n.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^(?:\d{1,8}|[A-Z]\d{7}|[A-Z]{2}\d{6}|[A-Z]{2}\d{5}[A-Z])$/i.test(s)) throw new UserError("invalid company number");
  if (/^\d+$/.test(s)) return s.padStart(8, "0");
  return s;
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function apiGet(env: EnvKV, path: string) {
  const key = (env.CH_API_KEY || "").trim();
  if (!key) throw new UserError("CH_API_KEY not configured", 503);
  const r = await fetch(`${CH_API}${path}`, {
    headers: { authorization: basicAuth(key), accept: "application/json", "user-agent": UA },
    signal: AbortSignal.timeout(12000),
  });
  if (r.status === 404) throw new UserError("company not found", 404);
  if (r.status === 429) throw new UserError("Companies House rate limited", 429);
  if (!r.ok) throw new UserError(`Companies House http ${r.status}`, 502);
  return r.json();
}

function pscLabel(x: any): string {
  if (x?.name) return String(x.name);
  const id = x?.identification;
  if (id && typeof id === "object") {
    const parts = [id.name || id.legal_form, id.registration_number, id.place_registered, id.legal_authority]
      .filter(Boolean).map(String);
    if (parts.length) return parts.join("/");
  }
  return String(x?.identification || "unknown");
}

function isOutstandingCharge(status: string | null | undefined) {
  return /outstanding|part[-_ ]?satisfied/i.test(String(status || ""));
}

async function snapshot(env: EnvKV, number: string) {
  const [profile, officers, filings, psc, charges] = await Promise.all([
    apiGet(env, `/company/${number}`),
    apiGet(env, `/company/${number}/officers?items_per_page=20`).catch(() => ({ items: [] })),
    apiGet(env, `/company/${number}/filing-history?items_per_page=10`).catch(() => ({ items: [] })),
    apiGet(env, `/company/${number}/persons-with-significant-control?items_per_page=25`).catch(() => ({ items: [] })),
    apiGet(env, `/company/${number}/charges?items_per_page=25`).catch(() => ({ items: [] })),
  ]);
  const officer_names = (officers.items || [])
    .filter((o: any) => !o.resigned_on)
    .map((o: any) => `${o.officer_role}:${o.name}:${o.appointed_on || ""}`)
    .sort();
  const filing_ids = (filings.items || []).map((f: any) => f.transaction_id || `${f.date}:${f.type}`).slice(0, 10);
  const psc_active = (psc.items || [])
    .filter((x: any) => !x.ceased_on)
    .map((x: any) => {
      const natures = Array.isArray(x.natures_of_control) ? [...x.natures_of_control].map(String).sort().join(",") : "";
      return `${pscLabel(x)}|${natures}|${x.notified_on || ""}`;
    })
    .sort();
  const outstandingItems = (charges.items || []).filter((c: any) => isOutstandingCharge(c.status));
  const charges_outstanding = outstandingItems.length;
  const charges_ids = outstandingItems.slice(0, 10).map((c: any) => {
    const entitled = (c.persons_entitled || []).map((p: any) => p.name).filter(Boolean).join(",");
    return `${c.delivered_on || c.created_on || ""}:${c.status || ""}:${entitled}`;
  });
  const slim = {
    company_number: number,
    name: profile.company_name || null,
    status: profile.company_status || null,
    status_detail: profile.company_status_detail || null,
    accounts_overdue: profile.accounts?.overdue ?? null,
    confirmation_overdue: profile.confirmation_statement?.overdue ?? null,
    sic_codes: profile.sic_codes || [],
    registered_office: profile.registered_office_address || null,
    officers_active: officer_names,
    recent_filings: filing_ids,
    psc_active,
    charges_outstanding,
    charges_ids,
  };
  const hash = await sha256(JSON.stringify(slim));
  return { slim, hash, profile_name: profile.company_name || null };
}

function newId() {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function createUkWatch(env: EnvKV, body: { number: string; webhook: string }): Promise<UkWatch> {
  const number = normalizeNumber(body.number || "");
  const webhook = (body.webhook || "").trim();
  if (!webhook) throw new UserError("missing webhook");
  let wh: URL; try { wh = new URL(webhook); } catch { throw new UserError("invalid webhook url"); }
  if (wh.protocol !== "https:") throw new UserError("webhook must be https");

  try {
    const listed = await env.LOG.list({ prefix: "ukwatch:" });
    if (listed.keys.length >= MAX_WATCHES) throw new UserError(`uk-watch capacity reached (${MAX_WATCHES})`, 503);
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    console.log("ukwatch list cap skipped", e?.message || e);
  }

  const snap = await snapshot(env, number);
  const id = newId();
  const now = new Date();
  const expires = new Date(now.getTime() + TTL_DAYS * 864e5);
  const watch: UkWatch = {
    id, kind: "uk-watch", company_number: number, company_name: snap.profile_name,
    webhook, created: now.toISOString(), expires: expires.toISOString(),
    last_check: now.toISOString(), last_hash: snap.hash, last_change: null,
    checks: 1, changes: 0, last_error: null, active: true, snapshot: snap.slim,
  };
  // Customer paid — create MUST persist; never silently succeed if KV put fails.
  try {
    await env.LOG.put(`ukwatch:${id}`, JSON.stringify(watch), {
      expirationTtl: (TTL_DAYS + 1) * 86400,
      metadata: { id, expires: watch.expires, number, active: true },
    });
  } catch (e: any) {
    console.log("ukwatch create put failed", e?.message || e);
    throw new UserError("watch storage unavailable; payment not consumed — retry shortly", 503);
  }
  return { ...watch, snapshot: snap.slim };
}

export async function getUkWatch(env: EnvKV, id: string): Promise<UkWatch | null> {
  if (!/^[a-f0-9]{32}$/i.test(id)) return null;
  return (await env.LOG.get(`ukwatch:${id}`, "json")) as UkWatch | null;
}

export async function runUkWatches(env: EnvKV) {
  let listed: any;
  try { listed = await env.LOG.list({ prefix: "ukwatch:" }); }
  catch (e: any) { console.log("runUkWatches list failed", e?.message || e); return { ran: 0, changes: 0, errors: 0, skipped: "kv_list_limit" }; }
  let ran = 0, changes = 0, errors = 0;
  const now = Date.now();
  for (const k of listed.keys) {
    const watch = (await env.LOG.get(k.name, "json")) as UkWatch | null;
    if (!watch || !watch.active) continue;
    if (new Date(watch.expires).getTime() < now) {
      watch.active = false;
      try {
        await env.LOG.put(k.name, JSON.stringify(watch), { expirationTtl: 7 * 86400, metadata: { id: watch.id, active: false, expired: true } });
      } catch (e: any) {
        console.log("ukwatch expire put failed", watch.id, e?.message || e);
      }
      continue;
    }
    ran++;
    try {
      const snap = await snapshot(env, watch.company_number);
      watch.checks += 1;
      watch.last_check = new Date().toISOString();
      watch.company_name = snap.profile_name;
      if (watch.last_hash && watch.last_hash !== snap.hash) {
        changes++;
        watch.changes += 1;
        watch.last_change = watch.last_check;
        const prev = watch.snapshot || {};
        const payload = {
          type: "uk-watch-change",
          watch_id: watch.id,
          company_number: watch.company_number,
          company_name: snap.profile_name,
          changed_at: watch.last_check,
          before: prev,
          after: snap.slim,
          ch_url: `https://find-and-update.company-information.service.gov.uk/company/${watch.company_number}`,
        };
        const r = await fetch(watch.webhook, {
          method: "POST",
          headers: { "content-type": "application/json", "user-agent": UA },
          body: JSON.stringify(payload).slice(0, 200_000),
          signal: AbortSignal.timeout(12000),
        });
        if (!r.ok) throw new Error(`webhook http ${r.status}`);
      }
      watch.last_hash = snap.hash;
      watch.snapshot = snap.slim;
      watch.last_error = null;
    } catch (e: any) {
      errors++;
      watch.last_error = String(e?.message || e).slice(0, 300);
      watch.last_check = new Date().toISOString();
    }
    const ttl = Math.max(60, Math.floor((new Date(watch.expires).getTime() - now) / 1000) + 86400);
    try {
      await env.LOG.put(k.name, JSON.stringify(watch), { expirationTtl: ttl, metadata: { id: watch.id, expires: watch.expires, active: true } });
    } catch (e: any) {
      console.log("ukwatch run put failed", watch.id, e?.message || e);
    }
  }
  return { ran, changes, errors };
}
