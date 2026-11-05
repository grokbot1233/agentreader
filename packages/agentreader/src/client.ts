import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import type { Chain, ClientOptions, RequestOpts } from "./types.js";

const DEFAULT_ORIGIN = "https://api.axiomworks.co.uk";
const VERSION = "1.7.0";

function normalizeKey(raw?: string): `0x${string}` | undefined {
  if (!raw) return undefined;
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("privateKey must be a 32-byte hex string (optional 0x prefix)");
  }
  return key as `0x${string}`;
}

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    sp.set(k, String(v));
  }
  return sp.toString();
}

export class PaymentRequiredError extends Error {
  readonly status = 402;
  readonly paymentRequired: unknown;
  readonly body: unknown;
  readonly url: string;
  constructor(url: string, paymentRequired: unknown, body: unknown) {
    super("Payment required (x402). Pass privateKey to createClient or fund/retry with @x402/fetch.");
    this.name = "PaymentRequiredError";
    this.url = url;
    this.paymentRequired = paymentRequired;
    this.body = body;
  }
}

export class AgentReaderClient {
  readonly origin: string;
  readonly paying: boolean;
  private readonly fetchFn: typeof fetch;
  private readonly defaultPreview: boolean;
  private readonly ua: string;

  constructor(opts: ClientOptions = {}) {
    this.origin = (opts.origin || DEFAULT_ORIGIN).replace(/\/$/, "");
    const key = normalizeKey(
      opts.privateKey ||
        process.env.AGENTREADER_PRIVATE_KEY ||
        process.env.EVM_PRIVATE_KEY ||
        process.env.PRIVATE_KEY,
    );
    this.paying = !!key;
    this.defaultPreview = opts.preview ?? !this.paying;
    this.ua = opts.userAgent || `axiomworks-agentreader-sdk/${VERSION}`;
    if (key) {
      const account = privateKeyToAccount(key);
      const client = new x402Client().register("eip155:8453", new ExactEvmScheme(account));
      const base = opts.fetch || globalThis.fetch.bind(globalThis);
      this.fetchFn = wrapFetchWithPayment(base, client);
    } else {
      this.fetchFn = opts.fetch || globalThis.fetch.bind(globalThis);
    }
  }

