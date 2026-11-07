import { VALIDATE, aliasInput } from "./validate";
import { search } from "./search";
import { ukProperty, ukArea } from "./ukdata";
import { ukCharity } from "./uk-charity";
import { usSec } from "./us-sec";
import { euVat } from "./eu-vat";
import { leiLookup, leiFull } from "./lei";
import { ukLeads, createLeadsFeed, getLeadsFeed, runLeadsFeeds } from "./uk-leads";
import { createUkWatch, getUkWatch, runUkWatches } from "./uk-watch";
import { kybReport, bindingRegistries } from "./kyb";
import { ukDdReport } from "./uk-dd";
import { ukOfficerSearch } from "./uk-officer";
import { screenSanctions, screenSanctionsBatch, refreshSanctionsIndex, clearSanctionsCache } from "./sanctions";
import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { readUrl, linksFor, checkDomain, readBatch, UserError } from "./core";
import { emailCheck } from "./email-check";
import { domainLookup } from "./domain";
import { dnsLookup } from "./dns";
import { redirectsLookup } from "./redirects";
import { pageMeta } from "./meta";
import { headersAudit } from "./headers";
import { validateIban } from "./iban";
import { validatePhone } from "./phone";
import { validateUkPostcode } from "./uk-postcode";
import { validateSiren, validateSiret } from "./fr-company-id";
import { frCompany, frCompanySlim } from "./fr-company";
import { noCompany, noCompanySlim } from "./no-company";
import { dkCompany, dkCompanySlim } from "./dk-company";
import { fiCompany, fiCompanySlim } from "./fi-company";
import { chCompany, chCompanySlim } from "./ch-company";
import { plCompany, plCompanySlim } from "./pl-company";
import { czCompany, czCompanySlim } from "./cz-company";
import { beCompany, beCompanySlim } from "./be-company";
import { skCompany, skCompanySlim } from "./sk-company";
import { usEntity, usEntitySlim } from "./us-entity";
import { validatePartitaIva } from "./it-partita-iva";
import { validateOrgnr } from "./se-orgnr";
import { validateBnCa } from "./ca-bn";
import { validateCvr } from "./dk-cvr";
import { validateKvk } from "./nl-kvk";
import { validateHr } from "./de-hr";
import { validateNif } from "./es-nif";
import { validateCnpj } from "./br-cnpj";
import { validateNip } from "./pl-nip";
import { validateUid } from "./ch-uid";
import { validateFn } from "./at-fn";
import { validateCin } from "./in-cin";
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
import PAID_EXAMPLES from "./paid-examples.json";
import { CHAIN_ROUTES } from "./chain";
import { v1Reqs, v1Body, decodeV1, handleV1 } from "./v1";
import { dashboardHtml } from "./dashboard";
import { wallet, tx, tokenCheck, fx, CHAINS } from "./onchain";
import { ens, tokenMeta, allowance, contractInfo, gas, block, nft } from "./micro";

type Env = { AU?: Fetcher; AU_INTERNAL_KEY?: string; LOG: KVNamespace; STATS_SECRET: string; DASHBOARD_KEY: string; PAY_TO: string; FACILITATOR_URL: string; CDP_API_KEY_ID?: string; CDP_API_KEY_SECRET?: string; FACILITATOR?: string; CH_API_KEY?: string; CHARITY_KEY?: string };
const NETWORK = "eip155:8453";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
// Buyer sheet: everything an agent needs to pay with confidence (exact USDC, atomic units, network, asset, payTo, success-only charging).
const BUYER_SHEET_ENDPOINTS = ["/uk-company", "/kyb", "/uk-dd", "/company", "/company-full", "/sanctions-batch", "/uk-charity-full", "/registry-batch", "/uk-officer", "/uk-leads", "/uk-watch", "/uk-leads-feed"];
function pricingBlock(p: string, payTo: string) {
  const atomic = (ATOMIC as any)[p] as number; let usdc = (atomic / 1e6).toFixed(6).replace(/0+$/, ""); if (/\.\d?$/.test(usdc)) usdc = (atomic / 1e6).toFixed(2);
  return { endpoint: p, price_usd: (PRICES as any)[p], amount_usdc: usdc, amount_atomic: String(atomic), asset: { symbol: "USDC", decimals: 6, address: USDC, eip712: { name: "USD Coin", version: "2" } },
    network: { name: "Base mainnet", caip2: NETWORK, x402_v1: "base", chain_id: 8453 }, pay_to: payTo, scheme: "exact", max_timeout_seconds: 120,
    charged_only_on_success: true, charging_rule: "Payment settles only after a 2xx response. 4xx/5xx (bad input, not found, upstream down) are never settled, so you are not charged.",
    protocols: ["x402 v2: PAYMENT-REQUIRED header -> retry with PAYMENT-SIGNATURE", "x402 v1: 402 JSON accepts[] -> retry with X-PAYMENT"] };
}

