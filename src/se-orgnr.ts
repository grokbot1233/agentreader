import { UserError } from "./core";

const DISCLAIMER =
  "Swedish organisationsnummer structure + Luhn (from left) only (offline). Not proof the number is assigned, active, or matches a named entity. Accepts 10-digit or 12-digit (YYYY + 10) forms. Not a KYB/AML determination — confirm via Bolagsverket / LEI before acting.";

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Luhn from the left: double indices 0,2,4,6,8; subtract 9 if >9; sum % 10 === 0. */
export function orgnrLuhnOk(digits: string): boolean {
  if (digits.length !== 10) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const UPSELL = {
  lei: { path: "/lei", price: "$0.005", why: "GLEIF LEI lookup" },
  eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate SE VAT via VIES" },
  kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB pack (registry + VAT + LEI + sanctions)" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "screen a name against OFAC/UK/UN/EU lists" },
};

export function validateOrgnr(input: { orgnr?: string }) {
  const raw = (input.orgnr == null ? "" : String(input.orgnr)).trim();
  if (!raw) throw new UserError("orgnr required", 400);
  let digits = digitsOnly(raw);
  if (!digits) throw new UserError("orgnr must contain digits", 400);
  if (digits.length === 12) digits = digits.slice(2);
  if (digits.length !== 10) throw new UserError("orgnr must be 10 digits (or 12-digit YYYY+orgnr form)", 400);

  const third = digits.charCodeAt(2) - 48;
  const third_digit_ok = third >= 2;
  const luhn_ok = orgnrLuhnOk(digits);
  const length_ok = true;
  const valid = length_ok && luhn_ok && third_digit_ok;

  return {
    product: "orgnr",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    orgnr: digits,
    orgnr_formatted: `${digits.slice(0, 6)}-${digits.slice(6)}`,
    valid,
    luhn_ok,
    third_digit_ok,
    length_ok,
    digits: 10,
    source: "Swedish organisationsnummer Luhn (offline)",
    upsell: UPSELL,
  };
}
