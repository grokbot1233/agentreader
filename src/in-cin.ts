import { UserError } from "./core";

const DISCLAIMER =
  "Indian CIN (Corporate Identity Number) structural parse only (offline). MCA publishes no public check digit — this does NOT prove issuance or activity. Soft flags for known company-type codes and year range. Not a KYB/AML determination — confirm via MCA21 before acting.";

/** Common MCA company-type / ownership codes (open list; unknown types still shape-ok). */
const COMPANY_TYPES: Record<string, string> = {
  PLC: "Public Limited Company",
  PTC: "Private Limited Company",
  OPC: "One Person Company",
  NPL: "Section 8 / Not-for-profit",
  FTC: "Foreign Company",
  SGC: "State Government Company",
  GOI: "Union Government Company",
  ULL: "Unlimited Liability Company",
  ULT: "Unlimited Liability (private)",
  GAP: "Producer Company (GAP)",
  GAT: "Producer Company (GAT)",
};

const UPSELL = {
  lei: { path: "/lei", price: "$0.005", why: "GLEIF LEI lookup" },
  kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB pack (registry + VAT + LEI + sanctions)" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "screen a name against OFAC/UK/UN/EU lists" },
};

export function validateCin(input: { cin?: string }) {
  const raw = (input.cin == null ? "" : String(input.cin)).trim();
  if (!raw) throw new UserError("cin required", 400);

  const cleaned = raw.replace(/[\s\-]/g, "").toUpperCase();
  if (!cleaned) throw new UserError("cin required", 400);
  if (cleaned.length !== 21) throw new UserError("cin must be exactly 21 characters", 400);

  const m = cleaned.match(/^([LU])(\d{5})([A-Z]{2})(\d{4})([A-Z]{3})(\d{6})$/);
  if (!m) {
    throw new UserError("cin must match [LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}", 400);
  }

  const listing = m[1];
  const nic = m[2];
  const state = m[3];
  const year = parseInt(m[4], 10);
  const company_type = m[5];
  const registration = m[6];
  const year_ok = year >= 1850 && year <= new Date().getUTCFullYear() + 1;
  const company_type_known = Object.prototype.hasOwnProperty.call(COMPANY_TYPES, company_type);
  const company_type_name = company_type_known ? COMPANY_TYPES[company_type] : null;
  const listing_status = listing === "L" ? "listed" : "unlisted";
  const shape_ok = true;
  // Soft year/type: do not fail shape-valid CINs solely on unknown type or soft year.
  const valid = shape_ok && year_ok;

  return {
    product: "cin-in",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    cin: cleaned,
    valid,
    shape_ok,
    year_ok,
    listing,
    listing_status,
    nic_code: nic,
    state_code: state,
    year_of_incorporation: year,
    company_type,
    company_type_known,
    company_type_name,
    registration_number: registration,
    source: "Indian MCA CIN structure (offline; no check digit)",
    upsell: UPSELL,
  };
}