const PRICES = {
  "/au-company": "$0.02",
  "/ca-company": "$0.02",
  "/fr-company": "$0.25",
  "/no-company": "$0.25",
  "/dk-company": "$0.25",
  "/fi-company": "$0.25",
  "/ch-company": "$0.25",
  "/pl-company": "$0.25",
  "/cz-company": "$0.25",
  "/be-company": "$0.25",
  "/sk-company": "$0.25",
  "/us-entity": "$0.25",
  "/registry-batch": "$0.30",
  "/read": "$0.002",
  "/links": "$0.001",
  "/check": "$0.001",
  "/email-check": "$0.002",
  "/domain": "$0.002",
  "/dns": "$0.001",
  "/redirects": "$0.001",
  "/meta": "$0.001",
  "/headers": "$0.001",
  "/iban": "$0.001",
  "/phone": "$0.001",
  "/uk-postcode": "$0.001",
  "/siren": "$0.001",
  "/siret": "$0.001",
  "/partita-iva": "$0.001",
  "/orgnr": "$0.001",
  "/bn-ca": "$0.001",
  "/cvr": "$0.001",
  "/fn-at": "$0.001",
  "/cin-in": "$0.001",
  "/kvk-nl": "$0.001",
  "/hr-de": "$0.001",
  "/nif-es": "$0.001",
  "/cnpj": "$0.001",
  "/nip-pl": "$0.001",
  "/uid-ch": "$0.001",
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
  "/lei": "$0.005", "/lei-full": "$0.05", "/read-batch": "$0.015",
  "/uk-leads-lite": "$0.25", "/uk-leads": "$1.00", "/uk-leads-feed": "$25.00",
  "/uk-watch": "$5.00", "/uk-dd": "$1.00", "/kyb": "$2.50",
  "/sanctions": "$0.05", "/sanctions-batch": "$1.00",
  "/uk-officer": "$0.15",
} as const;
const ATOMIC: Record<string, number> = {
  "/au-company": 20000,
  "/ca-company": 20000,
  "/fr-company": 250000,
  "/no-company": 250000,
  "/dk-company": 250000,
  "/fi-company": 250000,
  "/ch-company": 250000,
  "/pl-company": 250000,
  "/cz-company": 250000,
  "/be-company": 250000,
  "/sk-company": 250000,
  "/us-entity": 250000,
  "/registry-batch": 300000,
  "/read": 2000, "/links": 1000, "/check": 1000, "/email-check": 2000, "/domain": 2000, "/dns": 1000, "/redirects": 1000, "/meta": 1000, "/headers": 1000, "/iban": 1000, "/phone": 1000, "/uk-postcode": 1000, "/siren": 1000, "/siret": 1000, "/partita-iva": 1000, "/orgnr": 1000, "/bn-ca": 1000, "/cvr": 1000, "/fn-at": 1000, "/cin-in": 1000, "/kvk-nl": 1000, "/hr-de": 1000, "/nif-es": 1000, "/cnpj": 1000, "/nip-pl": 1000, "/uid-ch": 1000,
  "/company": 250000, "/uk-company": 500000, "/uk-company-lite": 50000, "/company-full": 650000,
  "/convert": 30000, "/monitor": 1000000,
  "/wallet": 3000, "/tx": 3000, "/token-check": 10000, "/fx": 2000,
  "/ens": 2000, "/token": 1000, "/allowance": 2000, "/contract": 3000, "/gas": 1000, "/block": 1000, "/nft": 2000,
  "/search": 3000, "/uk-property": 10000, "/uk-area": 5000,
  "/uk-charity": 50000, "/uk-charity-full": 250000,
  "/us-sec": 50000, "/us-sec-full": 250000, "/eu-vat": 10000,
  "/lei": 5000, "/lei-full": 50000, "/read-batch": 15000,
  "/uk-leads-lite": 250000, "/uk-leads": 1000000, "/uk-leads-feed": 25000000,
  "/uk-watch": 5000000, "/uk-dd": 1000000, "/kyb": 2500000,
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
const emailCheckIn = { type: "object", properties: { email: { type: "string", description: "Email address to validate" } }, required: ["email"] };
const emailCheckOut = { type: "object", properties: { email: { type: "string" }, syntax_ok: { type: "boolean" }, verdict: { type: "string" }, score: { type: "number" }, flags: { type: "array" }, checks: { type: "object" }, provider: { type: "string" }, mx_hosts: { type: "array" } } };
const domainIn = { type: "object", properties: { domain: { type: "string", description: "Domain name, e.g. stripe.com" } }, required: ["domain"] };
const domainOut = { type: "object", properties: { domain: { type: "string" }, registrar: { type: ["string", "null"] }, registered: { type: ["string", "null"] }, expires: { type: ["string", "null"] }, age_days: { type: ["integer", "null"] }, status: { type: "array" }, flags: { type: "array" }, sources: { type: "object" } } };
const dnsIn = { type: "object", properties: { name: { type: "string", description: "Hostname to resolve, e.g. example.com" }, domain: { type: "string", description: "Alias for name" }, type: { type: "string", description: "Optional DNS type or comma list: A,AAAA,MX,TXT,NS,CNAME (default all of those); also SOA,PTR,CAA" } }, required: ["name"] };
const dnsOut = { type: "object", properties: { name: { type: "string" }, type: {}, records: { type: "object" }, flags: { type: "array" }, sources: { type: "object" } } };
const metaOut = { type: "object", properties: { url: { type: "string" }, final_url: { type: "string" }, title: { type: ["string", "null"] }, description: { type: ["string", "null"] }, canonical_url: { type: "string" }, language: { type: ["string", "null"] }, site_name: { type: ["string", "null"] }, og: { type: "object" }, twitter: { type: "object" }, favicons: { type: "array", items: { type: "string" } }, json_ld_types: { type: "array", items: { type: "string" } }, headings: { type: "object" }, disclaimer: { type: "string" } } };
const redirectsOut = { type: "object", properties: { url: { type: "string" }, final_url: { type: "string" }, status: { type: ["integer", "null"] }, hops: { type: "integer" }, redirect_count: { type: "integer" }, chain: { type: "array", items: { type: "object", properties: { url: { type: "string" }, status: { type: "integer" } } } }, content_type: { type: ["string", "null"] }, ok: { type: "boolean" }, truncated_chain: { type: "boolean" }, disclaimer: { type: "string" } } };
const headersIn = { type: "object", properties: { url: { type: "string", description: "Public http(s) URL (or pass domain=)" }, domain: { type: "string", description: "Hostname, normalized to https://" } }, anyOf: [{ required: ["url"] }, { required: ["domain"] }] };
const headersOut = { type: "object", properties: { url: { type: "string" }, final_url: { type: "string" }, status: { type: "integer" }, headers: { type: "object" }, missing_critical: { type: "array", items: { type: "string" } }, ok: { type: "object" }, score: { type: "integer" }, disclaimer: { type: "string" } } };
const ibanIn = { type: "object", properties: { iban: { type: "string", description: "IBAN to validate (spaces allowed)" } }, required: ["iban"] };
const ibanOut = { type: "object", properties: { iban: { type: "string" }, valid: { type: "boolean" }, country: { type: "string" }, check_digits: { type: "string" }, bban: { type: "string" }, length: { type: "integer" }, length_ok: { type: "boolean" }, mod97_ok: { type: "boolean" }, disclaimer: { type: "string" } } };
const phoneIn = { type: "object", properties: { phone: { type: "string", description: "Phone in E.164 (+4479…), 00…, or national digits with country=" }, country: { type: "string", description: "ISO 3166-1 alpha-2 when phone is national, e.g. GB" } }, required: ["phone"] };
const phoneOut = { type: "object", properties: { phone_e164: { type: "string" }, valid: { type: "boolean" }, country: { type: ["string", "null"] }, calling_code: { type: ["string", "null"] }, national_number: { type: "string" }, length_ok: { type: "boolean" }, country_known: { type: "boolean" }, type_guess: { type: "string" }, disclaimer: { type: "string" } } };
const ukPostcodeIn = { type: "object", properties: { postcode: { type: "string", description: "UK postcode to validate (spaces/hyphens ok), e.g. SW1A 2AA" } }, required: ["postcode"] };
const ukPostcodeOut = { type: "object", properties: { postcode: { type: "string" }, postcode_compact: { type: "string" }, valid: { type: "boolean" }, format_ok: { type: "boolean" }, outward: { type: ["string", "null"] }, inward: { type: ["string", "null"] }, area: { type: ["string", "null"] }, district: { type: ["string", "null"] }, sector: { type: ["string", "null"] }, unit: { type: ["string", "null"] }, disclaimer: { type: "string" } } };
const sirenIn = { type: "object", properties: { siren: { type: "string", description: "French SIREN (9 digits, spaces/dashes ok)" } }, required: ["siren"] };
const sirenOut = { type: "object", properties: { siren: { type: "string" }, valid: { type: "boolean" }, luhn_ok: { type: "boolean" }, length_ok: { type: "boolean" }, digits: { type: "integer" }, disclaimer: { type: "string" } } };
const siretIn = { type: "object", properties: { siret: { type: "string", description: "French SIRET (14 digits = SIREN + NIC, spaces ok)" } }, required: ["siret"] };
const siretOut = { type: "object", properties: { siret: { type: "string" }, valid: { type: "boolean" }, luhn_ok: { type: "boolean" }, length_ok: { type: "boolean" }, digits: { type: "integer" }, nic: { type: "string" }, parent_siren: { type: "string" }, disclaimer: { type: "string" } } };
const partitaIvaIn = { type: "object", properties: { vat: { type: "string", description: "Italian Partita IVA (11 digits, optional IT prefix, spaces/dashes ok)" }, number: { type: "string", description: "Alias for vat" }, partita_iva: { type: "string", description: "Alias for vat" }, partita: { type: "string", description: "Alias for vat" } }, required: ["vat"] };
const partitaIvaOut = { type: "object", properties: { vat: { type: "string" }, partita_iva: { type: "string" }, valid: { type: "boolean" }, checksum_ok: { type: "boolean" }, length_ok: { type: "boolean" }, digits: { type: "integer" }, province_code: { type: "string" }, province_ok: { type: "boolean" }, disclaimer: { type: "string" } } };
const orgnrIn = { type: "object", properties: { orgnr: { type: "string", description: "Swedish organisationsnummer (10 digits or 12-digit YYYY+orgnr; spaces/dashes ok)" }, number: { type: "string", description: "Alias for orgnr" } }, required: ["orgnr"] };
const orgnrOut = { type: "object", properties: { orgnr: { type: "string" }, orgnr_formatted: { type: "string" }, valid: { type: "boolean" }, luhn_ok: { type: "boolean" }, third_digit_ok: { type: "boolean" }, length_ok: { type: "boolean" }, digits: { type: "integer" }, disclaimer: { type: "string" } } };
const bnCaIn = { type: "object", properties: { bn: { type: "string", description: "Canadian CRA Business Number (9 digits) or program account (BN9 + 2-letter program + 4-digit ref)" }, number: { type: "string", description: "Alias for bn" }, business_number: { type: "string", description: "Alias for bn" } }, required: ["bn"] };
const bnCaOut = { type: "object", properties: { bn: { type: "string" }, bn9: { type: "string" }, program: { type: ["string", "null"] }, reference: { type: ["string", "null"] }, program_known: { type: ["boolean", "null"] }, program_name: { type: ["string", "null"] }, shape_ok: { type: "boolean" }, valid: { type: "boolean" }, form: { type: "string" }, disclaimer: { type: "string" } } };
const kvkNlIn = { type: "object", properties: { kvk: { type: "string", description: "NL KvK number, e.g. 69599084" }, number: { type: "string", description: "Alias for kvk" } }, required: ["kvk"] };
const kvkNlOut = { type: "object", properties: { kvk: { type: "string" }, valid: { type: "boolean" }, disclaimer: { type: "string" } } };
const hrDeIn = { type: "object", properties: { hr: { type: "string", description: "DE Handelsregister number, e.g. HRB 6684" }, number: { type: "string", description: "Alias for hr" } }, required: ["hr"] };
const hrDeOut = { type: "object", properties: { hr: { type: "string" }, valid: { type: "boolean" }, disclaimer: { type: "string" } } };
const nifEsIn = { type: "object", properties: { nif: { type: "string", description: "ES NIF number, e.g. A28015865" }, number: { type: "string", description: "Alias for nif" } }, required: ["nif"] };
const nifEsOut = { type: "object", properties: { nif: { type: "string" }, valid: { type: "boolean" }, disclaimer: { type: "string" } } };
const cnpjIn = { type: "object", properties: { cnpj: { type: "string", description: "Brazilian CNPJ (14 digits, punctuation ok), e.g. 33.000.167/0001-01" }, number: { type: "string", description: "Alias for cnpj" } }, required: ["cnpj"] };
const cnpjOut = { type: "object", properties: { cnpj: { type: "string" }, cnpj_formatted: { type: "string" }, valid: { type: "boolean" }, checksum_ok: { type: "boolean" }, disclaimer: { type: "string" } } };
const nipPlIn = { type: "object", properties: { nip: { type: "string", description: "Polish NIP (10 digits, optional PL prefix), e.g. 5261040828" }, number: { type: "string", description: "Alias for nip" }, vat: { type: "string", description: "Alias for nip" } }, required: ["nip"] };
const nipPlOut = { type: "object", properties: { nip: { type: "string" }, valid: { type: "boolean" }, mod11_ok: { type: "boolean" }, disclaimer: { type: "string" } } };
const uidChIn = { type: "object", properties: { uid: { type: "string", description: "Swiss UID, e.g. CHE-109.322.551" }, number: { type: "string", description: "Alias for uid" }, che: { type: "string", description: "Alias for uid" } }, required: ["uid"] };
const uidChOut = { type: "object", properties: { uid: { type: "string" }, uid_formatted: { type: "string" }, valid: { type: "boolean" }, mod11_ok: { type: "boolean" }, disclaimer: { type: "string" } } };
const cvrIn = { type: "object", properties: { cvr: { type: "string", description: "Danish CVR (8 digits, optional DK prefix, spaces/dashes ok)" }, number: { type: "string", description: "Alias for cvr" }, vat: { type: "string", description: "Alias for cvr" } }, required: ["cvr"] };
const cvrOut = { type: "object", properties: { cvr: { type: "string" }, valid: { type: "boolean" }, mod11_ok: { type: "boolean" }, no_leading_zero: { type: "boolean" }, length_ok: { type: "boolean" }, digits: { type: "integer" }, disclaimer: { type: "string" } } };
const fnAtIn = { type: "object", properties: { fn: { type: "string", description: "Austrian Firmenbuchnummer (optional FN prefix + 1–6 digits + check letter + optional branch digits)" }, number: { type: "string", description: "Alias for fn" }, firmenbuch: { type: "string", description: "Alias for fn" } }, required: ["fn"] };
const fnAtOut = { type: "object", properties: { fn: { type: "string" }, fn_formatted: { type: "string" }, digits: { type: "string" }, check_letter: { type: "string" }, expected_check_letter: { type: "string" }, branch: { type: ["string", "null"] }, valid: { type: "boolean" }, letter_ok: { type: "boolean" }, letter_in_alphabet: { type: "boolean" }, length_ok: { type: "boolean" }, disclaimer: { type: "string" } } };
const cinInIn = { type: "object", properties: { cin: { type: "string", description: "Indian CIN (21 chars: L/U + NIC + state + year + type + reg)" }, number: { type: "string", description: "Alias for cin" } }, required: ["cin"] };
const cinInOut = { type: "object", properties: { cin: { type: "string" }, valid: { type: "boolean" }, shape_ok: { type: "boolean" }, year_ok: { type: "boolean" }, listing: { type: "string" }, listing_status: { type: "string" }, nic_code: { type: "string" }, state_code: { type: "string" }, year_of_incorporation: { type: "integer" }, company_type: { type: "string" }, company_type_known: { type: "boolean" }, company_type_name: { type: ["string", "null"] }, registration_number: { type: "string" }, disclaimer: { type: "string" } } };
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
  company_number: { type: "string", description: "Alias of number (Companies House field name)" },
  name: { type: "string", description: "Registered company name to search" },
}, anyOf: [{ required: ["number"] }, { required: ["company_number"] }, { required: ["name"] }] };
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
  company: companyOut,
  uk: { type: ["object", "null"] }, uk_included: { type: "boolean" }, uk_skip_reason: { type: ["string", "null"] },
  charity: { type: ["object", "null"] }, charity_included: { type: "boolean" }, charity_skip_reason: { type: ["string", "null"] },
  fr: { type: ["object", "null"] }, fr_included: { type: "boolean" }, fr_skip_reason: { type: ["string", "null"] },
  no: { type: ["object", "null"] }, no_included: { type: "boolean" }, no_skip_reason: { type: ["string", "null"] },
  dk: { type: ["object", "null"] }, dk_included: { type: "boolean" }, dk_skip_reason: { type: ["string", "null"] },
  fi: { type: ["object", "null"] }, fi_included: { type: "boolean" }, fi_skip_reason: { type: ["string", "null"] },
  ch: { type: ["object", "null"] }, ch_included: { type: "boolean" }, ch_skip_reason: { type: ["string", "null"] },
  pl: { type: ["object", "null"] }, pl_included: { type: "boolean" }, pl_skip_reason: { type: ["string", "null"] },
  cz: { type: ["object", "null"] }, cz_included: { type: "boolean" }, cz_skip_reason: { type: ["string", "null"] },
  be: { type: ["object", "null"] }, be_included: { type: "boolean" }, be_skip_reason: { type: ["string", "null"] },
  sk: { type: ["object", "null"] }, sk_included: { type: "boolean" }, sk_skip_reason: { type: ["string", "null"] },
  au: { type: ["object", "null"] }, au_included: { type: "boolean" }, au_skip_reason: { type: ["string", "null"] },
  ca: { type: ["object", "null"] }, ca_included: { type: "boolean" }, ca_skip_reason: { type: ["string", "null"] },
  registries_attached: { type: "array", items: { type: "string" } }, note: { type: "string" } } };
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
const walletIn = { type: "object", properties: { address: { type: "string", description: "0x EVM wallet address" }, wallet: { type: "string", description: "Alias for address" }, chain: chainP, tokens: { type: "string", description: "Optional comma-separated extra ERC20 contract addresses (max 10)" } }, required: ["address"] };
const walletOut = { type: "object", properties: { chain: { type: "string" }, address: { type: "string" }, block: { type: "integer" }, native: { type: "object" }, nonce: { type: "integer" }, is_contract: { type: "boolean" }, tokens: { type: "array", items: { type: "object" } } } };
const txIn = { type: "object", properties: { hash: { type: "string", description: "0x transaction hash" }, chain: chainP }, required: ["hash"] };
const txOut = { type: "object", properties: { status: { type: "string" }, block: { type: ["integer", "null"] }, timestamp: { type: ["string", "null"] }, from: { type: "string" }, to: { type: ["string", "null"] }, value_native: { type: "string" }, fee_native: { type: "string" }, erc20_transfers: { type: "array", items: { type: "object" } } } };
const tokenIn = { type: "object", properties: { address: { type: "string", description: "0x ERC20 token contract address" }, chain: chainP }, required: ["address"] };
const tokenOut = { type: "object", properties: { name: { type: ["string", "null"] }, symbol: { type: ["string", "null"] }, decimals: { type: ["integer", "null"] }, total_supply: { type: "string" }, owner: { type: ["string", "null"] }, proxy: { type: "object" }, market: { type: ["object", "null"] }, risk_flags: { type: "array", items: { type: "object" } }, risk_score: { type: "integer" }, verdict: { type: "string" } } };
const rbIn = { type: "object", properties: { uk: { type: "string", description: "Comma-separated UK company numbers (max 10, e.g. 00445790, SC123456)" }, au: { type: "string", description: "Comma-separated ACNs (9) or ABNs (11)" }, ca: { type: "string", description: "Comma-separated Canadian corporation numbers or 9-digit BNs" }, fr: { type: "string", description: "Comma-separated French SIREN (9 digits)" }, no: { type: "string", description: "Comma-separated Norwegian organisasjonsnummer (9 digits)" }, dk: { type: "string", description: "Comma-separated Danish CVR numbers (8 digits)" }, fi: { type: "string", description: "Comma-separated Finnish Y-tunnukset (e.g. 0112038-9)" }, ch: { type: "string", description: "Comma-separated Swiss UIDs (e.g. CHE-105.909.036)" }, pl: { type: "string", description: "Comma-separated Polish KRS numbers (10 digits, e.g. 0000001538)" }, cz: { type: "string", description: "Comma-separated Czech IČO (8 digits, e.g. 27082440)" }, be: { type: "string", description: "Comma-separated Belgian enterprise numbers (10 digits, e.g. 0202239951)" }, sk: { type: "string", description: "Comma-separated Slovak IČO (8 digits, e.g. 31322832)" } } };
const rbOut = { type: "object", properties: { count: { type: "number" }, found: { type: "number" }, results: { type: "array" } } };
const caIn = { type: "object", properties: { number: { type: "string", description: "Corporations Canada corporation number (up to 8 digits)" }, bn: { type: "string", description: "9-digit CRA Business Number (alternative)" } } };
const caOut = { type: "object", properties: { corporation_number: { type: "string" }, business_number: { type: "string" }, name: { type: "string" }, name_alt: { type: "string" }, governing_legislation: { type: "string" }, status: { type: "string" }, status_detail: { type: "string" }, anniversary_date: { type: "string" }, last_annual_filing_year: { type: "string" }, last_annual_meeting: { type: "string" }, registered_office: { type: "string" }, directors_min: { type: "number" }, directors_max: { type: "number" }, matches: { type: "array" }, source: { type: "string" } } };
const auIn = { type: "object", properties: { acn: { type: "string", description: "9-digit Australian Company Number" }, abn: { type: "string", description: "11-digit ABN (alternative to acn)" } } };
const auOut = { type: "object", properties: { acn: { type: "string" }, abn: { type: "string" }, name: { type: "string" }, former_names: { type: "array" }, type: { type: "string" }, type_desc: { type: "string" }, class: { type: "string" }, status: { type: "string" }, status_desc: { type: "string" }, registered: { type: "string" }, deregistered: { type: "string" }, source: { type: "string" } } };
const frIn = { type: "object", properties: { siren: { type: "string", description: "French SIREN (9 digits)" }, siret: { type: "string", description: "French SIRET (14 digits)" }, name: { type: "string", description: "Company name search" }, q: { type: "string", description: "Alias of name" }, limit: { type: "integer", description: "Name-search matches (1-10, default 5)" } } };
const frOut = { type: "object", properties: { siren: { type: "string" }, name: { type: "string" }, status: { type: "string" }, status_label: { type: "string" }, activity_code: { type: "string" }, siege: { type: "object" }, dirigeants: { type: "array" }, red_flags: { type: "array" }, source: { type: "string" } } };
const noIn = { type: "object", properties: { orgnr: { type: "string", description: "Norwegian organisasjonsnummer (9 digits, spaces/dashes ok)" }, name: { type: "string", description: "Company name search" }, q: { type: "string", description: "Alias of name" }, limit: { type: "integer", description: "Name-search matches (1-10, default 5)" } } };
const noOut = { type: "object", properties: { orgnr: { type: "string" }, name: { type: "string" }, status: { type: "string" }, orgform: { type: "object" }, forretningsadresse: { type: "object" }, naeringskode: { type: "object" }, antallAnsatte: { type: "integer" }, red_flags: { type: "array" }, source: { type: "string" } } };
const dkIn = { type: "object", properties: { cvr: { type: "string", description: "Danish CVR (8 digits, spaces/dashes/DK prefix ok)" }, number: { type: "string", description: "Alias of cvr" }, vat: { type: "string", description: "Alias of cvr" }, name: { type: "string", description: "Company name search" }, q: { type: "string", description: "Alias of name" }, limit: { type: "integer", description: "Name-search matches (1-10, default 5)" } } };
const dkOut = { type: "object", properties: { cvr: { type: "string" }, name: { type: "string" }, status: { type: "string" }, company_type: { type: "string" }, company_type_short: { type: "string" }, address: { type: "string" }, zipcode: {}, city: { type: "string" }, industry_code: { type: "string" }, industry_desc: { type: "string" }, employees: { type: "integer" }, direktion: { type: "array" }, ejere: { type: "array" }, red_flags: { type: "array" }, source: { type: "string" } } };
const fiIn = { type: "object", properties: { businessId: { type: "string", description: "Finnish Y-tunnus / business ID (e.g. 0112038-9)" }, ytunnus: { type: "string", description: "Alias of businessId" }, fi: { type: "string", description: "Alias of businessId" }, number: { type: "string", description: "Alias of businessId" }, name: { type: "string", description: "Company name search" }, q: { type: "string", description: "Alias of name" }, limit: { type: "integer", description: "Name-search matches (1-10, default 5)" } } };
const chIn = { type: "object", properties: { uid: { type: "string", description: "Swiss UID (e.g. CHE-105.909.036)" }, che: { type: "string", description: "Alias of uid" }, number: { type: "string", description: "Alias of uid" }, ehraid: { type: "string", description: "Zefix ehraid numeric id" }, name: { type: "string", description: "Company name search" }, q: { type: "string", description: "Alias of name" }, limit: { type: "integer", description: "Name-search matches (1-10, default 5)" } } };
const fiOut = { type: "object", properties: { business_id: { type: "string" }, name: { type: "string" }, status: { type: "string" }, company_form: { type: "object" }, address: { type: "string" }, city: { type: "string" }, postcode: { type: "string" }, country: { type: "string" }, main_business_line: { type: "object" }, website: { type: "string" }, eu_id: { type: "string" }, company_situations: { type: "array" }, red_flags: { type: "array" }, source: { type: "string" } } };
const chOut = { type: "object", properties: { uid: { type: "string" }, name: { type: "string" }, status: { type: "string" }, legal_seat: { type: ["string", "null"] }, legal_form: { type: ["object", "null"] }, address: { type: ["string", "null"] }, purpose: { type: ["string", "null"] }, red_flags: { type: "array" }, source: { type: "string" } } };
const plIn = { type: "object", properties: { krs: { type: "string", description: "Polish KRS number (10 zero-padded digits, e.g. 0000001538)" }, nip: { type: "string", description: "Polish NIP (10 digits) — resolves via MF VAT whitelist then KRS odpis" }, number: { type: "string", description: "Alias of krs" }, pl: { type: "string", description: "Alias of krs" } } };
const plOut = { type: "object", properties: { krs: { type: "string" }, nip: { type: ["string", "null"] }, name: { type: "string" }, legal_form: { type: ["string", "null"] }, seat: { type: ["string", "null"] }, address: { type: ["string", "null"] }, status_hint: { type: "string" }, activities: { type: "object" }, representation: { type: "object" }, red_flags: { type: "array" }, source: { type: "string" } } };
const czIn = { type: "object", properties: { ico: { type: "string", description: "Czech IČO (8 digits, e.g. 27082440)" }, number: { type: "string", description: "Alias of ico" }, cz: { type: "string", description: "Alias of ico" }, dic: { type: "string", description: "Czech DIČ (CZ + IČO) — treated as IČO" }, name: { type: "string", description: "Company name search" }, q: { type: "string", description: "Alias of name" }, limit: { type: "integer", description: "Name-search matches (1-10, default 5)" } } };
const beIn = { type: "object", properties: { enterprise_number: { type: "string", description: "Belgian CBE/KBO enterprise number (10 digits, e.g. 0202239951 or 0202.239.951)" }, number: { type: "string", description: "Alias of enterprise_number" }, be: { type: "string", description: "Alias of enterprise_number" }, bce: { type: "string", description: "Alias of enterprise_number" }, kbo: { type: "string", description: "Alias of enterprise_number" }, sk: { type: "string", description: "Slovak IČO (8 digits) via RPO" }, ico_sk: { type: "string", description: "Alias of sk" }, rpo: { type: "string", description: "Alias of sk" }, us_state: { type: "string", description: "US state for us_id/us_name: NY, CO, CT, OR or TX" }, us_id: { type: "string", description: "US state entity id (needs us_state), e.g. CO 20211537536" }, us_name: { type: "string", description: "US entity name searched across NY/CO/CT/OR/TX SOS open data" }, vat: { type: "string", description: "Belgian VAT (BE + 10 digits) — treated as enterprise number" }, name: { type: "string", description: "Company name search (phonetic; may be unavailable if CBE blocks)" }, q: { type: "string", description: "Alias of name" }, limit: { type: "integer", description: "Name-search matches (1-10, default 5)" } } };
const beOut = { type: "object", properties: { enterprise_number: { type: "string" }, vat: { type: ["string", "null"] }, name: { type: ["string", "null"] }, status: { type: "string" }, legal_form: { type: ["string", "null"] }, address: { type: ["string", "null"] }, nace: { type: "array" }, functions: { type: "array" }, red_flags: { type: "array" }, disclaimer: { type: "string" } } };
const skIn = { type: "object", properties: { ico: { type: "string", description: "Slovak IČO (8 digits, e.g. 31322832)" }, identifier: { type: "string", description: "Alias of ico (RPO identifier=)" }, sk: { type: "string", description: "Alias of ico" }, ico_sk: { type: "string", description: "Alias of ico" }, rpo: { type: "string", description: "Alias of ico" }, number: { type: "string", description: "Alias of ico" }, name: { type: "string", description: "Company name search" }, q: { type: "string", description: "Alias of name" }, limit: { type: "integer", description: "Name-search matches (1-10, default 5)" } } };
const skOut = { type: "object", properties: { ico: { type: "string" }, name: { type: ["string", "null"] }, status: { type: "string" }, legal_form: { type: ["object", "null"] }, establishment: { type: ["string", "null"] }, termination: { type: ["string", "null"] }, address: { type: ["string", "null"] }, registration_office: { type: ["string", "null"] }, registration_number: { type: ["string", "null"] }, statutory_bodies: { type: "array" }, stakeholders: { type: "array" }, successors: { type: "array" }, red_flags: { type: "array" }, source: { type: "string" }, license: { type: "string" } } };
const usIn = { type: "object", properties: { name: { type: "string", description: "Company/entity name (prefix + exact match, legal suffix optional), e.g. Etsy Inc" }, q: { type: "string", description: "Alias of name" }, company: { type: "string", description: "Alias of name" }, state: { type: "string", description: "NY, CO, CT, OR, TX, comma list, or all (default all). Required (single state) for id lookup" }, id: { type: "string", description: "State entity id: NY DOS ID, CO entity id, CT account number, OR registry number, TX taxpayer number" }, number: { type: "string", description: "Alias of id" }, entity_id: { type: "string", description: "Alias of id" }, limit: { type: "integer", description: "Results (1-25, default 10)" } } };
const usOut = { type: "object", properties: { query: { type: "object" }, total_results: { type: "integer" }, best_match: { type: "object", description: "state, id, name, status, entity_type, formed, jurisdiction, address, registered_agent, principals (CT), lookup_url" }, results: { type: "array" }, red_flags: { type: "array" }, per_state: { type: "object" }, source: { type: "string" } } };
const czOut = { type: "object", properties: { ico: { type: "string" }, dic: { type: ["string", "null"] }, name: { type: "string" }, status: { type: "string" }, legal_form: { type: ["object", "null"] }, seat: { type: ["string", "null"] }, address: { type: ["string", "null"] }, activities_nace: { type: "array" }, capital: { type: ["object", "null"] }, court_file: { type: ["string", "null"] }, red_flags: { type: "array" }, source: { type: "string" } } };
const fxIn = { type: "object", properties: { base: { type: "string", description: "ISO currency, default USD" }, symbols: { type: "string", description: "Comma list e.g. GBP,EUR (default all ~30)" }, date: { type: "string", description: "YYYY-MM-DD historical (default latest)" }, amount: { type: "string", description: "Optional amount to convert" } } };
const fxOut = { type: "object", properties: { base: { type: "string" }, date: { type: "string" }, rates: { type: "object" }, converted: { type: "object" } } };
const A = (d: string) => ({ type: "string", description: d });
const ensIn = { type: "object", properties: { name: A("ENS name to resolve, e.g. vitalik.eth"), address: A("0x address for reverse lookup (primary name)") }, anyOf: [{ required: ["name"] }, { required: ["address"] }] };
const ensOut = { type: "object", properties: { direction: { type: "string" }, name: { type: ["string", "null"] }, address: { type: ["string", "null"] }, records: { type: "object" }, forward_verified: { type: "boolean" } } };
const tokenMetaIn = { type: "object", properties: { address: A("0x ERC20 token contract"), wallet: { type: "string", description: "Alias for address" }, chain: chainP }, required: ["address"] };
const tokenMetaOut = { type: "object", properties: { name: { type: ["string", "null"] }, symbol: { type: ["string", "null"] }, decimals: { type: ["integer", "null"] }, total_supply: { type: ["string", "null"] }, is_erc20_like: { type: "boolean" } } };
const allowIn = { type: "object", properties: { token: A("0x ERC20 token"), owner: A("0x token holder"), spender: A("0x approved spender (router, Permit2, x402 facilitator…)"), chain: chainP }, required: ["token", "owner", "spender"] };
const allowOut = { type: "object", properties: { allowance: { type: "string" }, allowance_raw: { type: "string" }, unlimited: { type: "boolean" }, owner_balance: { type: ["string", "null"] }, spendable_now: { type: ["string", "null"] } } };
const contractIn = { type: "object", properties: { address: A("0x address to inspect"), wallet: { type: "string", description: "Alias for address" }, chain: chainP }, required: ["address"] };
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
const leiIn = { type: "object", properties: {
  lei: { type: "string", description: "20-char Legal Entity Identifier, e.g. HWUPKR0MPOU8FGXBT394" },
  name: { type: "string", description: "Legal name search (best match)" },
  registered_as: { type: "string", description: "National registration number" },
  country: { type: "string", description: "Optional ISO2 with name/registered_as" },
}, anyOf: [{ required: ["lei"] }, { required: ["name"] }, { required: ["registered_as"] }] };
const leiOut = { type: "object", properties: {
  lei: { type: "string" }, legal_name: {}, status: { type: "object" }, jurisdiction: {}, legal_form: {},
  legal_address: {}, hq_address: {}, registered_as: {}, registration_authority: {}, bic: {}, identifiers: { type: "array" },
  parents: { type: "object", properties: { direct: {}, ultimate: {} } },
  creation_date: {}, next_renewal: {}, source: { type: "string" }, fetched_at: { type: "string" } } };
const leiFullIn = { type: "object", properties: {
  name: { type: "string", description: "Legal name search (up to 10 matches with parents)" },
  registered_as: { type: "string" }, country: { type: "string" }, lei: { type: "string", description: "Optional single LEI (prefer /lei)" },
}, anyOf: [{ required: ["name"] }, { required: ["registered_as"] }, { required: ["lei"] }] };
const leiFullOut = { type: "object", properties: {
  product: { type: "string" }, query: { type: "object" }, count: { type: "integer" }, total_available: { type: "integer" },
  results: { type: "array", items: leiOut }, source: { type: "string" } } };
