import { VALIDATE } from "./validate";
import { search } from "./search";
import { ukProperty, ukArea } from "./ukdata";
import { ukCharity } from "./uk-charity";
import { usSec } from "./us-sec";
import { euVat } from "./eu-vat";
import { ukLeads, createLeadsFeed, getLeadsFeed, runLeadsFeeds } from "./uk-leads";
import { createUkWatch, getUkWatch, runUkWatches } from "./uk-watch";
import { kybReport } from "./kyb";
import { ukOfficerSearch } from "./uk-officer";
import { screenSanctions, screenSanctionsBatch, refreshSanctionsIndex } from "./sanctions";
import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { readUrl, linksFor, checkDomain, UserError } from "./core";
import { companyResearch } from "./company";
import { ukCompany } from "./uk-company";
import { companyFull } from "./company-full";
import { convertDocument } from "./convert";
import { createMonitor, getMonitor, runMonitors } from "./monitor";
import { checkPreviewQuota, clientIp, truncateSample, STATIC_SAMPLES, type PreviewKind } from "./previews";
import { handleMcp } from "./mcp";
import { upsell } from "./upsell";
import { facilitatorClient, CANONICAL, CONTACT } from "./facilitator";
import EXAMPLES from "./examples.json";
import { CHAIN_ROUTES } from "./chain";
import { v1Reqs, v1Body, decodeV1, handleV1 } from "./v1";
import { dashboardHtml } from "./dashboard";
import { wallet, tx, tokenCheck, fx, CHAINS } from "./onchain";
import { ens, tokenMeta, allowance, contractInfo, gas, block, nft } from "./micro";

type Env = { LOG: KVNamespace; STATS_SECRET: string; DASHBOARD_KEY: string; PAY_TO: string; FACILITATOR_URL: string; CDP_API_KEY_ID?: string; CDP_API_KEY_SECRET?: string; FACILITATOR?: string; CH_API_KEY?: string; CHARITY_KEY?: string };
const NETWORK = "eip155:8453";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const PRICES = {
  "/read": "$0.002",
  "/links": "$0.001",
  "/check": "$0.001",
  "/company": "$0.25",
  "/uk-company": "$0.50",
  "/uk-company-lite": "$0.05",
  "/company-full": "$0.65",
  "/convert": "$0.03",
  "/monitor": "$1.00",
  "/wallet": "$0.003",
  "/tx": "$0.003",
  "/token-check": "$0.01",
  "/fx": "$0.002",
  "/ens": "$0.002", "/token": "$0.001", "/allowance": "$0.002", "/contract": "$0.003", "/gas": "$0.001", "/block": "$0.001", "/nft": "$0.002",
  "/search": "$0.003", "/uk-property": "$0.01", "/uk-area": "$0.005",
  "/uk-charity": "$0.05", "/uk-charity-full": "$0.25",
  "/us-sec": "$0.05", "/us-sec-full": "$0.25", "/eu-vat": "$0.01",
  "/uk-leads-lite": "$0.25", "/uk-leads": "$1.00", "/uk-leads-feed": "$25.00",
  "/uk-watch": "$5.00", "/kyb": "$2.00",
  "/sanctions": "$0.05", "/sanctions-batch": "$1.00",
  "/uk-officer": "$0.15",
} as const;
const ATOMIC: Record<string, number> = {
  "/read": 2000, "/links": 1000, "/check": 1000,
  "/company": 250000, "/uk-company": 500000, "/uk-company-lite": 50000, "/company-full": 650000,
  "/convert": 30000, "/monitor": 1000000,
  "/wallet": 3000, "/tx": 3000, "/token-check": 10000, "/fx": 2000,
  "/ens": 2000, "/token": 1000, "/allowance": 2000, "/contract": 3000, "/gas": 1000, "/block": 1000, "/nft": 2000,
  "/search": 3000, "/uk-property": 10000, "/uk-area": 5000,
  "/uk-charity": 50000, "/uk-charity-full": 250000,
  "/us-sec": 50000, "/us-sec-full": 250000, "/eu-vat": 10000,
  "/uk-leads-lite": 250000, "/uk-leads": 1000000, "/uk-leads-feed": 25000000,
  "/uk-watch": 5000000, "/kyb": 2000000,
  "/sanctions": 50000, "/sanctions-batch": 1000000,
  "/uk-officer": 150000,
};

const urlIn = { type: "object", properties: { url: { type: "string", format: "uri", description: "Public http(s) URL to fetch" } }, required: ["url"] };
const linkSchema = { type: "object", properties: { url: { type: "string" }, text: { type: "string" }, internal: { type: "boolean" } } };
const readOut = { type: "object", properties: {
  url: { type: "string" }, final_url: { type: "string" }, title: { type: ["string", "null"] }, description: { type: ["string", "null"] },
  canonical_url: { type: "string" }, author: { type: ["string", "null"] }, published: { type: ["string", "null"] }, language: { type: ["string", "null"] },
  word_count: { type: "integer" }, markdown: { type: "string" }, links_count: { type: "integer" }, links: { type: "array", items: linkSchema } } };
const linksOut = { type: "object", properties: { url: { type: "string" }, final_url: { type: "string" }, count: { type: "integer" }, links: { type: "array", items: linkSchema } } };
const checkIn = { type: "object", properties: { domain: { type: "string", description: "Domain name, e.g. example.com" } }, required: ["domain"] };
const checkOut = { type: "object", properties: { domain: { type: "string" }, dns: { type: "object" }, dnssec_validated: { type: ["boolean", "null"] },
  tls: { type: "object" }, http: { type: "object" }, email: { type: "object", properties: { mx: { type: "array" }, spf: { type: "array" }, dmarc: { type: "array" }, dmarc_policy: { type: ["string", "null"] } } },
  issues: { type: "array", items: { type: "string" } }, score: { type: "integer" } } };

const companyIn = { type: "object", properties: {
  domain: { type: "string", description: "Company website domain, e.g. stripe.com" },
  name: { type: "string", description: "Alias for domain if it looks like a hostname" },
}, anyOf: [{ required: ["domain"] }, { required: ["name"] }] };
const companyOut = { type: "object", properties: {
  domain: { type: "string" }, homepage: { type: "object" }, key_pages: { type: "object" }, tech_stack: { type: "object" },
  social_links: { type: "object" }, contacts: { type: "object" }, dns: { type: "object" }, domain_registration: { type: "object" },
  ssl: { type: "object" }, sitemap: { type: "object" }, news: { type: "object" }, sources: { type: "object" } } };

const ukIn = { type: "object", properties: {
  number: { type: "string", description: "UK Companies House number, e.g. 00445790" },
  name: { type: "string", description: "Registered company name to search" },
}, anyOf: [{ required: ["number"] }, { required: ["name"] }] };
const ukOut = { type: "object", properties: {
  company_number: { type: "string" }, profile: { type: "object" }, overview: { type: "object" }, officers: { type: "object" },
  persons_with_significant_control: { type: "object" }, filing_history_highlights: { type: "object" }, charges: { type: "object" },
  compliance: { type: "object" }, red_flags: { type: "array", items: { type: "object" } }, sources: { type: "object" } } };

const ukLiteIn = ukIn;
const ukLiteOut = { type: "object", properties: {
  company_number: { type: "string" }, name: { type: ["string", "null"] }, status: { type: ["string", "null"] },
  incorporation_date: { type: ["string", "null"] }, sic_codes: { type: "array" }, registered_office_text: { type: ["string", "null"] },
  compliance: { type: "object" }, red_flags: { type: "array", items: { type: "object" } }, mass_formation_office: { type: "object" } } };
const companyFullIn = companyIn;
const companyFullOut = { type: "object", properties: {
  domain: { type: "string" }, bundle: { type: "string" }, price: { type: "string" },
  company: companyOut, uk: ukOut, uk_included: { type: "boolean" }, uk_skip_reason: { type: ["string", "null"] }, note: { type: "string" } } };
const convertIn = { type: "object", properties: {
  url: { type: "string", format: "uri", description: "Public URL of a PDF, DOCX, HTML or text document" },
  format: { type: "string", enum: ["markdown", "text"], description: "Output format (default markdown)" },
}, required: ["url"] };
const convertOut = { type: "object", properties: {
  url: { type: "string" }, final_url: { type: "string" }, detected_format: { type: "string" }, title: { type: ["string", "null"] },
  markdown: { type: "string" }, text: { type: "string" }, pages: { type: "integer" }, word_count: { type: "integer" }, truncated: { type: "boolean" } } };

const monitorIn = { type: "object", properties: {
  url: { type: "string", format: "uri", description: "Page URL to monitor hourly" },
  webhook: { type: "string", format: "uri", description: "HTTPS endpoint to POST JSON on change" },
  selector: { type: "string", description: "Optional CSS selector (id/class/tag) to hash a page fragment" },
  keyword: { type: "string", description: "Optional keyword; hash includes whether it is present" },
}, required: ["url", "webhook"] };
const monitorOut = { type: "object", properties: {
  id: { type: "string" }, url: { type: "string" }, webhook: { type: "string" }, created: { type: "string" }, expires: { type: "string" },
  last_hash: { type: "string" }, status_url: { type: "string" }, active: { type: "boolean" } } };

