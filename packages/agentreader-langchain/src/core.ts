import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { z } from "zod";
import catalog from "./catalog.json";

export interface CatalogTool {
  name: string;
  path: string;
  price: string;
  description: string;
  params: { name: string; required: boolean; type: string; description: string }[];
}
export const CATALOG = catalog as CatalogTool[];
export const DEFAULT_ORIGIN = "https://api.axiomworks.co.uk";

export interface SelectOptions {
  /** Only expose these tool names (e.g. ["read", "chain_erc20_balance"]). Default: all. */
  tools?: string[];
  /** Hide tools whose per-call price is above this many USD. Default 0.05. */
  maxPriceUsd?: number;
}
export function selectTools(opts: SelectOptions = {}): CatalogTool[] {
  const max = opts.maxPriceUsd ?? 0.05;
  return CATALOG.filter(t => (!opts.tools || opts.tools.includes(t.name)) && Number(t.price.replace("$", "")) <= max);
}

export function zodSchema(t: CatalogTool) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const p of t.params) {
    const s = z.string().describe(p.description || p.name);
    shape[p.name] = p.required ? s : s.optional();
  }
  return z.object(shape);
}

/** Wrap fetch so 402 responses are paid in USDC on Base with the given viem-compatible account. */
export function payingFetch(account: any, baseFetch: typeof fetch = fetch): typeof fetch {
  const client = new x402Client().register("eip155:8453", new ExactEvmScheme(account));
  return wrapFetchWithPayment(baseFetch, client) as typeof fetch;
}

export async function callTool(f: typeof fetch, t: CatalogTool, args: Record<string, unknown>, origin = DEFAULT_ORIGIN): Promise<string> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(args ?? {})) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const res = await f(`${origin}${t.path}?${q}`, { headers: { accept: "application/json", "user-agent": "agentreader-framework/1.8.0" } });
  const text = await res.text();
  if (!res.ok) return JSON.stringify({ error: `HTTP ${res.status}`, body: text.slice(0, 2000) });
  return text.length > 60000 ? text.slice(0, 60000) + "…[truncated]" : text;
}