const readBatchIn = { type: "object", properties: {
  urls: { description: "Up to 8 http(s) URLs as comma-separated string or JSON array", anyOf: [{ type: "string" }, { type: "array", items: { type: "string", format: "uri" } }] },
}, required: ["urls"] };
const readBatchOut = { type: "object", properties: {
  product: { type: "string" }, count: { type: "integer" }, ok_count: { type: "integer" },
  results: { type: "array", items: { type: "object", properties: { url: {}, ok: {}, error: {}, title: {}, markdown: {}, word_count: {} } } } } };


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
  names: { type: "array", description: "1-50 names (strings or {name,country?,dob?,year?,type?} objects). GET: comma/semicolon/pipe-separated string or repeated names=", items: { type: ["string", "object"] } },
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
  "/registry-batch": "Use this to verify up to 25 UK (Companies House, max 10), Australian (ASIC, ACN/ABN), Canadian (Corporations Canada, corp number/BN), French (SIREN via Recherche d'entreprises), Norwegian (orgnr via Brreg), Danish (CVR via apicvr.dk), Finnish (Y-tunnus via PRH), Swiss (UID via Zefix), Polish (KRS), Czech (IČO via ARES), Belgian (CBE enterprise number) and Slovak (RPO IČO) companies in one call: name, status, type/act, dates, office, UK compliance/red flags (lite). Not-found IDs reported inline. ~$0.012/company vs $0.02-0.05 single. Example: {uk:\"00445790\", au:\"009661901\", ca:\"8660115\", fr:\"443061841\", no:\"923609016\", dk:\"24256790\", fi:\"0112038-9\", ch:\"CHE-105.909.036\", pl:\"0000001538\", cz:\"27082440\", be:\"0202239951\", sk:\"31322832\"}. $0.30.",
  "/ca-company": "Use this for a Canadian federal corporation lookup (Corporations Canada, CBCA + NFP/coop/BOTA) by corporation number or 9-digit Business Number (BN): legal name (EN/FR), governing act, status, anniversary date, last annual filing year, last AGM, registered office address, min/max directors. Source: Corporations Canada open data (OGL-Canada), ~697k active corporations. Example: {number:\"8660115\"}. $0.02.",
  "/fr-company": "Use this for a French company lookup from the official API Recherche d'entreprises (INSEE/RNE): legal name, SIREN/SIRET siège, status, NAF activity, dirigeants, employee band, optional finances, red flags. Search by siren, siret, or name. Example: {siren:\"443061841\"} (Google France) or {name:\"AXA\"}. $0.25.",
  "/no-company": "Use this for a Norwegian company lookup from Brønnøysundregistrene Enhetsregisteret (open data): legal name, orgnr, orgform, status/konkurs/liquidation flags, forretningsadresse, NACE, ansatte, hjemmeside, red flags. Search by orgnr (9 digits) or name. Example: {orgnr:\"923609016\"} (Equinor) or {name:\"Equinor\"}. $0.25.",
  "/dk-company": "Use this for a Danish company lookup from CVR (Erhvervsstyrelsen via apicvr.dk): legal name, CVR, status, company type, address, industry, employees, direktion/ejere, red flags (bankrupt/ceased/protected). Search by cvr (8 digits, DK prefix ok) or name. Path alias /dk-company/{cvr}. Example: {cvr:\"24256790\"} (Novo Nordisk) or {name:\"Novo Nordisk\"}. $0.25.",
  "/ch-company": "Use this for a Swiss company lookup from Zefix (central business name index / UID register): legal name, UID, status, legal form, seat, address, purpose, recent SHAB notices, audit firms, red flags. Search by uid/che (e.g. CHE-105.909.036), ehraid, or name. Path alias /ch-company/{uid}. Example: {uid:\"CHE-105.909.036\"} (Nestlé) or {name:\"UBS AG\"}. $0.25.",
  "/pl-company": "Use this for a Polish company lookup from the National Court Register (KRS) current extract: legal name, KRS, NIP, REGON, legal form, seat/address, website, email, capital, PKD activities, representation summary, registration/last-entry dates, red flags. Search by krs (10 digits) or nip (MF whitelist → KRS). No free-text name search. Path alias /pl-company/{krs}. Example: {krs:\"0000001538\"} (Bank Handlowy) or {nip:\"5260300291\"}. $0.25.",
  "/us-entity": "Use this for a US state business-entity (Secretary of State) lookup across New York, Colorado, Connecticut, Oregon and Texas official open-data registries in one call: entity name, state id, status/good standing, entity type, formation date, jurisdiction of formation (e.g. DE for foreign-qualified), principal address, registered agent, Connecticut principals, red flags (inactive, new <6 months, same name in multiple states). Search by name (all 5 states) or state+id. Path alias /us-entity/{state}/{id}. Example: {name:\"Etsy Inc\"} or {state:\"CO\",id:\"20211537536\"}. $0.25.",
  "/sk-company": "Use this for a Slovak company lookup from RPO (Register of Legal Entities, ŠÚ SR): legal name, IČO, status, legal form, establishment/termination, address, registration office/number, statutory bodies, stakeholders, successors, red flags. Search by ico (8 digits) or name. Path alias /sk-company/{ico}. Example: {ico:\"31322832\"} (SLOVNAFT) or {name:\"Slovnaft\"}. $0.25.",
  "/be-company": "Use this for a Belgian company lookup from CBE/KBO Public Search: legal name, enterprise number, VAT, status, legal form, seat/address, NACEBEL, directors/functions, capital, characteristics, red flags. Search by enterprise_number (10 digits) or name. Path alias /be-company/{enterprise_number}. Example: {enterprise_number:\"0202239951\"} (Proximus) or {name:\"Proximus\"}. $0.25.",
  "/cz-company": "Use this for a Czech company lookup from ARES (Administrativní registr ekonomických subjektů): legal name, IČO, DIČ, status, legal form, seat/address, CZ-NACE, founded date, optional VR capital/court file, red flags. Search by ico (8 digits) or name. Path alias /cz-company/{ico}. Example: {ico:\"27082440\"} (Alza.cz) or {name:\"Seznam.cz\"}. $0.25.",
  "/fi-company": "Use this for a Finnish company lookup from PRH / Finnish Trade Register (YTJ open data, CC BY 4.0): legal name, Y-tunnus/businessId, status, company form, address, main business line, website, EU ID, registered entries, company situations, red flags. Search by businessId/ytunnus/fi (e.g. 0112038-9) or name. Path alias /fi-company/{businessId}. Example: {businessId:\"0112038-9\"} (Nokia Oyj) or {name:\"Nokia Oyj\"}. $0.25.",
  "/au-company": "Use this for an Australian company lookup from the ASIC register by ACN or ABN: current name, former names, type (proprietary/public…), class, status (registered/deregistered/strike-off/external admin), registration and deregistration dates, ABN. Source: ASIC Company Dataset (data.gov.au, CC BY 3.0 AU), monthly snapshot. Example: {acn:\"009661901\"} (Qantas). $0.02.",
  "/search": "Use this for cheap research search over open sources: Wikipedia + OpenAlex (250M scholarly works) + arXiv + Crossref, merged, deduplicated (DOI/title) and ranked, with snippets, authors, dates, DOIs and citation counts. Not a general web index. Example: {q:\"x402 agent payments\"}. $0.003.",
  "/uk-property": "Use this for UK (England & Wales) house prices around a postcode: HM Land Registry Price Paid sales (address, price, date, type, tenure, new-build) within a radius, plus median overall/last-12m/by type. OGL data. Example: {postcode:\"CB1 2AB\"}. $0.01.",
  "/uk-area": "Use this for a UK postcode profile: ONS geography (LA, ward, constituency, LSOA, codes), lat/lon, police street crime last month by category (~1 mile), and FSA food hygiene rating mix nearby. All OGL. Example: {postcode:\"SW1A 2AA\"}. $0.005.",
  "/uk-charity": "Use this for a cheap UK charity snapshot from the Charity Commission register (England & Wales): status, registration/removal dates, income/spending, trustees count, website, activities. Lookup by registered number or name. OGL v3. Example: {number:\"1089464\"} or {name:\"Cancer Research UK\"}. Upsell /uk-charity-full. $0.05.",
  "/us-sec": "Use this for a cheap US SEC EDGAR company snapshot by ticker or CIK: name, tickers/exchanges, SIC, EIN, addresses, phone, former names, last ~15 filings (form/filed/accession/primaryDocument/reportDate), website. Fair-use EDGAR. Example: {ticker:\"AAPL\"} or {cik:\"320193\"}. Upsell /us-sec-full. $0.05.",
  "/us-sec-full": "Use this for fuller US SEC DD: lite snapshot + key us-gaap companyfacts highlights (Assets, Liabilities, StockholdersEquity, Revenues, NetIncomeLoss, EPS diluted — last reported) + red-flag heuristics (NT 10-K, Item 4.02, bankruptcy/going-concern signals). Example: {ticker:\"AAPL\"}. $0.25.",
  "/eu-vat": "Use this to validate an EU VAT number via official VIES: valid flag, registered name/address when available, requestDate. Input vat like DE123456789 or IE6388047V (or country+number; use EL for Greece). Cached 24h when valid. Example: {vat:\"IE6388047V\"}. $0.01.",
  "/lei": "Use this for a GLEIF Legal Entity Identifier lookup (CC0, no key): lei / name / registered_as (+ optional country). ALWAYS returns parents.direct + parents.ultimate (null if unreported), BIC/mapped ids, legal/hq address, status, jurisdiction. Soft-cached 24h. Path alias /lei/{lei}. Upsell /lei-full $0.05 for up to 10 name matches each with parents. Example: {lei:\"HWUPKR0MPOU8FGXBT394\"}. $0.005.",
  "/lei-full": "Use this to screen a legal name or national reg number against GLEIF: up to 10 ranked candidates, each with parents.direct + parents.ultimate, BIC/ids, jurisdiction/status. Bulk KYB name screening. Single LEI lookups: prefer cheaper /lei $0.005. Example: {name:\"Apple Inc.\",country:\"US\"}. $0.05.",
  "/read-batch": "Use this to read up to 8 public URLs in one call (~$0.0019/url vs $0.002 single): Readability markdown + title/word_count per URL, concurrency 4, ~8s timeout, markdown capped. GET urls=comma-list or POST {urls:[...]}. Preview=1: first 2 URLs. Example: {urls:\"https://example.com,https://example.org\"}. $0.015.",
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
  "/email-check": "Use this to validate an email address before outreach or onboarding: RFC-ish syntax, MX/A via DNS-over-HTTPS, disposable/temp domain heuristics, free-provider and role-account flags, mail-host provider guess, score + verdict. No SMTP probe. Example: {email:\"info@stripe.com\"}. $0.002.",
  "/domain": "Standalone RDAP domain registration lookup: registrar, registered, expires, age_days, status flags. Free upstream (rdap.org / Nominet for .uk). Example: {domain:\"stripe.com\"}. $0.002.",
  "/headers": "HTTP security headers audit for agents: HSTS/CSP/XFO/XCTO/Referrer/Permissions/COOP/CORP/COEP + score (SSRF-safe HEAD→GET). Not a pen-test. Example: {url:\"https://example.com\"} or {domain:\"example.com\"}. $0.001.",
  "/iban": "Offline IBAN validation (ISO 13616 mod-97 + country length). Checksum only — not proof account exists / not sanctions. Path alias /iban/{iban}. Example: {iban:\"GB82WEST12345698765432\"}. $0.001.",
  "/phone": "Offline phone validate (E.164 + country calling-code / national length). Structure only — not HLR/carrier/assigned. Accepts +E.164, 00…, or national+country=. Path alias /phone/{phone}. Example: {phone:\"+447911123456\"} or {phone:\"07911123456\",country:\"GB\"}. $0.001.",
  "/uk-postcode": "Offline UK postcode structural validate (Royal Mail format only — not assigned/deliverable/geocode). Distinct from /uk-area and /uk-property. Path alias /uk-postcode/{postcode}. Example: {postcode:\"SW1A 2AA\"}. $0.001.",
  "/siren": "Offline French SIREN validate (9 digits + Luhn; La Poste 356000000 exception). Not proof assigned. Path alias /siren/{siren}. Example: {siren:\"732829320\"}. $0.001.",
  "/siret": "Offline French SIRET validate (14 digits = SIREN+NIC, Luhn on all 14). Path alias /siret/{siret}. Example: {siret:\"73282932000074\"}. $0.001.",
  "/partita-iva": "Offline Italian Partita IVA validate (11 digits + checksum; optional IT prefix). Soft province_ok. Accepts number=/partita_iva=/partita= as aliases of vat=. Path alias /partita-iva/{vat}. Example: {vat:\"00488410010\"} or {number:\"00488410010\"}. $0.001.",
  "/orgnr": "Offline Swedish organisationsnummer validate (10-digit Luhn from left; 12-digit YYYY form ok). Accepts number= as alias of orgnr=. Path alias /orgnr/{orgnr}. Example: {orgnr:\"556012-5790\"} or {number:\"5560125790\"}. $0.001.",
  "/bn-ca": "Offline Canadian CRA Business Number shape check (9-digit BN or 15-char program account). No check digit. Accepts number=/business_number= as aliases of bn=. Path alias /bn-ca/{bn}. Example: {bn:\"123456789RT0001\"} or {number:\"123456789\"}. $0.001.",
  "/cvr": "Offline Danish CVR validate (8 digits + modulus-11; optional DK prefix). Accepts number=/vat= as aliases of cvr=. Path alias /cvr/{cvr}. Example: {cvr:\"10403782\"} or {number:\"10403782\"}. $0.001.",
  "/fn-at": "Offline Austrian Firmenbuchnummer (FN) validate (1–6 digits + check letter; optional FN prefix / branch). Accepts number=/firmenbuch= as aliases of fn=. Path alias /fn-at/{fn}. Example: {fn:\"FN 575737y\"}. $0.001.",
  "/cin-in": "Offline Indian CIN structural validate (21 chars; no check digit). Accepts number= as alias of cin=. Path alias /cin-in/{cin}. Example: {cin:\"U72200KA2013PTC097389\"}. $0.001.",
  "/kvk-nl": "Offline Dutch KvK (Chamber of Commerce) number validate (8 digits; elfproef informational). Accepts number= as alias of kvk=. Path alias /kvk-nl/{kvk}. Example: {kvk:\"69599084\"}. $0.001.",
  "/hr-de": "Offline German Handelsregister number validate (HRA/HRB/GnR/PR/VR/GsR + number; optional court prefix e.g. 'Amtsgericht München HRB 6684'). Accepts number= as alias of hr=. Path alias /hr-de/{hr}. Example: {hr:\"HRB 6684\"}. $0.001.",
  "/nif-es": "Offline Spanish NIF/NIE/CIF validate (control letter/digit; optional ES prefix). Accepts number=/vat= as aliases of nif=. Path alias /nif-es/{nif}. Example: {nif:\"A28015865\"}. $0.001.",
  "/cnpj": "Offline Brazilian CNPJ validate (14 digits + check digits; punctuation ok). Accepts number= as alias of cnpj=. Path alias /cnpj/{cnpj}. Example: {cnpj:\"33000167000101\"}. $0.001.",
  "/nip-pl": "Offline Polish NIP validate (10-digit modulus-11; optional PL prefix). Accepts number=/vat= as aliases of nip=. Path alias /nip-pl/{nip}. Example: {nip:\"5261040828\"}. $0.001.",
  "/uid-ch": "Offline Swiss UID (CHE-xxx.xxx.xxx) validate (9 digits + check digit; optional MWST/TVA/IVA suffix). Accepts number=/che= as aliases of uid=. Path alias /uid-ch/{uid}. Example: {uid:\"CHE-109.322.551\"}. $0.001.",
  "/meta": "Lightweight page metadata for agents: title, description, canonical, Open Graph + Twitter card tags, favicons, JSON-LD @types, h1/h2. Cheaper/faster than /read when you do not need Markdown body. Example: {url:\"https://example.com\"}. $0.001.",
  "/redirects": "Unwrap URL redirects / short links: follow http(s) Location hops with SSRF guards, return final_url + chain (no body download). Not a malware verdict. Example: {url:\"https://bit.ly/...\"} or {url:\"example.com\"}. $0.001.",
  "/dns": "DNS resolve via Cloudflare DoH: A/AAAA/MX/TXT/NS/CNAME (or single type=). Public DNS only, not authoritative. Accepts domain= as alias of name=. Example: {name:\"example.com\"} or {domain:\"example.com\",type:\"MX\"}. $0.001.",
  "/check": "Use this when vetting a domain's health before outreach or onboarding: DNS (DoH), DNSSEC, TLS/HTTPS, redirects, HSTS, MX/SPF/DMARC + score/issues. Structured JSON beats dig+openssl. Example: {domain:\"stripe.com\"} → {score, issues, email}. $0.001.",
  "/company": "Use this when researching any company from its website domain — not Companies House. Returns sourced tech stack, socials, emails/phones, DNS/MX/SPF/DMARC, RDAP age/registrar, SSL, sitemap, news. No LLM inventing facts. Example: {domain:\"stripe.com\"} → {homepage, tech_stack, contacts, dns, news, sources}. Prefer /uk-company* for UK filings. $0.25.",
  "/uk-company": "Use this for UK due diligence on a Companies House number or name: official API profile, officers, PSCs, filings, charges, insolvency + rule-based red flags (overdue, dissolved, churn, mass-formation office). Sourced JSON. Example: {number:\"00445790\"} or {name:\"TESCO\"}. Prefer /uk-company-lite ($0.05) for status/flags only. $0.50.",
  "/uk-company-lite": "Use this for a cheap UK company snapshot before paying for the full pack: status, SIC, office, compliance overdue, mass-formation check, red-flag names. Example: {number:\"00445790\"} → {name,status,red_flags,compliance}. Upsell: /uk-company for officers/PSC/filings/charges/insolvency. $0.05.",
  "/company-full": "Use this when you have a company website and want registry DD auto-attached in one call ($0.65). Runs /company then soft-attaches UK Companies House, FR Recherche d'entreprises, NO Brreg, DK CVR, FI PRH, CH Zefix, PL KRS, CZ ARES, BE CBE/KBO, AU ASIC, CA Corporations Canada, and UK Charity Commission when domain TLD or page signals (SIREN/orgnr/CVR/Y-tunnus/CHE UID/KRS/NIP/IČO/BE enterprise number/ACN/CH number/etc.) match. Soft-skips with *_skip_reason — never fails the bundle. Example: {domain:\"tesco.com\"} → {company, uk, fr, no, dk, fi, ch, pl, cz, be, au, ca, charity, *_included}. $0.65.",
  "/convert": "Use this when an agent needs PDF/DOCX/HTML/text as clean markdown or plain text (RAG, summarisation). PDF via unpdf; DOCX via mammoth. Example: {url, format:\"markdown\"} → {detected_format, markdown, pages, word_count}. $0.03.",
  "/monitor": "Use this when you need 30 days of hourly page-change alerts to your webhook (pricing pages, status, jobs). Returns id; GET /monitor/:id free. Example POST {url, webhook, selector?}. $1.00/30d.",
  "/uk-leads-lite": "Use this for cheap UK new-incorporation lead lists filtered by SIC and/or location/postcode area (1-7 day lookback). Returns up to 100 companies: number, name, SIC, office, mass-formation flag. No directors. Example: {sic:\"62012\",days:1}. Upsell /uk-leads for directors. $0.25.",
  "/uk-leads": "Use this for UK new-incorporation leads with active director names — filter by SIC/location/postcode_area, 1-7 days, up to 40 companies. Official Companies House data + mass-formation flags. Example: {sic:\"62\",location:\"Manchester\",days:2}. Daily webhook: /uk-leads-feed $25/30d. $1.00.",
  "/uk-leads-feed": "Use this for a 30-day daily webhook of new UK incorporations matching your SIC/location/postcode_area (director-enriched). Deduped. Example POST {sic:\"62012\",webhook:\"https://your.app/hook\"}. Status GET /uk-leads-feed/:id free. $25.00/30d.",
  "/uk-watch": "Use this to watch one UK company for 30 days: hourly Companies House poll of status/officers/filings/PSC/charges → webhook on change. Example POST {number:\"00445790\",webhook:\"https://your.app/hook\"}. GET /uk-watch/:id free. $5.00/30d.",
  "/uk-dd": "Use this for a UK-only due-diligence job: full Companies House pack (profile/officers/PSC/filings/charges/insolvency/red flags) + public sanctions screen (entity + active officers) + optional domain RDAP/website skim → composite trust flag (CLEAR/CAUTION/REVIEW/INSUFFICIENT_DATA). Screening only, not regulated KYC/AML. Between /uk-company ($0.50) and /kyb ($2.50). Path alias /uk-dd/{number}. Example: {number:\"00445790\"} or {name:\"TESCO\",domain:\"tesco.com\"}. $1.00.",
  "/kyb": "Use this for a one-shot agent KYB/due-diligence pack: optional website research + UK Companies House DD and/or Australia ASIC (acn/abn) and/or Canada Corporations Canada (ca_number/bn) and/or France Recherche d'entreprises (siren/siret) and/or Norway Brreg (orgnr) and/or Denmark CVR (cvr) and/or Finland PRH (ytunnus/businessId/fi) and/or Switzerland Zefix (uid/che) and/or Poland KRS (krs/nip/pl) and/or Czech ARES (ico/cz) and/or Belgium CBE/KBO (enterprise_number/be) and/or Slovakia RPO (sk/ico_sk/rpo) and/or US state SOS registries NY/CO/CT/OR/TX (us_state+us_id or us_name) + EU VIES VAT + optional GLEIF LEI (with ownership parents) + public sanctions screen (entity + directors) + director appointment skim (nominee/formation pattern) → composite trust flag (CLEAR/CAUTION/REVIEW/INSUFFICIENT_DATA). Screening only, not a regulated determination. Example: {domain:\"tesco.com\",number:\"00445790\"} or {siren:\"443061841\"} or {orgnr:\"923609016\"} or {cvr:\"24256790\"} or {ytunnus:\"0112038-9\"} or {uid:\"CHE-105.909.036\"} or {krs:\"0000001538\"} or {ico:\"27082440\"} or {enterprise_number:\"0202239951\"} or {sk:\"31322832\"} or {us_state:\"CO\",us_id:\"20211537536\"} or {us_name:\"Etsy Inc\"} or {lei:\"HWUPKR0MPOU8FGXBT394\"}. $2.50.",
  "/sanctions": "Screen a person or entity name against public OFAC SDN/CONS, UK FCDO, UN SC and EU financial sanctions lists. Fuzzy scored matches with list/programme/id/aliases/DOB/nationality. Screening aid only - not a regulated AML/KYC determination. Example: {name:\"BANCO NACIONAL DE CUBA\"}. $0.05.",
  "/sanctions-batch": "Screen up to 50 names against OFAC/UK/UN/EU public sanctions lists. Screening aid only. POST {names:[\"BANCO NACIONAL DE CUBA\",\"Alice Wonderland\"]} or GET ?names=BANCO NACIONAL DE CUBA,Alice Wonderland (comma, ; or | separated; repeated names= also accepted; use ; or JSON when a name contains a comma). $1.00.",
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
  number: { type: "string", description: "UK company number" },
  company_number: { type: "string", description: "Alias of number" },
  webhook: { type: "string", format: "uri" },
}, anyOf: [{ required: ["number", "webhook"] }, { required: ["company_number", "webhook"] }] };
const ukWatchOut = { type: "object", properties: {
  id: { type: "string" }, company_number: { type: "string" }, company_name: {}, webhook: { type: "string" },
  created: { type: "string" }, expires: { type: "string" }, snapshot: { type: "object" }, status_url: { type: "string" } } };
