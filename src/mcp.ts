const EXAMPLES_CHAIN: Record<string, any> = {};
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createPaymentWrapper, x402ResourceServer } from "@x402/mcp";
import { facilitatorClient } from "./facilitator";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { z } from "zod";
import { readUrl, linksFor, checkDomain, readBatch } from "./core";
import { companyResearch } from "./company";
import { ukCompany } from "./uk-company";
import { companyFull } from "./company-full";
import { convertDocument } from "./convert";
import { createMonitor } from "./monitor";
import { wallet, tx, tokenCheck, fx } from "./onchain";
import { ens, tokenMeta, allowance, contractInfo, gas, block, nft } from "./micro";
import { MICRO_DESC } from "./micro-desc";
import { VALIDATE, aliasInput, TOOL_PATH } from "./validate";
import { search } from "./search";
import { ukProperty, ukArea } from "./ukdata";
import { ukCharity } from "./uk-charity";
import { usSec } from "./us-sec";
import { euVat } from "./eu-vat";
import { leiLookup, leiFull } from "./lei";
import { ukLeads, createLeadsFeed } from "./uk-leads";
import { createUkWatch } from "./uk-watch";
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
import { frCompany } from "./fr-company";
import { noCompany } from "./no-company";
import { dkCompany } from "./dk-company";
import { fiCompany } from "./fi-company";
import { chCompany } from "./ch-company";
import { plCompany } from "./pl-company";
import { czCompany } from "./cz-company";
import { beCompany } from "./be-company";
import { skCompany } from "./sk-company";
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
import { kybReport, bindingRegistries } from "./kyb";
import { ukDdReport } from "./uk-dd";
import { screenSanctions, screenSanctionsBatch } from "./sanctions";
import { ukOfficerSearch } from "./uk-officer";
import { CHAIN_ROUTES } from "./chain";
import { upsell } from "./upsell";
for (const r of CHAIN_ROUTES) { TOOL_PATH["chain_" + r.path.slice(7).replace(/-/g, "_")] = r.path; EXAMPLES_CHAIN[r.path] = r.ex; }
const EXAMPLES: Record<string, any> = { "/read": { url: "https://example.com" }, "/links": { url: "https://example.com" }, "/check": { domain: "example.com" }, "/domain": { domain: "stripe.com" }, "/dns": { name: "example.com" }, "/redirects": { url: "https://example.com" }, "/meta": { url: "https://example.com" }, "/headers": { url: "https://example.com" }, "/iban": { iban: "GB82WEST12345698765432" }, "/phone": { phone: "+447911123456" }, "/uk-postcode": { postcode: "SW1A 2AA" }, "/siren": { siren: "732829320" }, "/siret": { siret: "73282932000074" }, "/partita-iva": { vat: "00488410010" }, "/orgnr": { orgnr: "556012-5790" }, "/bn-ca": { bn: "123456789RT0001" }, "/cvr": { cvr: "10403782" }, "/fn-at": { fn: "FN 575737y" }, "/cin-in": { cin: "U72200KA2013PTC097389" }, "/kvk-nl": { kvk: "69599084" }, "/hr-de": { hr: "HRB 6684" }, "/nif-es": { nif: "A28015865" }, "/cnpj": { cnpj: "33000167000101" }, "/nip-pl": { nip: "5261040828" }, "/uid-ch": { uid: "CHE-109.322.551" }, "/company": { domain: "stripe.com" }, "/company-full": { domain: "tesco.com" },
  "/uk-company": { number: "00445790" }, "/uk-company-lite": { number: "00445790" }, "/convert": { url: "https://pdfobject.com/pdf/sample.pdf" }, "/monitor": { url: "https://example.com", webhook: "https://your.app/hook" },
  "/wallet": { address: "0x88b1c747c33A5868A34057D8C57318E5602b3ff6" }, "/tx": { hash: "0x" + "ab".repeat(32) }, "/token-check": { address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631" }, "/token": { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  "/contract": { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }, "/fx": { base: "GBP", symbols: "USD,EUR" }, "/ens": { name: "vitalik.eth" }, "/allowance": { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", owner: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", spender: "0x000000000022D473030F116dDEE9F6B43aC78BA3" },
  "/gas": { chain: "base" }, "/block": { timestamp: "2026-01-01T00:00:00Z" }, "/nft": { contract: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D", token_id: "1", chain: "ethereum" },
  "/search": { q: "x402 agent payments" }, "/uk-property": { postcode: "CB1 2AB" }, "/uk-area": { postcode: "SW1A 2AA" }, "/uk-charity": { number: "1089464" }, "/uk-charity-full": { number: "1089464" }, "/us-sec": { ticker: "AAPL" }, "/us-sec-full": { ticker: "AAPL" }, "/eu-vat": { vat: "IE6388047V" }, "/lei": { lei: "HWUPKR0MPOU8FGXBT394" }, "/lei-full": { name: "Apple Inc.", country: "US" }, "/read-batch": { urls: "https://example.com,https://example.org" }, "/uk-leads": { sic: "62012", days: 1 }, "/uk-leads-lite": { sic: "62", location: "London" }, "/uk-leads-feed": { sic: "62012", webhook: "https://your.app/hook" }, "/uk-watch": { number: "00445790", webhook: "https://your.app/hook" }, "/kyb": { domain: "tesco.com", number: "00445790" }, "/sanctions": { name: "BANCO NACIONAL DE CUBA" }, "/sanctions-batch": { names: ["BANCO NACIONAL DE CUBA", "Alice Wonderland"] }, "/uk-officer": { name: "Ken Olisa", limit: 10 }, "/fr-company": { siren: "443061841" }, "/no-company": { orgnr: "923609016" }, "/dk-company": { cvr: "24256790" }, "/fi-company": { businessId: "0112038-9" }, "/ch-company": { uid: "CHE-105.909.036" }, "/pl-company": { krs: "0000001538" }, "/cz-company": { ico: "27082440" }, "/be-company": { enterprise_number: "0202239951" }, "/sk-company": { ico: "31322832" }, "/registry-batch": { uk: "00445790", no: "923609016", dk: "24256790", fi: "0112038-9", ch: "CHE-105.909.036", pl: "0000001538", cz: "27082440", be: "0202239951", sk: "31322832" } };

const NETWORK = "eip155:8453";
function EXAMPLES_CHAIN_GET(p: string) { return EXAMPLES_CHAIN[p]; }
let rs: any = null; let ready: Promise<any> | null = null;

export async function handleMcp(req: Request, env: any, log: (rec: any) => Promise<void>) {
  if (!rs) {
    rs = new x402ResourceServer(facilitatorClient(env));
    rs.register(NETWORK, new ExactEvmScheme());
    ready = rs.initialize();
  }
  await ready;
  const mk = async (price: string, tool: string, atomic: number) => { const w: any = await mk0(price, tool, atomic); return (h: any) => { const paid = w(h); return async (a: any, extra: any) => {
    const p = TOOL_PATH[tool]; if (p) aliasInput(p, a || {}); const e = p && VALIDATE[p] ? VALIDATE[p](a || {}) : null;
    if (e) return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: e, free: true, note: "Input rejected before payment; you were not charged.", example: EXAMPLES[p] || EXAMPLES_CHAIN_GET(p) || null }) }] };
    return paid(a, extra); }; }; };
  const mk0 = async (price: string, tool: string, atomic: number) => createPaymentWrapper(rs, {
    resource: { url: `mcp://tool/${tool}`, description: `Axiom Works AgentReader ${tool}`, mimeType: "application/json", serviceName: "Axiom Works AgentReader", tags: ["x402", "uk", "web", "onchain", "charity"] },
    accepts: await rs.buildPaymentRequirements({ scheme: "exact", network: NETWORK, payTo: env.PAY_TO, price, maxTimeoutSeconds: 120 }),
    hooks: { onAfterSettlement: async ({ settlement }: any) => {
      await log({ endpoint: `mcp:${tool}`, payer: settlement?.payer || null, amount: settlement?.amount || String(atomic), network: settlement?.network, tx: settlement?.transaction, success: settlement?.success });
    } },
  } as any);
  const server = new McpServer({ name: "agentreader", title: "Axiom Works AgentReader", version: "1.39.3" }, { instructions: "Start with the big hitters: kyb ($2.50 one-shot KYB pack), uk_dd ($1 UK due diligence), uk_company ($0.50), uk_watch ($5/30d), uk_leads ($1), uk_leads_feed ($25/30d), company_research ($0.25), company_full ($0.65), sanctions_batch ($1), uk_charity_full ($0.25), fr_company ($0.25), no_company ($0.25), dk_company ($0.25), fi_company ($0.25), ch_company ($0.25), pl_company ($0.25), cz_company ($0.25), be_company ($0.25), sk_company ($0.25), registry_batch ($0.30), uk_officer ($0.15). Call pricing for the full list." });
  const HIDDEN_TOOLS = new Set(["iban_validate","phone_check","uk_postcode_validate","siren_validate","siret_validate","partita_iva_validate","orgnr_se_validate","bn_ca_validate","cvr_dk_validate","fn_at_validate","cin_in_validate","kvk_nl_validate","hr_de_validate","nif_es_validate","cnpj_validate","nip_pl_validate","uid_ch_validate"]);
  { const _tool = server.tool.bind(server); (server as any).tool = (n: string, ...r: any[]) => HIDDEN_TOOLS.has(n) ? undefined : (_tool as any)(n, ...r); }
  { const orig = (server as any).tool.bind(server); (server as any).tool = (name: string, desc: any, ...rest: any[]) => orig(name, typeof desc === "string" ? upsell(TOOL_PATH[name] || "", desc) : desc, ...rest); }
  const json = (d: any) => ({ content: [{ type: "text" as const, text: JSON.stringify(d) }] });
  const err = (e: any) => ({ isError: true, content: [{ type: "text" as const, text: String(e?.message || e) }] });

  server.tool("read_url",
    "Use this when you need clean Markdown + metadata from a public URL (not raw HTML). Returns title, author, date, language, word_count, markdown, links. Better for RAG/summaries than fetch. Example: {url:\"https://example.com\"}. $0.002 USDC on Base via x402.",
    { url: z.string().url() },
    (await mk("$0.002", "read_url", 2000))(async (a: any) => { try { return json(await readUrl(a.url)); } catch (e) { return err(e); } }) as any);

  server.tool("extract_links",
    "Use this when you only need de-duplicated absolute links (crawl maps). Cheaper/faster than read_url. Example: {url} → {count, links:[{url,text,internal}]}. $0.001 USDC.",
    { url: z.string().url() },
    (await mk("$0.001", "extract_links", 1000))(async (a: any) => { try { return json(await linksFor(a.url)); } catch (e) { return err(e); } }) as any);

  server.tool("email_check",
    "Validate an email: syntax, MX/A DNS, disposable/free/role flags, provider guess, score+verdict. No SMTP probe. $0.002 USDC.",
    { email: z.string() },
    (await mk("$0.002", "email_check", 2000))(async (a: any) => { try { return json(await emailCheck(a)); } catch (e) { return err(e); } }) as any);
  server.tool("domain_lookup",
    "RDAP domain registration lookup: registrar, registered, expires, age_days, status. Free upstream (rdap.org / Nominet). Example: {domain:\"stripe.com\"}. $0.002 USDC.",
    { domain: z.string() },
    (await mk("$0.002", "domain_lookup", 2000))(async (a: any) => { try { return json(await domainLookup(a)); } catch (e) { return err(e); } }) as any);
  server.tool("dns_lookup",
    "DNS resolve via Cloudflare DoH: A/AAAA/MX/TXT/NS/CNAME (optional type=). Public DNS only. Example: {name:\"example.com\"} or {name:\"example.com\",type:\"MX\"}. $0.001 USDC.",
    { name: z.string(), type: z.string().optional() },
    (await mk("$0.001", "dns_lookup", 1000))(async (a: any) => { try { return json(await dnsLookup(a)); } catch (e) { return err(e); } }) as any);
  server.tool("url_redirects",
    "Unwrap URL redirects / short links: follow Location hops with SSRF guards, return final_url + chain (no body). Not a malware verdict. Example: {url:\"https://example.com\"}. $0.001 USDC.",
    { url: z.string() },
    (await mk("$0.001", "url_redirects", 1000))(async (a: any) => { try { return json(await redirectsLookup(a)); } catch (e) { return err(e); } }) as any);
  server.tool("page_meta",
    "Lightweight page metadata: title, description, canonical, Open Graph + Twitter tags, favicons, JSON-LD @types, h1/h2. Cheaper than read_url when you do not need Markdown. Example: {url:\"https://example.com\"}. $0.001 USDC.",
    { url: z.string() },
    (await mk("$0.001", "page_meta", 1000))(async (a: any) => { try { return json(await pageMeta(a)); } catch (e) { return err(e); } }) as any);
  server.tool("http_headers",
    "HTTP security headers audit: HSTS/CSP/XFO/XCTO/Referrer/Permissions/COOP/CORP/COEP + score (SSRF-safe). Not a pen-test. Example: {url:\"https://example.com\"} or {domain:\"example.com\"}. $0.001 USDC.",
    { url: z.string().optional(), domain: z.string().optional() },
    (await mk("$0.001", "http_headers", 1000))(async (a: any) => { try { return json(await headersAudit(a)); } catch (e) { return err(e); } }) as any);
  server.tool("iban_validate",
    "Offline IBAN validation (ISO 13616 mod-97 + country length). Checksum only — not proof account exists. Example: {iban:\"GB82WEST12345698765432\"}. $0.001 USDC.",
    { iban: z.string() },
    (await mk("$0.001", "iban_validate", 1000))(async (a: any) => { try { return json(validateIban(a)); } catch (e) { return err(e); } }) as any);
  server.tool("phone_check",
    "Offline phone validate (E.164 + country length). Structure only — not HLR/carrier. Example: {phone:\"+447911123456\"} or {phone:\"07911123456\",country:\"GB\"}. $0.001 USDC.",
    { phone: z.string(), country: z.string().optional() },
    (await mk("$0.001", "phone_check", 1000))(async (a: any) => { try { return json(validatePhone(a)); } catch (e) { return err(e); } }) as any);
  server.tool("uk_postcode_validate",
    "Offline UK postcode structural validate (Royal Mail format only — not assigned/deliverable/geocode). Path alias /uk-postcode/{postcode}. Example: {postcode:\"SW1A 2AA\"}. Upsell uk_area / uk_property. $0.001 USDC.",
    { postcode: z.string() },
    (await mk("$0.001", "uk_postcode_validate", 1000))(async (a: any) => { try { return json(validateUkPostcode(a)); } catch (e) { return err(e); } }) as any);
  server.tool("siren_validate",
    "Offline French SIREN validate (9-digit Luhn; La Poste exception). Structure only. Example: {siren:\"732829320\"}. $0.001 USDC.",
    { siren: z.string() },
    (await mk("$0.001", "siren_validate", 1000))(async (a: any) => { try { return json(validateSiren(a)); } catch (e) { return err(e); } }) as any);
  server.tool("siret_validate",
    "Offline French SIRET validate (14-digit Luhn = SIREN+NIC). Structure only. Example: {siret:\"73282932000074\"}. $0.001 USDC.",
    { siret: z.string() },
    (await mk("$0.001", "siret_validate", 1000))(async (a: any) => { try { return json(validateSiret(a)); } catch (e) { return err(e); } }) as any);
  server.tool("partita_iva_validate",
    "Offline Italian Partita IVA validate (11-digit checksum; optional IT prefix). Structure only. Example: {vat:\"00488410010\"}. $0.001 USDC.",
    { vat: z.string() },
    (await mk("$0.001", "partita_iva_validate", 1000))(async (a: any) => { try { return json(validatePartitaIva(a)); } catch (e) { return err(e); } }) as any);
  server.tool("orgnr_se_validate",
    "Offline Swedish organisationsnummer validate (10-digit Luhn from left). Structure only. Example: {orgnr:\"556012-5790\"}. $0.001 USDC.",
    { orgnr: z.string() },
    (await mk("$0.001", "orgnr_se_validate", 1000))(async (a: any) => { try { return json(validateOrgnr(a)); } catch (e) { return err(e); } }) as any);
  server.tool("bn_ca_validate",
    "Offline Canadian CRA Business Number shape check (9-digit or program account). No check digit. Example: {bn:\"123456789RT0001\"}. $0.001 USDC.",
    { bn: z.string() },
    (await mk("$0.001", "bn_ca_validate", 1000))(async (a: any) => { try { return json(validateBnCa(a)); } catch (e) { return err(e); } }) as any);
  server.tool("cvr_dk_validate",
    "Offline Danish CVR validate (8-digit modulus-11; optional DK prefix). Structure only. Example: {cvr:\"10403782\"}. $0.001 USDC.",
    { cvr: z.string() },
    (await mk("$0.001", "cvr_dk_validate", 1000))(async (a: any) => { try { return json(validateCvr(a)); } catch (e) { return err(e); } }) as any);
  server.tool("fn_at_validate",
    "Offline Austrian Firmenbuchnummer (FN) validate (digits + check letter). Structure only. Example: {fn:\"FN 575737y\"}. $0.001 USDC.",
    { fn: z.string() },
    (await mk("$0.001", "fn_at_validate", 1000))(async (a: any) => { try { return json(validateFn(a)); } catch (e) { return err(e); } }) as any);
  server.tool("cin_in_validate",
    "Offline Indian CIN structural validate (21 chars; no check digit). Example: {cin:\"U72200KA2013PTC097389\"}. $0.001 USDC.",
    { cin: z.string() },
    (await mk("$0.001", "cin_in_validate", 1000))(async (a: any) => { try { return json(validateCin(a)); } catch (e) { return err(e); } }) as any);
  server.tool("kvk_nl_validate",
    "Offline Dutch KvK (Chamber of Commerce) number validate (8 digits; elfproef informational). Accepts number= as alias of kvk=. Structure only. Example: {kvk:\"69599084\"}. $0.001 USDC.",
    { kvk: z.string() },
    (await mk("$0.001", "kvk_nl_validate", 1000))(async (a: any) => { try { return json(validateKvk(a)); } catch (e) { return err(e); } }) as any);
  server.tool("hr_de_validate",
    "Offline German Handelsregister number validate (HRA/HRB/GnR/PR/VR/GsR + number; optional court prefix e.g. 'Amtsgericht München HRB 6684'). Accepts number= as alias of hr=. Structure only. Example: {hr:\"HRB 6684\"}. $0.001 USDC.",
    { hr: z.string() },
    (await mk("$0.001", "hr_de_validate", 1000))(async (a: any) => { try { return json(validateHr(a)); } catch (e) { return err(e); } }) as any);
  server.tool("nif_es_validate",
    "Offline Spanish NIF/NIE/CIF validate (control letter/digit; optional ES prefix). Accepts number=/vat= as aliases of nif=. Structure only. Example: {nif:\"A28015865\"}. $0.001 USDC.",
    { nif: z.string() },
    (await mk("$0.001", "nif_es_validate", 1000))(async (a: any) => { try { return json(validateNif(a)); } catch (e) { return err(e); } }) as any);
  server.tool("cnpj_validate",
    "Offline Brazilian CNPJ validate (14 digits + check digits; punctuation ok). Accepts number= as alias of cnpj=. Structure only. Example: {cnpj:\"33000167000101\"}. $0.001 USDC.",
    { cnpj: z.string() },
    (await mk("$0.001", "cnpj_validate", 1000))(async (a: any) => { try { return json(validateCnpj(a)); } catch (e) { return err(e); } }) as any);
  server.tool("nip_pl_validate",
    "Offline Polish NIP validate (10-digit modulus-11; optional PL prefix). Accepts number=/vat= as aliases of nip=. Structure only. Example: {nip:\"5261040828\"}. $0.001 USDC.",
    { nip: z.string() },
    (await mk("$0.001", "nip_pl_validate", 1000))(async (a: any) => { try { return json(validateNip(a)); } catch (e) { return err(e); } }) as any);
  server.tool("uid_ch_validate",
    "Offline Swiss UID (CHE-xxx.xxx.xxx) validate (9 digits + check digit; optional MWST/TVA/IVA suffix). Accepts number=/che= as aliases of uid=. Structure only. Example: {uid:\"CHE-109.322.551\"}. $0.001 USDC.",
    { uid: z.string() },
    (await mk("$0.001", "uid_ch_validate", 1000))(async (a: any) => { try { return json(validateUid(a)); } catch (e) { return err(e); } }) as any);
  server.tool("check_domain",
    "Use this when vetting domain health before outreach: DNS (DoH), DNSSEC, TLS/HTTPS, HSTS, MX/SPF/DMARC, issues + score. Structured JSON beats shell dig/openssl. Example: {domain:\"stripe.com\"}. $0.001 USDC.",
    { domain: z.string() },
    (await mk("$0.001", "check_domain", 1000))(async (a: any) => { try { return json(await checkDomain(a.domain)); } catch (e) { return err(e); } }) as any);

  server.tool("company_research",
    "Use this when researching a company from its website domain (not UK Companies House). Sourced tech stack, socials, emails/phones, DNS/MX/SPF/DMARC, RDAP, SSL, sitemap, news - no LLM fiction. Example: {domain:\"stripe.com\"}. Prefer uk_company* for UK filings. $0.25 USDC.",
    { domain: z.string() },
    (await mk("$0.25", "company_research", 250000))(async (a: any) => { try { return json(await companyResearch({ domain: a.domain })); } catch (e) { return err(e); } }) as any);

  server.tool("uk_company",
    "Use this for full UK Companies House due diligence (number or name): profile, officers, PSCs, filings, charges, insolvency + red flags (overdue, dissolved, officer churn, mass-formation office). Official API with public fallback. Example: {number:\"00445790\"}. Prefer uk_company_lite ($0.05) for status/flags only. $0.50 USDC.",
    { number: z.string().optional(), name: z.string().optional() },
    (await mk("$0.50", "uk_company", 500000))(async (a: any) => { try { return json(await ukCompany(env, { number: a.number, name: a.name })); } catch (e) { return err(e); } }) as any);

  server.tool("uk_company_lite",
    "Use this for a cheap UK company snapshot: status, SIC, office, compliance overdue, mass-formation check, red flags. Example: {number:\"00445790\"}. Upsell uk_company for officers/PSC/filings/charges/insolvency. $0.05 USDC.",
    { number: z.string().optional(), name: z.string().optional() },
    (await mk("$0.05", "uk_company_lite", 50000))(async (a: any) => { try { return json(await ukCompany(env, { number: a.number, name: a.name, lite: true })); } catch (e) { return err(e); } }) as any);

  server.tool("company_full",
    "Use this for website company research + multi-registry DD in one call ($0.65). Soft-attaches UK CH, FR, NO, DK, FI, CH Zefix, PL KRS, CZ ARES, BE CBE/KBO, SK RPO, AU, CA, and UK charity when domain/page signals match. Example: {domain:\"tesco.com\"} → {company, uk, fr, no, dk, fi, ch, pl, cz, be, au, ca, charity, *_included}. $0.65 USDC.",
    { domain: z.string() },
    (await mk("$0.65", "company_full", 650000))(async (a: any) => { try { return json(await companyFull(env, { domain: a.domain }, bindingRegistries(env))); } catch (e) { return err(e); } }) as any);

  server.tool("uk_charity",
    "Use this for a cheap UK charity snapshot (Charity Commission E&W): status, registration/removal, income/spending, trustees count, website, activities. Lookup by registered number or name. OGL v3. Example: {number:\"1089464\"}. Upsell uk_charity_full. $0.05 USDC.",
    { number: z.string().optional(), name: z.string().optional(), suffix: z.string().optional() },
    (await mk("$0.05", "uk_charity", 50000))(async (a: any) => { try { return json(await ukCharity(env, { number: a.number, name: a.name, suffix: a.suffix })); } catch (e) { return err(e); } }) as any);


  server.tool("us_sec",
    "Use this for a cheap US SEC EDGAR company snapshot by ticker or CIK: name, tickers/exchanges, SIC, EIN, addresses, phone, former names, last ~15 filings, website. Fair-use EDGAR. Example: {ticker:\"AAPL\"}. Upsell us_sec_full. $0.05 USDC.",
    { ticker: z.string().optional(), cik: z.string().optional() },
    (await mk("$0.05", "us_sec", 50000))(async (a: any) => { try { return json(await usSec(env, { ticker: a.ticker, cik: a.cik })); } catch (e) { return err(e); } }) as any);

  server.tool("us_sec_full",
    "Use this for fuller US SEC DD: lite snapshot + key us-gaap companyfacts (Assets, Liabilities, Equity, Revenues, NetIncomeLoss, EPS) + red-flag heuristics (NT 10-K, Item 4.02, distress signals). Example: {ticker:\"AAPL\"}. $0.25 USDC.",
    { ticker: z.string().optional(), cik: z.string().optional() },
    (await mk("$0.25", "us_sec_full", 250000))(async (a: any) => { try { return json(await usSec(env, { ticker: a.ticker, cik: a.cik, full: true })); } catch (e) { return err(e); } }) as any);

  server.tool("eu_vat",
    "Use this to validate an EU VAT number via official VIES: valid, name, address, requestDate. Input vat like IE6388047V or DE123456789 (or country+number; EL for Greece). $0.01 USDC.",
    { vat: z.string().optional(), country: z.string().optional(), number: z.string().optional() },
    (await mk("$0.01", "eu_vat", 10000))(async (a: any) => { try { return json(await euVat(env, { vat: a.vat, country: a.country, number: a.number })); } catch (e) { return err(e); } }) as any);

  server.tool("lei_lookup",
    "GLEIF LEI lookup (CC0): lei/name/registered_as. ALWAYS includes parents.direct + parents.ultimate (null if unreported), BIC/mapped ids, addresses, status. Upsell lei_full for up to 10 name matches. Example: {lei:\"HWUPKR0MPOU8FGXBT394\"}. $0.005 USDC.",
    { lei: z.string().optional(), name: z.string().optional(), registered_as: z.string().optional(), country: z.string().optional() },
    (await mk("$0.005", "lei_lookup", 5000))(async (a: any) => { try { return json(await leiLookup(env, a)); } catch (e) { return err(e); } }) as any);

  server.tool("lei_full",
    "GLEIF multi-match name/registered_as screening: up to 10 candidates each with parents.direct/ultimate. Prefer lei_lookup $0.005 for a single LEI. Example: {name:\"Apple Inc.\",country:\"US\"}. $0.05 USDC.",
    { name: z.string().optional(), registered_as: z.string().optional(), country: z.string().optional(), lei: z.string().optional() },
    (await mk("$0.05", "lei_full", 50000))(async (a: any) => { try { return json(await leiFull(env, a)); } catch (e) { return err(e); } }) as any);

  server.tool("read_batch",
    "Batch web read up to 8 URLs (~$0.0019/url): Markdown + title/word_count per URL. Pass urls as comma-string or array. $0.015 USDC.",
    { urls: z.any() },
    (await mk("$0.015", "read_batch", 15000))(async (a: any) => { try { return json(await readBatch({ urls: a.urls })); } catch (e) { return err(e); } }) as any);

  server.tool("uk_charity_full",
    "Use this for full UK charity due diligence: trustees, 5-year finances, assets/liabilities, governance, areas of operation, regulatory/insolvency flags, linked charities, other names + red-flag summary. OGL v3. Example: {number:\"1089464\"}. $0.25 USDC.",
    { number: z.string().optional(), name: z.string().optional(), suffix: z.string().optional() },
    (await mk("$0.25", "uk_charity_full", 250000))(async (a: any) => { try { return json(await ukCharity(env, { number: a.number, name: a.name, suffix: a.suffix, full: true })); } catch (e) { return err(e); } }) as any);

  server.tool("convert_document",
    "Use this when converting a public PDF/DOCX/HTML/text URL to markdown or plain text for RAG/summaries. Example: {url, format:\"markdown\"} → {detected_format, markdown, pages, word_count}. $0.03 USDC.",
    { url: z.string().url(), format: z.enum(["markdown", "text"]).optional() },
    (await mk("$0.03", "convert_document", 30000))(async (a: any) => { try { return json(await convertDocument(a.url, a.format === "text" ? "text" : "markdown")); } catch (e) { return err(e); } }) as any);

  server.tool("create_monitor",
    "Use this for 30 days of hourly web change monitoring with webhook alerts (pricing/status/jobs pages). Returns id; GET /monitor/:id is free. Example: {url, webhook, selector?}. $1.00 USDC.",
    { url: z.string().url(), webhook: z.string().url(), selector: z.string().optional(), keyword: z.string().optional() },
    (await mk("$1.00", "create_monitor", 1000000))(async (a: any) => {
      try {
        const mon = await createMonitor(env, { url: a.url, webhook: a.webhook, selector: a.selector, keyword: a.keyword });
        return json({ ...mon, status_url: `https://api.axiomworks.co.uk/monitor/${mon.id}` });
      } catch (e) { return err(e); }
    }) as any);

  const chainZ = z.enum(["base", "ethereum", "arbitrum", "optimism", "polygon"]).optional();
  server.tool("wallet_balances",
    "Use this when you need an EVM wallet's balances in one call: native ETH/POL + USDC/USDT/DAI/WETH/cbBTC/EURC (+ up to 10 custom ERC20 addresses comma-separated), nonce, is_contract. Chains: base (default), ethereum, arbitrum, optimism, polygon. $0.003 USDC.",
    { address: z.string(), chain: chainZ, tokens: z.string().optional() },
    (await mk("$0.003", "wallet_balances", 3000))(async (a: any) => { try { return json(await wallet(a)); } catch (e) { return err(e); } }) as any);
  server.tool("tx_status",
    "Use this to verify a transaction or payment landed: status success/reverted/pending, block, timestamp, confirmations, from/to, value, fee, decoded ERC20 transfers (USDC amounts). Chains: base (default), ethereum, arbitrum, optimism, polygon. $0.003 USDC.",
    { hash: z.string(), chain: chainZ },
    (await mk("$0.003", "tx_status", 3000))(async (a: any) => { try { return json(await tx(a)); } catch (e) { return err(e); } }) as any);
  server.tool("token_check",
    "Use this before buying, accepting or listing an ERC20 token: name/symbol/supply, owner renounced?, upgradeable proxy, DEX price/liquidity/volume/pair age + rule-based risk flags, 0-100 score and verdict. Not financial advice. $0.01 USDC.",
    { address: z.string(), chain: chainZ },
    (await mk("$0.01", "token_check", 10000))(async (a: any) => { try { return json(await tokenCheck(a)); } catch (e) { return err(e); } }) as any);
  server.tool("au_company",
    "Use this for an Australian company lookup from the ASIC register by ACN (9 digits) or ABN (11 digits): name, former names, type, class, status, registration/deregistration dates. ASIC Company Dataset (CC BY 3.0 AU). $0.02 USDC.",
    { acn: z.string().optional(), abn: z.string().optional() },
    (await mk("$0.02", "au_company", 20000))(async (a: any) => { try {
      const raw = String(a.acn || a.abn || "").replace(/\s/g, ""); const acn = /^\d{11}$/.test(raw) ? raw.slice(2) : raw;
      if (!/^\d{9}$/.test(acn)) throw new Error("acn must be 9 digits (or abn 11 digits)");
      const r = await env.AU.fetch(`https://au.internal/internal/au?acn=${acn}`, { headers: { "x-internal-key": env.AU_INTERNAL_KEY || "" } });
      return json(await r.json()); } catch (e) { return err(e); } }) as any);
  server.tool("fr_company",
    "French company lookup via API Recherche d'entreprises (INSEE/RNE): name, SIREN, status, NAF, siège, dirigeants, finances, red flags. Search by siren, siret, or name. Example: {siren:\"443061841\"}. $0.25 USDC.",
    { siren: z.string().optional(), siret: z.string().optional(), name: z.string().optional(), q: z.string().optional(), limit: z.union([z.string(), z.number()]).optional() },
    (await mk("$0.25", "fr_company", 250000))(async (a: any) => { try { return json(await frCompany(a)); } catch (e) { return err(e); } }) as any);
  server.tool("no_company",
    "Norwegian company lookup via Brønnøysundregistrene Enhetsregisteret: name, orgnr, orgform, status/konkurs/liquidation, forretningsadresse, NACE, ansatte, red flags. Search by orgnr (9 digits) or name. Example: {orgnr:\"923609016\"}. $0.25 USDC.",
    { orgnr: z.string().optional(), name: z.string().optional(), q: z.string().optional(), limit: z.union([z.string(), z.number()]).optional() },
    (await mk("$0.25", "no_company", 250000))(async (a: any) => { try { return json(await noCompany(a)); } catch (e) { return err(e); } }) as any);
  server.tool("dk_company",
    "Danish company lookup via CVR (apicvr.dk / Erhvervsstyrelsen): name, CVR, status, type, address, industry, employees, direktion/ejere, red flags. Search by cvr (8 digits) or name. Example: {cvr:\"24256790\"}. $0.25 USDC.",
    { cvr: z.string().optional(), number: z.string().optional(), vat: z.string().optional(), name: z.string().optional(), q: z.string().optional(), limit: z.union([z.string(), z.number()]).optional() },
    (await mk("$0.25", "dk_company", 250000))(async (a: any) => { try { return json(await dkCompany(a)); } catch (e) { return err(e); } }) as any);
  server.tool("ch_company",
    "Swiss company lookup via Zefix (UID register) by uid/che (e.g. CHE-105.909.036), ehraid, or name. $0.25 USDC.",
    { uid: z.string().optional(), che: z.string().optional(), number: z.string().optional(), ehraid: z.string().optional(), name: z.string().optional(), q: z.string().optional(), limit: z.string().optional() },
    (await mk("$0.25", "ch_company", 250000))(async (a: any) => { try { return json(await chCompany(a)); } catch (e) { return err(e); } }) as any);
  server.tool("fi_company",
    "Finnish company lookup via PRH YTJ open data (CC BY 4.0): name, Y-tunnus, status, form, address, main business line, website, situations, red flags. Search by businessId/ytunnus/fi or name. Example: {businessId:\"0112038-9\"}. $0.25 USDC.",
    { businessId: z.string().optional(), ytunnus: z.string().optional(), fi: z.string().optional(), number: z.string().optional(), name: z.string().optional(), q: z.string().optional(), limit: z.union([z.string(), z.number()]).optional() },
    (await mk("$0.25", "fi_company", 250000))(async (a: any) => { try { return json(await fiCompany(a)); } catch (e) { return err(e); } }) as any);
  server.tool("pl_company",
    "Polish company lookup via KRS current extract (api-krs.ms.gov.pl) by krs (10 digits) or nip (MF whitelist → KRS). Name, legal form, seat, PKD, representation, capital, red flags. No free-text name search. Example: {krs:\"0000001538\"} or {nip:\"5260300291\"}. $0.25 USDC.",
    { krs: z.string().optional(), nip: z.string().optional(), number: z.string().optional(), pl: z.string().optional() },
    (await mk("$0.25", "pl_company", 250000))(async (a: any) => { try { return json(await plCompany(a)); } catch (e) { return err(e); } }) as any);
  server.tool("cz_company",
    "Czech company lookup via ARES (ares.gov.cz) by ico (8 digits) or name. Legal name, DIČ, status, legal form, seat, CZ-NACE, optional VR capital/court file, red flags. Example: {ico:\"27082440\"} (Alza.cz) or {name:\"Seznam.cz\"}. $0.25 USDC.",
    { ico: z.string().optional(), number: z.string().optional(), cz: z.string().optional(), dic: z.string().optional(), name: z.string().optional(), q: z.string().optional(), limit: z.union([z.string(), z.number()]).optional() },
    (await mk("$0.25", "cz_company", 250000))(async (a: any) => { try { return json(await czCompany(a)); } catch (e) { return err(e); } }) as any);
  server.tool("be_company",
    "Belgian company lookup via CBE/KBO Public Search by enterprise_number (10 digits, e.g. 0202239951) or name. Legal name, status, legal form, seat, NACE, directors, capital, red flags. Example: {enterprise_number:\"0202239951\"} (Proximus) or {name:\"BNP Paribas Fortis\"}. $0.25 USDC.",
    { enterprise_number: z.string().optional(), number: z.string().optional(), be: z.string().optional(), vat: z.string().optional(), bce: z.string().optional(), kbo: z.string().optional(), name: z.string().optional(), q: z.string().optional(), limit: z.number().optional() },
    (await mk("$0.25", "be_company", 250000))(async (a: any) => { try { return json(await beCompany(a)); } catch (e) { return err(e); } }) as any);
  server.tool(
    "sk_company",
    "Slovak company lookup via RPO (api.statistics.sk) by ico (8 digits) or name. Legal name, status, legal form, establishment/termination, address, registration office/number, statutory bodies, stakeholders, successors, red flags. Example: {ico:\"31322832\"} (SLOVNAFT) or {name:\"Slovnaft\"}. $0.25 USDC.",
    { ico: z.string().optional(), identifier: z.string().optional(), sk: z.string().optional(), ico_sk: z.string().optional(), rpo: z.string().optional(), number: z.string().optional(), name: z.string().optional(), q: z.string().optional(), limit: z.union([z.string(), z.number()]).optional() },
    (await mk("$0.25", "sk_company", 250000))(async (a: any) => { try { return json(await skCompany(a)); } catch (e) { return err(e); } }) as any);
  server.tool("ca_company",
    "Use this for a Canadian federal corporation lookup (Corporations Canada) by corporation number or 9-digit Business Number: legal name, governing act, status, annual filing, registered office, directors min/max. OGL-Canada. $0.02 USDC.",
    { number: z.string().optional(), bn: z.string().optional() },
    (await mk("$0.02", "ca_company", 20000))(async (a: any) => { try {
      const bn = String(a.bn || "").replace(/\D/g, "").slice(0, 9), num = String(a.number || "").replace(/\D/g, "");
      const q = num && num.length <= 8 ? `number=${num}` : bn.length === 9 ? `bn=${bn}` : null; if (!q) throw new Error("number (up to 8 digits) or bn (9 digits) required");
      const r = await env.AU.fetch(`https://au.internal/internal/ca?${q}`, { headers: { "x-internal-key": env.AU_INTERNAL_KEY || "" } });
      return json(await r.json()); } catch (e) { return err(e); } }) as any);
  server.tool("registry_batch",
    "Use this to verify up to 25 UK (Companies House, max 10), Australian (ACN/ABN), Canadian (corp number/BN), French (SIREN), Norwegian (orgnr), Danish (CVR), Finnish (Y-tunnus), Swiss (UID), Polish (KRS), Czech (IČO) and Belgian (enterprise number) companies in one call: name, status, type, dates, UK red flags. Comma-separated ids. $0.30 USDC.",
    { uk: z.string().optional(), au: z.string().optional(), ca: z.string().optional(), fr: z.string().optional(), no: z.string().optional(), dk: z.string().optional(), fi: z.string().optional(), ch: z.string().optional(), pl: z.string().optional(), cz: z.string().optional(), be: z.string().optional() },
    (await mk("$0.30", "registry_batch", 300000))(async (a: any) => { try {
      const sp = (v: any) => String(v || "").split(/[\s,;]+/).map((x) => x.replace(/\D/g, "")).filter(Boolean);
      const au = sp(a.au), ca = sp(a.ca), fr = sp(a.fr).filter((x: string) => x.length === 9), no = sp(a.no).filter((x: string) => x.length === 9), dk = sp(a.dk).filter((x: string) => x.length === 8), fi = sp(a.fi).filter((x: string) => x.length === 8), ch = String(a.ch || "").split(/[\s,;]+/).map((x: string) => x.replace(/\D/g, "")).filter((x: string) => x.length === 9), pl = sp(a.pl).map((x: string) => x.padStart(10, "0")).filter((x: string) => x.length === 10), cz = sp(a.cz).map((x: string) => x.padStart(8, "0")).filter((x: string) => x.length === 8), be = sp(a.be).map((x: string) => x.replace(/\D/g, "")).map((x: string) => x.length === 9 ? "0"+x : x).filter((x: string) => x.length === 10), sk = sp(a.sk).map((x: string) => x.padStart(8, "0")).filter((x: string) => x.length === 8), uk = String(a.uk || "").split(/[\s,;]+/).map((x) => x.toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean); if (!au.length && !ca.length && !uk.length && !fr.length && !no.length && !dk.length && !fi.length && !ch.length && !pl.length && !cz.length && !be.length && !sk.length) throw new Error("uk, au, ca, fr, no, dk, fi, ch, pl, cz, be or sk ids required"); if (uk.length > 10 || au.length + ca.length + uk.length + fr.length + no.length + dk.length + fi.length + ch.length + pl.length + cz.length + be.length + sk.length > 25) throw new Error("max 25 ids (uk max 10)");
      const h = { headers: { "x-internal-key": env.AU_INTERNAL_KEY || "" } };
      const one = async (c: string, id: string) => { const q = c === "AU" ? `au?acn=${id.length === 11 ? id.slice(2) : id}` : `ca?${id.length === 9 ? "bn" : "number"}=${id}`; const r = await env.AU.fetch(`https://au.internal/internal/${q}`, h); return { country: c, id, found: r.ok, data: r.ok ? await r.json() : null }; };
      const ukOne = async (id: string) => { try { return { country: "UK", id, found: true, data: await ukCompany(env, { number: id.padStart(8, "0"), lite: true }) }; } catch (e: any) { return { country: "UK", id, found: false, error: e?.message }; } };
      const frOne = async (id: string) => { try { return { country: "FR", id, found: true, data: await frCompany({ siren: id, lite: true }) }; } catch (e: any) { return { country: "FR", id, found: false, error: e?.message }; } };
      const noOne = async (id: string) => { try { return { country: "NO", id, found: true, data: await noCompany({ orgnr: id, lite: true }) }; } catch (e: any) { return { country: "NO", id, found: false, error: e?.message }; } };
      const dkOne = async (id: string) => { try { return { country: "DK", id, found: true, data: await dkCompany({ cvr: id, lite: true }) }; } catch (e: any) { return { country: "DK", id, found: false, error: e?.message }; } };
      const fiOne = async (id: string) => { try { return { country: "FI", id, found: true, data: await fiCompany({ businessId: id, lite: true }) }; } catch (e: any) { return { country: "FI", id, found: false, error: e?.message }; } };
      const chOne = async (id: string) => { try { return { country: "CH", id, found: true, data: await chCompany({ uid: id, lite: true }) }; } catch (e: any) { return { country: "CH", id, found: false, error: e?.message }; } };
      const plOne = async (id: string) => { try { return { country: "PL", id, found: true, data: await plCompany({ krs: id, lite: true }) }; } catch (e: any) { return { country: "PL", id, found: false, error: e?.message }; } };
      const czOne = async (id: string) => { try { return { country: "CZ", id, found: true, data: await czCompany({ ico: id, lite: true }) }; } catch (e: any) { return { country: "CZ", id, found: false, error: e?.message }; } };
      const beOne = async (id: string) => { try { return { country: "BE", id, found: true, data: await beCompany({ enterprise_number: id, lite: true }) }; } catch (e: any) { return { country: "BE", id, found: false, error: e?.message }; } };
      const skOne = async (id: string) => { try { return { country: "SK", id, found: true, data: await skCompany({ ico: id, lite: true }) }; } catch (e: any) { return { country: "SK", id, found: false, error: e?.message }; } };
      const results = await Promise.all([...uk.map(ukOne), ...au.map((i) => one("AU", i)), ...ca.map((i) => one("CA", i)), ...fr.map(frOne), ...no.map(noOne), ...dk.map(dkOne), ...fi.map(fiOne), ...ch.map(chOne), ...pl.map(plOne), ...cz.map(czOne), ...be.map(beOne), ...sk.map(skOne)]);
      return json({ count: results.length, found: results.filter((r) => r.found).length, results }); } catch (e) { return err(e); } }) as any);
  server.tool("fx_rates",
    "Use this for official ECB currency exchange rates (~30 fiat incl GBP/EUR/USD/JPY), latest or a historical date (YYYY-MM-DD), with optional amount conversion. $0.002 USDC.",
    { base: z.string().optional(), symbols: z.string().optional(), date: z.string().optional(), amount: z.string().optional() },
    (await mk("$0.002", "fx_rates", 2000))(async (a: any) => { try { return json(await fx(a)); } catch (e) { return err(e); } }) as any);

  const MT: [string, string, number, any, (a: any) => Promise<any>][] = [
    ["ens_lookup", "$0.002", 2000, { name: z.string().optional(), address: z.string().optional() }, ens],
    ["token_metadata", "$0.001", 1000, { address: z.string(), chain: chainZ }, tokenMeta],
    ["token_allowance", "$0.002", 2000, { token: z.string(), owner: z.string(), spender: z.string(), chain: chainZ }, allowance],
    ["contract_info", "$0.003", 3000, { address: z.string(), chain: chainZ }, contractInfo],
    ["gas_fees", "$0.001", 1000, { chain: chainZ }, gas],
    ["block_lookup", "$0.001", 1000, { number: z.string().optional(), timestamp: z.string().optional(), chain: chainZ }, block],
    ["nft_lookup", "$0.002", 2000, { contract: z.string(), token_id: z.string(), chain: chainZ }, nft],
    ["web_search", "$0.003", 3000, { q: z.string(), sources: z.string().optional(), limit: z.string().optional(), lang: z.string().optional() }, search],
    ["uk_property_prices", "$0.01", 10000, { postcode: z.string(), radius: z.string().optional(), limit: z.string().optional() }, ukProperty],
    ["uk_area_profile", "$0.005", 5000, { postcode: z.string() }, ukArea],
  ];
  for (const [n, price, atomic, shape, fn] of MT)
    server.tool(n, MICRO_DESC[n], shape, (await mk(price, n, atomic))(async (a: any) => { try { return json(await fn(a)); } catch (e) { return err(e); } }) as any);

  for (const r of CHAIN_ROUTES) {
    const n = "chain_" + r.path.slice(7).replace(/-/g, "_"); const req: string[] = r.in.required || [];
    const shape: any = Object.fromEntries(Object.keys(r.in.properties).map((k) => [k, req.includes(k) ? z.string() : z.string().optional()]));
    server.tool(n, r.desc.replace(/\$0\.00\d\.$/, `${r.price} USDC.`), shape, (await mk(r.price, n, r.atomic))(async (a: any) => { try { return json(await r.fn(a)); } catch (e) { return err(e); } }) as any);
  }
  server.tool("pricing", "Free: list Axiom Works AgentReader tools, prices, when-to-use hints and payment details.", {}, async () => json({
    network: NETWORK, asset: "USDC", payTo: env.PAY_TO,
    samples: "https://api.axiomworks.co.uk/samples/{read|company|uk-company|uk-property|uk-area|meta|dns|redirects|…}",
    tools: {
      read_url: { price: "$0.002", when: "page → Markdown + metadata" },
      extract_links: { price: "$0.001", when: "links only" },
      check_domain: { price: "$0.001", when: "DNS/TLS/email health" },
      dns_lookup: { price: "$0.001", when: "raw DNS A/AAAA/MX/TXT/NS" },
      url_redirects: { price: "$0.001", when: "unwrap short/redirect URLs" },
      page_meta: { price: "$0.001", when: "title/OG/Twitter/canonical without full Markdown" },
      http_headers: { price: "$0.001", when: "HTTP security headers + score" },
      company_research: { price: "$0.25", when: "website company research (not UK CH)" },
      uk_company: { price: "$0.50", when: "full UK Companies House DD" },
      uk_company_lite: { price: "$0.05", when: "cheap UK status + flags" },
      company_full: { price: "$0.65", when: "website + multi-registry DD (UK/FR/NO/DK/FI/CH/PL/CZ/BE/SK/AU/CA/charity when signals)" },
      convert_document: { price: "$0.03", when: "PDF/DOCX → markdown" },
      create_monitor: { price: "$1.00 / 30 days", when: "hourly change webhooks" },
      wallet_balances: { price: "$0.003", when: "EVM wallet balances, 5 chains" },
      tx_status: { price: "$0.003", when: "did my tx/payment land" },
      token_check: { price: "$0.01", when: "ERC20 token risk/liquidity" },
      fx_rates: { price: "$0.002", when: "ECB fiat FX rates" },
      au_company: { price: "$0.02", when: "Australian ASIC company lookup by ACN/ABN" },
      fr_company: { price: "$0.25", when: "French company lookup by SIREN/SIRET/name (Recherche d'entreprises)" },
      no_company: { price: "$0.25", when: "Norwegian company lookup by orgnr/name (Brreg Enhetsregisteret)" },
      dk_company: { price: "$0.25", when: "Danish company lookup by CVR/name (apicvr.dk / Erhvervsstyrelsen)" },
      fi_company: { price: "$0.25", when: "Finnish company lookup by Y-tunnus/name (PRH YTJ open data)" },
      ch_company: { price: "$0.25", when: "Swiss company lookup by UID/name (Zefix central business name index)" },
      pl_company: { price: "$0.25", when: "Polish company lookup by KRS/NIP (KRS odpis + MF whitelist)" },
      registry_batch: { price: "$0.30", when: "Batch up to 25 UK+AU+CA+FR+NO+DK+FI+CH+PL+CZ+BE+SK company ids" },
      ca_company: { price: "$0.02", when: "Canadian federal corporation lookup by number/BN" },
      ens_lookup: { price: "$0.002", when: "ENS name <-> address" }, token_metadata: { price: "$0.001", when: "ERC20 name/symbol/decimals/supply" },
      token_allowance: { price: "$0.002", when: "ERC20 approval check" }, contract_info: { price: "$0.003", when: "proxy/clone/standards/verified name" },
      gas_fees: { price: "$0.001", when: "current fees + USD cost" }, block_lookup: { price: "$0.001", when: "block by number or timestamp" }, nft_lookup: { price: "$0.002", when: "NFT owner + metadata" },
      web_search: { price: "$0.003", when: "open research search (Wikipedia/OpenAlex/arXiv/Crossref)" }, uk_property_prices: { price: "$0.01", when: "E&W Land Registry sold prices near postcode" }, uk_area_profile: { price: "$0.005", when: "UK postcode geography/crime/food hygiene" },
      uk_charity: { price: "$0.05", when: "UK Charity Commission snapshot" },
      uk_charity_full: { price: "$0.25", when: "full UK charity DD + red flags" },
      us_sec: { price: "$0.05", when: "US SEC EDGAR company snapshot" },
      us_sec_full: { price: "$0.25", when: "SEC + us-gaap highlights + red flags" },
      eu_vat: { price: "$0.01", when: "EU VIES VAT validation" },
      lei_lookup: { price: "$0.005", when: "GLEIF LEI + ownership parents" },
      lei_full: { price: "$0.05", when: "GLEIF name search up to 10 with parents" },
      read_batch: { price: "$0.015", when: "batch web read up to 8 URLs" },
      sanctions_screen: { price: "$0.05", when: "OFAC/UK/UN/EU name sanctions screen" },
      sanctions_batch: { price: "$1.00", when: "batch <=50 sanctions screens" },
      email_check: { price: "$0.002", when: "validate email before outreach/onboarding" },
      uk_dd: { price: "$1.00", when: "UK-only DD job: full CH + sanctions + optional domain → trust flag" },
      kyb_report: { price: "$2.50", when: "UK/AU/CA/FR/NO/DK/FI/CH/PL/CZ/BE/SK registry+VAT+LEI+website+sanctions+director appointments KYB pack" },
      uk_officer: { price: "$0.15", when: "UK officer name → appointments reverse search" },
      ...Object.fromEntries(CHAIN_ROUTES.map((r) => ["chain_" + r.path.slice(7).replace(/-/g, "_"), { price: r.price, when: r.desc.split(".")[0].slice(0, 90) }])),
      pricing: { price: "free" },
    },
    how: "Paid tools return x402 PaymentRequired; retry with _meta['x402/payment'] via @x402/mcp createx402MCPClient.",
  }));
  server.tool("uk_leads_lite",
    "Use this for cheap UK new-incorporation lead lists by SIC/location/postcode_area (1-7 days). Up to 100 cos, no directors. Upsell uk_leads. $0.25 USDC.",
    { sic: z.string().optional(), location: z.string().optional(), postcode_area: z.string().optional(), days: z.union([z.string(), z.number()]).optional(), limit: z.union([z.string(), z.number()]).optional() },
    (await mk("$0.25", "uk_leads_lite", 250000))(async (a: any) => { try { return json(await ukLeads(env, { ...a, lite: true })); } catch (e) { return err(e); } }) as any);

  server.tool("uk_leads",
    "Use this for UK new-incorporation leads with active director names (SIC/location/postcode_area, 1-7 days, ≤40). Official CH data. Daily feed: uk_leads_feed $25/30d. $1.00 USDC.",
    { sic: z.string().optional(), location: z.string().optional(), postcode_area: z.string().optional(), days: z.union([z.string(), z.number()]).optional(), limit: z.union([z.string(), z.number()]).optional() },
    (await mk("$1.00", "uk_leads", 1000000))(async (a: any) => { try { return json(await ukLeads(env, { ...a, lite: false })); } catch (e) { return err(e); } }) as any);

  server.tool("uk_leads_feed",
    "Use this for a 30-day daily webhook of new UK incorporations matching SIC/location/postcode_area (director-enriched, deduped). $25.00/30d USDC.",
    { webhook: z.string().url(), sic: z.string().optional(), location: z.string().optional(), postcode_area: z.string().optional() },
    (await mk("$25.00", "uk_leads_feed", 25000000))(async (a: any) => { try { return json(await createLeadsFeed(env, a)); } catch (e) { return err(e); } }) as any);

  server.tool("uk_watch",
    "Use this to watch one UK company 30 days: hourly CH poll of status/officers/filings/PSC/charges → webhook on change. $5.00/30d USDC.",
    { number: z.string(), webhook: z.string().url() },
    (await mk("$5.00", "uk_watch", 5000000))(async (a: any) => { try { return json(await createUkWatch(env, a)); } catch (e) { return err(e); } }) as any);

  server.tool("uk_dd",
    "Use this for a UK-only due-diligence job: full Companies House pack + public sanctions (entity + active officers) + optional domain RDAP/website skim → trust flag (CLEAR/CAUTION/REVIEW/INSUFFICIENT_DATA). Screening only, not regulated KYC/AML. Between uk_company ($0.50) and kyb_report ($2.50). Example: {number:\"00445790\"} or {name:\"TESCO\",domain:\"tesco.com\"}. $1.00 USDC.",
    { number: z.string().optional(), name: z.string().optional(), domain: z.string().optional() },
    (await mk("$1.00", "uk_dd", 1000000))(async (a: any) => { try { return json(await ukDdReport(env, a)); } catch (e) { return err(e); } }) as any);

  server.tool("kyb_report",
    "Use this for one-shot agent KYB: UK Companies House DD and/or Australia ASIC (acn) and/or Canada (ca_number/bn) and/or France (siren/siret) and/or Norway Brreg (orgnr) and/or Denmark CVR (cvr) and/or Finland PRH (ytunnus/businessId) and/or Switzerland Zefix (uid) and/or Poland KRS (krs/nip) and/or Czech ARES (ico) and/or Belgium CBE/KBO (enterprise_number/be) and/or Slovakia RPO (sk/ico_sk/rpo) + EU VIES VAT + optional GLEIF LEI (with ownership parents) + website research + sanctions screen (entity+directors) + director appointment skim → trust flag. Screening only, not a regulated determination. Example: {enterprise_number:\"0202239951\"} or {sk:\"31322832\"}. $2.50 USDC.",
    { domain: z.string().optional(), number: z.string().optional(), name: z.string().optional(), vat: z.string().optional(), country: z.string().optional(), vat_number: z.string().optional(), acn: z.string().optional(), ca_number: z.string().optional(), bn: z.string().optional(), lei: z.string().optional(), siren: z.string().optional(), siret: z.string().optional(), orgnr: z.string().optional(), cvr: z.string().optional(), ytunnus: z.string().optional(), businessId: z.string().optional(), fi: z.string().optional(), uid: z.string().optional(), che: z.string().optional(), ch: z.string().optional(), krs: z.string().optional(), nip: z.string().optional(), pl: z.string().optional(), ico: z.string().optional(), cz: z.string().optional(), enterprise_number: z.string().optional(), be: z.string().optional(), bce: z.string().optional(), kbo: z.string().optional(), sk: z.string().optional(), ico_sk: z.string().optional(), rpo: z.string().optional() },
    (await mk("$2.50", "kyb_report", 2500000))(async (a: any) => { try { return json(await kybReport(env, a, bindingRegistries(env))); } catch (e) { return err(e); } }) as any);


  server.tool("uk_officer",
    "Use this to reverse-search a UK Companies House officer name to their appointments (company_number, role, appointed/resigned, status). Returns matches with address_snippet, appointment_count, DOB month/year, high-appointment / mass-formation heuristic flags. Public register (OGL); screening/research aid only - not a credit check. Example: {name:\"Ken Olisa\",limit:10}. $0.15 USDC.",
    { name: z.string(), limit: z.union([z.string(), z.number()]).optional() },
    (await mk("$0.15", "uk_officer", 150000))(async (a: any) => { try { return json(await ukOfficerSearch(env, a)); } catch (e) { return err(e); } }) as any);

  server.tool("sanctions_screen",
    "Use this to screen a person or entity name against public OFAC SDN (+non-SDN), UK FCDO, UN SC and EU financial sanctions lists. Fuzzy match with scores, programmes, aliases, DOB/nationality where present. Screening aid only - not a regulated AML/KYC determination. Example: {name:\"BANCO NACIONAL DE CUBA\"}. Batch: sanctions_batch $1. $0.05 USDC.",
    { name: z.string(), country: z.string().optional(), dob: z.string().optional(), year: z.union([z.string(), z.number()]).optional(), type: z.string().optional() },
    (await mk("$0.05", "sanctions_screen", 50000))(async (a: any) => { try { return json(await screenSanctions(env, a)); } catch (e) { return err(e); } }) as any);

  server.tool("sanctions_batch",
    "Use this to screen up to 50 names in one call against OFAC/UK/UN/EU public lists. Screening aid only. Example: {names:[\"BANCO NACIONAL DE CUBA\",\"Alice Wonderland\"]}. $1.00 USDC.",
    { names: z.any() },
    (await mk("$1.00", "sanctions_batch", 1000000))(async (a: any) => { try { return json(await screenSanctionsBatch(env, a)); } catch (e) { return err(e); } }) as any);



  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}
