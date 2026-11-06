import { UserError } from "./core";
import { PC } from "./ukdata";

const DISCLAIMER =
  "Offline Royal Mail postcode format check only. Not proof the postcode is assigned, live, or deliverable. Not a geocode — use /uk-area $0.005 for ONS geography/crime/FSA or /uk-property $0.01 for Price Paid.";

/** Normalize to uppercase with a single space before the inward code (last 3 chars). */
export function normalizeUkPostcode(raw: string): string {
  const compact = raw.replace(/[\s\-]+/g, "").toUpperCase();
  if (compact.length < 5) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

/** Split outward into area (letters) + district (rest); inward into sector (digit) + unit (letters). */
function parts(outward: string, inward: string) {
  const areaM = outward.match(/^([A-Z]+)/);
  const area = areaM ? areaM[1] : null;
  const district = area ? outward.slice(area.length) || null : null;
  const sector = inward.length >= 1 ? inward[0] : null;
  const unit = inward.length >= 3 ? inward.slice(1) : null;
  return { area, district, sector, unit };
}

export function validateUkPostcode(input: { postcode?: string }) {
  const raw = (input.postcode == null ? "" : String(input.postcode)).trim();
  if (!raw) throw new UserError("postcode required", 400);

  const compact = raw.replace(/[\s\-]+/g, "").toUpperCase();
  const normalized = compact.length >= 5 ? normalizeUkPostcode(raw) : compact.toUpperCase();
  const special_gir = normalized === "GIR 0AA";
  const format_ok = special_gir || PC.test(raw) || PC.test(normalized) || PC.test(compact);

  const space = normalized.lastIndexOf(" ");
  const outward = format_ok && space >= 0 ? normalized.slice(0, space) : (format_ok ? normalized.slice(0, -3) : null);
  const inward = format_ok && space >= 0 ? normalized.slice(space + 1) : (format_ok ? normalized.slice(-3) : null);
  const parsed = outward && inward ? parts(outward, inward) : { area: null, district: null, sector: null, unit: null };

  return {
    product: "uk-postcode",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    postcode: format_ok ? normalized : (compact || raw.toUpperCase()),
    postcode_compact: compact || null,
    valid: !!format_ok,
    format_ok: !!format_ok,
    outward,
    inward,
    area: parsed.area,
    district: parsed.district,
    sector: parsed.sector,
    unit: parsed.unit,
    ...(special_gir ? { special_gir: true } : {}),
    source: "UK postcode format (offline)",
    upsell: {
      uk_area: { path: "/uk-area", price: "$0.005", why: "ONS geography + crime + FSA for a live postcode" },
      uk_property: { path: "/uk-property", price: "$0.01", why: "HM Land Registry Price Paid near postcode" },
      uk_company_lite: { path: "/uk-company-lite", price: "$0.05", why: "cheap UK Companies House status snapshot" },
      kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB pack (registry + VAT + LEI + sanctions)" },
      phone: { path: "/phone", price: "$0.001", why: "offline E.164 phone structure validate" },
      email_check: { path: "/email-check", price: "$0.002", why: "validate contact email (syntax + MX)" },
    },
  };
}