const ukDdIn = { type: "object", properties: {
  number: { type: "string", description: "UK Companies House number, e.g. 00445790" },
  company_number: { type: "string", description: "Alias of number (Companies House field name)" },
  name: { type: "string", description: "Registered company name to search" },
  domain: { type: "string", description: "Optional website domain for RDAP / light website skim" },
}, anyOf: [{ required: ["number"] }, { required: ["company_number"] }, { required: ["name"] }] };
const ukDdOut = { type: "object", properties: {
  product: { type: "string" }, disclaimer: { type: "string" }, uk: {}, sanctions: {}, domain: {}, website: {},
  trust: { type: "object", properties: { flag: { type: "string" }, score: { type: "integer" }, reasons: { type: "array" } } } } };
const kybIn = { type: "object", properties: {
  domain: { type: "string" }, number: { type: "string" }, company_number: { type: "string", description: "Alias of number" }, name: { type: "string" }, vat: { type: "string" },
  country: { type: "string" }, vat_number: { type: "string" }, acn: { type: "string", description: "Australian ACN/ABN" }, ca_number: { type: "string", description: "Canadian corporation number" }, bn: { type: "string", description: "Canadian 9-digit BN" }, lei: { type: "string", description: "Optional 20-char GLEIF LEI (attaches parents)" },
  siren: { type: "string", description: "French SIREN (9 digits)" }, siret: { type: "string", description: "French SIRET (14 digits)" },
  orgnr: { type: "string", description: "Norwegian organisasjonsnummer (9 digits)" },
  cvr: { type: "string", description: "Danish CVR (8 digits, optional DK prefix)" },
  ytunnus: { type: "string", description: "Finnish Y-tunnus / business ID (e.g. 0112038-9)" }, businessId: { type: "string", description: "Alias of ytunnus" }, fi: { type: "string", description: "Alias of ytunnus" },
  uid: { type: "string", description: "Swiss UID (e.g. CHE-105.909.036)" }, che: { type: "string", description: "Alias of uid" }, ch: { type: "string", description: "Alias of uid" },
  krs: { type: "string", description: "Polish KRS (10 digits)" }, nip: { type: "string", description: "Polish NIP (10 digits)" }, pl: { type: "string", description: "Alias of krs" }, ico: { type: "string", description: "Czech IČO (8 digits)" }, cz: { type: "string", description: "Alias of ico" }, enterprise_number: { type: "string", description: "Belgian CBE enterprise number (10 digits)" }, be: { type: "string", description: "Alias of enterprise_number" }, bce: { type: "string", description: "Alias of enterprise_number" }, kbo: { type: "string", description: "Alias of enterprise_number" }, sk: { type: "string", description: "Slovak IČO (8 digits) via RPO" }, ico_sk: { type: "string", description: "Alias of sk" }, rpo: { type: "string", description: "Alias of sk" },
}, description: "Provide domain and/or UK number/name and/or AU/CA/FR/NO/DK/FI/CH/PL/CZ registry ids and/or EU vat and/or lei" };
const kybOut = { type: "object", properties: {
  product: { type: "string" }, disclaimer: { type: "string" }, website: {}, uk: {}, eu_vat: {}, lei: {},
  trust: { type: "object", properties: { flag: { type: "string" }, score: { type: "integer" }, reasons: { type: "array" } } } } };

