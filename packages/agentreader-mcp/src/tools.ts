import { z } from "zod";

export const ORIGIN = process.env.AGENTREADER_ORIGIN || "https://api.axiomworks.co.uk";
export const VERSION = "1.37.0";
import CHAIN from "./chain-routes.json";

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

export const HIDDEN_TOOLS = new Set(["iban_validate","phone_check","uk_postcode_validate","siren_validate","siret_validate","partita_iva_validate","orgnr_se_validate","bn_ca_validate","cvr_dk_validate","fn_at_validate","cin_in_validate","kvk_nl_validate","hr_de_validate","nif_es_validate","cnpj_validate","nip_pl_validate","uid_ch_validate"]);
const ALL_TOOLS: ToolDef[] = [
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
    name: "email_check",
    description: "Validate an email address: syntax, MX/A DNS, disposable/free/role flags, provider guess, score+verdict. No SMTP probe. $0.002 USDC.",
    price: "$0.002",
    schema: { email: z.string() },
    http: (a) => `${ORIGIN}/email-check?email=${encodeURIComponent(a.email)}`,
    previewable: true,
  },
  {
    name: "domain_lookup",
    description: "RDAP domain registration lookup: registrar, registered, expires, age_days, status. $0.002 USDC.",
    price: "$0.002",
    schema: { domain: z.string() },
    http: (a) => `${ORIGIN}/domain?domain=${encodeURIComponent(a.domain)}`,
    previewable: true,
  },
  {
    name: "dns_lookup",
    description: "DNS resolve via Cloudflare DoH: A/AAAA/MX/TXT/NS/CNAME (optional type=). $0.001 USDC.",
    price: "$0.001",
    schema: { name: z.string(), type: z.string().optional() },
    http: (a) => {
      const q = new URLSearchParams({ name: a.name });
      if (a.type) q.set("type", a.type);
      return `${ORIGIN}/dns?${q}`;
    },
    previewable: true,
  },
  {
    name: "url_redirects",
    description: "Unwrap URL redirects / short links: final_url + hop chain (SSRF-safe). $0.001 USDC.",
    price: "$0.001",
    schema: { url: z.string() },
    http: (a) => `${ORIGIN}/redirects?url=${encodeURIComponent(a.url)}`,
    previewable: true,
  },
  {
    name: "page_meta",
    description: "Lightweight page metadata: title, description, canonical, Open Graph + Twitter, favicons, JSON-LD types, h1/h2. $0.001 USDC.",
    price: "$0.001",
    schema: { url: z.string() },
    http: (a) => `${ORIGIN}/meta?url=${encodeURIComponent(a.url)}`,
    previewable: true,
  },
  {
    name: "http_headers",
    description: "HTTP security headers audit: HSTS/CSP/XFO/XCTO + score (SSRF-safe). Not a pen-test. $0.001 USDC.",
    price: "$0.001",
    schema: { url: z.string().optional(), domain: z.string().optional() },
    http: (a) => {
      const q = new URLSearchParams();
      if (a.url) q.set("url", a.url);
      if (a.domain) q.set("domain", a.domain);
      return `${ORIGIN}/headers?${q}`;
    },
    previewable: true,
  },
  {
    name: "iban_validate",
    description: "Offline IBAN validation (ISO 13616 mod-97 + country length). Checksum only. $0.001 USDC.",
    price: "$0.001",
    schema: { iban: z.string() },
    http: (a) => `${ORIGIN}/iban?iban=${encodeURIComponent(a.iban)}`,
    previewable: true,
  },
  {
    name: "phone_check",
    description: "Offline phone validate (E.164 + country length). Structure only — not HLR/carrier. $0.001 USDC.",
    price: "$0.001",
    schema: { phone: z.string(), country: z.string().optional() },
    http: (a) => {
      const q = new URLSearchParams({ phone: a.phone });
      if (a.country) q.set("country", a.country);
      return `${ORIGIN}/phone?${q}`;
    },
    previewable: true,
  },
  {
    name: "uk_postcode_validate",
    description: "Offline UK postcode structural validate (Royal Mail format only — not assigned/deliverable). $0.001 USDC.",
    price: "$0.001",
    schema: { postcode: z.string() },
    http: (a) => `${ORIGIN}/uk-postcode?postcode=${encodeURIComponent(a.postcode)}`,
    previewable: true,
  },
  {
    name: "siren_validate",
    description: "Offline French SIREN (9-digit Luhn) validate. Structure only. $0.001 USDC.",
    price: "$0.001",
    schema: { siren: z.string() },
    http: (a) => `${ORIGIN}/siren?siren=${encodeURIComponent(a.siren)}`,
    previewable: true,
  },
  {
    name: "siret_validate",
    description: "Offline French SIRET (14-digit Luhn = SIREN+NIC) validate. Structure only. $0.001 USDC.",
    price: "$0.001",
    schema: { siret: z.string() },
    http: (a) => `${ORIGIN}/siret?siret=${encodeURIComponent(a.siret)}`,
    previewable: true,
  },
  {
    name: "partita_iva_validate",
    description: "Offline Italian Partita IVA (11-digit checksum; optional IT prefix) validate. Structure only. $0.001 USDC.",
    price: "$0.001",
    schema: { vat: z.string() },
    http: (a) => `${ORIGIN}/partita-iva?vat=${encodeURIComponent(a.vat)}`,
    previewable: true,
  },
  {
    name: "orgnr_se_validate",
    description: "Offline Swedish organisationsnummer (10-digit Luhn from left) validate. Structure only. $0.001 USDC.",
    price: "$0.001",
    schema: { orgnr: z.string() },
    http: (a) => `${ORIGIN}/orgnr?orgnr=${encodeURIComponent(a.orgnr)}`,
    previewable: true,
  },
  {
    name: "bn_ca_validate",
    description: "Offline Canadian CRA Business Number shape check (9-digit or program account). No check digit. $0.001 USDC.",
    price: "$0.001",
    schema: { bn: z.string() },
    http: (a) => `${ORIGIN}/bn-ca?bn=${encodeURIComponent(a.bn)}`,
    previewable: true,
  },
  {
    name: "cvr_dk_validate",
    description: "Offline Danish CVR validate (8-digit modulus-11). $0.001",
    schema: { cvr: z.string() },
    http: (a) => `${ORIGIN}/cvr?cvr=${encodeURIComponent(a.cvr)}`,
  },
  {
    name: "fn_at_validate",
    description: "Offline Austrian Firmenbuchnummer (FN) validate. $0.001",
    schema: { fn: z.string() },
    http: (a) => `${ORIGIN}/fn-at?fn=${encodeURIComponent(a.fn)}`,
  },
  {
    name: "kvk_nl_validate",
    description: "Offline Dutch KvK (Chamber of Commerce) number validate (8 digits; elfproef informational). Accepts number= as alias of kvk=. $0.001",
    schema: { kvk: z.string() },
    http: (a) => `${ORIGIN}/kvk-nl?kvk=${encodeURIComponent(a.kvk)}`,
  },
  {
    name: "hr_de_validate",
    description: "Offline German Handelsregister number validate (HRA/HRB/GnR/PR/VR/GsR + number; optional court prefix e.g. 'Amtsgericht München HRB 6684'). Accepts number= as alias of hr=. $0.001",
    schema: { hr: z.string() },
    http: (a) => `${ORIGIN}/hr-de?hr=${encodeURIComponent(a.hr)}`,
  },
  {
    name: "nif_es_validate",
    description: "Offline Spanish NIF/NIE/CIF validate (control letter/digit; optional ES prefix). Accepts number=/vat= as aliases of nif=. $0.001",
    schema: { nif: z.string() },
    http: (a) => `${ORIGIN}/nif-es?nif=${encodeURIComponent(a.nif)}`,
  },
  {
    name: "cnpj_validate",
    description: "Offline Brazilian CNPJ validate (14 digits + check digits; punctuation ok). Accepts number= as alias of cnpj=. $0.001",
    schema: { cnpj: z.string() },
    http: (a) => `${ORIGIN}/cnpj?cnpj=${encodeURIComponent(a.cnpj)}`,
  },
  {
    name: "nip_pl_validate",
    description: "Offline Polish NIP validate (10-digit modulus-11; optional PL prefix). Accepts number=/vat= as aliases of nip=. $0.001",
    schema: { nip: z.string() },
    http: (a) => `${ORIGIN}/nip-pl?nip=${encodeURIComponent(a.nip)}`,
  },
  {
    name: "uid_ch_validate",
    description: "Offline Swiss UID (CHE-xxx.xxx.xxx) validate (9 digits + check digit; optional MWST/TVA/IVA suffix). Accepts number=/che= as aliases of uid=. $0.001",
    schema: { uid: z.string() },
    http: (a) => `${ORIGIN}/uid-ch?uid=${encodeURIComponent(a.uid)}`,
  },
  {
    name: "cin_in_validate",
    description: "Offline Indian CIN structural validate (21 chars). $0.001",
    schema: { cin: z.string() },
    http: (a) => `${ORIGIN}/cin-in?cin=${encodeURIComponent(a.cin)}`,
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
    schema: { number: z.string().optional(),
      company_number: z.string().optional(), name: z.string().optional() },
    http: (a) =>
      a.number
        ? `${ORIGIN}/uk-company?number=${encodeURIComponent(a.number)}`
        : `${ORIGIN}/uk-company?name=${encodeURIComponent(a.name || "")}`,
    previewable: true,
  },
  {
    name: "uk_officer",
    description: "Reverse-search a UK Companies House officer/director name -> their appointments. $0.15 USDC.",
    price: "$0.15",
    schema: { name: z.string(), limit: z.string().optional() },
    http: (a) => `${ORIGIN}/uk-officer?name=${encodeURIComponent(a.name)}${a.limit ? `&limit=${encodeURIComponent(a.limit)}` : ""}`,
  },
  {
    name: "fr_company",
    description: "French company lookup (Recherche d'entreprises): SIREN/SIRET/name → status, NAF, siège, dirigeants, finances. $0.25 USDC.",
    price: "$0.25",
    schema: { siren: z.string().optional(), siret: z.string().optional(), name: z.string().optional(), q: z.string().optional(), limit: z.string().optional() },
    http: (a) => `${ORIGIN}/fr-company?${qs(a)}`,
    previewable: true,
  },
  {
    name: "no_company",
    description: "Norwegian company lookup via Brønnøysundregistrene Enhetsregisteret by orgnr (9 digits) or name. $0.25 USDC.",
    price: "$0.25",
    schema: { orgnr: z.string().optional(), name: z.string().optional(), q: z.string().optional(), limit: z.string().optional() },
    http: (a) => `${ORIGIN}/no-company?${qs(a)}`,
    previewable: true,
  },
  {
    name: "dk_company",
    description: "Danish company lookup via CVR (apicvr.dk / Erhvervsstyrelsen) by cvr (8 digits) or name. $0.25 USDC.",
    price: "$0.25",
    schema: { cvr: z.string().optional(), number: z.string().optional(), vat: z.string().optional(), name: z.string().optional(), q: z.string().optional(), limit: z.string().optional() },
    http: (a) => `${ORIGIN}/dk-company?${qs(a)}`,
    previewable: true,
  },
  {
    name: "fi_company",
    description: "Finnish company lookup via PRH YTJ open data (CC BY 4.0) by businessId/ytunnus (e.g. 0112038-9) or name. $0.25 USDC.",
    price: "$0.25",
    schema: { businessId: z.string().optional(), ytunnus: z.string().optional(), fi: z.string().optional(), number: z.string().optional(), name: z.string().optional(), q: z.string().optional(), limit: z.string().optional() },
    http: (a) => `${ORIGIN}/fi-company?${qs(a)}`,
    previewable: true,
  },
  {
    name: "ch_company",
    description: "Swiss company lookup via Zefix (UID register) by uid/che (e.g. CHE-105.909.036), ehraid, or name. $0.25 USDC.",
    price: "$0.25",
    schema: { uid: z.string().optional(), che: z.string().optional(), number: z.string().optional(), ehraid: z.string().optional(), name: z.string().optional(), q: z.string().optional(), limit: z.string().optional() },
    http: (a) => `${ORIGIN}/ch-company?${qs(a)}`,
    previewable: true,
  },
  {
    name: "pl_company",
    description: "Polish company lookup via KRS current extract by krs (10 digits) or nip (MF whitelist → KRS). No free-text name search. $0.25 USDC.",
    price: "$0.25",
    schema: { krs: z.string().optional(), nip: z.string().optional(), number: z.string().optional(), pl: z.string().optional() },
    http: (a) => `${ORIGIN}/pl-company?${qs(a)}`,
    previewable: true,
  },
  {
    name: "cz_company",
    description: "Czech company lookup via ARES by ico (8 digits) or name. $0.25 USDC.",
    price: "$0.25",
    schema: { ico: z.string().optional(), number: z.string().optional(), cz: z.string().optional(), dic: z.string().optional(), name: z.string().optional(), q: z.string().optional(), limit: z.union([z.string(), z.number()]).optional() },
    http: (a) => `${ORIGIN}/cz-company?${qs(a)}`,
    previewable: true,
  },
  {
    name: "be_company",
    description: "Belgian company lookup via CBE/KBO Public Search by enterprise_number (10 digits) or name. Legal name, VAT, status, legal form, seat, NACE, directors, capital, red flags. Example: {enterprise_number:\"0202239951\"} (Proximus). $0.25 USDC.",
    price: "$0.25",
    schema: { enterprise_number: z.string().optional(), number: z.string().optional(), be: z.string().optional(), bce: z.string().optional(), kbo: z.string().optional(), vat: z.string().optional(), name: z.string().optional(), q: z.string().optional(), limit: z.union([z.string(), z.number()]).optional() },
    http: (a) => `${ORIGIN}/be-company?${qs(a)}`,
    previewable: true,
  },
  {
    name: "sk_company",
    description: "Slovak company lookup via RPO by ico (8 digits) or name. Legal name, status, legal form, establishment/termination, address, registration, statutory bodies, red flags. Example: {ico:\"31322832\"} (SLOVNAFT). $0.25 USDC.",
    price: "$0.25",
    schema: { ico: z.string().optional(), identifier: z.string().optional(), sk: z.string().optional(), ico_sk: z.string().optional(), rpo: z.string().optional(), number: z.string().optional(), name: z.string().optional(), q: z.string().optional(), limit: z.union([z.string(), z.number()]).optional() },
    http: (a) => `${ORIGIN}/sk-company?${qs(a)}`,
    previewable: true,
  },
  {
    name: "us_entity",
    description: "US state business-entity (Secretary of State) lookup across NY, CO, CT, OR and TX open-data registries by name or state+id: status/good standing, type, formed, jurisdiction, registered agent, CT principals, red flags. Example: {name:\"Etsy Inc\"} or {state:\"CO\",id:\"20211537536\"}. $0.25 USDC.",
    price: "$0.25",
    schema: { name: z.string().optional(), q: z.string().optional(), company: z.string().optional(), state: z.string().optional(), id: z.string().optional(), number: z.string().optional(), entity_id: z.string().optional(), limit: z.union([z.string(), z.number()]).optional() },
    http: (a) => `${ORIGIN}/us-entity?${qs(a)}`,
    previewable: true,
  },
  {
    name: "registry_batch",
    description: "Batch verify up to 25 UK (Companies House, max 10), Australian (ACN/ABN), Canadian (number/BN), French (SIREN), Norwegian (orgnr), Danish (CVR), Finnish (Y-tunnus), Swiss (UID), Polish (KRS), Czech (IČO), Belgian (enterprise number) and Slovak (RPO IČO) companies in one call; comma-separated ids. $0.30 USDC.",
    price: "$0.30",
    schema: { uk: z.string().optional(), au: z.string().optional(), ca: z.string().optional(), fr: z.string().optional(), no: z.string().optional(), dk: z.string().optional(), fi: z.string().optional(), ch: z.string().optional(), pl: z.string().optional(), cz: z.string().optional(), be: z.string().optional(), sk: z.string().optional() },
    http: (a) => `${ORIGIN}/registry-batch?${new URLSearchParams(Object.entries(a).filter(([, v]) => v) as any)}`,
  },
  {
    name: "ca_company",
    description: "Canadian federal corporation lookup (Corporations Canada, ~697k active) by corporation number or 9-digit Business Number: legal name, governing act, status, filings, registered office, directors. $0.02 USDC.",
    price: "$0.02",
    schema: { number: z.string().optional(), bn: z.string().optional() },
    http: (a) => a.number ? `${ORIGIN}/ca-company?number=${encodeURIComponent(a.number)}` : `${ORIGIN}/ca-company?bn=${encodeURIComponent(a.bn || "")}`,
  },
  {
    name: "au_company",
    description: "Australian company lookup (ASIC register, ~4M companies) by ACN or ABN: name, type, status, registration date. $0.02 USDC.",
    price: "$0.02",
    schema: { acn: z.string().optional(), abn: z.string().optional() },
    http: (a) => a.acn ? `${ORIGIN}/au-company?acn=${encodeURIComponent(a.acn)}` : `${ORIGIN}/au-company?abn=${encodeURIComponent(a.abn || "")}`,
  },
  {
    name: "uk_company_lite",
    description: "Cheap UK company snapshot: status, compliance, red flags. $0.05 USDC.",
    price: "$0.05",
    schema: { number: z.string().optional(),
      company_number: z.string().optional(), name: z.string().optional() },
    http: (a) =>
      a.number
        ? `${ORIGIN}/uk-company-lite?number=${encodeURIComponent(a.number)}`
        : `${ORIGIN}/uk-company-lite?name=${encodeURIComponent(a.name || "")}`,
    previewable: true,
  },
  {
    name: "company_full",
    description: "Website company research + multi-registry DD (UK/FR/NO/DK/FI/CH/PL/CZ/BE/AU/CA/charity when signals) ($0.65).",
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
    name: "lei_lookup",
    description: "GLEIF LEI lookup with parents.direct/ultimate + BIC. $0.005 USDC.",
    price: "$0.005",
    schema: {
      lei: z.string().optional(),
      name: z.string().optional(),
      registered_as: z.string().optional(),
      country: z.string().optional(),
    },
    http: (a) => `${ORIGIN}/lei?${qs(a)}`,
    previewable: true,
  },
  {
    name: "lei_full",
    description: "GLEIF name/registered_as search up to 10 matches each with parents. $0.05 USDC.",
    price: "$0.05",
    schema: {
      name: z.string().optional(),
      registered_as: z.string().optional(),
      country: z.string().optional(),
      lei: z.string().optional(),
    },
    http: (a) => `${ORIGIN}/lei-full?${qs(a)}`,
    previewable: true,
  },
  {
    name: "read_batch",
    description: "Batch web read up to 8 URLs as Markdown. $0.015 USDC.",
    price: "$0.015",
    schema: { urls: z.any() },
    http: (a) => `${ORIGIN}/read-batch?urls=${encodeURIComponent(Array.isArray(a.urls) ? a.urls.join(",") : String(a.urls || ""))}`,
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
  {
    name: "uk_leads_lite",
    description: "UK new-incorporation leads by SIC/location/postcode_area (1-7 days), no directors. $0.25 USDC.",
    price: "$0.25",
    schema: {
      sic: z.string().optional(),
      location: z.string().optional(),
      postcode_area: z.string().optional(),
      days: z.union([z.string(), z.number()]).optional(),
      limit: z.union([z.string(), z.number()]).optional(),
    },
    http: (a) => `${ORIGIN}/uk-leads-lite?${qs(a)}`,
    previewable: true,
  },
  {
    name: "uk_leads",
    description: "UK new-incorporation leads with active director names. $1.00 USDC.",
    price: "$1.00",
    schema: {
      sic: z.string().optional(),
      location: z.string().optional(),
      postcode_area: z.string().optional(),
      days: z.union([z.string(), z.number()]).optional(),
      limit: z.union([z.string(), z.number()]).optional(),
    },
    http: (a) => `${ORIGIN}/uk-leads?${qs(a)}`,
    previewable: true,
  },
  {
    name: "uk_leads_feed",
    description: "30-day daily webhook of new UK incorporations matching SIC/location/postcode_area. $25.00/30d USDC.",
    price: "$25.00",
    schema: {
      webhook: z.string().url(),
      sic: z.string().optional(),
      location: z.string().optional(),
      postcode_area: z.string().optional(),
    },
    http: () => `${ORIGIN}/uk-leads-feed`,
    method: "POST",
    body: (a) => a,
  },
  {
    name: "uk_watch",
    description: "Watch one UK company 30 days: hourly CH poll of status/officers/filings/PSC/charges → webhook on change. $5.00/30d USDC.",
    price: "$5.00",
    schema: { number: z.string(),
      company_number: z.string().optional(), webhook: z.string().url() },
    http: () => `${ORIGIN}/uk-watch`,
    method: "POST",
    body: (a) => a,
  },
  {
    name: "uk_dd",
    description: "UK-only DD job: full Companies House pack + sanctions (entity+officers) + optional domain RDAP/website skim → trust flag. Screening only. $1.00 USDC.",
    price: "$1.00",
    schema: {
      number: z.string().optional(),
      company_number: z.string().optional(),
      name: z.string().optional(),
      domain: z.string().optional(),
    },
    http: (a) => `${ORIGIN}/uk-dd?${qs(a)}`,
    previewable: true,
  },
  {
    name: "kyb_report",
    description: "Agent KYB pack: UK/AU/CA/FR/NO/DK/FI/CH/PL/CZ/BE registry + EU VAT + optional GLEIF LEI (parents) + website + sanctions + director appointments → trust flag. Screening only. $2.50 USDC.",
    price: "$2.50",
    schema: {
      domain: z.string().optional(),
      number: z.string().optional(),
      company_number: z.string().optional(),
      name: z.string().optional(),
      vat: z.string().optional(),
      country: z.string().optional(),
      vat_number: z.string().optional(),
      acn: z.string().optional(),
      ca_number: z.string().optional(),
      bn: z.string().optional(),
      lei: z.string().optional(),
      siren: z.string().optional(),
      siret: z.string().optional(),
      orgnr: z.string().optional(),
      cvr: z.string().optional(),
      ytunnus: z.string().optional(),
      businessId: z.string().optional(),
      fi: z.string().optional(),
      uid: z.string().optional(),
      che: z.string().optional(),
      ch: z.string().optional(),
      krs: z.string().optional(),
      nip: z.string().optional(),
      pl: z.string().optional(),
      ico: z.string().optional(),
      cz: z.string().optional(),
      enterprise_number: z.string().optional(),
      be: z.string().optional(),
      bce: z.string().optional(),
      kbo: z.string().optional(),
      sk: z.string().optional(),
      ico_sk: z.string().optional(),
      rpo: z.string().optional(),
      us_state: z.string().optional(),
      us_id: z.string().optional(),
      us_name: z.string().optional(),
    },
    http: (a) => `${ORIGIN}/kyb?${qs(a)}`,
    previewable: true,
  },
];

// Single-fact EVM tools (/chain/*), generated from the server's route table.
for (const r of CHAIN as any[]) {
  ALL_TOOLS.push({
    name: r.tool,
    description: r.description.replace(/\$0\.00\d\.$/, `${r.price} USDC.`),
    price: r.price,
    schema: Object.fromEntries(Object.keys(r.params).map((k) => [k, r.required.includes(k) ? z.string().describe(r.params[k]) : z.string().optional().describe(r.params[k])])),
    http: (a) => `${ORIGIN}${r.path}?${qs(a)}`,
    previewable: true,
  } as ToolDef);
}

// 2026-11-06: $0.001 format validators unlisted; HTTP routes still work.
export const TOOLS: ToolDef[] = ALL_TOOLS.filter((t) => !HIDDEN_TOOLS.has(t.name));
