import { UserError } from "./core";

const DISCLAIMER =
  "Canadian CRA Business Number shape check only (offline). CRA publishes no public check digit — this does NOT prove issuance, assignment, or activity. Not a KYB/AML determination — confirm via /ca-company or CRA before acting.";

/** Known CRA program account identifiers (2 letters). */
const PROGRAM_NAMES: Record<string, string> = {
  RT: "GST/HST",
  RP: "Payroll deductions",
  RC: "Corporation income tax",
  RZ: "Information returns",
  RR: "Registered charity",
  RG: "Air travellers security charge",
  RD: "Excise duty",
  RE: "Excise tax",
  RM: "Import/export",
  RN: "Excise tax on insurance premiums",
  LT: "Softwood lumber products export charge",
  RU: "Selected listed financial institutions",
  PT: "Provincial sales tax / RST",
};

const UPSELL = {
  ca_company: { path: "/ca-company", price: "$0.02", why: "Canadian federal corporation lookup by number/BN" },
  kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB pack (registry + VAT + LEI + sanctions)" },
  lei: { path: "/lei", price: "$0.005", why: "GLEIF LEI lookup" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "screen a name against OFAC/UK/UN/EU lists" },
};

export function validateBnCa(input: { bn?: string }) {
  const raw = (input.bn == null ? "" : String(input.bn)).trim();
  if (!raw) throw new UserError("bn required", 400);

  const cleaned = raw.replace(/[\s\-]/g, "").toUpperCase();
  if (!cleaned) throw new UserError("bn required", 400);

  // 9-digit BN or 15-char program account = BN9 + 2-letter program + 4-digit reference
  const m9 = cleaned.match(/^(\d{9})$/);
  const m15 = cleaned.match(/^(\d{9})([A-Z]{2})(\d{4})$/);

  if (!m9 && !m15) {
    throw new UserError("bn must be 9 digits or 15-char program account (BN9 + 2-letter program + 4-digit ref)", 400);
  }

  const bn9 = m9 ? m9[1] : m15![1];
  const program = m15 ? m15[2] : null;
  const reference = m15 ? m15[3] : null;
  const program_known = program ? Object.prototype.hasOwnProperty.call(PROGRAM_NAMES, program) : null;
  const program_name = program && program_known ? PROGRAM_NAMES[program] : null;
  // Shape-ok even when program letters are unknown (still 2 letters + 4 digits).
  const shape_ok = true;
  const valid = shape_ok;

  return {
    product: "bn-ca",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    bn: cleaned,
    bn9,
    program,
    reference,
    program_known,
    program_name,
    shape_ok,
    valid,
    form: m15 ? "program_account" : "bn9",
    source: "Canadian CRA BN shape (offline; no check digit)",
    upsell: UPSELL,
  };
}