const OUT: any = { "/email-check": emailCheckOut, "/domain": domainOut, "/dns": dnsOut, "/redirects": redirectsOut, "/meta": metaOut, "/headers": headersOut, "/iban": ibanOut, "/phone": phoneOut, "/uk-postcode": ukPostcodeOut, "/siren": sirenOut, "/siret": siretOut, "/partita-iva": partitaIvaOut, "/orgnr": orgnrOut, "/bn-ca": bnCaOut, "/cvr": cvrOut, "/fn-at": fnAtOut, "/cin-in": cinInOut, "/kvk-nl": kvkNlOut, "/hr-de": hrDeOut, "/nif-es": nifEsOut, "/cnpj": cnpjOut, "/nip-pl": nipPlOut, "/uid-ch": uidChOut,  "/registry-batch": rbOut, "/ca-company": caOut, "/au-company": auOut, "/fr-company": frOut, "/no-company": noOut, "/dk-company": dkOut, "/fi-company": fiOut, "/ch-company": chOut, "/pl-company": plOut, "/cz-company": czOut, "/be-company": beOut, "/sk-company": skOut, "/us-entity": usOut, "/uk-officer": officerOut, "/sanctions": sanctionsOut, "/sanctions-batch": sanctionsBatchOut, "/uk-leads": leadsOut, "/uk-leads-lite": leadsOut, "/uk-leads-feed": leadsFeedOut, "/uk-watch": ukWatchOut, "/uk-dd": ukDdOut, "/kyb": kybOut, "/search": searchOut, "/uk-property": propOut, "/uk-area": areaOut, "/uk-charity": charityOut, "/uk-charity-full": charityFullOut, "/us-sec": secOut, "/us-sec-full": secFullOut, "/eu-vat": vatOut, "/lei": leiOut, "/lei-full": leiFullOut, "/read-batch": readBatchOut, "/ens": ensOut, "/token": tokenMetaOut, "/allowance": allowOut, "/contract": contractOut, "/gas": gasOut, "/block": blockOut, "/nft": nftOut, "/wallet": walletOut, "/tx": txOut, "/token-check": tokenOut, "/fx": fxOut, "/read": readOut, "/links": linksOut, "/check": checkOut, "/company": companyOut, "/uk-company": ukOut, "/uk-company-lite": ukLiteOut, "/company-full": companyFullOut, "/convert": convertOut, "/monitor": monitorOut };
const EX: any = { "/email-check": { email: "info@stripe.com" }, "/domain": { domain: "stripe.com" }, "/dns": { name: "example.com" }, "/redirects": { url: "https://example.com" }, "/meta": { url: "https://example.com" }, "/headers": { url: "https://example.com" }, "/iban": { iban: "GB82WEST12345698765432" }, "/phone": { phone: "+447911123456" }, "/uk-postcode": { postcode: "SW1A 2AA" }, "/siren": { siren: "732829320" }, "/siret": { siret: "73282932000074" }, "/partita-iva": { vat: "00488410010" }, "/orgnr": { orgnr: "556012-5790" }, "/bn-ca": { bn: "123456789RT0001" }, "/cvr": { cvr: "10403782" }, "/fn-at": { fn: "FN 575737y" }, "/cin-in": { cin: "U72200KA2013PTC097389" }, "/kvk-nl": { kvk: "69599084" }, "/hr-de": { hr: "HRB 6684" }, "/nif-es": { nif: "A28015865" }, "/cnpj": { cnpj: "33000167000101" }, "/nip-pl": { nip: "5261040828" }, "/uid-ch": { uid: "CHE-109.322.551" }, "/registry-batch": { uk: "00445790", au: "009661901,004028077", ca: "8660115", fr: "443061841", no: "923609016", dk: "24256790", fi: "0112038-9", ch: "CHE-105.909.036", pl: "0000001538", cz: "27082440", be: "0202239951", sk: "31322832" }, "/ca-company": { number: "8660115" }, "/au-company": { acn: "009661901" }, "/fr-company": { siren: "443061841" }, "/no-company": { orgnr: "923609016" }, "/dk-company": { cvr: "24256790" }, "/fi-company": { businessId: "0112038-9" }, "/ch-company": { uid: "CHE-105.909.036" }, "/pl-company": { krs: "0000001538" }, "/cz-company": { ico: "27082440" }, "/be-company": { enterprise_number: "0202239951" }, "/sk-company": { ico: "31322832" }, "/us-entity": { name: "Etsy Inc" }, "/uk-officer": { name: "Ken Olisa", limit: 10 }, "/sanctions": { name: "BANCO NACIONAL DE CUBA" }, "/sanctions-batch": { names: ["BANCO NACIONAL DE CUBA", "Alice Wonderland"] }, "/uk-leads": { sic: "62012", days: 1, limit: 25 }, "/uk-leads-lite": { sic: "62", location: "London", days: 1 }, "/uk-leads-feed": { sic: "62012", webhook: "https://api.axiomworks.co.uk/hooks/sink" }, "/uk-watch": { number: "00445790", webhook: "https://api.axiomworks.co.uk/hooks/sink" }, "/uk-dd": { number: "00445790" }, "/kyb": { domain: "tesco.com", number: "00445790" }, 
  "/search": { q: "x402 agent payments" }, "/uk-property": { postcode: "CB1 2AB" }, "/uk-area": { postcode: "SW1A 2AA" },
  "/uk-charity": { number: "1089464" }, "/uk-charity-full": { number: "1089464" },
  "/us-sec": { ticker: "AAPL" }, "/us-sec-full": { ticker: "AAPL" }, "/eu-vat": { vat: "IE6388047V" },
  "/lei": { lei: "HWUPKR0MPOU8FGXBT394" }, "/lei-full": { name: "Apple Inc.", country: "US" }, "/read-batch": { urls: "https://example.com,https://example.org" },
  "/ens": { name: "vitalik.eth" }, "/token": { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" },
  "/allowance": { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", owner: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", spender: "0x000000000022D473030F116dDEE9F6B43aC78BA3", chain: "base" },
  "/contract": { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" }, "/gas": { chain: "base" }, "/block": { timestamp: "2026-01-01T00:00:00Z", chain: "base" },
  "/nft": { contract: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D", token_id: "1", chain: "ethereum" },
  "/wallet": { address: "0x88b1c747c33A5868A34057D8C57318E5602b3ff6", chain: "base" }, "/tx": { hash: "0x0000000000000000000000000000000000000000000000000000000000000000", chain: "base" },
  "/token-check": { address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", chain: "base" }, "/fx": { base: "GBP", symbols: "USD,EUR", amount: "100" },
  "/read": { url: "https://example.com" }, "/links": { url: "https://example.com" }, "/check": { domain: "example.com" },
  "/company": { domain: "stripe.com" }, "/uk-company": { number: "00445790" }, "/uk-company-lite": { number: "00445790" }, "/company-full": { domain: "tesco.com" },
  "/convert": { url: "https://pdfobject.com/pdf/sample.pdf", format: "markdown" },
  "/monitor": { url: "https://example.com", webhook: "https://api.axiomworks.co.uk/hooks/sink" },
};
const IN: any = { "/email-check": emailCheckIn, "/domain": domainIn, "/dns": dnsIn, "/redirects": urlIn, "/meta": urlIn, "/headers": headersIn, "/iban": ibanIn, "/phone": phoneIn, "/uk-postcode": ukPostcodeIn, "/siren": sirenIn, "/siret": siretIn, "/partita-iva": partitaIvaIn, "/orgnr": orgnrIn, "/bn-ca": bnCaIn, "/cvr": cvrIn, "/fn-at": fnAtIn, "/cin-in": cinInIn, "/kvk-nl": kvkNlIn, "/hr-de": hrDeIn, "/nif-es": nifEsIn, "/cnpj": cnpjIn, "/nip-pl": nipPlIn, "/uid-ch": uidChIn,  "/registry-batch": rbIn, "/ca-company": caIn, "/au-company": auIn, "/fr-company": frIn, "/no-company": noIn, "/dk-company": dkIn, "/fi-company": fiIn, "/ch-company": chIn, "/pl-company": plIn, "/cz-company": czIn, "/be-company": beIn, "/sk-company": skIn, "/us-entity": usIn, "/uk-officer": officerIn, "/sanctions": sanctionsIn, "/sanctions-batch": sanctionsBatchIn, "/uk-leads": leadsIn, "/uk-leads-lite": leadsIn, "/uk-leads-feed": leadsFeedIn, "/uk-watch": ukWatchIn, "/uk-dd": ukDdIn, "/kyb": kybIn, "/search": searchIn, "/uk-property": pcIn, "/uk-area": areaIn, "/uk-charity": charityIn, "/uk-charity-full": charityIn, "/us-sec": secIn, "/us-sec-full": secIn, "/eu-vat": vatIn, "/lei": leiIn, "/lei-full": leiFullIn, "/read-batch": readBatchIn, "/ens": ensIn, "/token": tokenMetaIn, "/allowance": allowIn, "/contract": contractIn, "/gas": gasIn, "/block": blockIn, "/nft": nftIn, "/wallet": walletIn, "/tx": txIn, "/token-check": tokenIn, "/fx": fxIn, "/read": urlIn, "/links": urlIn, "/check": checkIn, "/company": companyIn, "/uk-company": ukIn, "/uk-company-lite": ukLiteIn, "/company-full": companyFullIn, "/convert": convertIn, "/monitor": monitorIn };
const METHODS: Record<string, ("GET" | "POST")[]> = {
  "/read": ["GET", "POST"], "/links": ["GET", "POST"], "/check": ["GET", "POST"], "/email-check": ["GET", "POST"], "/domain": ["GET", "POST"], "/dns": ["GET", "POST"], "/redirects": ["GET", "POST"], "/meta": ["GET", "POST"], "/headers": ["GET", "POST"], "/iban": ["GET", "POST"], "/phone": ["GET", "POST"], "/uk-postcode": ["GET", "POST"], "/siren": ["GET", "POST"], "/siret": ["GET", "POST"], "/partita-iva": ["GET", "POST"], "/orgnr": ["GET", "POST"], "/bn-ca": ["GET", "POST"], "/cvr": ["GET", "POST"], "/fn-at": ["GET", "POST"], "/cin-in": ["GET", "POST"], "/kvk-nl": ["GET", "POST"], "/hr-de": ["GET", "POST"], "/nif-es": ["GET", "POST"], "/cnpj": ["GET", "POST"], "/nip-pl": ["GET", "POST"], "/uid-ch": ["GET", "POST"],
  "/company": ["GET", "POST"], "/uk-company": ["GET", "POST"], "/uk-company-lite": ["GET", "POST"], "/company-full": ["GET", "POST"], "/convert": ["GET", "POST"],
  "/monitor": ["POST"],
  "/wallet": ["GET", "POST"], "/tx": ["GET", "POST"], "/token-check": ["GET", "POST"], "/fx": ["GET", "POST"],
  "/ens": ["GET", "POST"], "/token": ["GET", "POST"], "/allowance": ["GET", "POST"], "/contract": ["GET", "POST"], "/gas": ["GET", "POST"], "/block": ["GET", "POST"], "/nft": ["GET", "POST"],
  "/search": ["GET", "POST"], "/uk-property": ["GET", "POST"], "/uk-area": ["GET", "POST"],
  "/uk-charity": ["GET", "POST"], "/uk-charity-full": ["GET", "POST"],
  "/us-sec": ["GET", "POST"], "/us-sec-full": ["GET", "POST"], "/eu-vat": ["GET", "POST"],
  "/lei": ["GET", "POST"], "/lei-full": ["GET", "POST"], "/read-batch": ["GET", "POST"],
  "/uk-leads": ["GET", "POST"], "/uk-leads-lite": ["GET", "POST"], "/uk-leads-feed": ["POST"], "/uk-watch": ["POST"], "/uk-dd": ["GET", "POST"], "/kyb": ["GET", "POST"],
  "/sanctions": ["GET", "POST"], "/sanctions-batch": ["GET", "POST"],
  "/uk-officer": ["GET", "POST"],
  "/au-company": ["GET", "POST"],
  "/ca-company": ["GET", "POST"],
  "/fr-company": ["GET", "POST"],
  "/no-company": ["GET", "POST"],
  "/dk-company": ["GET", "POST"],
  "/fi-company": ["GET", "POST"],
  "/ch-company": ["GET", "POST"],
  "/pl-company": ["GET", "POST"],
  "/cz-company": ["GET", "POST"],
  "/be-company": ["GET", "POST"],
  "/sk-company": ["GET", "POST"],
  "/us-entity": ["GET", "POST"],
  "/registry-batch": ["GET", "POST"],
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

// 2026-11-06 directive: $0.001 offline format validators stay callable over HTTP but are unlisted from discovery/MCP.
export const UNLISTED = new Set(["/phone","/uk-postcode","/iban","/siren","/siret","/partita-iva","/orgnr","/bn-ca","/cvr","/fn-at","/cin-in","/kvk-nl","/hr-de","/nif-es","/cnpj","/nip-pl","/uid-ch"]);
const LISTED_PRICES = () => Object.entries(PRICES).filter(([p]) => !UNLISTED.has(p));
function base(_c: any) { return CANONICAL; }
function discovery(c: any) {
  const b = base(c);
  return { x402Version: 2, name: "Axiom Works AgentReader", description: "Pay-per-call web reading, KYB packs, UK due diligence, company research, UK company/charity + US SEC EDGAR + EU VAT (VIES) + sanctions screening due diligence, document conversion, change monitoring, EVM wallet/tx/token checks and FX rates for AI agents. USDC on Base via x402.",
    resources: LISTED_PRICES().map(([p]) => p).map((p) => `${b}${p}`),
    items: LISTED_PRICES().map(([p, price]) => ({ resource: `${b}${p}`, methods: METHODS[p], description: DESC[p], mimeType: "application/json",
      accepts: [{ scheme: "exact", network: NETWORK, amount: String(ATOMIC[p]), price, asset: USDC, payTo: c.env.PAY_TO, maxTimeoutSeconds: 120, extra: { name: "USD Coin", version: "2" } }],
      input: { type: "http", method: METHODS[p][0], queryParams: IN[p] }, output: OUT[p] })),
    contact: CONTACT, ownershipProofs: [] };
}

app.get("/health", (c) => c.json({ ok: true, version: "1.41.1", ts: new Date().toISOString() }));
// Crawler/agent hygiene: robots.txt + favicon (agent.json iconUrl points here). Previously 404 for ~100 crawler hits / 6h.
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b1220"/><path d="M18 48 L32 14 L46 48 M23.5 36 H40.5" fill="none" stroke="#3b82f6" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const favicon = (c: any) => { c.header("content-type", "image/svg+xml"); c.header("cache-control", "public, max-age=604800"); return c.body(FAVICON_SVG); };
app.get("/favicon.ico", favicon); app.get("/favicon.svg", favicon);
app.get("/favicon.png", (c) => c.redirect("/favicon.svg", 301));
app.get("/robots.txt", (c) => { const b = base(c); c.header("cache-control", "public, max-age=86400"); return c.text(`# AgentReader by Axiom Works — x402 pay-per-call APIs for agents (USDC on Base)\nUser-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /hooks/\n\n# Machine-readable discovery:\n# ${b}/llms.txt\n# ${b}/openapi.json\n# ${b}/.well-known/x402\n# ${b}/.well-known/agent.json\n# MCP: ${b}/mcp\n`); });

app.get("/.well-known/x402", (c) => c.json(discovery(c)));
app.get("/.well-known/x402.json", (c) => c.json(discovery(c)));
app.get("/.well-known/402index-verify.txt", (c) => c.text("9a944a1ce3c68588c5fb1d104be63981bb5e6b6e302fa0a1bd65b6a3cd5f5372"));
app.get("/.well-known/x402list.txt", (c) => c.text("x402list-verify-xS90Dr23BVuxDNiAyIixsofh77huTTGyjkKHySrsmk4\n"));
app.get("/.well-known/agent-card.json", (c) => {
  const b = base(c);
  const tags = (p: string) => p.startsWith("/uk") ? ["uk", "companies-house", "due-diligence", "x402"] : p.startsWith("/us-sec") ? ["sec", "edgar", "filings", "x402"] : (p === "/sanctions" || p === "/sanctions-batch") ? ["sanctions", "compliance", "aml", "x402"] : (p === "/kyb" || p === "/eu-vat" || p === "/lei" || p === "/lei-full" || p === "/fr-company" || p === "/no-company" || p === "/dk-company" || p === "/fi-company" || p === "/ch-company" || p === "/pl-company" || p === "/cz-company" || p === "/be-company" || p === "/sk-company" || p === "/us-entity") ? ["kyb", "lei", "compliance", "x402", "registry"] : ["/read", "/links", "/check", "/convert", "/monitor", "/search", "/company", "/company-full", "/read-batch", "/meta", "/headers", "/iban", "/phone", "/uk-postcode", "/siren", "/siret", "/partita-iva", "/orgnr", "/bn-ca", "/cvr", "/fn-at", "/cin-in", "/kvk-nl", "/hr-de", "/nif-es", "/cnpj", "/nip-pl", "/uid-ch", "/redirects", "/dns", "/domain", "/email-check"].includes(p) ? ["web", "research", "x402"] : ["onchain", "base", "evm", "x402"];
  return c.json({
    protocolVersion: "0.3.0", name: "Axiom Works AgentReader",
    description: "Pay-per-call (x402, USDC on Base) UK Companies House, KYB, SEC EDGAR, EU VAT, web-to-markdown and EVM on-chain lookups for AI agents. HTTP + MCP; no API keys.",
    url: b, preferredTransport: "HTTP+JSON", version: "1.41.1", documentationUrl: `${b}/llms.txt`, iconUrl: `${b}/favicon.ico`,
    provider: { organization: "Axiom Works", url: "https://axiomworks.co.uk" },
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
    defaultInputModes: ["application/json"], defaultOutputModes: ["application/json"],
    skills: LISTED_PRICES().map(([p, price]) => ({ id: p.slice(1), name: p, description: `${DESC[p]} Price ${price} USDC via x402 at ${b}${p}.`, tags: tags(p), inputModes: ["application/json"], outputModes: ["application/json"], examples: [JSON.stringify(EX[p] || {})] })),
    metadata: { mcp: `${b}/mcp`, openapi: `${b}/openapi.json`, x402: `${b}/.well-known/x402`, payments: { protocol: "x402", network: NETWORK, asset: USDC, payTo: c.env.PAY_TO }, github: "https://github.com/grokbot1233/agentreader" },
  });
});
app.get("/.well-known/agent.json", (c) => {
  const b = base(c);
  return c.json({
    name: "Axiom Works AgentReader", description: "x402 pay-per-call web reader, KYB packs, UK due diligence, company research, UK Companies House + Charity Commission + US SEC EDGAR + EU VIES VAT + OFAC/UK/UN/EU sanctions screening due diligence, document conversion, change monitoring, EVM wallet/tx/token risk checks and ECB FX rates for AI agents.",
    url: b, provider: { organization: "Axiom Works", url: "https://axiomworks.co.uk", email: CONTACT },
    version: "1.41.1", documentationUrl: `${b}/llms.txt`, openapi: `${b}/openapi.json`,
    skills: LISTED_PRICES().map(([p, price]) => ({ id: p.slice(1), name: p, description: DESC[p], price, endpoint: `${b}${p}` })),
    mcp: `${b}/mcp`, payments: { protocol: "x402", network: NETWORK, asset: USDC, payTo: c.env.PAY_TO },
  });
});
app.get("/.well-known/mcp.json", (c) => {
  const b = base(c);
  return c.json({ name: "io.github.axiomworks/agentreader", title: "Axiom Works AgentReader", version: "1.41.1",
    description: "x402 pay-per-call MCP: KYB, UK due diligence, UK/AU/CA registries, web reader, SEC, VAT, sanctions, EVM chain data.",
    transport: { type: "streamable-http", url: `${b}/mcp` }, documentationUrl: `${b}/llms.txt`, openapi: `${b}/openapi.json`,
    payments: { protocol: "x402", network: NETWORK, asset: USDC } });
});
app.get("/sitemap.xml", (c) => {
  const b = base(c);
  const urls = ["/", "/llms.txt", "/openapi.json", "/.well-known/x402", "/.well-known/agent.json", "/.well-known/mcp.json", ...LISTED_PRICES().map(([p]) => p)];
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${b}${u}</loc></url>`).join("")}</urlset>`, 200, { "content-type": "application/xml" });
});
const ALIAS_DOCS: [string, string, string[]][] = [
  ["/tx/{hash}", "/tx", ["hash"]], ["/ens/{name}", "/ens", ["name"]], ["/contract/{address}", "/contract", ["address"]],
  ["/wallet/{address}", "/wallet", ["address"]], ["/address/{address}", "/wallet", ["address"]], ["/token/{address}", "/token", ["address"]],
  ["/token-check/{address}", "/token-check", ["address"]], ["/block/{number}", "/block", ["number"]], ["/nft/{contract}/{token_id}", "/nft", ["contract", "token_id"]],
  ["/gas/{chain}", "/gas", ["chain"]], ["/check/{domain}", "/check", ["domain"]], ["/domain/{domain}", "/domain", ["domain"]], ["/dns/{name}", "/dns", ["name"]], ["/email-check/{email}", "/email-check", ["email"]], ["/meta/{url}", "/meta", ["url"]], ["/uk-company/{number}", "/uk-company", ["number"]], ["/uk-dd/{number}", "/uk-dd", ["number"]],
  ["/uk-charity/{number}", "/uk-charity", ["number"]], ["/us-sec/{ticker}", "/us-sec", ["ticker"]], ["/eu-vat/{vat}", "/eu-vat", ["vat"]], ["/lei/{lei}", "/lei", ["lei"]], ["/au-company/{acn}", "/au-company", ["acn"]], ["/ca-company/{number}", "/ca-company", ["number"]], ["/fr-company/{siren}", "/fr-company", ["siren"]], ["/no-company/{orgnr}", "/no-company", ["orgnr"]], ["/dk-company/{cvr}", "/dk-company", ["cvr"]], ["/fi-company/{businessId}", "/fi-company", ["businessId"]], ["/ch-company/{uid}", "/ch-company", ["uid"]], ["/pl-company/{krs}", "/pl-company", ["krs"]], ["/cz-company/{ico}", "/cz-company", ["ico"]], ["/be-company/{enterprise_number}", "/be-company", ["enterprise_number"]], ["/sk-company/{ico}", "/sk-company", ["ico"]], ["/us-entity/{state}/{id}", "/us-entity", ["state", "id"]],
];
app.get("/openapi.json", (c) => {
  const b = base(c); const paths: any = {};
  for (const [p, price] of LISTED_PRICES()) {
    const params = Object.entries(IN[p].properties || {}).map(([k, v]: any) => ({
      name: k, in: "query", required: (IN[p].required || []).includes(k), schema: { type: "string" }, description: v.description,
    }));
    const pex = (PAID_EXAMPLES as any)[p]; const resp = { "200": { description: "Success", content: { "application/json": pex ? { schema: OUT[p], example: pex } : { schema: OUT[p] } } }, "402": { description: `Payment required: ${price} USDC on Base (x402 v2, see PAYMENT-REQUIRED header)` }, "400": { description: "Bad input" } };
    paths[p] = {};
    const payInfo = { mode: "fixed", currency: "USD", amount: price.replace("$", ""), network: NETWORK, asset: USDC, payTo: c.env.PAY_TO, amountAtomic: String(ATOMIC[p]) };
    if (METHODS[p].includes("GET")) paths[p].get = { summary: DESC[p], parameters: params, responses: resp, "x-price": price, "x-payment-info": payInfo, "x-402": { network: NETWORK, asset: USDC, amount: String(ATOMIC[p]) }, "x-buyer-sheet": `${b}/buy${p}` };
    if (METHODS[p].includes("POST")) paths[p].post = { summary: DESC[p], requestBody: { content: { "application/json": { schema: IN[p] } } }, responses: resp, "x-price": price, "x-payment-info": payInfo, "x-402": { network: NETWORK, asset: USDC, amount: String(ATOMIC[p]) } };
  }
  paths["/uk-leads-feed/{id}"] = { get: { summary: "Free UK leads-feed status (id is the secret)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Feed status" }, "404": { description: "Not found" } }, "x-price": "free" } };
  paths["/uk-watch/{id}"] = { get: { summary: "Free UK company-watch status (id is the secret)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Watch status" }, "404": { description: "Not found" } }, "x-price": "free" } };
  paths["/monitor/{id}"] = { get: { summary: "Free monitor status (id is the secret)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Monitor status" }, "404": { description: "Not found" } }, "x-price": "free" } };
  paths["/samples/{kind}"] = { get: { summary: "Free truncated sample (rate-limited 8/IP/day) with x402 upsell", parameters: [{ name: "kind", in: "path", required: true, schema: { type: "string", enum: ["read","links","check","company","uk-company","uk-company-lite","convert","company-full","uk-charity","uk-charity-full","us-sec","us-sec-full","eu-vat","lei","lei-full","read-batch","uk-leads","uk-leads-lite","kyb","uk-dd","uk-watch","email-check","domain","dns","redirects","meta","headers","iban","phone","uk-postcode","siren","siret","partita-iva","orgnr","bn-ca","cvr","fn-at","cin-in","kvk-nl","hr-de","nif-es","cnpj","nip-pl","uid-ch","au-company","ca-company","fr-company","no-company","dk-company","fi-company","ch-company","pl-company","cz-company","be-company","sk-company","uk-officer","uk-property","uk-area","sanctions","sanctions-batch"] } }], responses: { "200": { description: "Truncated sample" }, "429": { description: "Preview quota exceeded" } }, "x-price": "free" } };
  for (const [ap, to, ks] of ALIAS_DOCS) { const price = PRICES[to];
    paths[ap] = { get: { summary: `Path alias of ${to} (same price/x402 challenge). ${DESC[to] || ""}`, parameters: [...ks.map((k) => ({ name: k, in: "path", required: true, schema: { type: "string" } })), { name: "chain", in: "query", required: false, schema: { type: "string" } }, { name: "preview", in: "query", required: false, schema: { type: "string", enum: ["1"] } }],
      responses: { "200": { description: "Success", content: { "application/json": { schema: OUT[to] } } }, "402": { description: `Payment required: ${price} USDC on Base (x402)` } }, "x-price": price, "x-alias-of": to } }; }
  paths["/hooks/sink"] = { post: { summary: "Free webhook test sink for /monitor", responses: { "200": { description: "Stored" } }, "x-price": "free" } };
  return c.json({ openapi: "3.1.0", info: { title: "Axiom Works AgentReader", version: "1.41.1", contact: { email: CONTACT, url: "https://github.com/grokbot1233/agentreader" }, description: "x402 pay-per-call APIs for AI agents: KYB packs, UK due diligence, company research, UK/AU/CA/FR/NO/DK/FI/CH/PL/CZ/BE/SK registries, LEI, sanctions, SEC EDGAR, VIES VAT, web reading, document conversion, change monitoring, EVM/FX. Big hitters first (/kyb, /uk-dd, /uk-company, /uk-watch, /uk-leads, /company-full, /sanctions-batch). Payments: USDC on Base mainnet (eip155:8453)." },
    servers: [{ url: b }], paths });
});
const llms = (b: string, payTo: string) => `# Axiom Works AgentReader

> Pay-per-call tools for AI agents. No API keys: x402 (HTTP 402) + USDC on Base (eip155:8453), payTo ${payTo}.
> Free truncated samples: ${b}/samples/{read|links|check|company|company-full|uk-company|uk-company-lite|convert|uk-charity|uk-charity-full|us-sec|us-sec-full|eu-vat|lei|lei-full|read-batch|uk-leads|uk-leads-lite|kyb|uk-dd|uk-watch|email-check|domain|dns|redirects|meta|headers|au-company|ca-company|fr-company|no-company|dk-company|fi-company|ch-company|pl-company|cz-company|be-company|sk-company|uk-officer|uk-property|uk-area|sanctions|sanctions-batch} (8/IP/day). Or add &preview=1 on paid GETs (same limit).

## Buy with confidence (free, no quota)
Buyer sheet per endpoint = exact price in USDC + atomic units (6 decimals), network (Base mainnet, eip155:8453 / v1 "base"), asset, payTo, example call, free preview, inputs, and the expected PAID response shape: ${b}/buy (index), e.g. ${b}/buy/uk-company ($0.50 = 500000 atomic), ${b}/buy/kyb ($2.50 = 2500000), ${b}/buy/uk-dd ($1.00 = 1000000).
You are only charged on HTTP 2xx: 4xx/5xx responses are never settled. Every 402 body also carries a "pricing" block with the same fields.

## Big hitters (start here)

| Need | Endpoint | Price |
|---|---|---|
| One-shot agent KYB pack (UK/AU/CA/FR/NO/DK/FI/CH/PL/CZ/BE registry + VAT + website + sanctions + LEI) | ${b}/kyb?number=00445790 | $2.50 |
| UK due-diligence job (full Companies House pack + sanctions on entity and officers) | ${b}/uk-dd?number=00445790 | $1.00 |
| UK company watch (hourly status/officers/filings/PSC/charges → webhook) | POST ${b}/uk-watch | $5.00/30d |
| UK leads search by SIC/area | ${b}/uk-leads?sic=62012 | $1.00 |
| UK leads daily webhook feed | POST ${b}/uk-leads-feed | $25.00/30d |
| UK company full report | ${b}/uk-company?number=00445790 | $0.50 |
| Company research from a domain | ${b}/company?domain=stripe.com | $0.25 |
| Company research + multi-registry pack (UK/FR/NO/DK/FI/CH/PL/CZ/AU/CA/charity when signals match) | ${b}/company-full?domain=tesco.com | $0.65 |
| Sanctions batch (OFAC/UK/UN/EU) | POST ${b}/sanctions-batch | $1.00 |
| UK charity full (trustees + 5y financials + red flags) | ${b}/uk-charity-full?number=1089464 | $0.25 |
| French company (SIREN/SIRET/name → dirigeants + siège + NAF) | ${b}/fr-company?siren=443061841 | $0.25 |
| Norwegian company (orgnr/name → Brreg status + NACE + address) | ${b}/no-company?orgnr=923609016 | $0.25 |
| Danish company (CVR/name → status + industry + directors/owners) | ${b}/dk-company?cvr=24256790 | $0.25 |
| Finnish company (Y-tunnus/name → status + form + business line) | ${b}/fi-company?businessId=0112038-9 | $0.25 |
| Swiss company (UID/name → status + form + seat + SHAB) | ${b}/ch-company?uid=CHE-105.909.036 | $0.25 |
| Polish company (KRS/NIP → status + form + seat + PKD + representation) | ${b}/pl-company?krs=0000001538 | $0.25 |
| Czech company (IČO/name → status + form + seat + NACE) | ${b}/cz-company?ico=27082440 | $0.25 |
| Belgian company (enterprise number/name → status + form + seat + NACE) | ${b}/be-company?enterprise_number=0202239951 | $0.25 |
| Slovak company (IČO/name → status + form + seat + RPO) | ${b}/sk-company?ico=31322832 | $0.25 |
| US state business entity (NY/CO/CT/OR/TX SOS: status, type, formed, agent) | ${b}/us-entity?name=Etsy%20Inc | $0.25 |
| UK+AU+CA+FR+NO+DK+FI+CH+PL+CZ+BE+SK registry batch (up to 25) | ${b}/registry-batch?uk=00445790&au=004028077&ca=8660115&fr=443061841&no=923609016&dk=24256790&fi=0112038-9&ch=CHE-105.909.036&pl=0000001538&cz=27082440&be=0202239951&sk=31322832 | $0.30 |
| UK officer search + appointments | ${b}/uk-officer?name=Ken+Olisa | $0.15 |

Supporting real-data checks: /uk-company-lite, /uk-charity, /sanctions, /au-company, /ca-company, /us-sec, /lei-full, /eu-vat.

## When to use which (pick one)

| Need | Endpoint | Price | Why ours |
|---|---|---|---|
| Page → Markdown | ${b}/read?url= | $0.002 | Readability + metadata JSON, not raw HTML |
| Batch page → Markdown | ${b}/read-batch?urls= | $0.015 | Up to 8 URLs (~$0.0019/url) |
| Links only | ${b}/links?url= | $0.001 | Cheaper than /read |
| Domain health | ${b}/check?domain= | $0.001 | DNS/TLS/MX/SPF/DMARC + score |
| Email check | ${b}/email-check?email=info@stripe.com | $0.002 | Syntax + MX/A + disposable/free/role flags (free: &preview=1) |
| Domain registration (RDAP) | ${b}/domain?domain=stripe.com | $0.002 | Registrar, registered, expires, age_days, status (free: &preview=1) |
| DNS resolve | ${b}/dns?name=example.com | $0.001 | A/AAAA/MX/TXT/NS/CNAME via Cloudflare DoH (free: &preview=1; optional type=) |
| Redirects unwrap | ${b}/redirects?url= | $0.001 | Follow Location hops → final_url + chain (SSRF-safe; free: &preview=1) |
| Page metadata | ${b}/meta?url= | $0.001 | Title/description/canonical/OG/Twitter/favicons/JSON-LD types (free: &preview=1) |
| HTTP security headers | ${b}/headers?url= | $0.001 | HSTS/CSP/XFO/XCTO/… + score (SSRF-safe; free: &preview=1) |
| Website company research | ${b}/company?domain= | $0.25 | Sourced tech/contacts/DNS/RDAP/news (no LLM fiction) |
| UK CH full DD | ${b}/uk-company?number=\|name= | $0.50 | Official API: officers/PSC/filings/charges/insolvency + red flags |
| UK officer search | ${b}/uk-officer?name= | $0.15 | Reverse officer name → appointments + high-appt/mass-formation flags |
| UK CH cheap snapshot | ${b}/uk-company-lite?number=\|name= | $0.05 | Status + compliance flags; upsell full pack |
| Website + multi-registry DD bundle | ${b}/company-full?domain= | $0.65 | Auto-attaches UK/FR/NO/DK/FI/CH/PL/CZ/AU/CA/charity when TLD/page signals match |
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
| GLEIF LEI | ${b}/lei?lei=HWUPKR0MPOU8FGXBT394 | $0.005 | LEI + parents.direct/ultimate + BIC (CC0) |
| GLEIF LEI search | ${b}/lei-full?name=Apple%20Inc. | $0.05 | Up to 10 name matches each with parents |
| Batch web read | ${b}/read-batch?urls=https://example.com,https://example.org | $0.015 | Up to 8 URLs Markdown (~$0.0019/url) |
| FX rates (ECB) | ${b}/fx?base=GBP&symbols=USD | $0.002 | Official ECB rates, history, conversion |
| **Single-fact EVM (5 chains, $0.001–0.003)** | ${b}/chain/{erc20-balance,balance,live-balance,block-number,nonce,total-supply,erc20-transfers,events,network-info,receipt,code,call,estimate-gas,nft-owner,nft-metadata,erc721-tokens,erc1155-balance,storage,proxy,chain-id,pending} | $0.001–0.003 | One answer per call, Base/Ethereum/Arbitrum/Optimism/Polygon; see /openapi.json |
| UK new cos (lite) | ${b}/uk-leads-lite?sic=&location= | $0.25 | New incorporations 1-7d, no directors |
| UK new cos + directors | ${b}/uk-leads?sic=&location= | $1.00 | + active officer names, mass-formation flags |
| UK leads daily feed | POST ${b}/uk-leads-feed | $25.00/30d | Daily webhook of new matches |
| UK company watch | POST ${b}/uk-watch | $5.00/30d | Hourly CH status/officers/filings/PSC/charges → webhook |
| UK DD job | ${b}/uk-dd?number=00445790 (optional name=/domain=) | $1.00 | Full CH pack + sanctions (entity+officers) + optional RDAP/website → trust flag. Free preview: ${b}/uk-dd?number=00445790&preview=1 |
| Agent KYB pack | ${b}/kyb?number=00445790 (or acn=/ca_number=/siren=/orgnr=/cvr=/ytunnus=/uid=/krs=/nip=/ico=/cz=/enterprise_number=/be=/vat=/domain=) | $2.50 | UK/AU/CA/FR/NO/DK/FI/CH/PL/CZ/BE + VAT + website + sanctions + director appointments + trust flag. Free preview: ${b}/kyb?number=00445790&preview=1 (lite UK + entity sanctions; pay for full pack) |
| French company | ${b}/fr-company?siren=443061841 (or siret=/name=) | $0.25 | Official Recherche d'entreprises: name, status, NAF, siège, dirigeants, finances. Free preview: ${b}/fr-company?siren=443061841&preview=1 |
| Norwegian company | ${b}/no-company?orgnr=923609016 (or name=) | $0.25 | Brønnøysundregistrene Enhetsregisteret: name, status/konkurs, orgform, NACE, address, ansatte. Free preview: ${b}/no-company?orgnr=923609016&preview=1 |
| Danish company | ${b}/dk-company?cvr=24256790 (or name=) | $0.25 | CVR via apicvr.dk / Erhvervsstyrelsen: name, status, type, address, industry, employees, direktion/ejere. Free preview: ${b}/dk-company?cvr=24256790&preview=1 |
| Sanctions screen | ${b}/sanctions?name= | $0.05 | OFAC SDN/CONS + UK FCDO + UN SC + EU FSF fuzzy |
| Sanctions batch | POST ${b}/sanctions-batch | $1.00 | Up to 50 names |
| AU company | GET ${b}/au-company?acn=009661901 | $0.02 | ASIC register, ~4M cos (free: &preview=1) |
| CA company | GET ${b}/ca-company?number=8660115 | $0.02 | Corporations Canada, ~697k federal corps (free: &preview=1) |
| UK+AU+CA+FR+NO+DK+FI+CH+PL+CZ+BE+SK batch | GET ${b}/registry-batch?uk=00445790&au=009661901&ca=8660115&fr=443061841&no=923609016&dk=24256790&fi=0112038-9&ch=CHE-105.909.036&pl=0000001538&cz=27082440&be=0202239951&sk=31322832 | $0.30 | Up to 25 company IDs (UK max 10) |
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

Explorer-style path aliases (same price + x402 challenge as the canonical route): ${ALIAS_DOCS.map(([a, t]) => `${b}${a} (= ${t})`).join(", ")}. Add ?chain=base|ethereum|... as needed.

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
      cur.test_revenue_usdc = Math.round(((cur.test_revenue_usdc || 0) + Number(rec.amount || 0) / 1e6) * 1e6) / 1e6;
    } else {
      const a = Number(rec.amount || 0);
      cur.paid_calls = (cur.paid_calls || 0) + 1;
      cur.revenue_usdc = Math.round(((cur.revenue_usdc || 0) + a / 1e6) * 1e6) / 1e6;
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
    const result = { paid_calls: ok.length, revenue_usdc: atomic / 1e6, unique_payers: payers.size, by_endpoint: byEndpoint, by_day: byDay, recent: all.slice(-20).reverse(), test_calls: tests.length, test_revenue_usdc: Math.round(tests.reduce((t, r) => t + Number(r.amount || 0), 0)) / 1e6, generated: new Date().toISOString(), source: "list-rebuild", payers: [...payers] };
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
  try {
    // CF free-tier daily KV put limit: never fail a paid response because payment logging could not write.
    await env.LOG.put(`pay:${rec.ts}:${crypto.randomUUID().slice(0, 8)}`, "1", { metadata: rec });
  } catch (e) { console.log("pay log put error", e); }
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

/** Read treasury USDC + ETH for dashboard (sweep-gas visibility). Tries multiple public Base RPCs; never throws. */
async function readTreasuryBalances(payTo: string): Promise<{ treasury_usdc: number | null; treasury_eth: number | null; treasury_err?: string }> {
  const data = "0x70a08231" + payTo.slice(2).toLowerCase().padStart(64, "0");
  // Prefer less rate-limited public Base RPCs first; keep prior endpoints as fallbacks.
  const rpcs = [
    "https://1rpc.io/base",
    "https://base.drpc.org",
    "https://base.publicnode.com",
    "https://base-mainnet.public.blastapi.io",
    "https://base-rpc.publicnode.com",
    "https://mainnet.base.org",
    "https://base.gateway.tenderly.co",
  ];
  const errs: string[] = [];
  for (const rpc of rpcs) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 6000);
      const opts = { method: "POST", headers: { "content-type": "application/json" }, signal: ac.signal } as RequestInit;
      const [balRes, usdcRes]: any[] = await Promise.all([
        fetch(rpc, { ...opts, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [payTo, "latest"] }) }).then((r) => r.json()),
        fetch(rpc, { ...opts, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_call", params: [{ to: USDC, data }, "latest"] }) }).then((r) => r.json()),
      ]).finally(() => clearTimeout(t));
      const ethHex = balRes?.result, usdcHex = usdcRes?.result;
      if (typeof ethHex !== "string" || typeof usdcHex !== "string") {
        errs.push(`${new URL(rpc).host}: ${balRes?.error?.message || usdcRes?.error?.message || "missing result"}`);
        continue;
      }
      return {
        treasury_eth: Math.round((Number(BigInt(ethHex)) / 1e18) * 1e9) / 1e9,
        treasury_usdc: Math.round((Number(BigInt(usdcHex)) / 1e6) * 1e6) / 1e6,
      };
    } catch (e: any) {
      errs.push(`${new URL(rpc).host}: ${String(e?.message || e).slice(0, 80)}`);
    }
  }
  return { treasury_usdc: null, treasury_eth: null, treasury_err: errs.slice(0, 3).join(" | ").slice(0, 240) };
}

app.get("/dashboard/data", async (c) => {
  const t = Date.now(); let health: any = { ok: true, version: "1.41.1" };
  try { await c.env.LOG.get("health-probe"); health.kv_ms = Date.now() - t; } catch (e: any) { health = { ok: false, version: "1.41.1", error: String(e) }; }
  health.facilitator = (c.env as any).CDP_API_KEY_ID ? "Coinbase CDP" : "PayAI";
  const meta = (await c.env.LOG.get("meta:dashboard", "json")) || {};
  // Keep in sync with HIDDEN_TOOLS in mcp.ts — unlisted $0.001 format validators stay off discovery surfaces.
  const HIDDEN_MCP = new Set(["iban_validate","phone_check","uk_postcode_validate","siren_validate","siret_validate","partita_iva_validate","orgnr_se_validate","bn_ca_validate","cvr_dk_validate","fn_at_validate","cin_in_validate","kvk_nl_validate","hr_de_validate","nif_es_validate","cnpj_validate","nip_pl_validate","uid_ch_validate"]);
  const mcpTools = [
    ["read_url", "$0.002"], ["extract_links", "$0.001"], ["check_domain", "$0.001"], ["dns_lookup", "$0.001"], ["url_redirects", "$0.001"], ["page_meta", "$0.001"], ["http_headers", "$0.001"], ["email_check", "$0.002"], ["domain_lookup", "$0.002"],
    ["company_research", "$0.25"], ["au_company", "$0.02"], ["ca_company", "$0.02"], ["fr_company", "$0.25"], ["no_company", "$0.25"], ["dk_company", "$0.25"], ["fi_company", "$0.25"], ["ch_company", "$0.25"], ["pl_company", "$0.25"], ["cz_company", "$0.25"], ["be_company", "$0.25"], ["sk_company", "$0.25"], ["us_entity", "$0.25"], ["registry_batch", "$0.30"], ["uk_company", "$0.50"], ["uk_company_lite", "$0.05"], ["company_full", "$0.65"], ["convert_document", "$0.03"], ["create_monitor", "$1.00"],
    ["wallet_balances", "$0.003"], ["tx_status", "$0.003"], ["token_check", "$0.01"], ["fx_rates", "$0.002"], ["ens_lookup", "$0.002"], ["token_metadata", "$0.001"], ["token_allowance", "$0.002"], ["contract_info", "$0.003"], ["gas_fees", "$0.001"], ["block_lookup", "$0.001"], ["nft_lookup", "$0.002"], ["web_search", "$0.003"], ["uk_property_prices", "$0.01"], ["uk_area_profile", "$0.005"], ["uk_charity", "$0.05"], ["uk_charity_full", "$0.25"], ["us_sec", "$0.05"], ["us_sec_full", "$0.25"], ["eu_vat", "$0.01"], ["lei_lookup", "$0.005"], ["lei_full", "$0.05"], ["read_batch", "$0.015"], ["uk_officer", "$0.15"], ["uk_leads_lite", "$0.25"], ["uk_leads", "$1.00"], ["uk_leads_feed", "$25.00"], ["uk_watch", "$5.00"], ["uk_dd", "$1.00"], ["kyb_report", "$2.50"], ["sanctions_screen", "$0.05"], ["sanctions_batch", "$1.00"],
    ...CHAIN_ROUTES.map((r) => ["chain_" + r.path.slice(7).replace(/-/g, "_"), r.price]),
    ["pricing", "free"],
  ].filter(([n]) => !HIDDEN_MCP.has(n as string));
  const services = [
    ...LISTED_PRICES().map(([p, price]) => ({ name: `HTTP ${p}`, url: `${CANONICAL}${p}`, price, paid: true, status: "live" })),
    { name: "HTTP GET /monitor/:id", url: `${CANONICAL}/monitor/:id`, price: "free", paid: false, status: "live" },
    ...mcpTools.map(([n, price]) => ({ name: `MCP ${n}`, url: `${CANONICAL}/mcp`, price, paid: price !== "free", status: "live" })),
    ...["/health", "/llms.txt", "/openapi.json", "/.well-known/x402", "/.well-known/agent.json", "/samples/company", "/hooks/sink"].map((p) => ({ name: p, url: `${CANONICAL}${p}`, price: "free", paid: false, status: "live" })),
  ];
  const { treasury_usdc, treasury_eth, treasury_err } = await readTreasuryBalances(c.env.PAY_TO);
  c.header("cache-control", "no-store"); const st: any = await stats(c.env); for (const k of ["revenue_usdc", "test_revenue_usdc"]) if (typeof st[k] === "number") st[k] = Math.round(st[k] * 1e6) / 1e6;
  return c.json({ ...st, health, services, meta, network: NETWORK, payTo: c.env.PAY_TO, treasury_usdc, treasury_eth, treasury_err, legacy_payTo: ["0xB1A4e2C441fa896AF010222659AAbBb71E9Ef1D1", "0x560d1dbb6e973082EBd20D340EAd3a198452b3Ec"], prices: PRICES });
});
app.post("/admin/dashboard-meta", async (c) => {
  const auth = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") || c.req.query("key") || "";
  if (!(await keyOk(auth, c.env.DASHBOARD_KEY || ""))) return c.json({ error: "unauthorized" }, 401);
  let body: any; try { body = await c.req.json(); } catch { return c.json({ error: "invalid json" }, 400); }
  const cur: any = (await c.env.LOG.get("meta:dashboard", "json")) || {};
  const { ops_notes_append, listings_upsert, checklist_upsert, ...rest } = body || {};
  const next: any = { ...cur, ...rest, updated: new Date().toISOString() };
  if (typeof ops_notes_append === "string" && ops_notes_append.trim()) {
    const prev = typeof next.ops_notes === "string" ? next.ops_notes : "";
    next.ops_notes = prev ? `${ops_notes_append.trim()}\n${prev}` : ops_notes_append.trim();
  }
  delete next.ops_notes_append;
  if (Array.isArray(listings_upsert)) {
    const list = Array.isArray(next.listings) ? [...next.listings] : [];
    for (const item of listings_upsert) {
      if (!item || typeof item !== "object" || !item.name) continue;
      const i = list.findIndex((x: any) => x && x.name === item.name);
      if (i >= 0) list[i] = { ...list[i], ...item };
      else list.unshift(item);
    }
    next.listings = list;
  }
  delete next.listings_upsert;
  if (Array.isArray(checklist_upsert)) {
    const list = Array.isArray(next.checklist) ? [...next.checklist] : [];
    for (const item of checklist_upsert) {
      if (!item || typeof item !== "object" || !item.item) continue;
      const i = list.findIndex((x: any) => x && x.item === item.item);
      if (i >= 0) list[i] = { ...list[i], ...item };
      else list.unshift(item);
    }
    next.checklist = list;
  }
  delete next.checklist_upsert;
  try {
    await c.env.LOG.put("meta:dashboard", JSON.stringify(next));
    return c.json({ ok: true, meta: next });
  } catch (e: any) {
    const detail = String(e?.message || e).slice(0, 300);
    return c.json({ ok: false, error: "kv_put_failed", detail }, 503);
  }
});
app.post("/admin/sanctions-refresh", async (c) => {
  const auth = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") || c.req.query("key") || "";
  if (!(await keyOk(auth, c.env.DASHBOARD_KEY || ""))) return c.json({ error: "unauthorized" }, 401);
  // Full OFAC/EU/UN/UK rebuild exceeds Worker HTTP CPU (CF 1102). Run in waitUntil (same as
  // cron) unless caller forces ?async=0 for a best-effort sync attempt.
  const sync = c.req.query("async") === "0";
  clearSanctionsCache();
  if (!sync) {
    c.executionCtx.waitUntil(
      refreshSanctionsIndex(c.env)
        .then((r) => { clearSanctionsCache(); console.log("sanctions-refresh", JSON.stringify({ ok: r.ok, entries: r.entries, error: r.error, sources: Object.fromEntries(Object.entries(r.sources || {}).map(([k, v]: any) => [k, { count: v?.count, error: v?.error?.slice?.(0, 80) }])) })); })
        .catch((e) => console.log("sanctions-refresh error", String(e?.message || e)))
    );
    return c.json({ ok: true, async: true, started: true, note: "refresh running in background via waitUntil (avoids HTTP CPU 1102). Pass ?async=0 to attempt sync." });
  }
  const r = await refreshSanctionsIndex(c.env);
  clearSanctionsCache();
  return c.json(r, r.ok ? 200 : 502);
});

app.all("/mcp", (c) => handleMcp(c.req.raw, c.env, (r) => logPay(c.env, r)));

// Free webhook sink for monitor tests (stores last payload briefly)
app.post("/hooks/sink", async (c) => {
  let body: any = null; try { body = await c.req.json(); } catch { try { body = await c.req.text(); } catch { body = null; } }
  const id = crypto.randomUUID().slice(0, 12);
  let stored = false;
  try {
    // CF free-tier daily KV put limit: never 500 a webhook delivery just because sink storage is full.
    await c.env.LOG.put(`hook:${id}`, JSON.stringify({ ts: new Date().toISOString(), body }), { expirationTtl: 86400 });
    await c.env.LOG.put("hook:last", id, { expirationTtl: 86400 });
    stored = true;
  } catch (e: any) {
    console.log("hook sink put failed", e?.message || e);
  }
  return c.json({
    ok: true,
    id,
    stored,
    fetch: stored ? `${CANONICAL}/hooks/sink/${id}` : null,
    ...(stored ? {} : { note: "payload accepted but not persisted (KV write limit); retry later to store" }),
  });
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

// Free buyer sheets (no quota): exact price + payment details + expected paid response shape, one URL per endpoint.
app.get("/buy", (c) => c.json({ about: "One page per endpoint with everything needed to pay: exact USDC + atomic amount, network, asset, payTo, example call, free preview, input params, expected paid response. Free, no rate limit.",
  start_here: BUYER_SHEET_ENDPOINTS.map((p) => ({ endpoint: p, price_usd: (PRICES as any)[p], amount_atomic: String((ATOMIC as any)[p]), sheet: `${CANONICAL}/buy${p}` })),
  all_endpoints: `${CANONICAL}/.well-known/x402`, charged_only_on_success: true }));
app.get("/buy/:ep{.+}", (c) => {
  const p = "/" + c.req.param("ep").replace(/^\/+/, "");
  if (!(p in PRICES)) return c.json({ error: "unknown endpoint", see: `${CANONICAL}/buy` }, 404);
  const get = METHODS[p].includes("GET"); const q = new URLSearchParams(Object.fromEntries(Object.entries(EX[p] || {}).map(([k, v]) => [k, Array.isArray(v) ? (v as any[]).join(";") : typeof v === "object" ? JSON.stringify(v) : String(v)])));
  const paidEx = (PAID_EXAMPLES as any)[p];
  return c.json({
    endpoint: `${CANONICAL}${p}`, methods: METHODS[p], what_you_get: DESC[p],
    pricing: pricingBlock(p, c.env.PAY_TO),
    example_call: get ? `${CANONICAL}${p}?${q}` : { method: "POST", url: `${CANONICAL}${p}`, json: EX[p] },
    free_preview: get ? `${CANONICAL}${p}?${q}&preview=1` : null, free_preview_limit: "8 previews/IP/UTC day (truncated; never the full paid payload)",
    input: IN[p], output_schema: OUT[p],
    expected_response: paidEx || (EXAMPLES as any)[p] || null,
    expected_response_kind: paidEx ? "paid (full report shape, arrays trimmed)" : (EXAMPLES as any)[p] ? "preview-derived (truncated; paid adds the omitted fields listed in output_schema)" : "see output_schema",
    how_to_pay: [
      `1. Call ${CANONICAL}${p} without payment -> HTTP 402 with PAYMENT-REQUIRED header (x402 v2) and a v1 JSON body (accepts[0].maxAmountRequired = ${(ATOMIC as any)[p]}).`,
      "2. Sign an EIP-3009 USDC transferWithAuthorization for exactly that amount on Base to payTo (any x402 client does this: @x402/fetch, x402-fetch, x402 Python, AgentKit, @axiomworks/agentreader).",
      "3. Retry the same request with PAYMENT-SIGNATURE (v2) or X-PAYMENT (v1). 2xx -> settled, response carries PAYMENT-RESPONSE with the tx hash. Non-2xx -> not settled.",
    ],
    sdk: { npm: "npm i @axiomworks/agentreader", mcp: `${CANONICAL}/mcp` }, contact: CONTACT,
  });
});

// Free truncated samples (rate-limited) — never full paid payloads
app.get("/samples", (c) => c.json({
  samples: Object.keys(STATIC_SAMPLES),
  live_preview: "Add ?preview=1 to paid GET routes (same IP daily quota)",
  limit: "8 previews/IP/UTC day",
  kinds: ["read","links","check","company","uk-company","uk-company-lite","convert","company-full","uk-charity","uk-charity-full","us-sec","us-sec-full","eu-vat","lei","lei-full","read-batch","uk-leads","uk-leads-lite","kyb","uk-dd","uk-watch","email-check","domain","dns","redirects","meta","headers","iban","phone","uk-postcode","siren","siret","partita-iva","orgnr","bn-ca","cvr","fn-at","cin-in","kvk-nl","hr-de","nif-es","cnpj","nip-pl","uid-ch","au-company","ca-company","fr-company","no-company","dk-company","fi-company","ch-company","pl-company","cz-company","be-company","sk-company","sanctions","sanctions-batch","uk-officer","uk-property","uk-area"],
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
  const b = await bodyObj(c);
  aliasInput(p, b);
  // Non-empty inputs always validate. Empty values for known schema keys also count as an attempt
  // (so ?phone= → free 400, never pay-then-400). Truly bare probes still get the 402 challenge for crawlers.
  const props = (IN[p]?.properties || IN[p] || {}) as Record<string, unknown>;
  const known = new Set([...Object.keys(props), ...Object.keys(EX[p] || {})]);
  const given = Object.keys(b).filter((k) => k !== "preview" && b[k] !== "" && b[k] != null);
  const emptyKnown = Object.keys(b).some((k) => k !== "preview" && known.has(k) && (b[k] === "" || b[k] == null));
  if (!given.length && !emptyKnown && c.req.query("preview") !== "1") return next(); // bare probe (x402scan/Bazaar crawlers): show the 402 challenge with schema + example
  const e = v(b);
  if (e) return c.json({ error: e, free: true, note: "Input rejected before payment; you were not charged.", example: EX[p], example_call: `${CANONICAL}${p}?${new URLSearchParams(EX[p])}` }, 400);
  return next();
});
// Paid routes: payment middleware first, except ?preview=1 (free truncated). v1 X-PAYMENT handled by ./v1; 402 body carries v1 accepts.
async function paid(c: any, next: any, p: string) {
  const req = v1Reqs({ url: `${CANONICAL}${p}`, method: c.req.method === "POST" ? "POST" : "GET", atomic: ATOMIC[p], desc: upsell(p, DESC[p]), payTo: c.env.PAY_TO, input: IN[p]?.properties || IN[p], output: { example: (PAID_EXAMPLES as any)[p] || (EXAMPLES as any)[p], schema: OUT[p] } });
  const v1 = decodeV1(c.req.header("x-payment"));
  if (v1) return handleV1(c, next, v1, req, (r) => logPay(c.env, r));
  const out = await getMw(c.env)(c, next); const res: Response = out instanceof Response ? out : c.res;
  if (res.status === 402 && res.headers.get("payment-required")) {
    const h = new Headers(res.headers); h.set("content-type", "application/json");
    return new Response(JSON.stringify({ ...v1Body(req), x402_v2: "see PAYMENT-REQUIRED header (base64 JSON)", example_call: `${CANONICAL}${p}?${new URLSearchParams(EX[p])}`, free_preview: c.req.method === "GET" ? `${CANONICAL}${p}?${new URLSearchParams(EX[p])}&preview=1` : undefined, pricing: pricingBlock(p, c.env.PAY_TO), buyer_sheet: `${CANONICAL}/buy${p}` }), { status: 402, headers: h });
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
  app[m]("/email-check", async (c) => {
    const b = await bodyObj(c);
    const email = (b.email || "").trim(); if (!email) return c.json({ error: "missing email", example: { email: "info@stripe.com" } }, 400);
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "email-check", () => emailCheck({ email }), `${CANONICAL}/email-check?email=${encodeURIComponent(email)}`);
    return cached(c, `email-check?email=${encodeURIComponent(email.toLowerCase())}`, () => emailCheck({ email }), 3600);
  });
  app[m]("/domain", async (c) => {
    const b = await bodyObj(c);
    const domain = (b.domain || "").trim(); if (!domain) return c.json({ error: "missing domain", example: { domain: "stripe.com" } }, 400);
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "domain", () => domainLookup({ domain }), `${CANONICAL}/domain?domain=${encodeURIComponent(domain)}`);
    return cached(c, `domain?domain=${encodeURIComponent(domain.toLowerCase())}`, () => domainLookup({ domain }), 3600);
  });
  app[m]("/dns", async (c) => {
    const b = await bodyObj(c); aliasInput("/dns", b);
    const name = (b.name || "").trim(); if (!name) return c.json({ error: "missing name", example: { name: "example.com" } }, 400);
    const type = (b.type || "").trim() || undefined;
    const cacheKey = `dns?name=${encodeURIComponent(name.toLowerCase())}&type=${encodeURIComponent(type || "default")}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "dns", () => dnsLookup({ name, type }), `${CANONICAL}/dns?name=${encodeURIComponent(name)}${type ? `&type=${encodeURIComponent(type)}` : ""}`);
    return cached(c, cacheKey, () => dnsLookup({ name, type }), 300);
  });
  app[m]("/redirects", async (c) => {
    const b = await bodyObj(c);
    const url = (b.url || "").trim(); if (!url) return c.json({ error: "missing url", example: { url: "https://example.com" } }, 400);
    const cacheKey = `redirects?url=${encodeURIComponent(url)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "redirects", () => redirectsLookup({ url }), `${CANONICAL}/redirects?url=${encodeURIComponent(url)}`);
    return cached(c, cacheKey, () => redirectsLookup({ url }), 120);
  });
  app[m]("/meta", async (c) => {
    const b = await bodyObj(c);
    const url = (b.url || "").trim(); if (!url) return c.json({ error: "missing url", example: { url: "https://example.com" } }, 400);
    const cacheKey = `meta?url=${encodeURIComponent(url)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "meta", () => pageMeta({ url }), `${CANONICAL}/meta?url=${encodeURIComponent(url)}`);
    return cached(c, cacheKey, () => pageMeta({ url }), 300);
  });
  app[m]("/headers", async (c) => {
    const b = await bodyObj(c);
    const url = String(b.url || "").trim();
    const domain = String(b.domain || "").trim();
    if (!url && !domain) return c.json({ error: "missing url or domain" }, 400);
    const cacheKey = `headers?${url ? "url="+encodeURIComponent(url) : "domain="+encodeURIComponent(domain)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "headers", () => headersAudit({ url: url || undefined, domain: domain || undefined }), `${CANONICAL}/headers?${url ? "url="+encodeURIComponent(url) : "domain="+encodeURIComponent(domain)}`);
    return cached(c, cacheKey, () => headersAudit({ url: url || undefined, domain: domain || undefined }), 60);
  });
  app[m]("/iban", async (c) => {
    const b = await bodyObj(c);
    const iban = String(b.iban || "").trim(); if (!iban) return c.json({ error: "missing iban" }, 400);
    const cacheKey = `iban?iban=${encodeURIComponent(iban)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "iban", () => Promise.resolve(validateIban({ iban })), `${CANONICAL}/iban?iban=${encodeURIComponent(iban)}`);
    return cached(c, cacheKey, () => Promise.resolve(validateIban({ iban })), 3600);
  });
  app[m]("/phone", async (c) => {
    const b = await bodyObj(c);
    const phone = String(b.phone || "").trim(); if (!phone) return c.json({ error: "missing phone" }, 400);
    const country = String(b.country || "").trim() || undefined;
    const cacheKey = `phone?phone=${encodeURIComponent(phone)}&country=${encodeURIComponent(country || "")}`;
    const paidUrl = `${CANONICAL}/phone?phone=${encodeURIComponent(phone)}${country ? "&country="+encodeURIComponent(country) : ""}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "phone", () => Promise.resolve(validatePhone({ phone, country })), paidUrl);
    return cached(c, cacheKey, () => Promise.resolve(validatePhone({ phone, country })), 3600);
  });
  app[m]("/uk-postcode", async (c) => {
    const b = await bodyObj(c);
    const postcode = String(b.postcode || "").trim(); if (!postcode) return c.json({ error: "missing postcode" }, 400);
    const cacheKey = `uk-postcode?postcode=${encodeURIComponent(postcode)}`;
    const paidUrl = `${CANONICAL}/uk-postcode?postcode=${encodeURIComponent(postcode)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "uk-postcode", () => Promise.resolve(validateUkPostcode({ postcode })), paidUrl);
    return cached(c, cacheKey, () => Promise.resolve(validateUkPostcode({ postcode })), 3600);
  });
  app[m]("/siren", async (c) => {
    const b = await bodyObj(c);
    const siren = String(b.siren || "").trim(); if (!siren) return c.json({ error: "missing siren" }, 400);
    const cacheKey = `siren?siren=${encodeURIComponent(siren)}`;
    const paidUrl = `${CANONICAL}/siren?siren=${encodeURIComponent(siren)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "siren", () => Promise.resolve(validateSiren({ siren })), paidUrl);
    return cached(c, cacheKey, () => Promise.resolve(validateSiren({ siren })), 3600);
  });
  app[m]("/siret", async (c) => {
    const b = await bodyObj(c);
    const siret = String(b.siret || "").trim(); if (!siret) return c.json({ error: "missing siret" }, 400);
    const cacheKey = `siret?siret=${encodeURIComponent(siret)}`;
    const paidUrl = `${CANONICAL}/siret?siret=${encodeURIComponent(siret)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "siret", () => Promise.resolve(validateSiret({ siret })), paidUrl);
    return cached(c, cacheKey, () => Promise.resolve(validateSiret({ siret })), 3600);
  });
  app[m]("/partita-iva", async (c) => {
    const b = await bodyObj(c); aliasInput("/partita-iva", b);
    const vat = String(b.vat || b.partita_iva || "").trim(); if (!vat) return c.json({ error: "missing vat", example: { vat: "00488410010" } }, 400);
    const cacheKey = `partita-iva?vat=${encodeURIComponent(vat)}`;
    const paidUrl = `${CANONICAL}/partita-iva?vat=${encodeURIComponent(vat)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "partita-iva", () => Promise.resolve(validatePartitaIva({ vat })), paidUrl);
    return cached(c, cacheKey, () => Promise.resolve(validatePartitaIva({ vat })), 3600);
  });
  app[m]("/orgnr", async (c) => {
    const b = await bodyObj(c); aliasInput("/orgnr", b);
    const orgnr = String(b.orgnr || "").trim(); if (!orgnr) return c.json({ error: "missing orgnr", example: { orgnr: "556012-5790" } }, 400);
    const cacheKey = `orgnr?orgnr=${encodeURIComponent(orgnr)}`;
    const paidUrl = `${CANONICAL}/orgnr?orgnr=${encodeURIComponent(orgnr)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "orgnr", () => Promise.resolve(validateOrgnr({ orgnr })), paidUrl);
    return cached(c, cacheKey, () => Promise.resolve(validateOrgnr({ orgnr })), 3600);
  });
  app[m]("/bn-ca", async (c) => {
    const b = await bodyObj(c); aliasInput("/bn-ca", b);
    const bn = String(b.bn || "").trim(); if (!bn) return c.json({ error: "missing bn", example: { bn: "123456789RT0001" } }, 400);
    const cacheKey = `bn-ca?bn=${encodeURIComponent(bn)}`;
    const paidUrl = `${CANONICAL}/bn-ca?bn=${encodeURIComponent(bn)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "bn-ca", () => Promise.resolve(validateBnCa({ bn })), paidUrl);
    return cached(c, cacheKey, () => Promise.resolve(validateBnCa({ bn })), 3600);
  });
  app[m]("/cvr", async (c) => {
    const b = await bodyObj(c); aliasInput("/cvr", b);
    const cvr = String(b.cvr || "").trim(); if (!cvr) return c.json({ error: "missing cvr", example: { cvr: "10403782" } }, 400);
    const cacheKey = `cvr?cvr=${encodeURIComponent(cvr)}`;
    const paidUrl = `${CANONICAL}/cvr?cvr=${encodeURIComponent(cvr)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "cvr", () => Promise.resolve(validateCvr({ cvr })), paidUrl);
    return cached(c, cacheKey, () => Promise.resolve(validateCvr({ cvr })), 3600);
  });
  app[m]("/fn-at", async (c) => {
    const b = await bodyObj(c); aliasInput("/fn-at", b);
    const fn = String(b.fn || "").trim(); if (!fn) return c.json({ error: "missing fn", example: { fn: "FN 575737y" } }, 400);
    const cacheKey = `fn-at?fn=${encodeURIComponent(fn)}`;
    const paidUrl = `${CANONICAL}/fn-at?fn=${encodeURIComponent(fn)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "fn-at", () => Promise.resolve(validateFn({ fn })), paidUrl);
    return cached(c, cacheKey, () => Promise.resolve(validateFn({ fn })), 3600);
  });
  app[m]("/cin-in", async (c) => {
    const b = await bodyObj(c); aliasInput("/cin-in", b);
    const cin = String(b.cin || "").trim(); if (!cin) return c.json({ error: "missing cin", example: { cin: "U72200KA2013PTC097389" } }, 400);
    const cacheKey = `cin-in?cin=${encodeURIComponent(cin)}`;
    const paidUrl = `${CANONICAL}/cin-in?cin=${encodeURIComponent(cin)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "cin-in", () => Promise.resolve(validateCin({ cin })), paidUrl);
    return cached(c, cacheKey, () => Promise.resolve(validateCin({ cin })), 3600);
  });
  app[m]("/kvk-nl", async (c) => {
    const b = await bodyObj(c); aliasInput("/kvk-nl", b);
    const kvk = String(b.kvk || "").trim(); if (!kvk) return c.json({ error: "missing kvk", example: { kvk: "69599084" } }, 400);
    const cacheKey = `kvk-nl?kvk=${encodeURIComponent(kvk)}`;
    const paidUrl = `${CANONICAL}/kvk-nl?kvk=${encodeURIComponent(kvk)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "kvk-nl", () => Promise.resolve(validateKvk({ kvk })), paidUrl);
    return cached(c, cacheKey, () => Promise.resolve(validateKvk({ kvk })), 3600);
  });
  app[m]("/hr-de", async (c) => {
    const b = await bodyObj(c); aliasInput("/hr-de", b);
    const hr = String(b.hr || "").trim(); if (!hr) return c.json({ error: "missing hr", example: { hr: "HRB 6684" } }, 400);
    const cacheKey = `hr-de?hr=${encodeURIComponent(hr)}`;
    const paidUrl = `${CANONICAL}/hr-de?hr=${encodeURIComponent(hr)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "hr-de", () => Promise.resolve(validateHr({ hr })), paidUrl);
    return cached(c, cacheKey, () => Promise.resolve(validateHr({ hr })), 3600);
  });
  app[m]("/nif-es", async (c) => {
    const b = await bodyObj(c); aliasInput("/nif-es", b);
    const nif = String(b.nif || "").trim(); if (!nif) return c.json({ error: "missing nif", example: { nif: "A28015865" } }, 400);
    const cacheKey = `nif-es?nif=${encodeURIComponent(nif)}`;
    const paidUrl = `${CANONICAL}/nif-es?nif=${encodeURIComponent(nif)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "nif-es", () => Promise.resolve(validateNif({ nif })), paidUrl);
    return cached(c, cacheKey, () => Promise.resolve(validateNif({ nif })), 3600);
  });
  app[m]("/cnpj", async (c) => {
    const b = await bodyObj(c); aliasInput("/cnpj", b);
    const cnpj = String(b.cnpj || "").trim(); if (!cnpj) return c.json({ error: "missing cnpj", example: { cnpj: "33000167000101" } }, 400);
    const cacheKey = `cnpj?cnpj=${encodeURIComponent(cnpj)}`;
    const paidUrl = `${CANONICAL}/cnpj?cnpj=${encodeURIComponent(cnpj)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "cnpj", () => Promise.resolve(validateCnpj({ cnpj })), paidUrl);
    return cached(c, cacheKey, () => Promise.resolve(validateCnpj({ cnpj })), 3600);
  });
  app[m]("/nip-pl", async (c) => {
    const b = await bodyObj(c); aliasInput("/nip-pl", b);
    const nip = String(b.nip || "").trim(); if (!nip) return c.json({ error: "missing nip", example: { nip: "5261040828" } }, 400);
    const cacheKey = `nip-pl?nip=${encodeURIComponent(nip)}`;
    const paidUrl = `${CANONICAL}/nip-pl?nip=${encodeURIComponent(nip)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "nip-pl", () => Promise.resolve(validateNip({ nip })), paidUrl);
    return cached(c, cacheKey, () => Promise.resolve(validateNip({ nip })), 3600);
  });
  app[m]("/uid-ch", async (c) => {
    const b = await bodyObj(c); aliasInput("/uid-ch", b);
    const uid = String(b.uid || "").trim(); if (!uid) return c.json({ error: "missing uid", example: { uid: "CHE-109.322.551" } }, 400);
    const cacheKey = `uid-ch?uid=${encodeURIComponent(uid)}`;
    const paidUrl = `${CANONICAL}/uid-ch?uid=${encodeURIComponent(uid)}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "uid-ch", () => Promise.resolve(validateUid({ uid })), paidUrl);
    return cached(c, cacheKey, () => Promise.resolve(validateUid({ uid })), 3600);
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
    const b = await bodyObj(c); aliasInput("/uk-company", b);
    if (!(b.number || b.name)) return c.json({ error: "missing number or name" }, 400);
    const key = b.number ? `number=${b.number}` : `name=${b.name}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "uk-company", () => ukCompany(c.env, { number: b.number, name: b.name }), `${CANONICAL}/uk-company?${key}`);
    return cached(c, `uk-company?${encodeURIComponent(key)}`, () => ukCompany(c.env, { number: b.number, name: b.name }), 60);
  });
  app[m]("/uk-company-lite", async (c) => {
    const b = await bodyObj(c); aliasInput("/uk-company-lite", b);
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
    const CREG = bindingRegistries(c.env);
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "company-full", () => companyFull(c.env, { domain }, CREG), `${CANONICAL}/company-full?domain=${encodeURIComponent(domain)}`);
    return cached(c, `company-full?domain=${encodeURIComponent(domain)}`, () => companyFull(c.env, { domain }, CREG), 60);
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
  app[m]("/lei", async (c) => {
    const b = await bodyObj(c);
    const key = b.lei ? `lei=${b.lei}` : `name=${b.name||""}&registered_as=${b.registered_as||""}&country=${b.country||""}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "lei", () => leiLookup(c.env, { lei: b.lei, name: b.name, registered_as: b.registered_as, country: b.country }), `${CANONICAL}/lei?${key}`);
    return cached(c, `lei?${encodeURIComponent(key)}`, () => leiLookup(c.env, { lei: b.lei, name: b.name, registered_as: b.registered_as, country: b.country }), 300);
  });
  app[m]("/lei-full", async (c) => {
    const b = await bodyObj(c);
    const key = `name=${b.name||""}&registered_as=${b.registered_as||""}&country=${b.country||""}&lei=${b.lei||""}`;
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "lei-full", () => leiFull(c.env, { name: b.name, registered_as: b.registered_as, country: b.country, lei: b.lei }), `${CANONICAL}/lei-full?${key}`);
    return cached(c, `lei-full?${encodeURIComponent(key)}`, () => leiFull(c.env, { name: b.name, registered_as: b.registered_as, country: b.country, lei: b.lei }), 300);
  });
  app[m]("/read-batch", async (c) => {
    const b = await bodyObj(c);
    let urls = b.urls;
    if (typeof urls === "string" && urls.trim().startsWith("[")) { try { urls = JSON.parse(urls); } catch {} }
    const preview = c.req.query("preview") === "1" && m === "get";
    if (preview)
      return livePreview(c, "read-batch", () => readBatch({ urls, preview: true }), `${CANONICAL}/read-batch?urls=...`);
    return readBatch({ urls }).then((d) => c.json(d)).catch((e: any) => c.json({ error: e?.message || String(e) }, (e instanceof UserError ? e.status : 502) as any));
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

  app[m]("/uk-dd", async (c) => {
    const b = await bodyObj(c); aliasInput("/uk-dd", b);
    const key = b.number ? `number=${encodeURIComponent(b.number)}` : b.name ? `name=${encodeURIComponent(b.name)}` : "domain";
    if (!(b.number || b.name)) return c.json({ error: "missing number or name" }, 400);
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "uk-dd", () => ukDdReport(c.env, { number: b.number, name: b.name, domain: b.domain, preview: true }), `${CANONICAL}/uk-dd?${key}`);
    return cached(c, `uk-dd?${encodeURIComponent(key)}&d=${encodeURIComponent(b.domain||"")}`, () => ukDdReport(c.env, { number: b.number, name: b.name, domain: b.domain }), 120);
  });

  app[m]("/kyb", async (c) => {
    const b = await bodyObj(c); aliasInput("/kyb", b);
    // Pass EVERY supported identifier (paid path used to drop uid/krs/nip/ico/enterprise_number/sk → paid CH/PL/CZ/BE/SK KYB returned 400).
    const inp: any = {}; for (const k of KYB_KEYS) { const v = b[k]; if (v != null && String(v).trim() !== "") inp[k] = String(v).trim(); }
    const key = new URLSearchParams(inp).toString();
    const KREG = bindingRegistries(c.env);
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "kyb", () => kybReport(c.env, { ...inp, preview: true }, KREG), `${CANONICAL}/kyb?${key}`);
    return cached(c, `kyb2?${encodeURIComponent(key)}`, () => kybReport(c.env, inp, KREG), 120);
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
    // GET: accept repeated ?names=A&names=B and ?name= as well as comma/semicolon lists (parsed in screenSanctionsBatch).
    if (m === "get") { const rep = c.req.queries("names") || []; if (rep.length > 1) b.names = rep.join(";"); else if (!b.names && b.name) b.names = String(b.name); }
    if (c.req.query("preview") === "1" && m === "get")
      return livePreview(c, "sanctions-batch", () => screenSanctionsBatch(c.env, { names: b.names || ["BANCO NACIONAL DE CUBA", "Alice Wonderland"] }), `${CANONICAL}/sanctions-batch`);
    return screenSanctionsBatch(c.env, { names: b.names }).then((d) => c.json(d)).catch((e: any) => c.json({ error: e?.message || String(e) }, (e instanceof UserError ? e.status : 502) as any));
  });

}

