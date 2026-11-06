import { UserError } from "./core";

const DISCLAIMER =
  "French SIREN/SIRET structure + Luhn checksum only (offline). Not proof the number is assigned, active, or matches a named entity. La Poste SIREN 356000000 is accepted as a known exception. Not a KYB/AML determination — confirm via registry before acting.";

/** La Poste SIREN fails Luhn but is legitimately assigned. */
const LA_POSTE_SIREN = "356000000";

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Standard Luhn (mod-10): double every second digit from the right. */
export function luhnOk(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

const UPSELL = {
  eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate FR VAT (TVA) via VIES" },
  lei: { path: "/lei", price: "$0.005", why: "GLEIF LEI lookup" },
  kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB pack (registry + VAT + LEI + sanctions)" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "screen a name against OFAC/UK/UN/EU lists" },
};

export function validateSiren(input: { siren?: string }) {
  const raw = (input.siren == null ? "" : String(input.siren)).trim();
  if (!raw) throw new UserError("siren required", 400);
  const siren = digitsOnly(raw);
  if (!siren) throw new UserError("siren must contain digits", 400);
  if (siren.length !== 9) throw new UserError("siren must be exactly 9 digits", 400);

  const length_ok = true;
  const is_la_poste = siren === LA_POSTE_SIREN;
  const luhn_ok = is_la_poste ? true : luhnOk(siren);
  const valid = length_ok && luhn_ok;

  return {
    product: "siren",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    siren,
    valid,
    luhn_ok,
    length_ok,
    digits: 9,
    ...(is_la_poste ? { la_poste_exception: true } : {}),
    source: "French SIREN Luhn (offline)",
    upsell: UPSELL,
  };
}

export function validateSiret(input: { siret?: string }) {
  const raw = (input.siret == null ? "" : String(input.siret)).trim();
  if (!raw) throw new UserError("siret required", 400);
  const siret = digitsOnly(raw);
  if (!siret) throw new UserError("siret must contain digits", 400);
  if (siret.length !== 14) throw new UserError("siret must be exactly 14 digits", 400);

  const parent_siren = siret.slice(0, 9);
  const nic = siret.slice(9);
  const length_ok = true;
  const is_la_poste = parent_siren === LA_POSTE_SIREN;
  // La Poste establishments: Luhn on full 14 often fails; accept when parent is La Poste SIREN.
  const luhn_ok = is_la_poste ? true : luhnOk(siret);
  const valid = length_ok && luhn_ok;

  return {
    product: "siret",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    siret,
    valid,
    luhn_ok,
    length_ok,
    digits: 14,
    nic,
    parent_siren,
    ...(is_la_poste ? { la_poste_exception: true } : {}),
    source: "French SIRET Luhn (offline)",
    upsell: UPSELL,
  };
}
