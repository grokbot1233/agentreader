import { safeFetch, UserError, LIMITS } from "./core";

export type Monitor = {
  id: string;
  url: string;
  selector?: string | null;
  keyword?: string | null;
  webhook: string;
  created: string;
  expires: string;
  last_check?: string | null;
  last_hash?: string | null;
  last_status?: number | null;
  last_change?: string | null;
  checks: number;
  changes: number;
  last_error?: string | null;
  active: boolean;
};

const MAX_ACTIVE = 40;
const TTL_DAYS = 30;
const MAX_WEBHOOK_BODY = 8_000;

export async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function extractContent(url: string, selector?: string | null, keyword?: string | null) {
  const { res, finalUrl } = await safeFetch(url);
  const status = res.status;
  if (status >= 400) {
    try { await res.body?.cancel(); } catch {}
    return { finalUrl, status, hash: await sha256(`status:${status}`), excerpt: `HTTP ${status}`, matched_keyword: false };
  }
  const len = Number(res.headers.get("content-length") || 0);
  if (len > LIMITS.maxBytes) throw new UserError("document too large", 413);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > LIMITS.maxBytes) throw new UserError("document too large", 413);
  let text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  if (selector) {
    // lightweight CSS id/class/tag extractor without full CSS engine
    const { parseHTML } = await import("linkedom");
    const { document } = parseHTML(text);
    let el: any = null;
    if (selector.startsWith("#")) el = document.getElementById(selector.slice(1));
    else if (selector.startsWith(".")) el = document.querySelector(selector);
    else el = document.querySelector(selector);
    text = el ? (el.innerHTML || el.textContent || "") : "";
  }
  // normalize whitespace for stable hashing of HTML noise
  const norm = text.replace(/\s+/g, " ").trim().slice(0, 500_000);
  const matched = keyword ? norm.toLowerCase().includes(keyword.toLowerCase()) : true;
  const hash = await sha256(keyword ? `kw:${matched}|${norm}` : norm);
  return { finalUrl, status, hash, excerpt: norm.slice(0, 500), matched_keyword: matched, length: norm.length };
}

function newId() {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function createMonitor(env: { LOG: KVNamespace }, body: {
  url: string; webhook: string; selector?: string; keyword?: string;
}): Promise<Monitor> {
  const url = (body.url || "").trim();
  const webhook = (body.webhook || "").trim();
  if (!url) throw new UserError("missing url");
  if (!webhook) throw new UserError("missing webhook");
  let wh: URL; try { wh = new URL(webhook); } catch { throw new UserError("invalid webhook url"); }
  if (!["http:", "https:"].includes(wh.protocol)) throw new UserError("webhook must be http(s)");
  if (body.selector && body.selector.length > 200) throw new UserError("selector too long");
  if (body.keyword && body.keyword.length > 200) throw new UserError("keyword too long");

  // cap active monitors
  const listed = await env.LOG.list({ prefix: "mon:" });
  const active = listed.keys.filter((k) => k.name.startsWith("mon:") && !k.name.includes(":log:")).length;
  if (active >= MAX_ACTIVE) throw new UserError(`monitor capacity reached (${MAX_ACTIVE}). Try again when some expire.`, 503);

  // baseline snapshot (also validates url)
  const snap = await extractContent(url, body.selector, body.keyword);
  const id = newId();
  const now = new Date();
  const expires = new Date(now.getTime() + TTL_DAYS * 864e5);
  const mon: Monitor = {
    id, url, selector: body.selector || null, keyword: body.keyword || null, webhook,
    created: now.toISOString(), expires: expires.toISOString(),
    last_check: now.toISOString(), last_hash: snap.hash, last_status: snap.status,
    last_change: null, checks: 1, changes: 0, last_error: null, active: true,
  };
  // store value + metadata; TTL ~31 days
  await env.LOG.put(`mon:${id}`, JSON.stringify(mon), {
    expirationTtl: (TTL_DAYS + 1) * 86400,
    metadata: { id, expires: mon.expires, url: mon.url, active: true },
  });
  return mon;
}

export async function getMonitor(env: { LOG: KVNamespace }, id: string): Promise<Monitor | null> {
  if (!/^[a-f0-9]{32}$/i.test(id)) return null;
  const raw = await env.LOG.get(`mon:${id}`, "json");
  return raw as Monitor | null;
}

async function postWebhook(webhook: string, payload: any) {
  const body = JSON.stringify(payload).slice(0, MAX_WEBHOOK_BODY);
  const r = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "AgentReader-Monitor/1.0" },
    body,
    signal: AbortSignal.timeout(8000),
  });
  return { status: r.status, ok: r.ok };
}

export async function runMonitors(env: { LOG: KVNamespace }) {
  const listed = await env.LOG.list({ prefix: "mon:" });
  const keys = listed.keys.map((k) => k.name).filter((n) => /^mon:[a-f0-9]{32}$/i.test(n));
  const now = Date.now();
  let checked = 0, changed = 0, expired = 0, errors = 0;
  // Process sequentially in small batches to stay within subrequest/CPU limits
  for (const key of keys.slice(0, MAX_ACTIVE)) {
    const mon = (await env.LOG.get(key, "json")) as Monitor | null;
    if (!mon || !mon.active) continue;
    if (new Date(mon.expires).getTime() < now) {
      mon.active = false;
      await env.LOG.put(key, JSON.stringify(mon), { expirationTtl: 7 * 86400, metadata: { id: mon.id, active: false, expired: true } });
      expired++;
      continue;
    }
    try {
      const snap = await extractContent(mon.url, mon.selector, mon.keyword);
      mon.checks++;
      mon.last_check = new Date().toISOString();
      mon.last_status = snap.status;
      mon.last_error = null;
      if (mon.last_hash && mon.last_hash !== snap.hash) {
        mon.changes++;
        mon.last_change = mon.last_check;
        const prev = mon.last_hash;
        mon.last_hash = snap.hash;
        try {
          await postWebhook(mon.webhook, {
            monitor_id: mon.id,
            url: mon.url,
            final_url: snap.finalUrl,
            changed_at: mon.last_change,
            previous_hash: prev,
            new_hash: snap.hash,
            http_status: snap.status,
            keyword: mon.keyword,
            keyword_matched: snap.matched_keyword,
            excerpt: snap.excerpt,
            status_url: `https://api.axiomworks.co.uk/monitor/${mon.id}`,
          });
        } catch (e: any) {
          mon.last_error = `webhook: ${String(e?.message || e)}`;
        }
        changed++;
      } else {
        mon.last_hash = snap.hash;
      }
      const ttl = Math.max(60, Math.floor((new Date(mon.expires).getTime() - now) / 1000) + 86400);
      await env.LOG.put(key, JSON.stringify(mon), { expirationTtl: ttl, metadata: { id: mon.id, expires: mon.expires, active: true } });
      checked++;
    } catch (e: any) {
      errors++;
      mon.last_check = new Date().toISOString();
      mon.last_error = String(e?.message || e).slice(0, 300);
      mon.checks++;
      try {
        await env.LOG.put(key, JSON.stringify(mon), {
          expirationTtl: Math.max(60, Math.floor((new Date(mon.expires).getTime() - now) / 1000) + 86400),
          metadata: { id: mon.id, active: true },
        });
      } catch {}
    }
  }
  return { checked, changed, expired, errors, at: new Date().toISOString() };
}
