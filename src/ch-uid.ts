import { UserError } from "./core";

const DISCLAIMER =
  "Swiss UID (Unternehmens-Identifikationsnummer) structure + check digit only (offline). Not proof the number is assigned, active, or matches a named entity. Not a KYB/AML determination — confirm via UID-Register / LEI before acting.";

const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4];

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

const UPSELL = {
  lei: { path: "/lei", price: "$0.005", why: "GLEIF LEI lookup" },
  eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate EU VAT via VIES (CH not covered)" },
  kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB pack" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "sanctions screen" },
};

/** Format 9 digits as CHE-XXX.XXX.XXX */
export function formatUid(digits: string): string {
  return `CHE-${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
}

export function validateUid(input: { uid?: string }) {
  const raw = (input.uid == null ? "" : String(input.uid)).trim();
  if (!raw) throw new UserError("uid required", 400);

  let cleaned = raw.replace(/\s+/g, "").toUpperCase();
  let vat_suffix: string | null = null;
  for (const suf of ["MWST", "TVA", "IVA", "VAT"]) {
    if (cleaned.endsWith(suf)) {
      vat_suffix = suf;
      cleaned = cleaned.slice(0, -suf.length);
      break;
    }
  }
  if (cleaned.startsWith("CHE-") || cleaned.startsWith("CHE.")) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith("CHE")) cleaned = cleaned.slice(3);

  const uid = digitsOnly(cleaned);
  if (!uid) throw new UserError("uid must contain digits (optional CHE- prefix)", 400);
  if (uid.length !== 9) throw new UserError("uid must be exactly 9 digits after optional CHE- prefix", 400);

  let sum = 0;
  for (let i = 0; i < 8; i++) sum += (uid.charCodeAt(i) - 48) * WEIGHTS[i];
  const rem = sum % 11;
  const rawCheck = (11 - rem) % 11;
  const checksum_impossible = rawCheck === 10;
  const expected = checksum_impossible ? null : rawCheck;
  const mod11_ok = !checksum_impossible && uid[8] === String(expected);
  const valid = mod11_ok;

  return {
    product: "uid-ch",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    uid,
    uid_formatted: formatUid(uid),
    valid,
    mod11_ok,
    checksum_impossible,
    length_ok: true,
    digits: 9,
    check_digit: uid[8],
    expected_check_digit: expected === null ? null : String(expected),
    vat_suffix,
    source: "Swiss UID check digit (offline; mod-11)",
    upsell: UPSELL,
  };
}
