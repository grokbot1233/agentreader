import { UserError } from "./core";
const DISCLAIMER = "German Handelsregister number structure only (offline). Not proof the entry exists or is active; register numbers are unique only per court. Not a KYB/AML determination.";
const TYPES: Record<string, string> = { HRA: "Handelsregister A (sole traders/partnerships)", HRB: "Handelsregister B (corporations: GmbH, AG, …)", GNR: "Genossenschaftsregister", PR: "Partnerschaftsregister", VR: "Vereinsregister", GSR: "Gesellschaftsregister (GbR)" };
const UPSELL = { eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate DE VAT via VIES" }, lei: { path: "/lei", price: "$0.005", why: "GLEIF LEI lookup" }, kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB pack" }, sanctions: { path: "/sanctions", price: "$0.05", why: "sanctions screen" } };
export const HR_RE = /^(?:(.+?)\s*[,:]?\s+)?(HRA|HRB|GNR|PR|VR|GSR)\s*(\d{1,6})(?:\s*([A-Z]{1,2}))?$/i;
export function validateHr(input: { hr?: string; court?: string }) {
  const raw = (input.hr == null ? "" : String(input.hr)).trim().replace(/\s+/g, " ");
  if (!raw) throw new UserError("hr required", 400);
  const m = raw.match(HR_RE);
  if (!m) throw new UserError("hr must look like 'HRB 12345' (types HRA/HRB/GnR/PR/VR/GsR; optional court prefix and suffix letter)", 400);
  const type = m[2].toUpperCase(); const number = m[3]; const suffix = m[4] ? m[4].toUpperCase() : null;
  const court = (m[1] || input.court || "").trim() || null;
  const typeOut = type === "GNR" ? "GnR" : type === "GSR" ? "GsR" : type;
  return { product: "hr-de", price: "$0.001", disclaimer: DISCLAIMER, hr: `${typeOut} ${number}${suffix ? " " + suffix : ""}`, register_type: typeOut, register_type_name: TYPES[type], number, suffix, court, court_provided: !!court, valid: true, shape_ok: true, source: "German Handelsregister structure (offline)", upsell: UPSELL };
}
