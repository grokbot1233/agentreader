import { UserError } from "./core";

const DISCLAIMER =
  "Polish NIP structure + modulus-11 checksum only (offline). Not proof the number is assigned, active, or matches a named entity. Not a KYB/AML determination — confirm via VIES / CEIDG / KRS before acting.";

const WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

const UPSELL = {
  eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate PL VAT via VIES" },
  lei: { path: "/lei", price: "$0.005", why: "GLEIF LEI lookup" },
  kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB pack" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "sanctions screen" },
};

export function validateNip(input: { nip?: string }) {
  const raw = (input.nip == null ? "" : String(input.nip)).trim();
  if (!raw) throw new UserError("nip required", 400);
  let cleaned = raw.replace(/[\s\-.]/g, "").toUpperCase();
  if (cleaned.startsWith("PL")) cleaned = cleaned.slice(2);
  const nip = digitsOnly(cleaned);
  if (!nip) throw new UserError("nip must contain digits", 400);
  if (nip.length !== 10) throw new UserError("nip must be exactly 10 digits (optional PL prefix)", 400);

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (nip.charCodeAt(i) - 48) * WEIGHTS[i];
  const rem = sum % 11;
  const checksum_impossible = rem === 10;
  const expected = checksum_impossible ? null : rem;
  const mod11_ok = !checksum_impossible && nip[9] === String(expected);
  const valid = mod11_ok;

  return {
    product: "nip-pl",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    nip,
    valid,
    mod11_ok,
    checksum_impossible,
    length_ok: true,
    digits: 10,
    check_digit: nip[9],
    expected_check_digit: expected === null ? null : String(expected),
    source: "Polish NIP modulus-11 (offline)",
    upsell: UPSELL,
  };
}
