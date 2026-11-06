import { UserError } from "./core";
const DISCLAIMER = "Spanish NIF/NIE/CIF structure + control character only (offline). Not proof of issuance or that it matches a named person/entity. Not a KYB/AML determination.";
const L = "TRWAGMYFPDXBNJZSQVHLCKE";
const UPSELL = { eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate ES VAT via VIES" }, lei: { path: "/lei", price: "$0.005", why: "GLEIF LEI lookup" }, kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB pack" }, sanctions: { path: "/sanctions", price: "$0.05", why: "sanctions screen" } };
export function validateNif(input: { nif?: string }) {
  const raw = (input.nif == null ? "" : String(input.nif)).trim();
  if (!raw) throw new UserError("nif required", 400);
  let c = raw.replace(/[\s\-.]/g, "").toUpperCase();
  if (c.startsWith("ES") && c.length === 11) c = c.slice(2);
  if (c.length !== 9) throw new UserError("nif must be 9 characters (optional ES prefix)", 400);
  let kind: string, expected: string, ok: boolean;
  if (/^\d{8}[A-Z]$/.test(c)) { kind = "DNI"; expected = L[Number(c.slice(0, 8)) % 23]; ok = expected === c[8]; }
  else if (/^[XYZ]\d{7}[A-Z]$/.test(c)) { kind = "NIE"; expected = L[Number("XYZ".indexOf(c[0]) + c.slice(1, 8)) % 23]; ok = expected === c[8]; }
  else if (/^[KLM]\d{7}[A-Z]$/.test(c)) { kind = "NIF-KLM"; const d = cifDigit(c); expected = "JABCDEFGHI"[d]; ok = expected === c[8]; }
  else if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(c)) {
    kind = "CIF"; const d = cifDigit(c); const dig = String(d), let_ = "JABCDEFGHI"[d];
    const letterOnly = "PQRSNW".includes(c[0]) || c.slice(1, 3) === "00"; const digitOnly = "ABEH".includes(c[0]);
    expected = letterOnly ? let_ : digitOnly ? dig : `${dig}|${let_}`;
    ok = letterOnly ? c[8] === let_ : digitOnly ? c[8] === dig : (c[8] === dig || c[8] === let_);
  } else throw new UserError("nif must be DNI (8 digits+letter), NIE (X/Y/Z+7 digits+letter) or CIF (letter+7 digits+control)", 400);
  return { product: "nif-es", price: "$0.001", disclaimer: DISCLAIMER, nif: c, kind, control: c[8], expected_control: expected, control_ok: ok, valid: ok, shape_ok: true, source: "Spanish NIF/NIE/CIF control character (offline)", upsell: UPSELL };
}
function cifDigit(c: string): number {
  let sum = 0;
  for (let i = 1; i <= 7; i++) { let n = c.charCodeAt(i) - 48; if (i % 2 === 1) { n *= 2; n = Math.floor(n / 10) + (n % 10); } sum += n; }
  return (10 - (sum % 10)) % 10;
}