const chainP = { type: "string", enum: ["base", "ethereum", "arbitrum", "optimism", "polygon"], description: "EVM chain (default base)" };
const walletIn = { type: "object", properties: { address: { type: "string", description: "0x EVM wallet address" }, chain: chainP, tokens: { type: "string", description: "Optional comma-separated extra ERC20 contract addresses (max 10)" } }, required: ["address"] };
const walletOut = { type: "object", properties: { chain: { type: "string" }, address: { type: "string" }, block: { type: "integer" }, native: { type: "object" }, nonce: { type: "integer" }, is_contract: { type: "boolean" }, tokens: { type: "array", items: { type: "object" } } } };
const txIn = { type: "object", properties: { hash: { type: "string", description: "0x transaction hash" }, chain: chainP }, required: ["hash"] };
const txOut = { type: "object", properties: { status: { type: "string" }, block: { type: ["integer", "null"] }, timestamp: { type: ["string", "null"] }, from: { type: "string" }, to: { type: ["string", "null"] }, value_native: { type: "string" }, fee_native: { type: "string" }, erc20_transfers: { type: "array", items: { type: "object" } } } };
const tokenIn = { type: "object", properties: { address: { type: "string", description: "0x ERC20 token contract address" }, chain: chainP }, required: ["address"] };
const tokenOut = { type: "object", properties: { name: { type: ["string", "null"] }, symbol: { type: ["string", "null"] }, decimals: { type: ["integer", "null"] }, total_supply: { type: "string" }, owner: { type: ["string", "null"] }, proxy: { type: "object" }, market: { type: ["object", "null"] }, risk_flags: { type: "array", items: { type: "object" } }, risk_score: { type: "integer" }, verdict: { type: "string" } } };
const fxIn = { type: "object", properties: { base: { type: "string", description: "ISO currency, default USD" }, symbols: { type: "string", description: "Comma list e.g. GBP,EUR (default all ~30)" }, date: { type: "string", description: "YYYY-MM-DD historical (default latest)" }, amount: { type: "string", description: "Optional amount to convert" } } };
const fxOut = { type: "object", properties: { base: { type: "string" }, date: { type: "string" }, rates: { type: "object" }, converted: { type: "object" } } };
const A = (d: string) => ({ type: "string", description: d });
const ensIn = { type: "object", properties: { name: A("ENS name to resolve, e.g. vitalik.eth"), address: A("0x address for reverse lookup (primary name)") }, anyOf: [{ required: ["name"] }, { required: ["address"] }] };
const ensOut = { type: "object", properties: { direction: { type: "string" }, name: { type: ["string", "null"] }, address: { type: ["string", "null"] }, records: { type: "object" }, forward_verified: { type: "boolean" } } };
const tokenMetaIn = { type: "object", properties: { address: A("0x ERC20 token contract"), chain: chainP }, required: ["address"] };
const tokenMetaOut = { type: "object", properties: { name: { type: ["string", "null"] }, symbol: { type: ["string", "null"] }, decimals: { type: ["integer", "null"] }, total_supply: { type: ["string", "null"] }, is_erc20_like: { type: "boolean" } } };
const allowIn = { type: "object", properties: { token: A("0x ERC20 token"), owner: A("0x token holder"), spender: A("0x approved spender (router, Permit2, x402 facilitator…)"), chain: chainP }, required: ["token", "owner", "spender"] };
const allowOut = { type: "object", properties: { allowance: { type: "string" }, allowance_raw: { type: "string" }, unlimited: { type: "boolean" }, owner_balance: { type: ["string", "null"] }, spendable_now: { type: ["string", "null"] } } };
const contractIn = { type: "object", properties: { address: A("0x address to inspect"), chain: chainP }, required: ["address"] };
const contractOut = { type: "object", properties: { is_contract: { type: "boolean" }, eip7702_delegate: { type: ["string", "null"] }, bytecode_bytes: { type: "integer" }, proxy: { type: "object" }, owner: { type: ["string", "null"] }, standards: { type: "array" }, verified: { type: ["object", "null"] } } };
const gasIn = { type: "object", properties: { chain: chainP } };
const gasOut = { type: "object", properties: { base_fee_gwei: { type: "number" }, priority_fee_gwei: { type: "object" }, suggested_eip1559: { type: "object" }, native_usd: { type: ["number", "null"] }, est_cost: { type: "object" } } };
const blockIn = { type: "object", properties: { number: A("Block number (decimal/hex) or latest|safe|finalized"), timestamp: A("Unix seconds or ISO date: returns last block at/before it"), chain: chainP } };
const blockOut = { type: "object", properties: { number: { type: "integer" }, hash: { type: "string" }, timestamp: { type: "integer" }, time_iso: { type: "string" }, tx_count: { type: ["integer", "null"] }, base_fee_gwei: { type: ["number", "null"] } } };
const nftIn = { type: "object", properties: { contract: A("0x ERC721/ERC1155 contract"), token_id: A("Decimal token id"), chain: chainP }, required: ["contract", "token_id"] };
const nftOut = { type: "object", properties: { standard: { type: ["string", "null"] }, owner: { type: ["string", "null"] }, token_uri: { type: ["string", "null"] }, metadata: { type: ["object", "null"] }, collection: { type: "object" } } };
const searchIn = { type: "object", properties: { q: A("Search query (2-300 chars)"), sources: A("Optional comma list: wikipedia,openalex,arxiv,crossref (default all)"), limit: A("Max results 1-30 (default 15)"), lang: A("Wikipedia language code, default en") }, required: ["q"] };
const searchOut = { type: "object", properties: { query: { type: "string" }, count: { type: "integer" }, results: { type: "array", items: { type: "object", properties: { title: { type: "string" }, url: { type: "string" }, snippet: { type: "string" }, source: { type: "string" }, type: { type: "string" }, date: { type: ["string", "null"] }, doi: { type: ["string", "null"] }, score: { type: "number" } } } }, sources: { type: "object" } } };
const pcIn = { type: "object", properties: { postcode: A("Full UK postcode, e.g. CB1 2AB"), radius: A("Metres around postcode, 50-1000 (default 400)"), limit: A("Max sales 5-200 (default 50)") }, required: ["postcode"] };
const propOut = { type: "object", properties: { postcode: { type: "string" }, area: { type: "object" }, summary: { type: "object" }, sales: { type: "array", items: { type: "object" } }, source: { type: "string" } } };
const areaIn = { type: "object", properties: { postcode: A("Full UK postcode, e.g. SW1A 2AA") }, required: ["postcode"] };
const areaOut = { type: "object", properties: { postcode: { type: "string" }, location: { type: "object" }, geography: { type: "object" }, crime: { type: "object" }, food_hygiene: { type: "object" } } };
const charityIn = { type: "object", properties: {
  number: { type: "string", description: "Charity Commission registered number, e.g. 1089464" },
  name: { type: "string", description: "Registered charity name to search" },
  suffix: { type: "string", description: "Optional group/subsidiary suffix (default 0)" },
}, anyOf: [{ required: ["number"] }, { required: ["name"] }] };
const charityOut = { type: "object", properties: {
  registered_number: {}, name: { type: ["string", "null"] }, status: { type: ["string", "null"] }, income: {}, spending: {},
  trustees_count: {}, contact: { type: "object" }, activities: {}, source: { type: "string" }, licence: { type: "string" } } };
const charityFullOut = { type: "object", properties: {
  registered_number: {}, name: {}, trustees: { type: "array" }, financial_history: { type: "array" }, assets_liabilities: {},
  governance: {}, areas_of_operation: {}, regulatory_reports: {}, linked_charities: {}, other_names: {},
  red_flags: { type: "array", items: { type: "object" } }, source: { type: "string" } } };

const secIn = { type: "object", properties: {
  ticker: { type: "string", description: "US ticker symbol, e.g. AAPL" },
  cik: { type: "string", description: "SEC CIK (with or without leading zeros), e.g. 320193" },
}, anyOf: [{ required: ["ticker"] }, { required: ["cik"] }] };
const secOut = { type: "object", properties: {
  cik: { type: "string" }, name: { type: ["string", "null"] }, tickers: { type: "array" }, exchanges: { type: "array" },
  sic: {}, sicDescription: {}, ein: {}, addresses: { type: "object" }, phone: {}, formerNames: { type: "array" },
  recent_filings: { type: "array", items: { type: "object" } }, website: {}, source: { type: "string" }, fair_use: { type: "string" } } };
const secFullOut = { type: "object", properties: {
  cik: {}, name: {}, recent_filings: { type: "array" }, companyfacts_highlights: { type: "object" },
  red_flags: { type: "array", items: { type: "object" } }, red_flag_count: {}, source: { type: "string" } } };
const vatIn = { type: "object", properties: {
  vat: { type: "string", description: "EU VAT id with country prefix, e.g. DE123456789 or IE6388047V" },
  country: { type: "string", description: "Optional 2-letter country (EL for Greece) if number given separately" },
  number: { type: "string", description: "VAT number without country prefix" },
}, anyOf: [{ required: ["vat"] }, { required: ["country", "number"] }] };
const vatOut = { type: "object", properties: {
  valid: { type: "boolean" }, countryCode: { type: "string" }, vatNumber: { type: "string" }, vat: { type: "string" },
  name: { type: ["string", "null"] }, address: { type: ["string", "null"] }, requestDate: {}, source: { type: "string" } } };


const sanctionsIn = { type: "object", properties: {
  name: { type: "string", description: "Person or entity name to screen" },
  country: { type: "string", description: "Optional country / nationality hint" },
  dob: { type: "string", description: "Optional date of birth (any common format)" },
  year: { type: "string", description: "Optional birth year YYYY" },
  type: { type: "string", description: "Optional individual|entity (person|company also accepted)" },
}, required: ["name"] };
const sanctionsOut = { type: "object", properties: {
  product: { type: "string" }, disclaimer: { type: "string" }, query: { type: "object" },
  match_count: { type: "integer" }, possible_match: { type: "boolean" }, highest_score: { type: "number" },
  matches: { type: "array", items: { type: "object" } }, lists: { type: "object" }, index_built_at: { type: "string" } } };
const sanctionsBatchIn = { type: "object", properties: {
  names: { type: "array", description: "1-50 names (strings or {name,country?,dob?,year?,type?} objects)", items: { type: ["string", "object"] } },
}, required: ["names"] };
const sanctionsBatchOut = { type: "object", properties: {
  product: { type: "string" }, disclaimer: { type: "string" }, count: { type: "integer" },
  possible_match_count: { type: "integer" }, results: { type: "array", items: { type: "object" } } } };


const officerIn = { type: "object", properties: {
  name: { type: "string", description: "Officer name to search (2-100 chars), e.g. Ken Olisa" },
  limit: { type: "integer", description: "Max officer matches 1-25 (default 10)" },
}, required: ["name"] };
const officerOut = { type: "object", properties: {
  product: { type: "string" }, disclaimer: { type: "string" }, query: { type: "object" },
  hits_total: { type: "integer" }, returned: { type: "integer" },
  officers: { type: "array", items: { type: "object" } }, notes: { type: "array" }, attribution: { type: "string" } } };

