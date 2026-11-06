import { UserError } from "./core";

const DISCLAIMER =
  "Italian Partita IVA structure + official checksum only (offline). Not proof the number is assigned, active, or matches a named entity. Province code is soft (reported, does not alone fail a checksum-valid number). Not a KYB/AML determination — confirm via registry /eu-vat before acting.";

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Soft province/office code: digits 8–10 (1-indexed) = chars[7..9]. */
function provinceOk(code: string): boolean {
  const n = parseInt(code, 10);
  if (!Number.isFinite(n)) return false;
  if (n >= 1 && n <= 100) return true;
  return n === 120 || n === 121 || n === 999;
}

/** Official Agenzia delle Entrate Partita IVA checksum on 11 digits. */
export function partitaIvaChecksumOk(digits: string): boolean {
  if (digits.length !== 11) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits.charCodeAt(10) - 48;
}

const UPSELL = {
  eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate IT VAT via VIES" },
  lei: { path: "/lei", price: "$0.005", why: "GLEIF LEI lookup" },
  kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB pack (registry + VAT + LEI + sanctions)" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "screen a name against OFAC/UK/UN/EU lists" },
};

export function validatePartitaIva(input: { vat?: string; partita_iva?: string }) {
  const rawIn = input.vat ?? input.partita_iva;
  const raw = (rawIn == null ? "" : String(rawIn)).trim();
  if (!raw) throw new UserError("vat required", 400);

  // Optional IT prefix; strip spaces/dashes; keep letters only for prefix check.
  let cleaned = raw.replace(/[\s\-]/g, "").toUpperCase();
  if (cleaned.startsWith("IT")) cleaned = cleaned.slice(2);
  const vat = digitsOnly(cleaned);
  if (!vat) throw new UserError("vat must contain digits", 400);
  if (vat.length !== 11) throw new UserError("partita IVA must be exactly 11 digits (optional IT prefix)", 400);

  const checksum_ok = partitaIvaChecksumOk(vat);
  const province_code = vat.slice(7, 10);
  const province_ok = provinceOk(province_code);
  const length_ok = true;
  // Soft province: do not fail checksum-valid numbers solely on province.
  const valid = length_ok && checksum_ok;

  return {
    product: "partita-iva",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    vat,
    partita_iva: vat,
    valid,
    checksum_ok,
    length_ok,
    digits: 11,
    province_code,
    province_ok,
    source: "Italian Partita IVA checksum (offline)",
    upsell: UPSELL,
  };
}
