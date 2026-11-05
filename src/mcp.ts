import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createPaymentWrapper, x402ResourceServer } from "@x402/mcp";
import { facilitatorClient } from "./facilitator";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { z } from "zod";
import { readUrl, linksFor, checkDomain } from "./core";
import { companyResearch } from "./company";
import { ukCompany } from "./uk-company";
import { companyFull } from "./company-full";
import { convertDocument } from "./convert";
import { createMonitor } from "./monitor";
import { wallet, tx, tokenCheck, fx } from "./onchain";
import { ens, tokenMeta, allowance, contractInfo, gas, block, nft } from "./micro";
import { MICRO_DESC } from "./micro-desc";
import { VALIDATE, TOOL_PATH } from "./validate";
import { search } from "./search";
import { ukProperty, ukArea } from "./ukdata";
const EXAMPLES: Record<string, any> = { "/read": { url: "https://example.com" }, "/links": { url: "https://example.com" }, "/check": { domain: "example.com" }, "/company": { domain: "stripe.com" }, "/company-full": { domain: "tesco.com" },
  "/uk-company": { number: "00445790" }, "/uk-company-lite": { number: "00445790" }, "/convert": { url: "https://example.com/doc.pdf" }, "/monitor": { url: "https://example.com", webhook: "https://your.app/hook" },
  "/wallet": { address: "0x88b1c747c33A5868A34057D8C57318E5602b3ff6" }, "/tx": { hash: "0x" + "ab".repeat(32) }, "/token-check": { address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631" }, "/token": { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  "/contract": { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }, "/fx": { base: "GBP", symbols: "USD,EUR" }, "/ens": { name: "vitalik.eth" }, "/allowance": { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", owner: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", spender: "0x000000000022D473030F116dDEE9F6B43aC78BA3" },
  "/gas": { chain: "base" }, "/block": { timestamp: "2026-01-01T00:00:00Z" }, "/nft": { contract: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D", token_id: "1", chain: "ethereum" },
  "/search": { q: "x402 agent payments" }, "/uk-property": { postcode: "CB1 2AB" }, "/uk-area": { postcode: "SW1A 2AA" } };

const NETWORK = "eip155:8453";
let rs: any = null; let ready: Promise<any> | null = null;

export async function handleMcp(req: Request, env: any, log: (rec: any) => Promise<void>) {
  if (!rs) {
    rs = new x402ResourceServer(facilitatorClient(env));
    rs.register(NETWORK, new ExactEvmScheme());
    ready = rs.initialize();
  }
  await ready;
  const mk = async (price: string, tool: string, atomic: number) => { const w: any = await mk0(price, tool, atomic); return (h: any) => { const paid = w(h); return async (a: any, extra: any) => {
    const p = TOOL_PATH[tool]; const e = p && VALIDATE[p] ? VALIDATE[p](a || {}) : null;
    if (e) return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: e, free: true, note: "Input rejected before payment; you were not charged.", example: EXAMPLES[p] || null }) }] };
    return paid(a, extra); }; }; };
  const mk0 = async (price: string, tool: string, atomic: number) => createPaymentWrapper(rs, {
    resource: { url: `mcp://tool/${tool}`, description: `Axiom Works AgentReader ${tool}`, mimeType: "application/json", serviceName: "Axiom Works AgentReader", tags: ["web", "scraping", "markdown", "dns", "company", "uk", "pdf", "monitor", "x402", "onchain", "wallet", "token", "fx"] },
    accepts: await rs.buildPaymentRequirements({ scheme: "exact", network: NETWORK, payTo: env.PAY_TO, price, maxTimeoutSeconds: 120 }),
    hooks: { onAfterSettlement: async ({ settlement }: any) => {
      await log({ endpoint: `mcp:${tool}`, payer: settlement?.payer || null, amount: settlement?.amount || String(atomic), network: settlement?.network, tx: settlement?.transaction, success: settlement?.success });
    } },
  } as any);
  const server = new McpServer({ name: "agentreader", title: "Axiom Works AgentReader", version: "1.5.0" });
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

  server.tool("check_domain",
    "Use this when vetting domain health before outreach: DNS (DoH), DNSSEC, TLS/HTTPS, HSTS, MX/SPF/DMARC, issues + score. Structured JSON beats shell dig/openssl. Example: {domain:\"stripe.com\"}. $0.001 USDC.",
    { domain: z.string() },
    (await mk("$0.001", "check_domain", 1000))(async (a: any) => { try { return json(await checkDomain(a.domain)); } catch (e) { return err(e); } }) as any);

  server.tool("company_research",
    "Use this when researching a company from its website domain (not UK Companies House). Sourced tech stack, socials, emails/phones, DNS/MX/SPF/DMARC, RDAP, SSL, sitemap, news — no LLM fiction. Example: {domain:\"stripe.com\"}. Prefer uk_company* for UK filings. $0.25 USDC.",
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
    "Use this for website company research + UK Companies House pack in one call ($0.65 vs $0.75 separate). Attaches UK DD when .uk TLD or CH number detected. Example: {domain:\"tesco.com\"} → {company, uk, uk_included}. $0.65 USDC.",
    { domain: z.string() },
    (await mk("$0.65", "company_full", 650000))(async (a: any) => { try { return json(await companyFull(env, { domain: a.domain })); } catch (e) { return err(e); } }) as any);

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

  server.tool("pricing", "Free: list Axiom Works AgentReader tools, prices, when-to-use hints and payment details.", {}, async () => json({
    network: NETWORK, asset: "USDC", payTo: env.PAY_TO,
    samples: "https://api.axiomworks.co.uk/samples/{read|company|uk-company|uk-company-lite|convert}",
    tools: {
      read_url: { price: "$0.002", when: "page → Markdown + metadata" },
      extract_links: { price: "$0.001", when: "links only" },
      check_domain: { price: "$0.001", when: "DNS/TLS/email health" },
      company_research: { price: "$0.25", when: "website company research (not UK CH)" },
      uk_company: { price: "$0.50", when: "full UK Companies House DD" },
      uk_company_lite: { price: "$0.05", when: "cheap UK status + flags" },
      company_full: { price: "$0.65", when: "website + UK DD bundle" },
      convert_document: { price: "$0.03", when: "PDF/DOCX → markdown" },
      create_monitor: { price: "$1.00 / 30 days", when: "hourly change webhooks" },
      wallet_balances: { price: "$0.003", when: "EVM wallet balances, 5 chains" },
      tx_status: { price: "$0.003", when: "did my tx/payment land" },
      token_check: { price: "$0.01", when: "ERC20 token risk/liquidity" },
      fx_rates: { price: "$0.002", when: "ECB fiat FX rates" },
      ens_lookup: { price: "$0.002", when: "ENS name <-> address" }, token_metadata: { price: "$0.001", when: "ERC20 name/symbol/decimals/supply" },
      token_allowance: { price: "$0.002", when: "ERC20 approval check" }, contract_info: { price: "$0.003", when: "proxy/clone/standards/verified name" },
      gas_fees: { price: "$0.001", when: "current fees + USD cost" }, block_lookup: { price: "$0.001", when: "block by number or timestamp" }, nft_lookup: { price: "$0.002", when: "NFT owner + metadata" },
      web_search: { price: "$0.003", when: "open research search (Wikipedia/OpenAlex/arXiv/Crossref)" }, uk_property_prices: { price: "$0.01", when: "E&W Land Registry sold prices near postcode" }, uk_area_profile: { price: "$0.005", when: "UK postcode geography/crime/food hygiene" },
      pricing: { price: "free" },
    },
    how: "Paid tools return x402 PaymentRequired; retry with _meta['x402/payment'] via @x402/mcp createx402MCPClient.",
  }));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}