  private async request(
    path: string,
    init: RequestInit & { previewable?: boolean } = {},
    opts: RequestOpts = {},
  ): Promise<any> {
    const url = new URL(path.startsWith("http") ? path : `${this.origin}${path}`);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v == null || v === "") continue;
        url.searchParams.set(k, String(v));
      }
    }
    const wantPreview =
      opts.preview === true ||
      (opts.preview !== false && this.defaultPreview && init.method !== "POST" && init.previewable !== false);
    if (wantPreview && !url.searchParams.has("preview")) {
      url.searchParams.set("preview", "1");
    }
    const res = await this.fetchFn(url.toString(), {
      ...init,
      headers: {
        accept: "application/json",
        "user-agent": this.ua,
        ...(init.headers || {}),
      },
    });
    const pr = res.headers.get("payment-required") || res.headers.get("PAYMENT-REQUIRED");
    const text = await res.text();
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 4000) };
    }
    if (res.status === 402 || pr) {
      let payment: unknown = null;
      if (pr) {
        try {
          payment = JSON.parse(Buffer.from(pr, "base64").toString("utf8"));
        } catch {
          payment = { raw: pr.slice(0, 200) };
        }
      }
      throw new PaymentRequiredError(url.toString(), payment ?? body, body);
    }
    if (!res.ok) {
      const err: any = new Error(body?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  private get(path: string, query?: Record<string, unknown>, opts?: RequestOpts) {
    const q = qs({ ...(query || {}), ...(opts?.query || {}) });
    return this.request(`${path}${q ? `?${q}` : ""}`, { method: "GET" }, opts);
  }

  /** Free: x402 catalog / prices */
  pricing(opts?: RequestOpts) {
    return this.request(`${this.origin}/.well-known/x402`, { method: "GET", previewable: false }, { ...opts, preview: false });
  }

  readUrl(input: { url: string }, opts?: RequestOpts) {
    return this.get("/read", input, opts);
  }
  extractLinks(input: { url: string }, opts?: RequestOpts) {
    return this.get("/links", input, opts);
  }
  checkDomain(input: { domain: string }, opts?: RequestOpts) {
    return this.get("/check", input, opts);
  }
  companyResearch(input: { domain: string }, opts?: RequestOpts) {
    return this.get("/company", input, opts);
  }
  ukCompany(input: { number?: string; name?: string }, opts?: RequestOpts) {
    return this.get("/uk-company", input, opts);
  }
  ukCompanyLite(input: { number?: string; name?: string }, opts?: RequestOpts) {
    return this.get("/uk-company-lite", input, opts);
  }
  companyFull(input: { domain: string }, opts?: RequestOpts) {
    return this.get("/company-full", input, opts);
  }
  convertDocument(input: { url: string; format?: "markdown" | "text" }, opts?: RequestOpts) {
    return this.get("/convert", { format: "markdown", ...input }, opts);
  }
  createMonitor(
    input: { url: string; webhook: string; selector?: string; keyword?: string },
    opts?: RequestOpts,
  ) {
    return this.request(
      `${this.origin}/monitor`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        previewable: false,
      },
      { ...opts, preview: false },
    );
  }
  walletBalances(input: { address: string; chain?: Chain; tokens?: string }, opts?: RequestOpts) {
    return this.get("/wallet", input, opts);
  }
  txStatus(input: { hash: string; chain?: Chain }, opts?: RequestOpts) {
    return this.get("/tx", input, opts);
  }
  tokenCheck(input: { address: string; chain?: Chain }, opts?: RequestOpts) {
    return this.get("/token-check", input, opts);
  }
  fxRates(
    input: { base?: string; symbols?: string; date?: string; amount?: string } = {},
    opts?: RequestOpts,
  ) {
    return this.get("/fx", input, opts);
  }
  ensLookup(input: { name?: string; address?: string }, opts?: RequestOpts) {
    return this.get("/ens", input, opts);
  }
  tokenMetadata(input: { address: string; chain?: Chain }, opts?: RequestOpts) {
    return this.get("/token", input, opts);
  }
  tokenAllowance(
    input: { token: string; owner: string; spender: string; chain?: Chain },
    opts?: RequestOpts,
  ) {
    return this.get("/allowance", input, opts);
  }
  contractInfo(input: { address: string; chain?: Chain }, opts?: RequestOpts) {
    return this.get("/contract", input, opts);
  }
  gasFees(input: { chain?: Chain } = {}, opts?: RequestOpts) {
    return this.get("/gas", input, opts);
  }
  blockLookup(input: { number?: string; timestamp?: string; chain?: Chain } = {}, opts?: RequestOpts) {
    return this.get("/block", input, opts);
  }
  nftLookup(input: { contract: string; token_id: string; chain?: Chain }, opts?: RequestOpts) {
    return this.get("/nft", input, opts);
  }
  webSearch(input: { q: string; sources?: string; limit?: string | number }, opts?: RequestOpts) {
    return this.get("/search", input, opts);
  }
  ukPropertyPrices(input: { postcode: string; radius?: string }, opts?: RequestOpts) {
    return this.get("/uk-property", input, opts);
  }
  ukAreaProfile(input: { postcode: string }, opts?: RequestOpts) {
    return this.get("/uk-area", input, opts);
  }
  ukCharity(input: { number?: string; name?: string; suffix?: string }, opts?: RequestOpts) {
    return this.get("/uk-charity", input, opts);
  }
  ukCharityFull(input: { number?: string; name?: string; suffix?: string }, opts?: RequestOpts) {
    return this.get("/uk-charity-full", input, opts);
  }
  usSec(input: { ticker?: string; cik?: string }, opts?: RequestOpts) {
    return this.get("/us-sec", input, opts);
  }
  usSecFull(input: { ticker?: string; cik?: string }, opts?: RequestOpts) {
    return this.get("/us-sec-full", input, opts);
  }
  euVat(input: { vat?: string; country?: string; number?: string }, opts?: RequestOpts) {
    return this.get("/eu-vat", input, opts);
  }
}

/** Create a typed AgentReader client. Pass privateKey (or set AGENTREADER_PRIVATE_KEY) to auto-pay. */
export function createClient(opts: ClientOptions = {}): AgentReaderClient {
  return new AgentReaderClient(opts);
}
