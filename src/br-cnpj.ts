import { UserError } from "./core";

const DISCLAIMER =
  "Brazilian CNPJ structure + check digits only (offline). Not proof the number is assigned, active, or matches a named entity. Not a KYB/AML determination — confirm via Receita Federal / LEI before acting.";

const W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function checkDigit(nums: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += (nums.charCodeAt(i) - 48) * weights[i];
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
}

const UPSELL = {
  lei: { path: "/lei", price: "$0.005", why: "GLEIF LEI lookup" },
  kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB pack" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "sanctions screen" },
};

/** Format 14 digits as XX.XXX.XXX/XXXX-XX */
export function formatCnpj(digits: string): string {
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function validateCnpj(input: { cnpj?: string }) {
  const raw = (input.cnpj == null ? "" : String(input.cnpj)).trim();
  if (!raw) throw new UserError("cnpj required", 400);
  const cnpj = digitsOnly(raw);
  if (!cnpj) throw new UserError("cnpj must contain digits", 400);
  if (cnpj.length !== 14) throw new UserError("cnpj must be exactly 14 digits (punctuation ok)", 400);
  const all_same = /^(\d)\1{13}$/.test(cnpj);
  const d1 = checkDigit(cnpj.slice(0, 12), W1);
  const d2 = checkDigit(cnpj.slice(0, 12) + String(d1), W2);
  const expected = `${d1}${d2}`;
  const checksum_ok = !all_same && cnpj.slice(12) === expected;
  const valid = checksum_ok;
  const branch = cnpj.slice(8, 12);
  const is_head_office = branch === "0001";
  return {
    product: "cnpj",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    cnpj,
    cnpj_formatted: formatCnpj(cnpj),
    valid,
    checksum_ok,
    length_ok: true,
    not_all_same_digits: !all_same,
    digits: 14,
    root: cnpj.slice(0, 8),
    branch,
    is_head_office,
    check_digits: cnpj.slice(12),
    expected_check_digits: expected,
    source: "Brazilian CNPJ check digits (offline)",
    upsell: UPSELL,
  };
}
