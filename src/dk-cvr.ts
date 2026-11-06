import { UserError } from "./core";

const DISCLAIMER =
  "Danish CVR structure + modulus-11 checksum only (offline). Not proof the number is assigned, active, or matches a named entity. Not a KYB/AML determination — confirm via CVR /eu-vat / LEI before acting.";

const WEIGHTS = [2, 7, 6, 5, 4, 3, 2, 1];

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Official CVR mod-11: weights 2,7,6,5,4,3,2,1; sum % 11 === 0. Must not start with 0. */
export function cvrMod11Ok(digits: string): boolean {
  if (digits.length !== 8) return false;
  if (digits[0] === "0") return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    sum += d * WEIGHTS[i];
  }
  return sum % 11 === 0;
}

const UPSELL = {
  eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate DK VAT via VIES" },
  lei: { path: "/lei", price: "$0.005", why: "GLEIF LEI lookup" },
  kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB pack (registry + VAT + LEI + sanctions)" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "screen a name against OFAC/UK/UN/EU lists" },
};

export function validateCvr(input: { cvr?: string }) {
  const rawIn = input.cvr;
  const raw = (rawIn == null ? "" : String(rawIn)).trim();
  if (!raw) throw new UserError("cvr required", 400);

  let cleaned = raw.replace(/[\s\-.]/g, "").toUpperCase();
  if (cleaned.startsWith("DK")) cleaned = cleaned.slice(2);
  const cvr = digitsOnly(cleaned);
  if (!cvr) throw new UserError("cvr must contain digits", 400);
  if (cvr.length !== 8) throw new UserError("cvr must be exactly 8 digits (optional DK prefix)", 400);

  const length_ok = true;
  const no_leading_zero = cvr[0] !== "0";
  const mod11_ok = cvrMod11Ok(cvr);
  const valid = length_ok && no_leading_zero && mod11_ok;

  return {
    product: "cvr",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    cvr,
    valid,
    mod11_ok,
    no_leading_zero,
    length_ok,
    digits: 8,
    source: "Danish CVR modulus-11 (offline)",
    upsell: UPSELL,
  };
}
