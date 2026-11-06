import { UserError } from "./core";

const DISCLAIMER =
  "Austrian Firmenbuchnummer (FN) structure + check letter only (offline). Not proof the number is assigned, active, or matches a named entity. Optional branch digits after the letter are shape-checked only. Not a KYB/AML determination — confirm via Firmenbuch / LEI before acting.";

/** Check letters for remainders 0..16 (skips easily-confused letters). */
const CHECK_LETTERS = "abdfghikmpstvwxyz";
const WEIGHTS = [6, 4, 14, 15, 10, 1];

/** Official-style FN check letter: left-pad digits to 6, weights 6/4/14/15/10/1, sum mod 17 → letter table. */
export function fnCheckLetter(digits: string): string {
  const d = digits.replace(/\D/g, "").padStart(6, "0");
  if (d.length !== 6) throw new Error("fn digits must pad to 6");
  let sum = 0;
  for (let i = 0; i < 6; i++) {
    const n = d.charCodeAt(i) - 48;
    if (n < 0 || n > 9) throw new Error("non-digit");
    sum += n * WEIGHTS[i];
  }
  return CHECK_LETTERS[sum % 17];
}

const UPSELL = {
  lei: { path: "/lei", price: "$0.005", why: "GLEIF LEI lookup" },
  eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate AT VAT via VIES" },
  kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB pack (registry + VAT + LEI + sanctions)" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "screen a name against OFAC/UK/UN/EU lists" },
};

export function validateFn(input: { fn?: string }) {
  const raw = (input.fn == null ? "" : String(input.fn)).trim();
  if (!raw) throw new UserError("fn required", 400);

  let cleaned = raw.replace(/\s+/g, "").toUpperCase();
  if (cleaned.startsWith("FN")) cleaned = cleaned.slice(2);

  // digits (1-6) + check letter + optional branch (0-3 digits)
  const m = cleaned.match(/^(\d{1,6})([A-Z])(\d{0,3})$/);
  if (!m) {
    throw new UserError("fn must be 1–6 digits + check letter (optional FN prefix; optional ≤3 branch digits)", 400);
  }

  const digits = m[1];
  const letter = m[2].toLowerCase();
  const branch = m[3] || null;
  const expected = fnCheckLetter(digits);
  const letter_ok = letter === expected;
  const letter_in_alphabet = CHECK_LETTERS.includes(letter);
  const length_ok = true;
  const valid = length_ok && letter_ok;

  return {
    product: "fn-at",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    fn: `${digits}${letter}${branch || ""}`,
    fn_formatted: `FN ${digits}${letter}${branch || ""}`,
    digits,
    check_letter: letter,
    expected_check_letter: expected,
    branch,
    valid,
    letter_ok,
    letter_in_alphabet,
    length_ok,
    source: "Austrian Firmenbuchnummer check letter (offline; mod-17)",
    upsell: UPSELL,
  };
}