const DESC: Record<string, string> = {
  "/search": "Use this for cheap research search over open sources: Wikipedia + OpenAlex (250M scholarly works) + arXiv + Crossref, merged, deduplicated (DOI/title) and ranked, with snippets, authors, dates, DOIs and citation counts. Not a general web index. Example: {q:\"x402 agent payments\"}. $0.003.",
  "/uk-property": "Use this for UK (England & Wales) house prices around a postcode: HM Land Registry Price Paid sales (address, price, date, type, tenure, new-build) within a radius, plus median overall/last-12m/by type. OGL data. Example: {postcode:\"CB1 2AB\"}. $0.01.",
  "/uk-area": "Use this for a UK postcode profile: ONS geography (LA, ward, constituency, LSOA, codes), lat/lon, police street crime last month by category (~1 mile), and FSA food hygiene rating mix nearby. All OGL. Example: {postcode:\"SW1A 2AA\"}. $0.005.",
  "/uk-charity": "Use this for a cheap UK charity snapshot from the Charity Commission register (England & Wales): status, registration/removal dates, income/spending, trustees count, website, activities. Lookup by registered number or name. OGL v3. Example: {number:\"1089464\"} or {name:\"Cancer Research UK\"}. Upsell /uk-charity-full. $0.05.",
  "/us-sec": "Use this for a cheap US SEC EDGAR company snapshot by ticker or CIK: name, tickers/exchanges, SIC, EIN, addresses, phone, former names, last ~15 filings (form/filed/accession/primaryDocument/reportDate), website. Fair-use EDGAR. Example: {ticker:\"AAPL\"} or {cik:\"320193\"}. Upsell /us-sec-full. $0.05.",
  "/us-sec-full": "Use this for fuller US SEC DD: lite snapshot + key us-gaap companyfacts highlights (Assets, Liabilities, StockholdersEquity, Revenues, NetIncomeLoss, EPS diluted — last reported) + red-flag heuristics (NT 10-K, Item 4.02, bankruptcy/going-concern signals). Example: {ticker:\"AAPL\"}. $0.25.",
  "/eu-vat": "Use this to validate an EU VAT number via official VIES: valid flag, registered name/address when available, requestDate. Input vat like DE123456789 or IE6388047V (or country+number; use EL for Greece). Cached 24h when valid. Example: {vat:\"IE6388047V\"}. $0.01.",
  "/uk-charity-full": "Use this for full UK charity due diligence: trustees, 5-year financial history, assets/liabilities, governance, areas of operation, regulatory/insolvency flags, linked charities, other names + red-flag summary (removed, late accounts, income collapse). OGL v3. Example: {number:\"1089464\"}. $0.25.",
  "/ens": "Use this to resolve an ENS name to its address plus avatar/url/twitter/github/description records, or reverse-resolve an address to its primary name (forward-verified). Example: {name:\"vitalik.eth\"} or {address:\"0x…\"}. $0.002.",
  "/token": "Use this for just an ERC20's name, symbol, decimals and total supply (formatted + raw) on Base/Ethereum/Arbitrum/Optimism/Polygon — e.g. before formatting amounts. Cheaper than /token-check. Example: {address:\"0x…\", chain:\"base\"}. $0.001.",
  "/allowance": "Use this before transferFrom/x402/Permit flows or for approval hygiene: ERC20 allowance owner→spender, unlimited flag, owner balance and spendable-now amount. Multi-chain. Example: {token, owner, spender, chain:\"base\"}. $0.002.",
  "/contract": "Use this to inspect any address: contract vs wallet vs EIP-7702 delegated EOA, bytecode size, EIP-1967 implementation/admin/beacon, EIP-1167 clone target, owner(), ERC20/721/1155 detection and Sourcify verified contract name. Example: {address, chain}. $0.003.",
  "/gas": "Use this before sending a transaction: live base fee, priority-fee percentiles, suggested EIP-1559 maxFee/maxPriority, block utilisation and USD cost of a transfer/ERC20 transfer/swap (Chainlink price). Base/Ethereum/Arbitrum/Optimism/Polygon. Example: {chain:\"base\"}. $0.001.",
  "/block": "Use this to get a block by number/latest/finalized, or find the block at a date/time (timestamp → block, for historical balance or event queries). Returns number, hash, time, tx count, base fee. Example: {timestamp:\"2026-01-01T00:00:00Z\", chain:\"base\"}. $0.001.",
  "/nft": "Use this to look up one NFT: owner (ERC721), tokenURI and fetched JSON metadata (IPFS/Arweave/data URIs handled), collection name/symbol. Multi-chain. Example: {contract:\"0xBC4C…\", token_id:\"1\", chain:\"ethereum\"}. $0.002.",
  "/wallet": "Use this when you need an EVM wallet's balances in one call: native ETH/POL + USDC/USDT/DAI/WETH/cbBTC/EURC (plus up to 10 custom ERC20s), nonce, is_contract, block. Base, Ethereum, Arbitrum, Optimism, Polygon. Example: {address:\"0x…\", chain:\"base\"}. $0.003.",
  "/tx": "Use this to confirm a transaction/payment landed: status (success/reverted/pending), block, timestamp, confirmations, from/to, value, fee, decoded ERC20 transfers (USDC amounts). Base/Ethereum/Arbitrum/Optimism/Polygon. Example: {hash:\"0x…\"}. $0.003.",
  "/token-check": "Use this before buying, accepting or listing an ERC20 token: name/symbol/decimals/supply, owner (renounced?), EIP-1967 proxy, DEX price/liquidity/volume/pair age (DexScreener) + rule-based risk flags, score and verdict. Half the price of AI token verdicts. Example: {address:\"0x…\", chain:\"base\"}. $0.01.",
  "/fx": "Use this for official ECB foreign-exchange reference rates (≈30 fiat currencies incl GBP/EUR/USD/JPY), latest or historical date, with optional amount conversion. Example: {base:\"GBP\", symbols:\"USD,EUR\", amount:\"100\"}. $0.002.",
  "/read": "Use this when you need the clean text of a public web page as Markdown + metadata (title, author, date, language, word count, links). Better than raw fetch/HTML: Readability extraction, structured JSON, ~1s. Example in: {url:\"https://example.com\"} → {title, markdown, word_count, links}. $0.002 USDC.",
  "/links": "Use this when you only need every absolute link on a page (crawl maps, sitemaps-lite). Faster/cheaper than /read. Example: {url} → {count, links:[{url,text,internal}]}. $0.001.",
  "/check": "Use this when vetting a domain's health before outreach or onboarding: DNS (DoH), DNSSEC, TLS/HTTPS, redirects, HSTS, MX/SPF/DMARC + score/issues. Structured JSON beats dig+openssl. Example: {domain:\"stripe.com\"} → {score, issues, email}. $0.001.",
  "/company": "Use this when researching any company from its website domain — not Companies House. Returns sourced tech stack, socials, emails/phones, DNS/MX/SPF/DMARC, RDAP age/registrar, SSL, sitemap, news. No LLM inventing facts. Example: {domain:\"stripe.com\"} → {homepage, tech_stack, contacts, dns, news, sources}. Prefer /uk-company* for UK filings. $0.25.",
  "/uk-company": "Use this for UK due diligence on a Companies House number or name: official API profile, officers, PSCs, filings, charges, insolvency + rule-based red flags (overdue, dissolved, churn, mass-formation office). Sourced JSON. Example: {number:\"00445790\"} or {name:\"TESCO\"}. Prefer /uk-company-lite ($0.05) for status/flags only. $0.50.",
  "/uk-company-lite": "Use this for a cheap UK company snapshot before paying for the full pack: status, SIC, office, compliance overdue, mass-formation check, red-flag names. Example: {number:\"00445790\"} → {name,status,red_flags,compliance}. Upsell: /uk-company for officers/PSC/filings/charges/insolvency. $0.05.",
  "/company-full": "Use this when you have a company website and also want UK Companies House DD in one call ($0.65 vs $0.75 separate). Runs /company then attaches /uk-company when a UK number/name is detected (.uk TLD or CH number on site). Example: {domain:\"tesco.com\"} → {company, uk, uk_included}. $0.65.",
  "/convert": "Use this when an agent needs PDF/DOCX/HTML/text as clean markdown or plain text (RAG, summarisation). PDF via unpdf; DOCX via mammoth. Example: {url, format:\"markdown\"} → {detected_format, markdown, pages, word_count}. $0.03.",
  "/monitor": "Use this when you need 30 days of hourly page-change alerts to your webhook (pricing pages, status, jobs). Returns id; GET /monitor/:id free. Example POST {url, webhook, selector?}. $1.00/30d.",
  "/uk-leads-lite": "Use this for cheap UK new-incorporation lead lists filtered by SIC and/or location/postcode area (1-7 day lookback). Returns up to 100 companies: number, name, SIC, office, mass-formation flag. No directors. Example: {sic:\"62012\",days:1}. Upsell /uk-leads for directors. $0.25.",
  "/uk-leads": "Use this for UK new-incorporation leads with active director names — filter by SIC/location/postcode_area, 1-7 days, up to 40 companies. Official Companies House data + mass-formation flags. Example: {sic:\"62\",location:\"Manchester\",days:2}. Daily webhook: /uk-leads-feed $25/30d. $1.00.",
  "/uk-leads-feed": "Use this for a 30-day daily webhook of new UK incorporations matching your SIC/location/postcode_area (director-enriched). Deduped. Example POST {sic:\"62012\",webhook:\"https://your.app/hook\"}. Status GET /uk-leads-feed/:id free. $25.00/30d.",
  "/uk-watch": "Use this to watch one UK company for 30 days: hourly Companies House poll of status/officers/filings → webhook on change. Example POST {number:\"00445790\",webhook:\"https://your.app/hook\"}. GET /uk-watch/:id free. $5.00/30d.",
  "/kyb": "Use this for a one-shot agent KYB/due-diligence pack: optional website research + UK Companies House DD + EU VIES VAT + public sanctions screen (entity + directors) → composite trust flag (CLEAR/CAUTION/REVIEW/INSUFFICIENT_DATA). Screening only, not a regulated determination. Example: {domain:\"tesco.com\",number:\"00445790\"} or {vat:\"IE6388047V\"}. $2.00.",
  "/sanctions": "Screen a person or entity name against public OFAC SDN/CONS, UK FCDO, UN SC and EU financial sanctions lists. Fuzzy scored matches with list/programme/id/aliases/DOB/nationality. Screening aid only - not a regulated AML/KYC determination. Example: {name:\"BANCO NACIONAL DE CUBA\"}. $0.05.",
  "/sanctions-batch": "Screen up to 50 names against OFAC/UK/UN/EU public sanctions lists. Screening aid only. Example: {names:[\"BANCO NACIONAL DE CUBA\",\"Alice Wonderland\"]}. $1.00.",
  "/uk-officer": "Use this to reverse-search a UK Companies House officer name to their appointments (company_number, role, appointed/resigned, status). Returns matches with address_snippet, appointment_count, DOB month/year, heuristic high-appointment / mass-formation flags. Public register (OGL); screening/research aid only - not a credit check. Example: {name:\"Ken Olisa\",limit:10}. $0.15.",
};

const leadsIn = { type: "object", properties: {
  sic: { type: "string", description: "SIC code or 2-5 digit prefix, e.g. 62 or 62012" },
  location: { type: "string", description: "Town/city as indexed by Companies House, e.g. Manchester" },
  postcode_area: { type: "string", description: "Postcode area/district prefix, e.g. M, SW, SW1" },
  days: { type: "integer", description: "Lookback 1-7 days (default 1)" },
  limit: { type: "integer", description: "Max companies returned" },
}, description: "At least one of sic, location, postcode_area required" };
const leadsOut = { type: "object", properties: {
  product: { type: "string" }, query: { type: "object" }, hits_total_unfiltered_by_postcode: { type: "integer" },
  returned: { type: "integer" }, companies: { type: "array", items: { type: "object" } }, notes: { type: "array" }, attribution: { type: "string" } } };
const leadsFeedIn = { type: "object", properties: {
  webhook: { type: "string", format: "uri" }, sic: { type: "string" }, location: { type: "string" }, postcode_area: { type: "string" },
}, required: ["webhook"] };
const leadsFeedOut = { type: "object", properties: {
  id: { type: "string" }, kind: { type: "string" }, sic: {}, location: {}, postcode_area: {}, webhook: { type: "string" },
  created: { type: "string" }, expires: { type: "string" }, status_url: { type: "string" }, price_paid: { type: "string" }, duration_days: { type: "integer" } } };
const ukWatchIn = { type: "object", properties: {
  number: { type: "string", description: "UK company number" }, webhook: { type: "string", format: "uri" },
}, required: ["number", "webhook"] };
const ukWatchOut = { type: "object", properties: {
  id: { type: "string" }, company_number: { type: "string" }, company_name: {}, webhook: { type: "string" },
  created: { type: "string" }, expires: { type: "string" }, snapshot: { type: "object" }, status_url: { type: "string" } } };
const kybIn = { type: "object", properties: {
  domain: { type: "string" }, number: { type: "string" }, name: { type: "string" }, vat: { type: "string" },
  country: { type: "string" }, vat_number: { type: "string" },
}, description: "Provide domain and/or UK number/name and/or EU vat" };
const kybOut = { type: "object", properties: {
  product: { type: "string" }, disclaimer: { type: "string" }, website: {}, uk: {}, eu_vat: {},
  trust: { type: "object", properties: { flag: { type: "string" }, score: { type: "integer" }, reasons: { type: "array" } } } } };

