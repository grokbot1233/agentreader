import { UserError } from "./core";

const DISCLAIMER =
  "ISO 13616 IBAN structure + mod-97 checksum only. Not proof the account exists, is open, or belongs to a named party. Not a sanctions / AML / KYC determination — confirm before acting.";

/** Official IBAN lengths for common EU/UK/CH/EEA and frequent others (ISO 13616). */
const LEN: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29,
  BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28, EE: 20, EG: 29,
  ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28,
  HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20,
  LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22, MK: 19,
  MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29,
  RO: 24, RS: 22, SA: 24, SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28,
  TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
};

function normalize(raw: string): string {
  return raw.replace(/[\s\-]+/g, "").toUpperCase();
}

/** ISO 13616 mod-97: rearrange + A=10…Z=35, remainder must be 1. */
function mod97Ok(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const piece = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of piece) rem = (rem * 10 + (d.charCodeAt(0) - 48)) % 97;
  }
  return rem === 1;
}

export function validateIban(input: { iban?: string }) {
  const raw = (input.iban == null ? "" : String(input.iban)).trim();
  if (!raw) throw new UserError("iban required", 400);
  const iban = normalize(raw);
  if (iban.length < 15 || iban.length > 34) throw new UserError("iban length must be 15-34 after normalization", 400);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) throw new UserError("iban must start with country code + check digits (e.g. GB82WEST12345698765432)", 400);

  const country = iban.slice(0, 2);
  const check_digits = iban.slice(2, 4);
  const bban = iban.slice(4);
  const expected = LEN[country];
  const length_ok = expected != null ? iban.length === expected : iban.length >= 15 && iban.length <= 34;
  const mod97_ok = mod97Ok(iban);
  const valid = length_ok && mod97_ok && /^[A-Z]{2}$/.test(country) && /^\d{2}$/.test(check_digits);

  return {
    product: "iban",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    iban,
    valid,
    country,
    check_digits,
    bban,
    length: iban.length,
    expected_length: expected ?? null,
    length_ok,
    mod97_ok,
    country_known: expected != null,
    source: "ISO 13616 mod-97 (offline)",
    upsell: {
      eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate an EU VAT number via VIES" },
      kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB pack (registry + VAT + LEI + sanctions)" },
      sanctions: { path: "/sanctions", price: "$0.05", why: "screen a name against OFAC/UK/UN/EU lists" },
    },
  };
}
