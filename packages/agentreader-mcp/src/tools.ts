import { z } from "zod";

export const ORIGIN = process.env.AGENTREADER_ORIGIN || "https://api.axiomworks.co.uk";
export const VERSION = "1.7.0";

const CH = z.enum(["base", "ethereum", "arbitrum", "optimism", "polygon"]).optional();
const qs = (a: Record<string, unknown>) =>
  new URLSearchParams(
    Object.entries(a)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();

export type ToolDef = {
  name: string;
  description: string;
  price: string;
  schema: Record<string, z.ZodTypeAny>;
  http: (a: Record<string, any>) => string;
  method?: "GET" | "POST";
  body?: (a: Record<string, any>) => unknown;
  free?: boolean;
  /** When true, unpaid preview mode appends preview=1 */
  previewable?: boolean;
};

export const TOOLS: ToolDef[] = [
  {
    name: "read_url",
    description:
      "Use this when you need clean Markdown + metadata from a public URL (not raw HTML). $0.002 USDC on Base via x402.",
    price: "$0.002",
    schema: { url: z.string().url() },
    http: (a) => `${ORIGIN}/read?url=${encodeURIComponent(a.url)}`,
    previewable: true,
  },
  {
    name: "extract_links",
    description: "Use this when you only need de-duplicated absolute links. $0.001 USDC.",
    price: "$0.001",
    schema: { url: z.string().url() },
    http: (a) => `${ORIGIN}/links?url=${encodeURIComponent(a.url)}`,
    previewable: true,
  },
  {
    name: "check_domain",
    description: "Use this when vetting domain health: DNS/TLS/MX/SPF/DMARC + score. $0.001 USDC.",
    price: "$0.001",
    schema: { domain: z.string() },
    http: (a) => `${ORIGIN}/check?domain=${encodeURIComponent(a.domain)}`,
    previewable: true,
  },
  {
    name: "company_research",
    description:
      "Website company research (tech, contacts, DNS, RDAP, news) with sources — not UK Companies House. $0.25 USDC.",
    price: "$0.25",
    schema: { domain: z.string() },
    http: (a) => `${ORIGIN}/company?domain=${encodeURIComponent(a.domain)}`,
    previewable: true,
  },
  {
    name: "uk_company",
    description:
      "Full UK Companies House due diligence (number or name) + red flags. $0.50 USDC. Prefer uk_company_lite for a cheap snapshot.",
    price: "$0.50",
    schema: { number: z.string().optional(), name: z.string().optional() },
    http: (a) =>
      a.number
        ? `${ORIGIN}/uk-company?number=${encodeURIComponent(a.number)}`
        : `${ORIGIN}/uk-company?name=${encodeURIComponent(a.name || "")}`,
    previewable: true,
  },
  {
    name: "uk_company_lite",
    description: "Cheap UK company snapshot: status, compliance, red flags. $0.05 USDC.",
    price: "$0.05",
    schema: { number: z.string().optional(), name: z.string().optional() },
    http: (a) =>
      a.number
        ? `${ORIGIN}/uk-company-lite?number=${encodeURIComponent(a.number)}`
        : `${ORIGIN}/uk-company-lite?name=${encodeURIComponent(a.name || "")}`,
    previewable: true,
  },
  {
    name: "company_full",
    description: "Website company research + UK CH pack when detected ($0.65 vs $0.75 separate).",
    price: "$0.65",
    schema: { domain: z.string() },
    http: (a) => `${ORIGIN}/company-full?domain=${encodeURIComponent(a.domain)}`,
    previewable: true,
  },
  {
    name: "convert_document",
    description: "Convert public PDF/DOCX/HTML/text URL to markdown or text. $0.03 USDC.",
    price: "$0.03",
    schema: { url: z.string().url(), format: z.enum(["markdown", "text"]).optional() },
    http: (a) =>
      `${ORIGIN}/convert?url=${encodeURIComponent(a.url)}&format=${encodeURIComponent(a.format || "markdown")}`,
    previewable: true,
  },
  {
    name: "create_monitor",
    description: "30-day hourly web change monitor → webhook. $1.00 USDC. POST body.",
    price: "$1.00",
    schema: {
      url: z.string().url(),
      webhook: z.string().url(),
      selector: z.string().optional(),
      keyword: z.string().optional(),
    },
    http: () => `${ORIGIN}/monitor`,
    method: "POST",
    body: (a) => a,
  },
  {
    name: "pricing",
    description: "Free: list Axiom Works AgentReader tools, prices and payment details.",
    price: "free",
    schema: {},
    http: () => `${ORIGIN}/.well-known/x402`,
    free: true,
  },
  {
    name: "wallet_balances",
    description: "EVM wallet balances (native + majors), 5 chains. $0.003 USDC.",
    price: "$0.003",
    schema: { address: z.string(), chain: CH, tokens: z.string().optional() },
    http: (a) => `${ORIGIN}/wallet?${qs(a)}`,
    previewable: true,
  },
  {
    name: "tx_status",
    description: "Did a tx/payment land: status, confirmations, fee, decoded ERC20 transfers. $0.003 USDC.",
    price: "$0.003",
    schema: { hash: z.string(), chain: CH },
    http: (a) => `${ORIGIN}/tx?${qs(a)}`,
    previewable: true,
  },
  {
    name: "token_check",
    description: "ERC20 token risk: owner, proxy, liquidity, flags, score. $0.01 USDC.",
    price: "$0.01",
    schema: { address: z.string(), chain: CH },
    http: (a) => `${ORIGIN}/token-check?${qs(a)}`,
    previewable: true,
  },
  {
    name: "fx_rates",
    description: "ECB FX rates, latest/historical, with conversion. $0.002 USDC.",
    price: "$0.002",
    schema: {
      base: z.string().optional(),
      symbols: z.string().optional(),
      date: z.string().optional(),
      amount: z.string().optional(),
    },
    http: (a) => `${ORIGIN}/fx?${qs(a)}`,
    previewable: true,
  },
  {
    name: "ens_lookup",
    description: "ENS name -> address + records, or reverse. $0.002 USDC.",
    price: "$0.002",
    schema: { name: z.string().optional(), address: z.string().optional() },
    http: (a) => `${ORIGIN}/ens?${qs(a)}`,
    previewable: true,
  },
  {
    name: "token_metadata",
    description: "ERC20 name/symbol/decimals/supply. $0.001 USDC.",
    price: "$0.001",
    schema: { address: z.string(), chain: CH },
    http: (a) => `${ORIGIN}/token?${qs(a)}`,
    previewable: true,
  },
  {
    name: "token_allowance",
    description: "ERC20 allowance owner->spender, unlimited flag. $0.002 USDC.",
    price: "$0.002",
    schema: { token: z.string(), owner: z.string(), spender: z.string(), chain: CH },
    http: (a) => `${ORIGIN}/allowance?${qs(a)}`,
    previewable: true,
  },
  {
    name: "contract_info",
    description: "Contract/proxy/clone/7702/standards/Sourcify name. $0.003 USDC.",
    price: "$0.003",
    schema: { address: z.string(), chain: CH },
    http: (a) => `${ORIGIN}/contract?${qs(a)}`,
    previewable: true,
  },
  {
    name: "gas_fees",
    description: "Current gas fees + USD cost estimates. $0.001 USDC.",
    price: "$0.001",
    schema: { chain: CH },
    http: (a) => `${ORIGIN}/gas?${qs(a)}`,
    previewable: true,
  },
  {
    name: "block_lookup",
    description: "Block by number or timestamp. $0.001 USDC.",
    price: "$0.001",
    schema: { number: z.string().optional(), timestamp: z.string().optional(), chain: CH },
    http: (a) => `${ORIGIN}/block?${qs(a)}`,
    previewable: true,
  },
  {
    name: "nft_lookup",
    description: "NFT owner + metadata. $0.002 USDC.",
    price: "$0.002",
    schema: { contract: z.string(), token_id: z.string(), chain: CH },
    http: (a) => `${ORIGIN}/nft?${qs(a)}`,
    previewable: true,
  },
  {
    name: "web_search",
    description:
      "Open research search: Wikipedia + OpenAlex + arXiv + Crossref merged, deduped, ranked with snippets. $0.003 USDC.",
    price: "$0.003",
    schema: { q: z.string(), sources: z.string().optional(), limit: z.string().optional() },
    http: (a) => `${ORIGIN}/search?${qs(a)}`,
    previewable: true,
  },
  {
    name: "uk_property_prices",
    description: "England & Wales Land Registry sold prices near a postcode + medians. $0.01 USDC.",
    price: "$0.01",
    schema: { postcode: z.string(), radius: z.string().optional() },
    http: (a) => `${ORIGIN}/uk-property?${qs(a)}`,
    previewable: true,
  },
  {
    name: "uk_area_profile",
    description: "UK postcode profile: ONS geography, police crime, FSA hygiene. $0.005 USDC.",
    price: "$0.005",
    schema: { postcode: z.string() },
    http: (a) => `${ORIGIN}/uk-area?${qs(a)}`,
    previewable: true,
  },
  {
    name: "uk_charity",
    description:
      "UK Charity Commission snapshot: status, income, trustees count, activities. $0.05 USDC.",
    price: "$0.05",
    schema: {
      number: z.string().optional(),
      name: z.string().optional(),
      suffix: z.string().optional(),
    },
    http: (a) =>
      a.number
        ? `${ORIGIN}/uk-charity?number=${encodeURIComponent(a.number)}${a.suffix != null ? `&suffix=${encodeURIComponent(a.suffix)}` : ""}`
        : `${ORIGIN}/uk-charity?name=${encodeURIComponent(a.name || "")}`,
    previewable: true,
  },

  {
    name: "us_sec",
    description:
      "US SEC EDGAR company snapshot by ticker or CIK: filings, SIC, addresses. $0.05 USDC.",
    price: "$0.05",
    schema: { ticker: z.string().optional(), cik: z.string().optional() },
    http: (a) =>
      a.ticker
        ? `${ORIGIN}/us-sec?ticker=${encodeURIComponent(a.ticker)}`
        : `${ORIGIN}/us-sec?cik=${encodeURIComponent(a.cik || "")}`,
    previewable: true,
  },
  {
    name: "us_sec_full",
    description:
      "US SEC full DD: lite + us-gaap highlights + red-flag heuristics. $0.25 USDC.",
    price: "$0.25",
    schema: { ticker: z.string().optional(), cik: z.string().optional() },
    http: (a) =>
      a.ticker
        ? `${ORIGIN}/us-sec-full?ticker=${encodeURIComponent(a.ticker)}`
        : `${ORIGIN}/us-sec-full?cik=${encodeURIComponent(a.cik || "")}`,
    previewable: true,
  },
  {
    name: "eu_vat",
    description: "EU VIES VAT validation: valid, name, address. $0.01 USDC.",
    price: "$0.01",
    schema: {
      vat: z.string().optional(),
      country: z.string().optional(),
      number: z.string().optional(),
    },
    http: (a) =>
      a.vat
        ? `${ORIGIN}/eu-vat?vat=${encodeURIComponent(a.vat)}`
        : `${ORIGIN}/eu-vat?country=${encodeURIComponent(a.country || "")}&number=${encodeURIComponent(a.number || "")}`,
    previewable: true,
  },
  {
    name: "uk_charity_full",
    description:
      "Full UK charity DD: trustees, finances, assets, governance, regulatory + red flags. $0.25 USDC.",
    price: "$0.25",
    schema: {
      number: z.string().optional(),
      name: z.string().optional(),
      suffix: z.string().optional(),
    },
    http: (a) =>
      a.number
        ? `${ORIGIN}/uk-charity-full?number=${encodeURIComponent(a.number)}${a.suffix != null ? `&suffix=${encodeURIComponent(a.suffix)}` : ""}`
        : `${ORIGIN}/uk-charity-full?name=${encodeURIComponent(a.name || "")}`,
    previewable: true,
  },
];