const OUT: any = { "/uk-officer": officerOut, "/sanctions": sanctionsOut, "/sanctions-batch": sanctionsBatchOut, "/uk-leads": leadsOut, "/uk-leads-lite": leadsOut, "/uk-leads-feed": leadsFeedOut, "/uk-watch": ukWatchOut, "/kyb": kybOut, "/search": searchOut, "/uk-property": propOut, "/uk-area": areaOut, "/uk-charity": charityOut, "/uk-charity-full": charityFullOut, "/us-sec": secOut, "/us-sec-full": secFullOut, "/eu-vat": vatOut, "/ens": ensOut, "/token": tokenMetaOut, "/allowance": allowOut, "/contract": contractOut, "/gas": gasOut, "/block": blockOut, "/nft": nftOut, "/wallet": walletOut, "/tx": txOut, "/token-check": tokenOut, "/fx": fxOut, "/read": readOut, "/links": linksOut, "/check": checkOut, "/company": companyOut, "/uk-company": ukOut, "/uk-company-lite": ukLiteOut, "/company-full": companyFullOut, "/convert": convertOut, "/monitor": monitorOut };
const EX: any = { "/uk-officer": { name: "Ken Olisa", limit: 10 }, "/sanctions": { name: "BANCO NACIONAL DE CUBA" }, "/sanctions-batch": { names: ["BANCO NACIONAL DE CUBA", "Alice Wonderland"] }, "/uk-leads": { sic: "62012", days: 1, limit: 25 }, "/uk-leads-lite": { sic: "62", location: "London", days: 1 }, "/uk-leads-feed": { sic: "62012", webhook: "https://api.axiomworks.co.uk/hooks/sink" }, "/uk-watch": { number: "00445790", webhook: "https://api.axiomworks.co.uk/hooks/sink" }, "/kyb": { domain: "tesco.com", number: "00445790" }, 
  "/search": { q: "x402 agent payments" }, "/uk-property": { postcode: "CB1 2AB" }, "/uk-area": { postcode: "SW1A 2AA" },
  "/uk-charity": { number: "1089464" }, "/uk-charity-full": { number: "1089464" },
  "/us-sec": { ticker: "AAPL" }, "/us-sec-full": { ticker: "AAPL" }, "/eu-vat": { vat: "IE6388047V" },
  "/ens": { name: "vitalik.eth" }, "/token": { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" },
  "/allowance": { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", owner: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", spender: "0x000000000022D473030F116dDEE9F6B43aC78BA3", chain: "base" },
  "/contract": { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" }, "/gas": { chain: "base" }, "/block": { timestamp: "2026-01-01T00:00:00Z", chain: "base" },
  "/nft": { contract: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D", token_id: "1", chain: "ethereum" },
  "/wallet": { address: "0x88b1c747c33A5868A34057D8C57318E5602b3ff6", chain: "base" }, "/tx": { hash: "0x0000000000000000000000000000000000000000000000000000000000000000", chain: "base" },
  "/token-check": { address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", chain: "base" }, "/fx": { base: "GBP", symbols: "USD,EUR", amount: "100" },
  "/read": { url: "https://example.com" }, "/links": { url: "https://example.com" }, "/check": { domain: "example.com" },
  "/company": { domain: "stripe.com" }, "/uk-company": { number: "00445790" }, "/uk-company-lite": { number: "00445790" }, "/company-full": { domain: "tesco.com" },
  "/convert": { url: "https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf", format: "markdown" },
  "/monitor": { url: "https://example.com", webhook: "https://api.axiomworks.co.uk/hooks/sink" },
};
const IN: any = { "/uk-officer": officerIn, "/sanctions": sanctionsIn, "/sanctions-batch": sanctionsBatchIn, "/uk-leads": leadsIn, "/uk-leads-lite": leadsIn, "/uk-leads-feed": leadsFeedIn, "/uk-watch": ukWatchIn, "/kyb": kybIn, "/search": searchIn, "/uk-property": pcIn, "/uk-area": areaIn, "/uk-charity": charityIn, "/uk-charity-full": charityIn, "/us-sec": secIn, "/us-sec-full": secIn, "/eu-vat": vatIn, "/ens": ensIn, "/token": tokenMetaIn, "/allowance": allowIn, "/contract": contractIn, "/gas": gasIn, "/block": blockIn, "/nft": nftIn, "/wallet": walletIn, "/tx": txIn, "/token-check": tokenIn, "/fx": fxIn, "/read": urlIn, "/links": urlIn, "/check": checkIn, "/company": companyIn, "/uk-company": ukIn, "/uk-company-lite": ukLiteIn, "/company-full": companyFullIn, "/convert": convertIn, "/monitor": monitorIn };
const METHODS: Record<string, ("GET" | "POST")[]> = {
  "/read": ["GET", "POST"], "/links": ["GET", "POST"], "/check": ["GET", "POST"],
  "/company": ["GET", "POST"], "/uk-company": ["GET", "POST"], "/uk-company-lite": ["GET", "POST"], "/company-full": ["GET", "POST"], "/convert": ["GET", "POST"],
  "/monitor": ["POST"],
  "/wallet": ["GET", "POST"], "/tx": ["GET", "POST"], "/token-check": ["GET", "POST"], "/fx": ["GET", "POST"],
  "/ens": ["GET", "POST"], "/token": ["GET", "POST"], "/allowance": ["GET", "POST"], "/contract": ["GET", "POST"], "/gas": ["GET", "POST"], "/block": ["GET", "POST"], "/nft": ["GET", "POST"],
  "/search": ["GET", "POST"], "/uk-property": ["GET", "POST"], "/uk-area": ["GET", "POST"],
  "/uk-charity": ["GET", "POST"], "/uk-charity-full": ["GET", "POST"],
  "/us-sec": ["GET", "POST"], "/us-sec-full": ["GET", "POST"], "/eu-vat": ["GET", "POST"],
  "/uk-leads": ["GET", "POST"], "/uk-leads-lite": ["GET", "POST"], "/uk-leads-feed": ["POST"], "/uk-watch": ["POST"], "/kyb": ["GET", "POST"],
  "/sanctions": ["GET", "POST"], "/sanctions-batch": ["GET", "POST"],
  "/uk-officer": ["GET", "POST"],
};

for (const r of CHAIN_ROUTES) { (PRICES as any)[r.path] = r.price; ATOMIC[r.path] = r.atomic; (DESC as any)[r.path] = r.desc; OUT[r.path] = r.out; IN[r.path] = r.in; EX[r.path] = r.ex; METHODS[r.path] = ["GET", "POST"]; VALIDATE[r.path] = r.validate; }

function routes(payTo: string) {
  const r: any = {};
  for (const p of Object.keys(PRICES) as (keyof typeof PRICES)[]) {
    for (const method of METHODS[p]) {
      const ext = method === "GET"
        ? declareDiscoveryExtension({ input: EX[p], inputSchema: IN[p], output: { schema: OUT[p], example: (EXAMPLES as any)[p] } } as any)
        : declareDiscoveryExtension({ input: EX[p], inputSchema: IN[p], bodyType: "json", output: { schema: OUT[p], example: (EXAMPLES as any)[p] } } as any);
      r[`${method} ${p}`] = {
        accepts: [{ scheme: "exact", price: PRICES[p], network: NETWORK, payTo, maxTimeoutSeconds: 120 }],
        description: upsell(p, DESC[p]), mimeType: "application/json", extensions: { ...ext },
      };
    }
  }
  return r;
}

let mw: any = null;
function getMw(env: Env) {
  if (mw) return mw;
  const fac = facilitatorClient(env);
  const server = new x402ResourceServer(fac).register(NETWORK, new ExactEvmScheme()).registerExtension(bazaarResourceServerExtension);
  server.onAfterSettle(async (ctx: any) => {
    try {
      const res = ctx.paymentPayload?.resource?.url || ctx.requirements?.resource || "";
      let endpoint = "unknown"; try { endpoint = new URL(res).pathname; } catch {}
      const rec = { ts: new Date().toISOString(), endpoint, payer: ctx.result?.payer || null, amount: ctx.result?.amount || ctx.requirements?.amount || String(ATOMIC[endpoint] ?? 0),
        asset: ctx.requirements?.asset, network: ctx.result?.network, tx: ctx.result?.transaction, success: ctx.result?.success };
      await logPay(currentEnv!, rec);
    } catch (e) { console.log("log error", e); }
  });
  mw = paymentMiddleware(routes(env.PAY_TO), server);
  return mw;
}
let currentEnv: Env | null = null;

const app = new Hono<{ Bindings: Env }>();
app.use("*", async (c, next) => { currentEnv = c.env; await next(); c.header("access-control-allow-origin", "*");
  c.header("access-control-expose-headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE"); });
app.options("*", (c) => c.body(null, 204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, OPTIONS" }));

function base(_c: any) { return CANONICAL; }
function discovery(c: any) {
  const b = base(c);
  return { x402Version: 2, name: "Axiom Works AgentReader", description: "Pay-per-call web reading, company research, UK company/charity + US SEC EDGAR + EU VAT (VIES) + sanctions screening due diligence, document conversion, change monitoring, EVM wallet/tx/token checks and FX rates for AI agents. USDC on Base via x402.",
    resources: Object.keys(PRICES).map((p) => `${b}${p}`),
    items: Object.entries(PRICES).map(([p, price]) => ({ resource: `${b}${p}`, methods: METHODS[p], description: DESC[p], mimeType: "application/json",
      accepts: [{ scheme: "exact", network: NETWORK, amount: String(ATOMIC[p]), price, asset: USDC, payTo: c.env.PAY_TO, maxTimeoutSeconds: 120, extra: { name: "USD Coin", version: "2" } }],
      input: { type: "http", method: METHODS[p][0], queryParams: IN[p] }, output: OUT[p] })),
    contact: CONTACT, ownershipProofs: [] };
}

app.get("/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));
app.get("/.well-known/x402", (c) => c.json(discovery(c)));
app.get("/.well-known/x402.json", (c) => c.json(discovery(c)));
app.get("/.well-known/402index-verify.txt", (c) => c.text("9a944a1ce3c68588c5fb1d104be63981bb5e6b6e302fa0a1bd65b6a3cd5f5372"));
app.get("/.well-known/agent-card.json", (c) => {
  const b = base(c);
  const tags = (p: string) => p.startsWith("/uk") ? ["uk", "companies-house", "due-diligence", "x402"] : p.startsWith("/us-sec") ? ["sec", "edgar", "filings", "x402"] : (p === "/sanctions" || p === "/sanctions-batch") ? ["sanctions", "compliance", "aml", "x402"] : (p === "/kyb" || p === "/eu-vat") ? ["kyb", "vat", "compliance", "x402"] : ["/read", "/links", "/check", "/convert", "/monitor", "/search", "/company", "/company-full"].includes(p) ? ["web", "research", "x402"] : ["onchain", "base", "evm", "x402"];
  return c.json({
    protocolVersion: "0.3.0", name: "Axiom Works AgentReader",
    description: "Pay-per-call (x402, USDC on Base) UK Companies House, KYB, SEC EDGAR, EU VAT, web-to-markdown and EVM on-chain lookups for AI agents. HTTP + MCP; no API keys.",
    url: b, preferredTransport: "HTTP+JSON", version: "1.12.0", documentationUrl: `${b}/llms.txt`, iconUrl: `${b}/favicon.ico`,
    provider: { organization: "Axiom Works", url: "https://axiomworks.co.uk" },
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
    defaultInputModes: ["application/json"], defaultOutputModes: ["application/json"],
    skills: Object.entries(PRICES).map(([p, price]) => ({ id: p.slice(1), name: p, description: `${DESC[p]} Price ${price} USDC via x402 at ${b}${p}.`, tags: tags(p), inputModes: ["application/json"], outputModes: ["application/json"], examples: [JSON.stringify(EX[p] || {})] })),
    metadata: { mcp: `${b}/mcp`, openapi: `${b}/openapi.json`, x402: `${b}/.well-known/x402`, payments: { protocol: "x402", network: NETWORK, asset: USDC, payTo: c.env.PAY_TO }, github: "https://github.com/grokbot1233/agentreader" },
  });
});
app.get("/.well-known/agent.json", (c) => {
  const b = base(c);
  return c.json({
    name: "Axiom Works AgentReader", description: "x402 pay-per-call web reader, company research, UK Companies House + Charity Commission + US SEC EDGAR + EU VIES VAT + OFAC/UK/UN/EU sanctions screening due diligence, document conversion, change monitoring, EVM wallet/tx/token risk checks and ECB FX rates for AI agents.",
    url: b, provider: { organization: "Axiom Works", url: "https://axiomworks.co.uk", email: CONTACT },
    version: "1.12.0", documentationUrl: `${b}/llms.txt`, openapi: `${b}/openapi.json`,
    skills: Object.entries(PRICES).map(([p, price]) => ({ id: p.slice(1), name: p, description: DESC[p], price, endpoint: `${b}${p}` })),
    mcp: `${b}/mcp`, payments: { protocol: "x402", network: NETWORK, asset: USDC, payTo: c.env.PAY_TO },
  });
});
app.get("/openapi.json", (c) => {
  const b = base(c); const paths: any = {};
  for (const [p, price] of Object.entries(PRICES)) {
    const params = Object.entries(IN[p].properties || {}).map(([k, v]: any) => ({
      name: k, in: "query", required: (IN[p].required || []).includes(k), schema: { type: "string" }, description: v.description,
    }));
    const resp = { "200": { description: "Success", content: { "application/json": { schema: OUT[p] } } }, "402": { description: `Payment required: ${price} USDC on Base (x402 v2, see PAYMENT-REQUIRED header)` }, "400": { description: "Bad input" } };
    paths[p] = {};
    const payInfo = { mode: "fixed", currency: "USD", amount: price.replace("$", ""), network: NETWORK, asset: USDC, payTo: c.env.PAY_TO, amountAtomic: String(ATOMIC[p]) };
    if (METHODS[p].includes("GET")) paths[p].get = { summary: DESC[p], parameters: params, responses: resp, "x-price": price, "x-payment-info": payInfo, "x-402": { network: NETWORK, asset: USDC, amount: String(ATOMIC[p]) } };
    if (METHODS[p].includes("POST")) paths[p].post = { summary: DESC[p], requestBody: { content: { "application/json": { schema: IN[p] } } }, responses: resp, "x-price": price, "x-payment-info": payInfo, "x-402": { network: NETWORK, asset: USDC, amount: String(ATOMIC[p]) } };
  }
  paths["/uk-leads-feed/{id}"] = { get: { summary: "Free UK leads-feed status (id is the secret)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Feed status" }, "404": { description: "Not found" } }, "x-price": "free" } };
  paths["/uk-watch/{id}"] = { get: { summary: "Free UK company-watch status (id is the secret)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Watch status" }, "404": { description: "Not found" } }, "x-price": "free" } };
  paths["/monitor/{id}"] = { get: { summary: "Free monitor status (id is the secret)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Monitor status" }, "404": { description: "Not found" } }, "x-price": "free" } };
  paths["/samples/{kind}"] = { get: { summary: "Free truncated sample (rate-limited 8/IP/day) with x402 upsell", parameters: [{ name: "kind", in: "path", required: true, schema: { type: "string", enum: ["read","company","uk-company","uk-company-lite","convert","uk-charity","uk-charity-full","us-sec","us-sec-full","eu-vat","uk-leads","uk-leads-lite","kyb","uk-officer"] } }], responses: { "200": { description: "Truncated sample" }, "429": { description: "Preview quota exceeded" } }, "x-price": "free" } };
  paths["/hooks/sink"] = { post: { summary: "Free webhook test sink for /monitor", responses: { "200": { description: "Stored" } }, "x-price": "free" } };
  return c.json({ openapi: "3.1.0", info: { title: "Axiom Works AgentReader", version: "1.12.0", contact: { email: CONTACT, url: "https://github.com/grokbot1233/agentreader" }, description: "x402 pay-per-call APIs for AI agents: web reading, company research, UK due diligence, document conversion, change monitoring. Payments: USDC on Base mainnet (eip155:8453)." },
    servers: [{ url: b }], paths });
});
const llms = (b: string, payTo: string) => `# Axiom Works AgentReader

> Pay-per-call tools for AI agents. No API keys: x402 (HTTP 402) + USDC on Base (eip155:8453), payTo ${payTo}.
> Free truncated samples: ${b}/samples/{read|company|uk-company|uk-company-lite|convert|uk-charity|uk-charity-full|us-sec|us-sec-full|eu-vat|uk-leads|uk-leads-lite|kyb|uk-officer} (8/IP/day). Or add &preview=1 on paid GETs (same limit).

## When to use which (pick one)

| Need | Endpoint | Price | Why ours |
|---|---|---|---|
| Page → Markdown | ${b}/read?url= | $0.002 | Readability + metadata JSON, not raw HTML |
| Links only | ${b}/links?url= | $0.001 | Cheaper than /read |
| Domain health | ${b}/check?domain= | $0.001 | DNS/TLS/MX/SPF/DMARC + score |
| Website company research | ${b}/company?domain= | $0.25 | Sourced tech/contacts/DNS/RDAP/news (no LLM fiction) |
| UK CH full DD | ${b}/uk-company?number=\|name= | $0.50 | Official API: officers/PSC/filings/charges/insolvency + red flags |
| UK officer search | ${b}/uk-officer?name= | $0.15 | Reverse officer name → appointments + high-appt/mass-formation flags |
| UK CH cheap snapshot | ${b}/uk-company-lite?number=\|name= | $0.05 | Status + compliance flags; upsell full pack |
| Website + UK DD bundle | ${b}/company-full?domain= | $0.65 | $0.10 cheaper than $0.25+$0.50 when UK detected |
| PDF/DOCX → text | ${b}/convert?url= | $0.03 | Structured markdown/text for RAG |
| EVM wallet balances | ${b}/wallet?address=&chain=base | $0.003 | Native + 7 stablecoins/majors, 5 chains, one call |
| Tx / payment receipt | ${b}/tx?hash=&chain=base | $0.003 | Status, confirmations, fee, decoded USDC transfers |
| Token due diligence | ${b}/token-check?address=&chain=base | $0.01 | Owner/proxy/supply + DEX liquidity + risk flags |
| ENS name ⇄ address | ${b}/ens?name=vitalik.eth | $0.002 | Forward + text records, or verified reverse |
| Token metadata | ${b}/token?address=&chain=base | $0.001 | name/symbol/decimals/supply only |
| ERC20 allowance | ${b}/allowance?token=&owner=&spender= | $0.002 | Unlimited flag + spendable now |
| Contract / address info | ${b}/contract?address=&chain=base | $0.003 | Proxy impl, clone, 7702, standards, Sourcify name |
| Gas / fees now | ${b}/gas?chain=base | $0.001 | EIP-1559 suggestion + USD cost estimates |
| Block by number or time | ${b}/block?timestamp=2026-01-01 | $0.001 | Timestamp → block search |
| NFT owner + metadata | ${b}/nft?contract=&token_id= | $0.002 | IPFS/Arweave resolved JSON |
| Open research search | ${b}/search?q= | $0.003 | Wikipedia+OpenAlex+arXiv+Crossref merged/ranked |
| UK house prices | ${b}/uk-property?postcode= | $0.01 | HM Land Registry Price Paid near postcode |
| UK postcode profile | ${b}/uk-area?postcode= | $0.005 | ONS geography + police crime + FSA hygiene |
| UK charity snapshot | ${b}/uk-charity?number= | $0.05 | Charity Commission E&W OGL |
| UK charity full DD | ${b}/uk-charity-full?number= | $0.25 | Trustees, finances, red flags |
| US SEC EDGAR snapshot | ${b}/us-sec?ticker=AAPL | $0.05 | CIK resolve, filings summary, fair-use EDGAR |
| US SEC full + facts | ${b}/us-sec-full?ticker=AAPL | $0.25 | us-gaap highlights + red-flag heuristics |
| EU VAT (VIES) | ${b}/eu-vat?vat=IE6388047V | $0.01 | Official VIES valid/name/address |
| FX rates (ECB) | ${b}/fx?base=GBP&symbols=USD | $0.002 | Official ECB rates, history, conversion |
| **Single-fact EVM (5 chains, $0.001–0.003)** | ${b}/chain/{erc20-balance,balance,block-number,nonce,total-supply,erc20-transfers,events,network-info,receipt,code,call,estimate-gas,nft-owner,erc1155-balance,storage,proxy,chain-id} | $0.001–0.003 | One answer per call, Base/Ethereum/Arbitrum/Optimism/Polygon; see /openapi.json |
| UK new cos (lite) | ${b}/uk-leads-lite?sic=&location= | $0.25 | New incorporations 1-7d, no directors |
| UK new cos + directors | ${b}/uk-leads?sic=&location= | $1.00 | + active officer names, mass-formation flags |
| UK leads daily feed | POST ${b}/uk-leads-feed | $25.00/30d | Daily webhook of new matches |
| UK company watch | POST ${b}/uk-watch | $5.00/30d | Hourly CH status/officers/filings → webhook |
| Agent KYB pack | ${b}/kyb?domain=&number=&vat= | $2.00 | Website + UK CH + EU VAT + sanctions + trust flag |
| Sanctions screen | ${b}/sanctions?name= | $0.05 | OFAC SDN/CONS + UK FCDO + UN SC + EU FSF fuzzy |
| Sanctions batch | POST ${b}/sanctions-batch | $1.00 | Up to 50 names |
| Hourly change alerts | POST ${b}/monitor | $1.00/30d | Webhook on change; GET /monitor/:id free |

## Free
- ${b}/samples/:kind — cached truncated real examples + upsell
- ${b}/monitor/:id — monitor status · ${b}/hooks/sink — webhook test sink (POST)
- ${b}/llms.txt · ${b}/openapi.json · ${b}/.well-known/x402 · ${b}/.well-known/agent.json · ${b}/mcp · ${b}/health

## Pay
HTTP 402 + PAYMENT-REQUIRED header (x402 v2). Retry with PAYMENT-SIGNATURE (@x402/fetch, x402-axios, @axiomworks/agentreader). MCP: ${b}/mcp

## npm
- SDK: npm i @axiomworks/agentreader — createClient({ privateKey }) auto x402 + preview mode
- MCP stdio: npx -y @axiomworks/agentreader-mcp — Claude Desktop / Cursor / Claude Code (set AGENTREADER_PRIVATE_KEY)
- npm: https://www.npmjs.com/package/@axiomworks/agentreader · https://www.npmjs.com/package/@axiomworks/agentreader-mcp

## pip
- LangChain: pip install agentreader-tools — agentreader_tools(private_key=…)
- CrewAI: pip install agentreader-crewai — agentreader_crewai_tools(private_key=…)
- LlamaIndex: pip install llama-index-tools-agentreader — AgentReaderToolSpec(private_key=…).to_tool_list()
- PydanticAI / OpenAI Agents: pip install "agentreader-agents[all]"
- PyPI: https://pypi.org/project/agentreader-tools/ · https://pypi.org/project/agentreader-crewai/ · https://pypi.org/project/llama-index-tools-agentreader/ · https://pypi.org/project/agentreader-agents/
- Dashboard: ${b}/dashboard · Landing: https://grokbot1233.github.io/agentreader/

## Clients
x402 v2 (PAYMENT-REQUIRED header; @x402/fetch, @x402/axios, Python x402>=2, @x402/mcp) and legacy v1 (402 JSON body + X-PAYMENT; x402-fetch, x402-axios, older AgentKit) both settle. Free ?preview=1 on GET routes.

## Contact
${CONTACT} · https://github.com/grokbot1233/agentreader · examples/ in repo
`;

app.get("/llms.txt", (c) => c.text(llms(base(c), c.env.PAY_TO)));
app.get("/", (c) => {
  if ((c.req.header("accept") || "").includes("text/html"))
    return c.html(`<!doctype html><meta charset=utf-8><title>Axiom Works AgentReader</title><meta name=viewport content="width=device-width"><style>body{font:16px/1.5 system-ui;max-width:760px;margin:40px auto;padding:0 16px}pre{background:#f4f4f4;padding:12px;white-space:pre-wrap}</style><h1>AgentReader</h1><pre>${llms(base(c), c.env.PAY_TO).replace(/</g, "&lt;")}</pre>`);
  return c.text(llms(base(c), c.env.PAY_TO));
});

async function keyOk(given: string, s: string) {
  const enc = new TextEncoder(); const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(given)), crypto.subtle.digest("SHA-256", enc.encode(s))]);
  return s.length > 0 && new Uint8Array(x).every((v, i) => v === new Uint8Array(y)[i]);
}
const STATS_KEY = "meta:stats";
const TEST_PAYERS = new Set(["0xdefe5f9f39d0f0a5f3c83594cd65a8e70015b370"]);
function emptyStats() {
  return { paid_calls: 0, revenue_usdc: 0, unique_payers: 0, by_endpoint: {} as any, by_day: {} as any, recent: [] as any[], test_calls: 0, test_revenue_usdc: 0, payers: [] as string[], generated: new Date().toISOString(), source: "cache" };
}
async function applyPayToStats(env: Env, rec: any) {
  const cur: any = (await env.LOG.get(STATS_KEY, "json")) || emptyStats();
  const isTest = TEST_PAYERS.has(String(rec.payer || "").toLowerCase());
  const entry = { ...rec, test: isTest };
  if (rec.success !== false) {
    if (isTest) {
      cur.test_calls = (cur.test_calls || 0) + 1;
      cur.test_revenue_usdc = (cur.test_revenue_usdc || 0) + Number(rec.amount || 0) / 1e6;
    } else {
      const a = Number(rec.amount || 0);
      cur.paid_calls = (cur.paid_calls || 0) + 1;
      cur.revenue_usdc = (cur.revenue_usdc || 0) + a / 1e6;
      const payers: string[] = Array.isArray(cur.payers) ? cur.payers : [];
      if (rec.payer) {
        const p = String(rec.payer).toLowerCase();
        if (!payers.includes(p)) payers.push(p);
      }
      cur.payers = payers;
      cur.unique_payers = payers.length;
      const ep = rec.endpoint || "unknown";
      cur.by_endpoint ??= {}; cur.by_day ??= {};
      (cur.by_endpoint[ep] ??= { calls: 0, revenue_usdc: 0 }).calls++;
      cur.by_endpoint[ep].revenue_usdc += a / 1e6;
      const d = String(rec.ts || new Date().toISOString()).slice(0, 10);
      (cur.by_day[d] ??= { calls: 0, revenue_usdc: 0 }).calls++;
      cur.by_day[d].revenue_usdc += a / 1e6;
    }
  }
  cur.recent = [entry, ...(cur.recent || [])].slice(0, 20);
  cur.generated = new Date().toISOString();
  cur.source = "cache";
  await env.LOG.put(STATS_KEY, JSON.stringify(cur));
}
async function stats(env: Env) {
  // Prefer single-key cache — KV list() has a low daily free-tier quota and was
  // blowing up /dashboard/data (15s poll) + /stats with "list() limit exceeded".
  const cached: any = await env.LOG.get(STATS_KEY, "json");
  if (cached) {
    const { payers, ...rest } = cached;
    return {
      ...rest,
      unique_payers: rest.unique_payers ?? (Array.isArray(payers) ? payers.length : 0),
      by_endpoint: rest.by_endpoint || {},
      by_day: rest.by_day || {},
      recent: rest.recent || [],
      generated: new Date().toISOString(),
      source: "cache",
    };
  }
  try {
    const recs: any[] = []; let cursor: string | undefined;
    do { const l: any = await env.LOG.list({ prefix: "pay:", cursor }); recs.push(...l.keys.map((k: any) => k.metadata).filter(Boolean)); cursor = l.list_complete ? undefined : l.cursor; } while (cursor);
    const all = recs.filter((r) => r && r.success !== false).sort((a, b) => String(a.ts) < String(b.ts) ? -1 : 1).map((r) => ({ ...r, test: TEST_PAYERS.has(String(r.payer || "").toLowerCase()) }));
    const tests = all.filter((r) => r.test); const ok = all.filter((r) => !r.test);
    const byEndpoint: any = {}, byDay: any = {}; const payers = new Set<string>(); let atomic = 0;
    for (const r of ok) { const a = Number(r.amount || 0); atomic += a; if (r.payer) payers.add(String(r.payer).toLowerCase());
      (byEndpoint[r.endpoint] ??= { calls: 0, revenue_usdc: 0 }).calls++; byEndpoint[r.endpoint].revenue_usdc += a / 1e6;
      const d = String(r.ts || "").slice(0, 10); if (d) { (byDay[d] ??= { calls: 0, revenue_usdc: 0 }).calls++; byDay[d].revenue_usdc += a / 1e6; } }
    const result = { paid_calls: ok.length, revenue_usdc: atomic / 1e6, unique_payers: payers.size, by_endpoint: byEndpoint, by_day: byDay, recent: all.slice(-20).reverse(), test_calls: tests.length, test_revenue_usdc: tests.reduce((t, r) => t + Number(r.amount || 0), 0) / 1e6, generated: new Date().toISOString(), source: "list-rebuild", payers: [...payers] };
    await env.LOG.put(STATS_KEY, JSON.stringify(result));
    const { payers: _p, ...publicStats } = result;
    return publicStats;
  } catch (e: any) {
    const empty = emptyStats();
    return { ...empty, payers: undefined, stats_err: String(e?.message || e).slice(0, 200), source: "empty-fallback" };
  }
}
export async function logPay(env: Env, r: any) {
  const rec = { ...r, ts: r.ts || new Date().toISOString() };
  await env.LOG.put(`pay:${rec.ts}:${crypto.randomUUID().slice(0, 8)}`, "1", { metadata: rec });
  try { await applyPayToStats(env, rec); } catch (e) { console.log("stats cache error", e); }
}
app.get("/stats", async (c) => {
  const auth = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") || c.req.query("key") || "";
  if (!(await keyOk(auth, c.env.STATS_SECRET || ""))) return c.json({ error: "unauthorized" }, 401);
  return c.json(await stats(c.env));
});
app.get("/dashboard", async (c) => {
  c.header("cache-control", "no-store"); return c.html(dashboardHtml());
});
app.get("/dashboard/data", async (c) => {
  const t = Date.now(); let health: any = { ok: true };
  try { await c.env.LOG.get("health-probe"); health.kv_ms = Date.now() - t; } catch (e: any) { health = { ok: false, error: String(e) }; }
  health.facilitator = (c.env as any).CDP_API_KEY_ID ? "Coinbase CDP" : "PayAI";
  const meta = (await c.env.LOG.get("meta:dashboard", "json")) || {};
  const mcpTools = [
    ["read_url", "$0.002"], ["extract_links", "$0.001"], ["check_domain", "$0.001"],
    ["company_research", "$0.25"], ["uk_company", "$0.50"], ["uk_company_lite", "$0.05"], ["company_full", "$0.65"], ["convert_document", "$0.03"], ["create_monitor", "$1.00"],
    ["wallet_balances", "$0.003"], ["tx_status", "$0.003"], ["token_check", "$0.01"], ["fx_rates", "$0.002"], ["ens_lookup", "$0.002"], ["token_metadata", "$0.001"], ["token_allowance", "$0.002"], ["contract_info", "$0.003"], ["gas_fees", "$0.001"], ["block_lookup", "$0.001"], ["nft_lookup", "$0.002"], ["web_search", "$0.003"], ["uk_property_prices", "$0.01"], ["uk_area_profile", "$0.005"], ["uk_charity", "$0.05"], ["uk_charity_full", "$0.25"], ["us_sec", "$0.05"], ["us_sec_full", "$0.25"], ["eu_vat", "$0.01"], ["uk_leads_lite", "$0.25"], ["uk_leads", "$1.00"], ["uk_leads_feed", "$25.00"], ["uk_watch", "$5.00"], ["kyb_report", "$2.00"], ["sanctions_screen", "$0.05"], ["sanctions_batch", "$1.00"],
    ...CHAIN_ROUTES.map((r) => ["chain_" + r.path.slice(7).replace(/-/g, "_"), r.price]),
    ["pricing", "free"],
  ];
  const services = [
    ...Object.entries(PRICES).map(([p, price]) => ({ name: `HTTP ${p}`, url: `${CANONICAL}${p}`, price, paid: true, status: "live" })),
    { name: "HTTP GET /monitor/:id", url: `${CANONICAL}/monitor/:id`, price: "free", paid: false, status: "live" },
    ...mcpTools.map(([n, price]) => ({ name: `MCP ${n}`, url: `${CANONICAL}/mcp`, price, paid: price !== "free", status: "live" })),
    ...["/health", "/llms.txt", "/openapi.json", "/.well-known/x402", "/.well-known/agent.json", "/samples/company", "/hooks/sink"].map((p) => ({ name: p, url: `${CANONICAL}${p}`, price: "free", paid: false, status: "live" })),
  ];
  let treasury_usdc: number | null = null, treasury_err: string | undefined;
  try { const r: any = await (await fetch("https://base-rpc.publicnode.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: USDC, data: "0x70a08231" + c.env.PAY_TO.slice(2).toLowerCase().padStart(64, "0") }, "latest"] }) })).json(); treasury_usdc = Number(BigInt(r.result)) / 1e6; } catch (e: any) { treasury_err = String(e).slice(0, 200); }
  c.header("cache-control", "no-store"); return c.json({ ...(await stats(c.env)), health, services, meta, network: NETWORK, payTo: c.env.PAY_TO, treasury_usdc, treasury_err, legacy_payTo: ["0xB1A4e2C441fa896AF010222659AAbBb71E9Ef1D1", "0x560d1dbb6e973082EBd20D340EAd3a198452b3Ec"], prices: PRICES });
});
app.post("/admin/dashboard-meta", async (c) => {
  const auth = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") || c.req.query("key") || "";
  if (!(await keyOk(auth, c.env.DASHBOARD_KEY || ""))) return c.json({ error: "unauthorized" }, 401);
  let body: any; try { body = await c.req.json(); } catch { return c.json({ error: "invalid json" }, 400); }
  const cur: any = (await c.env.LOG.get("meta:dashboard", "json")) || {};
  const next = { ...cur, ...body, updated: new Date().toISOString() };
  await c.env.LOG.put("meta:dashboard", JSON.stringify(next)); return c.json({ ok: true, meta: next });
});
app.all("/mcp", (c) => handleMcp(c.req.raw, c.env, (r) => logPay(c.env, r)));

// Free webhook sink for monitor tests (stores last payload briefly)
app.post("/hooks/sink", async (c) => {
  let body: any = null; try { body = await c.req.json(); } catch { try { body = await c.req.text(); } catch { body = null; } }
  const id = crypto.randomUUID().slice(0, 12);
  await c.env.LOG.put(`hook:${id}`, JSON.stringify({ ts: new Date().toISOString(), body }), { expirationTtl: 86400 });
  await c.env.LOG.put("hook:last", id, { expirationTtl: 86400 });
  return c.json({ ok: true, id, fetch: `${CANONICAL}/hooks/sink/${id}` });
});
app.get("/hooks/sink/:id", async (c) => {
  const raw = await c.env.LOG.get(`hook:${c.req.param("id")}`, "json");
  if (!raw) return c.json({ error: "not found or expired" }, 404);
  return c.json(raw);
});
app.get("/hooks/sink", async (c) => {
  const id = await c.env.LOG.get("hook:last");
  if (!id) return c.json({ last: null });
  const raw = await c.env.LOG.get(`hook:${id}`, "json");
  return c.json({ last: id, payload: raw });
});

// Free truncated samples (rate-limited) — never full paid payloads
app.get("/samples", (c) => c.json({
  samples: Object.keys(STATIC_SAMPLES),
  live_preview: "Add ?preview=1 to paid GET routes (same IP daily quota)",
  limit: "8 previews/IP/UTC day",
  kinds: ["read","links","check","company","uk-company","uk-company-lite","convert","company-full","uk-charity","uk-charity-full","us-sec","us-sec-full","eu-vat","uk-leads","uk-leads-lite","kyb","sanctions","sanctions-batch","uk-officer"],
}));
app.get("/samples/:kind", async (c) => {
  const kind = c.req.param("kind") as PreviewKind;
  const ip = clientIp(c);
  const q = await checkPreviewQuota(c.env, ip);
  if (!q.ok) return c.json(q, 429);
  const base = STATIC_SAMPLES[kind];
  if (!base) return c.json({ error: "unknown kind", see: "/samples" }, 404);
  return c.json({ ...truncateSample(kind, base), preview_remaining: q.remaining, sample: "static" });
});

// Free monitor status (id is secret) — registered BEFORE paid /monitor middleware

app.get("/uk-leads-feed/:id", async (c) => {
  const mon = await getLeadsFeed(c.env, c.req.param("id"));
  if (!mon) return c.json({ error: "not found" }, 404);
  return c.json({ ...mon, seen: undefined, seen_count: (mon.seen || []).length, status_url: `${CANONICAL}/uk-leads-feed/${mon.id}`, seconds_remaining: Math.max(0, Math.floor((new Date(mon.expires).getTime() - Date.now()) / 1000)) });
});
app.get("/uk-watch/:id", async (c) => {
  const mon = await getUkWatch(c.env, c.req.param("id"));
  if (!mon) return c.json({ error: "not found" }, 404);
  return c.json({ ...mon, status_url: `${CANONICAL}/uk-watch/${mon.id}`, seconds_remaining: Math.max(0, Math.floor((new Date(mon.expires).getTime() - Date.now()) / 1000)) });
});
app.get("/monitor/:id", async (c) => {
  const mon = await getMonitor(c.env, c.req.param("id"));
  if (!mon) return c.json({ error: "not found" }, 404);
  return c.json({ ...mon, status_url: `${CANONICAL}/monitor/${mon.id}`, seconds_remaining: Math.max(0, Math.floor((new Date(mon.expires).getTime() - Date.now()) / 1000)) });
});

// Live preview helper (truncated + rate-limited). Must not return full paid payload.
async function livePreview(c: any, kind: PreviewKind, runner: () => Promise<any>, exampleCall: string) {
  const ip = clientIp(c);
  const q = await checkPreviewQuota(c.env, ip);
  if (!q.ok) return c.json(q, 429);
  try {
    const data = await runner();
    return c.json({ ...truncateSample(kind, data, exampleCall), preview_remaining: q.remaining, sample: "live" });
  } catch (e: any) {
    const status = e instanceof UserError ? e.status : 502;
    return c.json({ error: e?.message || String(e), preview: true }, status as any);
  }
}

// Free validation BEFORE payment: bad input -> 400 with an example, never a 402.
for (const p of Object.keys(PRICES)) app.use(p, async (c, next) => {
  if (c.req.path !== p || ((p === "/monitor" || p === "/uk-leads-feed" || p === "/uk-watch") && c.req.method !== "POST")) return next();
  const v = VALIDATE[p]; if (!v) return next();
  const b = await bodyObj(c); const given = Object.keys(b).filter((k) => k !== "preview" && b[k] !== "" && b[k] != null);
  if (!given.length && c.req.query("preview") !== "1") return next(); // bare probe (x402scan/Bazaar crawlers): show the 402 challenge with schema + example
  const e = v(b);
  if (e) return c.json({ error: e, free: true, note: "Input rejected before payment; you were not charged.", example: EX[p], example_call: `${CANONICAL}${p}?${new URLSearchParams(EX[p])}` }, 400);
  return next();
});
// Paid routes: payment middleware first, except ?preview=1 (free truncated). v1 X-PAYMENT handled by ./v1; 402 body carries v1 accepts.
async function paid(c: any, next: any, p: string) {
  const req = v1Reqs({ url: `${CANONICAL}${p}`, method: c.req.method === "POST" ? "POST" : "GET", atomic: ATOMIC[p], desc: upsell(p, DESC[p]), payTo: c.env.PAY_TO, input: IN[p]?.properties || IN[p], output: { example: (EXAMPLES as any)[p], schema: OUT[p] } });
  const v1 = decodeV1(c.req.header("x-payment"));
  if (v1) return handleV1(c, next, v1, req, (r) => logPay(c.env, r));
  const out = await getMw(c.env)(c, next); const res: Response = out instanceof Response ? out : c.res;
  if (res.status === 402 && res.headers.get("payment-required")) {
    const h = new Headers(res.headers); h.set("content-type", "application/json");
    return new Response(JSON.stringify({ ...v1Body(req), x402_v2: "see PAYMENT-REQUIRED header (base64 JSON)", example_call: `${CANONICAL}${p}?${new URLSearchParams(EX[p])}`, free_preview: c.req.method === "GET" ? `${CANONICAL}${p}?${new URLSearchParams(EX[p])}&preview=1` : undefined }), { status: 402, headers: h });
  }
  return out;
}
const POST_ONLY_PAID = new Set(["/monitor", "/uk-leads-feed", "/uk-watch"]);
for (const p of Object.keys(PRICES)) {
  if (POST_ONLY_PAID.has(p)) {
    app.use(p, async (c, next) => {
      if (c.req.method !== "POST" || c.req.path !== p) return next();
      return paid(c, next, p);
    });
  } else {
    app.use(p, async (c, next) => {
      if (c.req.query("preview") === "1" && c.req.method === "GET") return next();
      return paid(c, next, p);
    });
  }
}

async function param(c: any, k: string) {
  let v = c.req.query(k);
  if (!v && c.req.method === "POST") { try { const b = await c.req.json(); v = b?.[k]; } catch {} }
  return typeof v === "string" ? v : "";
}
async function bodyObj(c: any) {
  const q: any = {};
  for (const [k, v] of Object.entries(c.req.query())) q[k] = v;
  if (c.req.method === "POST") {
    try { Object.assign(q, await c.req.json()); } catch {}
  }
  return q;
}
async function cached(c: any, key: string, fn: () => Promise<any>, maxAge = 300) {
  const cache = (caches as any).default as Cache; const req = new Request(`https://cache.agentreader.internal/${key}`);
  const hit = await cache.match(req); if (hit) { const r = new Response(hit.body, hit); r.headers.set("x-cache", "HIT"); return r; }
  try {
    const data = await fn(); const res = new Response(JSON.stringify(data), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${maxAge}` } });
    c.executionCtx.waitUntil(cache.put(req, res.clone())); return res;
  } catch (e: any) {
    const status = e instanceof UserError ? e.status : 502;
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status, headers: { "content-type": "application/json" } });
  }
}
const handle = (p: string, k: string, fn: (v: string) => Promise<any>) => async (c: any) => {
  const v = (await param(c, k)).trim(); if (!v) return c.json({ error: `missing ${k}` }, 400);
  return cached(c, `${p}?${k}=${encodeURIComponent(v)}`, () => fn(v));
};
for (const m of ["get", "post"] as const) {
  app[m]("/read", async (c) => {
    const url = (await param(c, "url")).trim(); if (!url) return c.json({ error: "missing url" }, 400);
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "read", () => readUrl(url), `${CANONICAL}/read?url=${encodeURIComponent(url)}`);
    return cached(c, `read?url=${encodeURIComponent(url)}`, () => readUrl(url));
  });
  app[m]("/links", async (c) => {
    const url = (await param(c, "url")).trim(); if (!url) return c.json({ error: "missing url" }, 400);
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "links", () => linksFor(url), `${CANONICAL}/links?url=${encodeURIComponent(url)}`);
    return cached(c, `links?url=${encodeURIComponent(url)}`, () => linksFor(url));
  });
  app[m]("/check", async (c) => {
    const domain = (await param(c, "domain")).trim(); if (!domain) return c.json({ error: "missing domain" }, 400);
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "check", () => checkDomain(domain), `${CANONICAL}/check?domain=${encodeURIComponent(domain)}`);
    return cached(c, `check?domain=${encodeURIComponent(domain)}`, () => checkDomain(domain));
  });
  app[m]("/company", async (c) => {
    const b = await bodyObj(c);
    const domain = (b.domain || b.name || "").trim();
    if (!domain) return c.json({ error: "missing domain (or name as domain)" }, 400);
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "company", () => companyResearch({ domain }), `${CANONICAL}/company?domain=${encodeURIComponent(domain)}`);
    return cached(c, `company?domain=${encodeURIComponent(domain)}`, () => companyResearch({ domain }), 600);
  });
  app[m]("/uk-company", async (c) => {
    const b = await bodyObj(c);
    if (!(b.number || b.name)) return c.json({ error: "missing number or name" }, 400);
    const key = b.number ? `number=${b.number}` : `name=${b.name}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "uk-company", () => ukCompany(c.env, { number: b.number, name: b.name }), `${CANONICAL}/uk-company?${key}`);
    return cached(c, `uk-company?${encodeURIComponent(key)}`, () => ukCompany(c.env, { number: b.number, name: b.name }), 60);
  });
  app[m]("/uk-company-lite", async (c) => {
    const b = await bodyObj(c);
    if (!(b.number || b.name)) return c.json({ error: "missing number or name" }, 400);
    const key = b.number ? `number=${b.number}` : `name=${b.name}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "uk-company-lite", () => ukCompany(c.env, { number: b.number, name: b.name, lite: true }), `${CANONICAL}/uk-company-lite?${key}`);
    return cached(c, `uk-company-lite?${encodeURIComponent(key)}`, () => ukCompany(c.env, { number: b.number, name: b.name, lite: true }), 60);
  });
  app[m]("/company-full", async (c) => {
    const b = await bodyObj(c);
    const domain = (b.domain || b.name || "").trim();
    if (!domain) return c.json({ error: "missing domain" }, 400);
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "company-full", () => companyFull(c.env, { domain }), `${CANONICAL}/company-full?domain=${encodeURIComponent(domain)}`);
    return cached(c, `company-full?domain=${encodeURIComponent(domain)}`, () => companyFull(c.env, { domain }), 60);
  });
  app[m]("/uk-charity", async (c) => {
    const b = await bodyObj(c);
    const key = b.number ? `number=${b.number}` : `name=${b.name}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "uk-charity", () => ukCharity(c.env, { number: b.number, name: b.name, suffix: b.suffix }), `${CANONICAL}/uk-charity?${key}`);
    return cached(c, `uk-charity?${encodeURIComponent(key)}`, () => ukCharity(c.env, { number: b.number, name: b.name, suffix: b.suffix }), 300);
  });
  app[m]("/uk-charity-full", async (c) => {
    const b = await bodyObj(c);
    const key = b.number ? `number=${b.number}` : `name=${b.name}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "uk-charity-full", () => ukCharity(c.env, { number: b.number, name: b.name, suffix: b.suffix, full: true }), `${CANONICAL}/uk-charity-full?${key}`);
    return cached(c, `uk-charity-full?${encodeURIComponent(key)}`, () => ukCharity(c.env, { number: b.number, name: b.name, suffix: b.suffix, full: true }), 300);
  });

  app[m]("/us-sec", async (c) => {
    const b = await bodyObj(c);
    const key = b.ticker ? `ticker=${b.ticker}` : `cik=${b.cik}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "us-sec", () => usSec(c.env, { ticker: b.ticker, cik: b.cik }), `${CANONICAL}/us-sec?${key}`);
    return cached(c, `us-sec?${encodeURIComponent(key)}`, () => usSec(c.env, { ticker: b.ticker, cik: b.cik }), 300);
  });
  app[m]("/us-sec-full", async (c) => {
    const b = await bodyObj(c);
    const key = b.ticker ? `ticker=${b.ticker}` : `cik=${b.cik}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "us-sec-full", () => usSec(c.env, { ticker: b.ticker, cik: b.cik, full: true }), `${CANONICAL}/us-sec-full?${key}`);
    return cached(c, `us-sec-full?${encodeURIComponent(key)}`, () => usSec(c.env, { ticker: b.ticker, cik: b.cik, full: true }), 300);
  });
  app[m]("/eu-vat", async (c) => {
    const b = await bodyObj(c);
    const key = b.vat ? `vat=${b.vat}` : `country=${b.country}&number=${b.number}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "eu-vat", () => euVat(c.env, { vat: b.vat, country: b.country, number: b.number }), `${CANONICAL}/eu-vat?${key}`);
    return cached(c, `eu-vat?${encodeURIComponent(key)}`, () => euVat(c.env, { vat: b.vat, country: b.country, number: b.number }), 300);
  });

  app[m]("/convert", async (c) => {
    const b = await bodyObj(c);
    const url = (b.url || "").trim();
    if (!url) return c.json({ error: "missing url" }, 400);
    const format = b.format === "text" ? "text" : "markdown";
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "convert", () => convertDocument(url, format), `${CANONICAL}/convert?url=${encodeURIComponent(url)}`);
    return cached(c, `convert?url=${encodeURIComponent(url)}&format=${format}`, () => convertDocument(url, format), 600);
  });

  app[m]("/uk-leads-lite", async (c) => {
    const b = await bodyObj(c);
    const key = `sic=${b.sic||""}&loc=${b.location||""}&pa=${b.postcode_area||""}&d=${b.days||1}&l=${b.limit||50}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "uk-leads-lite", () => ukLeads(c.env, { ...b, lite: true, limit: Math.min(Number(b.limit)||5, 5) }), `${CANONICAL}/uk-leads-lite?${key}`);
    return cached(c, `uk-leads-lite?${encodeURIComponent(key)}`, () => ukLeads(c.env, { sic: b.sic, location: b.location, postcode_area: b.postcode_area, days: b.days, limit: b.limit, lite: true }), 900);
  });
  app[m]("/uk-leads", async (c) => {
    const b = await bodyObj(c);
    const key = `sic=${b.sic||""}&loc=${b.location||""}&pa=${b.postcode_area||""}&d=${b.days||1}&l=${b.limit||25}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "uk-leads", () => ukLeads(c.env, { ...b, lite: false, limit: Math.min(Number(b.limit)||3, 3) }), `${CANONICAL}/uk-leads?${key}`);
    return cached(c, `uk-leads?${encodeURIComponent(key)}`, () => ukLeads(c.env, { sic: b.sic, location: b.location, postcode_area: b.postcode_area, days: b.days, limit: b.limit, lite: false }), 900);
  });
  app[m]("/kyb", async (c) => {
    const b = await bodyObj(c);
    const key = `domain=${b.domain||""}&number=${b.number||""}&name=${b.name||""}&vat=${b.vat||""}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "kyb", () => kybReport(c.env, b), `${CANONICAL}/kyb?${key}`);
    return cached(c, `kyb?${encodeURIComponent(key)}`, () => kybReport(c.env, { domain: b.domain, number: b.number, name: b.name, vat: b.vat, country: b.country, vat_number: b.vat_number }), 120);
  });



  app[m]("/uk-officer", async (c) => {
    const b = await bodyObj(c);
    if (!(b.name || "").trim()) return c.json({ error: "missing name" }, 400);
    const key = `name=${b.name}&limit=${b.limit || 10}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "uk-officer", () => ukOfficerSearch(c.env, { name: b.name, limit: Math.min(Number(b.limit)||2, 2) }), `${CANONICAL}/uk-officer?${key}`);
    return cached(c, `uk-officer?${encodeURIComponent(key)}`, () => ukOfficerSearch(c.env, { name: b.name, limit: b.limit }), 900);
  });
  app[m]("/sanctions", async (c) => {
    const b = await bodyObj(c);
    const key = `name=${b.name||""}&country=${b.country||""}&dob=${b.dob||""}&year=${b.year||""}&type=${b.type||""}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "sanctions", () => screenSanctions(c.env, b), `${CANONICAL}/sanctions?${key}`);
    return cached(c, `sanctions?${encodeURIComponent(key)}`, () => screenSanctions(c.env, { name: b.name, country: b.country, dob: b.dob, year: b.year, type: b.type }), 300);
  });
  app[m]("/sanctions-batch", async (c) => {
    const b = await bodyObj(c);
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "sanctions-batch", () => screenSanctionsBatch(c.env, { names: b.names || ["BANCO NACIONAL DE CUBA", "Alice Wonderland"] }), `${CANONICAL}/sanctions-batch`);
    return screenSanctionsBatch(c.env, { names: b.names }).then((d) => c.json(d)).catch((e: any) => c.json({ error: e?.message || String(e) }, (e instanceof UserError ? e.status : 502) as any));
  });

}

const ONCHAIN: Record<string, [(b: any) => Promise<any>, string[], number, string[]?]> = {
  "/ens": [(b) => ens(b), ["name", "address"], 900, ["name|address"]], "/token": [(b) => tokenMeta(b), ["address", "chain"], 3600],
  "/allowance": [(b) => allowance(b), ["token", "owner", "spender", "chain"], 20, ["token", "owner", "spender"]], "/contract": [(b) => contractInfo(b), ["address", "chain"], 1800],
  "/gas": [(b) => gas(b), ["chain"], 10, []], "/block": [(b) => block(b), ["number", "timestamp", "chain"], 60, []], "/nft": [(b) => nft(b), ["contract", "token_id", "chain"], 300, ["contract", "token_id"]],
  "/wallet": [(b) => wallet(b), ["address", "chain", "tokens"], 15], "/tx": [(b) => tx(b), ["hash", "chain"], 10],
  "/token-check": [(b) => tokenCheck(b), ["address", "chain"], 120],
  "/search": [(b) => search(b), ["q", "sources", "limit", "lang"], 900, ["q"]], "/uk-property": [(b) => ukProperty(b), ["postcode", "radius", "limit"], 86400, ["postcode"]], "/uk-area": [(b) => ukArea(b), ["postcode"], 21600, ["postcode"]], "/fx": [(b) => fx(b), ["base", "symbols", "date", "amount"], 600, []],
};
for (const r of CHAIN_ROUTES) ONCHAIN[r.path] = [r.fn, r.keys, r.ttl, (r.in.required as string[] | undefined) ?? []];
function nftSlim(d: any) { const m = d?.metadata; return { ...slim(d), metadata: m ? { name: m.name ?? null, image: m.image ? String(m.image).slice(0, 60) + "…" : null, attributes_count: Array.isArray(m.attributes) ? m.attributes.length : 0, truncated: "full metadata/attributes in paid call" } : null }; }
function slim(d: any): any { if (Array.isArray(d)) return d.slice(0, 2); if (d && typeof d === "object") { const o: any = {}; for (const [k, v] of Object.entries(d)) o[k] = Array.isArray(v) ? (v as any[]).slice(0, 2) : (k === "rates" || k === "converted") && v ? Object.fromEntries(Object.entries(v as any).slice(0, 3)) : v; return o; } return d; }
for (const [p, [fn, keys, ttl, need]] of Object.entries(ONCHAIN)) for (const m of ["get", "post"] as const) app[m](p, async (c) => {
  const b = await bodyObj(c); const args: any = {}; for (const k of keys) if (b[k] != null && b[k] !== "") args[k] = String(b[k]).trim();
  for (const r of need ?? [keys[0]]) if (!r.split("|").some((k) => args[k])) return c.json({ error: `missing ${r.replace("|", " or ")}`, example: EX[p] }, 400);
  if (c.req.query("preview") === "1" && m === "get") {
    const q = await checkPreviewQuota(c.env, clientIp(c)); if (!q.ok) return c.json(q, 429);
    try { return c.json({ preview: true, truncated: "arrays cut to 2 items; pay for full result", data: p === "/nft" ? nftSlim(await fn(args)) : slim(await fn(args)), paid_call: `${CANONICAL}${p}?${new URLSearchParams(args)}`, price: PRICES[p as keyof typeof PRICES], preview_remaining: q.remaining }); }
    catch (e: any) { return c.json({ error: e?.message || String(e), preview: true }, (e instanceof UserError ? e.status : 502) as any); }
  }
  return cached(c, `${p.slice(1)}?${new URLSearchParams(Object.entries(args).sort() as any)}`, () => fn(args), ttl);
});


app.post("/uk-leads-feed", async (c) => {
  try {
    const b = await bodyObj(c);
    const mon = await createLeadsFeed(c.env, { webhook: b.webhook, sic: b.sic, location: b.location, postcode_area: b.postcode_area });
    return c.json({ ...mon, seen: undefined, status_url: `${CANONICAL}/uk-leads-feed/${mon.id}`, price_paid: PRICES["/uk-leads-feed"], duration_days: 30, delivery: "daily UTC morning via cron" });
  } catch (e: any) {
    const status = e instanceof UserError ? e.status : 502;
    return c.json({ error: e?.message || String(e) }, status as any);
  }
});
app.post("/uk-watch", async (c) => {
  try {
    const b = await bodyObj(c);
    const mon = await createUkWatch(c.env, { number: b.number, webhook: b.webhook });
    return c.json({ ...mon, status_url: `${CANONICAL}/uk-watch/${mon.id}`, price_paid: PRICES["/uk-watch"], duration_days: 30, check_interval: "hourly" });
  } catch (e: any) {
    const status = e instanceof UserError ? e.status : 502;
    return c.json({ error: e?.message || String(e) }, status as any);
  }
});
app.post("/monitor", async (c) => {
  try {
    const b = await bodyObj(c);
    const mon = await createMonitor(c.env, { url: b.url, webhook: b.webhook, selector: b.selector, keyword: b.keyword });
    return c.json({ ...mon, status_url: `${CANONICAL}/monitor/${mon.id}`, price_paid: PRICES["/monitor"], duration_days: 30, check_interval: "hourly" });
  } catch (e: any) {
    const status = e instanceof UserError ? e.status : 502;
    return c.json({ error: e?.message || String(e) }, status as any);
  }
});
app.notFound((c) => c.json({ error: "not found", see: "/llms.txt" }, 404));

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runMonitors(env).then((r) => console.log("monitors", r)).catch((e) => console.log("monitors error", e)));
    ctx.waitUntil(runUkWatches(env).then((r) => console.log("uk-watch", r)).catch((e) => console.log("uk-watch error", e)));
    // Leads feeds: run once near 07:00 Europe/London (cron is hourly)
    const hour = new Date().getUTCHours(); // London = UTC+0 in winter
    if (hour === 7) ctx.waitUntil(runLeadsFeeds(env).then((r) => console.log("leads-feed", r)).catch((e) => console.log("leads-feed error", e)));
    // Sanctions lists: refresh daily ~03:00 UTC into KV
    if (hour === 3) ctx.waitUntil(refreshSanctionsIndex(env).then((r) => console.log("sanctions-refresh", r)).catch((e) => console.log("sanctions-refresh error", e)));
  },
};