const KYB_KEYS = ["domain", "number", "name", "vat", "country", "vat_number", "acn", "abn", "ca_number", "bn", "lei", "siren", "siret", "orgnr", "cvr", "ytunnus", "businessId", "fi", "uid", "che", "ch", "krs", "nip", "pl", "ico", "cz", "enterprise_number", "be", "bce", "kbo", "sk", "ico_sk", "rpo", "us_state", "us_id", "us_name"];

async function caCompany(b: any) {
  const env = currentEnv!; const bn = String(b.bn || "").replace(/\D/g, "").slice(0, 9); const num = String(b.number || "").replace(/\D/g, "");
  const q = num && num.length <= 8 ? `number=${num}` : bn.length === 9 ? `bn=${bn}` : null;
  if (!q) throw new UserError("number (corporation number, up to 8 digits) or bn (9-digit Business Number) required", 400);
  if (!env.AU) throw new Error("ca-company backend not bound");
  const r = await env.AU.fetch(`https://au.internal/internal/ca?${q}`, { headers: { "x-internal-key": env.AU_INTERNAL_KEY || "" } });
  const j: any = await r.json(); if (r.status === 404) throw new UserError(`No active federal corporation found for ${q}`, 404); if (!r.ok) throw new Error(j?.error || "ca backend error");
  return j;
}
async function registryBatch(b: any) {
  const split = (v: any) => String(v || "").split(/[\s,;]+/).map((x) => x.replace(/\D/g, "")).filter(Boolean);
  const splitUid = (v: any) => String(v || "").split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean).map((x) => { const d = x.replace(/\D/g, ""); return d.length === 9 ? d : ""; }).filter(Boolean);
  const splitKrs = (v: any) => String(v || "").split(/[\s,;]+/).map((x) => x.replace(/\D/g, "")).filter(Boolean).map((x) => x.padStart(10, "0")).filter((x) => x.length === 10);
  const splitIco = (v: any) => String(v || "").split(/[\s,;]+/).map((x) => x.replace(/\D/g, "")).filter(Boolean).map((x) => x.padStart(8, "0")).filter((x) => x.length === 8);
  const splitBe = (v: any) => String(v || "").split(/[\s,;]+/).map((x) => x.replace(/\D/g, "")).filter(Boolean).map((x) => x.length === 9 ? "0" + x : x).filter((x) => x.length === 10);
  const splitSk = (v: any) => String(v || "").split(/[\s,;]+/).map((x) => x.replace(/\D/g, "")).filter(Boolean).map((x) => x.padStart(8, "0")).filter((x) => x.length === 8);
  const au = split(b.au), ca = split(b.ca), fr = split(b.fr).filter((x) => x.length === 9), no = split(b.no).filter((x) => x.length === 9), dk = split(b.dk).filter((x) => x.length === 8), fi = split(b.fi).filter((x) => x.length === 8), ch = splitUid(b.ch), pl = splitKrs(b.pl), cz = splitIco(b.cz), be = splitBe(b.be), sk = splitSk(b.sk); const uk = String(b.uk || "").split(/[\s,;]+/).map((x) => x.toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean);
  if (uk.length > 10) throw new UserError("max 10 uk ids", 400);
  if (au.length + ca.length + uk.length + fr.length + no.length + dk.length + fi.length + ch.length + pl.length + cz.length + be.length + sk.length > 25) throw new UserError("max 25 ids total", 400);
  if (!au.length && !ca.length && !uk.length && !fr.length && !no.length && !dk.length && !fi.length && !ch.length && !pl.length && !cz.length && !be.length && !sk.length) throw new UserError("uk, au, ca, fr, no, dk, fi, ch, pl, cz, be or sk ids required", 400);
  const RB_ITEM_MS = 9000; // per-id cap so one hung upstream registry cannot stall the whole batch
  const capped = <T,>(country: string, p: Promise<T>) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new UserError(`${country} registry upstream timeout (${RB_ITEM_MS / 1000}s) — retry this id shortly`, 504)), RB_ITEM_MS))]);
  const one = async (country: string, id: string) => { try { const d = await capped(country, (async () => country === "UK" ? await ukCompany(currentEnv as any, { number: id.padStart(8, "0"), lite: true }) : country === "AU" ? await auCompany({ acn: id }) : country === "FR" ? await frCompany({ siren: id, lite: true }) : country === "NO" ? await noCompany({ orgnr: id, lite: true }) : country === "DK" ? await dkCompany({ cvr: id, lite: true }) : country === "FI" ? await fiCompany({ businessId: id, lite: true }) : country === "CH" ? await chCompany({ uid: id, lite: true }) : country === "PL" ? await plCompany({ krs: id, lite: true }) : country === "CZ" ? await czCompany({ ico: id, lite: true }) : country === "BE" ? await beCompany({ enterprise_number: id, lite: true }) : country === "SK" ? await skCompany({ ico: id, lite: true }) : await caCompany(id.length === 9 ? { bn: id } : { number: id }))()); return { country, id, found: true, data: d }; } catch (e: any) { return { country, id, found: false, error: e?.message || String(e) }; } };
  const results = await Promise.all([...uk.map((i) => one("UK", i)), ...au.map((i) => one("AU", i)), ...ca.map((i) => one("CA", i)), ...fr.map((i) => one("FR", i)), ...no.map((i) => one("NO", i)), ...dk.map((i) => one("DK", i)), ...fi.map((i) => one("FI", i)), ...ch.map((i) => one("CH", i)), ...pl.map((i) => one("PL", i)), ...cz.map((i) => one("CZ", i)), ...be.map((i) => one("BE", i)), ...sk.map((i) => one("SK", i))]);
  return { count: results.length, found: results.filter((r) => r.found).length, results, sources: ["Companies House (OGL)", "ASIC Company Dataset (CC BY 3.0 AU)", "Corporations Canada open data (OGL-Canada)", "API Recherche d'entreprises (FR)", "Brønnøysundregistrene Enhetsregisteret (NO, NLOD)", "Danish CVR via apicvr.dk / Erhvervsstyrelsen", "PRH / Finnish Trade Register (YTJ open data, CC BY 4.0)", "Zefix (Swiss central business name index / UID register)", "KRS Odpis Aktualny (PL Ministerstwo Sprawiedliwości)", "ARES (CZ MF)", "CBE/KBO Public Search (BE FPS Economy)", "RPO (SK Statistical Office, CC-BY 4.0)"] };
}
function rbSlim(d: any) { return { count: d.count, found: d.found, results: d.results.slice(0, 2).map((r: any) => ({ country: r.country, id: r.id, found: r.found, name: r.data?.name ?? r.data?.company_name ?? null, ...(r.found ? {} : { error: String(r.error || "not found").slice(0, 160) }) })), omitted: "full records + remaining results" }; }
function caSlim(d: any) { const x = d.matches ? d.matches[0] : d; return { corporation_number: x.corporation_number, name: x.name, status: x.status, omitted: ["business_number", "registered_office", "filings", "directors", "governing_legislation"] }; }
async function auCompany(b: any) {
  const env = currentEnv!; const raw = String(b.acn || b.abn || "").replace(/\s/g, "");
  const acn = /^\d{11}$/.test(raw) ? raw.slice(2) : raw;
  if (!/^\d{9}$/.test(acn)) throw new UserError("acn must be 9 digits (or abn 11 digits)", 400);
  if (!env.AU) throw new Error("au-company backend not bound");
  const r = await env.AU.fetch(`https://au.internal/internal/au?acn=${acn}`, { headers: { "x-internal-key": env.AU_INTERNAL_KEY || "" } });
  const j: any = await r.json(); if (r.status === 404) throw new UserError(`ACN ${acn} not found in ASIC register snapshot`, 404); if (!r.ok) throw new Error(j?.error || "au backend error");
  return j;
}
const ONCHAIN: Record<string, [(b: any) => Promise<any>, string[], number, string[]?]> = {
  "/au-company": [(b) => auCompany(b), ["acn", "abn"], 86400, ["acn|abn"]],
  "/fr-company": [(b) => frCompany(b), ["siren", "siret", "name", "q", "limit"], 86400, ["siren|siret|name|q"]],
  "/no-company": [(b) => noCompany(b), ["orgnr", "name", "q", "limit"], 86400, ["orgnr|name|q"]],
  "/dk-company": [(b) => dkCompany(b), ["cvr", "number", "vat", "name", "q", "limit"], 86400, ["cvr|number|vat|name|q"]],
  "/fi-company": [(b) => fiCompany(b), ["businessId", "ytunnus", "fi", "number", "name", "q", "limit"], 86400, ["businessId|ytunnus|fi|number|name|q"]],
  "/ch-company": [(b) => chCompany(b), ["uid", "che", "number", "ehraid", "name", "q", "limit"], 86400, ["uid|che|number|ehraid|name|q"]],
  "/pl-company": [(b) => plCompany(b), ["krs", "nip", "number", "pl"], 86400, ["krs|nip|number|pl"]],
  "/cz-company": [(b) => czCompany(b), ["ico", "cz", "number", "dic", "name", "q", "limit"], 86400, ["ico|cz|number|dic|name|q"]],
  "/be-company": [(b) => beCompany(b), ["enterprise_number", "be", "bce", "kbo", "number", "vat", "name", "q", "limit"], 86400, ["enterprise_number|be|bce|kbo|number|vat|name|q"]],
  "/us-entity": [(b) => usEntity(b), ["name", "q", "company", "state", "states", "id", "number", "entity_id", "limit"], 86400, ["name|q|company|id|number|entity_id"]],
  "/sk-company": [(b) => skCompany(b), ["ico", "identifier", "sk", "ico_sk", "rpo", "number", "name", "q", "limit"], 86400, ["ico|identifier|sk|ico_sk|rpo|number|name|q"]],
  "/registry-batch": [(b) => registryBatch(b), ["uk", "au", "ca", "fr", "no", "dk", "fi", "ch", "pl", "cz", "be", "sk"], 3600, ["uk|au|ca|fr|no|dk|fi|ch|pl|cz|be|sk"]],
  "/ca-company": [(b) => caCompany(b), ["number", "bn"], 86400, ["number|bn"]],
  "/ens": [(b) => ens(b), ["name", "address"], 900, ["name|address"]], "/token": [(b) => tokenMeta(b), ["address", "chain"], 3600],
  "/allowance": [(b) => allowance(b), ["token", "owner", "spender", "chain"], 20, ["token", "owner", "spender"]], "/contract": [(b) => contractInfo(b), ["address", "chain"], 1800],
  "/gas": [(b) => gas(b), ["chain"], 10, []], "/block": [(b) => block(b), ["number", "timestamp", "chain"], 60, []], "/nft": [(b) => nft(b), ["contract", "token_id", "chain"], 300, ["contract", "token_id"]],
  "/wallet": [(b) => wallet(b), ["address", "chain", "tokens"], 15], "/tx": [(b) => tx(b), ["hash", "chain"], 10],
  "/token-check": [(b) => tokenCheck(b), ["address", "chain"], 120],
  "/search": [(b) => search(b), ["q", "sources", "limit", "lang"], 900, ["q"]], "/uk-property": [(b) => ukProperty(b), ["postcode", "radius", "limit"], 86400, ["postcode"]], "/uk-area": [(b) => ukArea(b), ["postcode"], 21600, ["postcode"]], "/fx": [(b) => fx(b), ["base", "symbols", "date", "amount"], 600, []],
};
for (const r of CHAIN_ROUTES) ONCHAIN[r.path] = [r.fn, r.keys, r.ttl, (r.in.required as string[] | undefined) ?? []];
function auSlim(d: any) { return { acn: d.acn, name: d.name, status: d.status, status_desc: d.status_desc, omitted: ["abn", "former_names", "type", "class", "registered", "deregistered"] }; }
function nftSlim(d: any) { const m = d?.metadata; return { ...slim(d), metadata: m ? { name: m.name ?? null, image: m.image ? String(m.image).slice(0, 60) + "…" : null, attributes_count: Array.isArray(m.attributes) ? m.attributes.length : 0, truncated: "full metadata/attributes in paid call" } : null }; }
function slim(d: any): any { if (Array.isArray(d)) return d.slice(0, 2); if (d && typeof d === "object") { const o: any = {}; for (const [k, v] of Object.entries(d)) o[k] = Array.isArray(v) ? (v as any[]).slice(0, 2) : (k === "rates" || k === "converted") && v ? Object.fromEntries(Object.entries(v as any).slice(0, 3)) : v; return o; } return d; }
for (const [p, [fn, keys, ttl, need]] of Object.entries(ONCHAIN)) for (const m of ["get", "post"] as const) app[m](p, async (c) => {
  const b = await bodyObj(c); aliasInput(p, b);
  const args: any = {}; for (const k of keys) if (b[k] != null && b[k] !== "") args[k] = String(b[k]).trim();
  // Prefer canonical address over wallet alias in args (fn reads address)
  if (args.wallet && !args.address) args.address = args.wallet;
  if (args.network && !args.chain) args.chain = args.network;
  for (const r of need ?? [keys[0]]) if (!r.split("|").some((k) => args[k])) return c.json({ error: `missing ${r.replace("|", " or ")}`, example: EX[p] }, 400);
  if (c.req.query("preview") === "1" && m === "get") {
    const q = await checkPreviewQuota(c.env, clientIp(c)); if (!q.ok) return c.json(q, 429);
    try { return c.json({ preview: true, truncated: "arrays cut to 2 items; pay for full result", data: p === "/registry-batch" ? rbSlim(await fn(args)) : p === "/ca-company" ? caSlim(await fn(args)) : p === "/au-company" ? auSlim(await fn(args)) : p === "/fr-company" ? frCompanySlim(await fn(args)) : p === "/no-company" ? noCompanySlim(await fn(args)) : p === "/dk-company" ? dkCompanySlim(await fn(args)) : p === "/fi-company" ? fiCompanySlim(await fn(args)) : p === "/ch-company" ? chCompanySlim(await fn(args)) : p === "/pl-company" ? plCompanySlim(await fn(args)) : p === "/cz-company" ? czCompanySlim(await fn(args)) : p === "/be-company" ? beCompanySlim(await fn(args)) : p === "/sk-company" ? skCompanySlim(await fn(args)) : p === "/us-entity" ? usEntitySlim(await fn({ ...args, lite: true })) : p === "/nft" ? nftSlim(await fn(args)) : slim(await fn(args)), paid_call: `${CANONICAL}${p}?${new URLSearchParams(args)}`, price: PRICES[p as keyof typeof PRICES], preview_remaining: q.remaining }); }
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
    const b = await bodyObj(c); aliasInput("/uk-watch", b);
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
// POST-only paid routes: GET on the bare path used to fall through to a generic 404.
// Return a free, structured hint so agents (and humans) self-correct without paying.
for (const p of POST_ONLY_PAID) {
  app.get(p, (c) => c.json({
    error: "method_not_allowed",
    free: true,
    note: `${p} accepts POST only. You were not charged.`,
    method: "POST",
    price: PRICES[p],
    example: EX[p],
    example_call: `POST ${CANONICAL}${p}`,
    status_url_template: `${CANONICAL}${p}/{id}`,
    ...(p === "/uk-watch" ? { sample: `${CANONICAL}/samples/uk-watch`, watches: "status/officers/filings/PSC/charges" } : {}),
  }, 405));
}
app.notFound((c) => {
  // Malformed path-alias id (e.g. /uk-company/!!!) -> free guided 400 instead of a bare 404
  const path = new URL(c.req.url).pathname; const seg = "/" + (path.split("/")[1] || "");
  const doc = ALIAS_DOCS.find(([ap]) => ap.startsWith(seg + "/{"));
  if (doc && path.length > seg.length + 1) return c.json({ error: `malformed identifier for ${doc[1]}: expected ${doc[0]}`, free: true, note: "Input rejected before payment; you were not charged.", canonical: `${doc[1]}?${doc[2].map((k) => `${k}=...`).join("&")}`, preview: `${doc[1]}?${doc[2].map((k) => `${k}=...`).join("&")}&preview=1`, see: "/llms.txt" }, 400);
  return c.json({ error: "not found", see: "/llms.txt" }, 404);
});

// Explorer-style path aliases -> canonical paid routes (same x402 price/challenge). e.g. /tx/0xabc -> /tx?hash=0xabc
const ALIASES: [RegExp, string, (m: RegExpMatchArray) => Record<string, string>][] = [
  [/^\/(?:tx|transaction)\/(0x[0-9a-fA-F]{64})$/, "/tx", (m) => ({ hash: m[1] })],
  [/^\/ens\/(0x[0-9a-fA-F]{40})$/, "/ens", (m) => ({ address: m[1] })],
  [/^\/(?:ens|name)\/([^\/\s]+\.[^\/\s]+)$/, "/ens", (m) => ({ name: decodeURIComponent(m[1]) })],
  [/^\/(?:contract|code)\/(0x[0-9a-fA-F]{40})$/, "/contract", (m) => ({ address: m[1] })],
  [/^\/(?:wallet|address|balance)\/(0x[0-9a-fA-F]{40})$/, "/wallet", (m) => ({ address: m[1] })],
  [/^\/token\/(0x[0-9a-fA-F]{40})$/, "/token", (m) => ({ address: m[1] })],
  [/^\/token-check\/(0x[0-9a-fA-F]{40})$/, "/token-check", (m) => ({ address: m[1] })],
  [/^\/block\/(\d+|0x[0-9a-fA-F]+|latest|safe|finalized)$/, "/block", (m) => ({ number: m[1] })],
  [/^\/nft\/(0x[0-9a-fA-F]{40})\/(\d{1,78})$/, "/nft", (m) => ({ contract: m[1], token_id: m[2] })],
  [/^\/gas\/([a-z]+)$/, "/gas", (m) => ({ chain: m[1] })],
  [/^\/check\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/, "/check", (m) => ({ domain: m[1] })],
  [/^\/domain\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/, "/domain", (m) => ({ domain: m[1] })],
  [/^\/dns\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/, "/dns", (m) => ({ name: m[1] })],
  [/^\/email-check\/([^/?#]+)$/, "/email-check", (m) => ({ email: decodeURIComponent(m[1]) })],
  [/^\/meta\/(.+)$/, "/meta", (m) => ({ url: decodeURIComponent(m[1]) })],
  [/^\/iban\/([A-Za-z0-9\s\-]{15,42})$/, "/iban", (m) => ({ iban: decodeURIComponent(m[1]) })],
  [/^\/phone\/(.+)$/, "/phone", (m) => ({ phone: decodeURIComponent(m[1]) })],
  [/^\/uk-postcode\/(.+)$/, "/uk-postcode", (m) => ({ postcode: decodeURIComponent(m[1]) })],
  [/^\/siren\/([0-9\s\-]{9,20})$/, "/siren", (m) => ({ siren: decodeURIComponent(m[1]) })],
  [/^\/siret\/([0-9\s\-]{14,24})$/, "/siret", (m) => ({ siret: decodeURIComponent(m[1]) })],
  [/^\/partita-iva\/([A-Za-z0-9\s\-]{11,20})$/, "/partita-iva", (m) => ({ vat: decodeURIComponent(m[1]) })],
  [/^\/orgnr\/([0-9\s\-]{10,20})$/, "/orgnr", (m) => ({ orgnr: decodeURIComponent(m[1]) })],
  [/^\/bn-ca\/([A-Za-z0-9\s\-]{9,20})$/, "/bn-ca", (m) => ({ bn: decodeURIComponent(m[1]) })],
  [/^\/cvr\/([A-Za-z0-9\s\-]{8,12})$/, "/cvr", (m) => ({ cvr: decodeURIComponent(m[1]) })],
  [/^\/fn-at\/([A-Za-z0-9\s\-]{2,16})$/, "/fn-at", (m) => ({ fn: decodeURIComponent(m[1]) })],
  [/^\/cin-in\/([A-Za-z0-9\s\-]{21,28})$/, "/cin-in", (m) => ({ cin: decodeURIComponent(m[1]) })],
  [/^\/kvk-nl\/([A-Za-z0-9\s\-.]{8,12})$/, "/kvk-nl", (m) => ({ kvk: decodeURIComponent(m[1]) })],
  [/^\/hr-de\/([A-Za-z0-9\s\-]{4,40})$/, "/hr-de", (m) => ({ hr: decodeURIComponent(m[1]) })],
  [/^\/nif-es\/([A-Za-z0-9\s\-]{9,13})$/, "/nif-es", (m) => ({ nif: decodeURIComponent(m[1]) })],
  [/^\/cnpj\/([0-9.\/\-]{14,18})$/, "/cnpj", (m) => ({ cnpj: decodeURIComponent(m[1]) })],
  [/^\/nip-pl\/([A-Za-z0-9\s\-]{10,12})$/, "/nip-pl", (m) => ({ nip: decodeURIComponent(m[1]) })],
  [/^\/uid-ch\/([A-Za-z0-9.\-]{9,20})$/, "/uid-ch", (m) => ({ uid: decodeURIComponent(m[1]) })],
  [/^\/uk-company\/([A-Za-z0-9]{8})$/, "/uk-company", (m) => ({ number: m[1].toUpperCase() })],
  [/^\/uk-dd\/([A-Za-z0-9]{8})$/, "/uk-dd", (m) => ({ number: m[1].toUpperCase() })],
  [/^\/uk-charity\/(\d{6,8}(?:\/\d{1,2})?)$/, "/uk-charity", (m) => ({ number: m[1] })],
  [/^\/us-sec\/(\d{1,10})$/, "/us-sec", (m) => ({ cik: m[1] })],
  [/^\/us-sec\/([A-Za-z][A-Za-z0-9.\-]{0,9})$/, "/us-sec", (m) => ({ ticker: m[1].toUpperCase() })],
  [/^\/ca-company\/(\d{1,9})$/, "/ca-company", (m) => ({ [m[1].length === 9 ? "bn" : "number"]: m[1] })],
  [/^\/au-company\/(\d{9}|\d{11})$/, "/au-company", (m) => ({ [m[1].length === 11 ? "abn" : "acn"]: m[1] })],
  [/^\/fr-company\/(\d{9}|\d{14})$/, "/fr-company", (m) => ({ [m[1].length === 14 ? "siret" : "siren"]: m[1] })],
  [/^\/no-company\/(\d{9})$/, "/no-company", (m) => ({ orgnr: m[1] })],
  [/^\/dk-company\/(?:DK)?([\d\s-]{8,14})$/i, "/dk-company", (m) => ({ cvr: m[1].replace(/\D/g, "") })],
  [/^\/fi-company\/([\d\s-]{8,14})$/i, "/fi-company", (m) => ({ businessId: m[1] })],
  [/^\/ch-company\/(CHE[\d.\s-]{9,20}|\d{9})$/i, "/ch-company", (m) => ({ uid: m[1] })],
  [/^\/pl-company\/(\d{1,10})$/i, "/pl-company", (m) => ({ krs: m[1] })],
  [/^\/cz-company\/(\d{1,8})$/i, "/cz-company", (m) => ({ ico: m[1] })],
  [/^\/be-company\/(?:BE)?([0-9.\s-]{9,16})$/i, "/be-company", (m) => ({ enterprise_number: m[1] })],
  [/^\/sk-company\/(\d{1,8})$/i, "/sk-company", (m) => ({ ico: m[1] })],
  [/^\/us-entity\/(NY|CO|CT|OR|TX)\/([\w-]{1,20})$/i, "/us-entity", (m) => ({ state: m[1].toUpperCase(), id: m[2] })],
  [/^\/eu-vat\/([A-Za-z]{2}[A-Za-z0-9]{2,14})$/, "/eu-vat", (m) => ({ vat: m[1].toUpperCase() })],
  [/^\/lei\/([A-Za-z0-9]{20})$/, "/lei", (m) => ({ lei: m[1].toUpperCase() })],
];
export function rewriteAlias(req: Request): Request {
  const u = new URL(req.url);
  for (const [re, to, f] of ALIASES) {
    const m = u.pathname.match(re); if (!m) continue;
    const q = f(m); for (const [k, v] of Object.entries(q)) if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    u.pathname = to; return new Request(u.toString(), req);
  }
  return req;
}

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => app.fetch(rewriteAlias(req), env, ctx),
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
