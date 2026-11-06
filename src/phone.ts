import { UserError } from "./core";

const DISCLAIMER =
  "E.164 structure + country calling-code / national-length tables only (offline). Not proof the number is assigned, reachable, ported, or belongs to a person. Not a carrier/HLR lookup. Not KYC/AML — confirm before acting.";

/** ISO 3166-1 alpha-2 → calling code + national significant number length range (min,max) + optional mobile NSN prefix hints. */
type CountryRule = {
  cc: string;
  nsn: [number, number];
  /** Digits after country code that typically indicate mobile (heuristic). */
  mobile?: RegExp;
  fixed?: RegExp;
  toll_free?: RegExp;
};

const BY_ISO: Record<string, CountryRule> = {
  GB: { cc: "44", nsn: [10, 10], mobile: /^7\d{9}$/, fixed: /^[12358]\d{9}$/, toll_free: /^80\d{8}$|^800\d{7}$/ },
  US: { cc: "1", nsn: [10, 10], mobile: /^[2-9]\d{2}[2-9]\d{6}$/, toll_free: /^8(00|33|44|55|66|77|88)\d{7}$/ },
  CA: { cc: "1", nsn: [10, 10], mobile: /^[2-9]\d{2}[2-9]\d{6}$/, toll_free: /^8(00|33|44|55|66|77|88)\d{7}$/ },
  AU: { cc: "61", nsn: [9, 9], mobile: /^4\d{8}$/, fixed: /^[2378]\d{8}$/, toll_free: /^1[38]\d{7,8}$/ },
  IE: { cc: "353", nsn: [7, 9], mobile: /^8[3-9]\d{7}$/, fixed: /^[1-9]\d{6,8}$/, toll_free: /^1800\d+$/ },
  DE: { cc: "49", nsn: [6, 13], mobile: /^1[5-7]\d{7,10}$/, toll_free: /^800\d+$/ },
  FR: { cc: "33", nsn: [9, 9], mobile: /^[67]\d{8}$/, fixed: /^[1-5]\d{8}$/, toll_free: /^8\d{8}$/ },
  NL: { cc: "31", nsn: [9, 9], mobile: /^6\d{8}$/, fixed: /^[1-5]\d{8}$/, toll_free: /^800\d+$/ },
  ES: { cc: "34", nsn: [9, 9], mobile: /^[67]\d{8}$/, fixed: /^[89]\d{8}$/, toll_free: /^900\d{6}$/ },
  IT: { cc: "39", nsn: [6, 11], mobile: /^3\d{8,10}$/, toll_free: /^800\d+$/ },
  PL: { cc: "48", nsn: [9, 9], mobile: /^[45]\d{8}$/, fixed: /^[1-8]\d{8}$/, toll_free: /^800\d+$/ },
  SE: { cc: "46", nsn: [7, 10], mobile: /^7\d{8,9}$/, toll_free: /^20\d+$/ },
  NO: { cc: "47", nsn: [8, 8], mobile: /^[49]\d{7}$/, fixed: /^[2-7]\d{7}$/, toll_free: /^800\d+$/ },
  DK: { cc: "45", nsn: [8, 8], mobile: /^[2-9]\d{7}$/, toll_free: /^80\d{6}$/ },
  FI: { cc: "358", nsn: [5, 12], mobile: /^4\d{7,10}$|^50\d{6,9}$/, toll_free: /^800\d+$/ },
  CH: { cc: "41", nsn: [9, 9], mobile: /^7[5-9]\d{7}$/, fixed: /^[1-6]\d{8}$/, toll_free: /^800\d+$/ },
  AT: { cc: "43", nsn: [4, 13], mobile: /^6\d{7,12}$/, toll_free: /^800\d+$/ },
  BE: { cc: "32", nsn: [8, 9], mobile: /^4\d{7,8}$/, fixed: /^[1-9]\d{7,8}$/, toll_free: /^800\d+$/ },
  PT: { cc: "351", nsn: [9, 9], mobile: /^9\d{8}$/, fixed: /^2\d{8}$/, toll_free: /^800\d+$/ },
  IN: { cc: "91", nsn: [10, 10], mobile: /^[6-9]\d{9}$/, toll_free: /^1800\d+$/ },
  BR: { cc: "55", nsn: [10, 11], mobile: /^[1-9]\d{1}9\d{8}$/, fixed: /^[1-9]\d{1}[2-5]\d{7}$/, toll_free: /^800\d+$/ },
  MX: { cc: "52", nsn: [10, 10], mobile: /^\d{10}$/, toll_free: /^800\d+$/ },
  JP: { cc: "81", nsn: [9, 10], mobile: /^[789]0\d{8}$/, fixed: /^[1-6]\d{8,9}$/, toll_free: /^120\d+$/ },
  KR: { cc: "82", nsn: [8, 11], mobile: /^1[0-9]\d{7,8}$/, toll_free: /^80\d+$/ },
  SG: { cc: "65", nsn: [8, 8], mobile: /^[89]\d{7}$/, fixed: /^[36]\d{7}$/, toll_free: /^1800\d+$/ },
  AE: { cc: "971", nsn: [8, 9], mobile: /^5\d{8}$/, fixed: /^[2-9]\d{7}$/, toll_free: /^800\d+$/ },
  NZ: { cc: "64", nsn: [8, 10], mobile: /^2\d{7,9}$/, fixed: /^[3-9]\d{7,8}$/, toll_free: /^800\d+$/ },
};

/** Longest-first calling-code index for E.164 parse. */
const CC_INDEX: { cc: string; iso: string[] }[] = (() => {
  const byCc = new Map<string, string[]>();
  for (const [iso, r] of Object.entries(BY_ISO)) {
    const list = byCc.get(r.cc) || [];
    list.push(iso);
    byCc.set(r.cc, list);
  }
  return [...byCc.entries()]
    .map(([cc, iso]) => ({ cc, iso }))
    .sort((a, b) => b.cc.length - a.cc.length);
})();

const ISO_SET = new Set(Object.keys(BY_ISO));

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function guessType(rule: CountryRule | null, nsn: string): "mobile" | "fixed" | "toll_free" | "unknown" {
  if (!rule) return "unknown";
  if (rule.toll_free && rule.toll_free.test(nsn)) return "toll_free";
  if (rule.mobile && rule.mobile.test(nsn)) return "mobile";
  if (rule.fixed && rule.fixed.test(nsn)) return "fixed";
  return "unknown";
}

function resolveCountry(hint: string | undefined, cc: string | null, nsn: string): { iso: string | null; rule: CountryRule | null; ambiguous?: string[] } {
  const h = (hint || "").trim().toUpperCase();
  if (h && ISO_SET.has(h)) {
    const rule = BY_ISO[h];
    if (cc && rule.cc !== cc) {
      // Prefer explicit ISO if it conflicts with parsed CC — still return ISO but note mismatch via country_known later
      return { iso: h, rule };
    }
    return { iso: h, rule };
  }
  if (!cc) return { iso: null, rule: null };
  const hit = CC_INDEX.find((x) => x.cc === cc);
  if (!hit) return { iso: null, rule: null };
  if (hit.iso.length === 1) return { iso: hit.iso[0], rule: BY_ISO[hit.iso[0]] };
  // NANP: US vs CA — cannot distinguish offline; prefer US unless hint
  if (cc === "1") return { iso: "US", rule: BY_ISO.US, ambiguous: hit.iso };
  // Prefer first listed that matches length
  for (const iso of hit.iso) {
    const r = BY_ISO[iso];
    if (nsn.length >= r.nsn[0] && nsn.length <= r.nsn[1]) return { iso, rule: r, ambiguous: hit.iso };
  }
  return { iso: hit.iso[0], rule: BY_ISO[hit.iso[0]], ambiguous: hit.iso };
}

function parseToE164(raw: string, countryHint?: string): { e164: string; cc: string | null; nsn: string; iso: string | null; rule: CountryRule | null } {
  let s = raw.trim();
  if (!s) throw new UserError("phone required", 400);

  // 00 international prefix → +
  if (s.startsWith("00")) s = "+" + s.slice(2);

  if (s.startsWith("+")) {
    const dig = digitsOnly(s.slice(1));
    if (dig.length < 7 || dig.length > 15) throw new UserError("E.164 must be 8-15 digits including country code (after +)", 400);
    for (const { cc } of CC_INDEX) {
      if (dig.startsWith(cc)) {
        const nsn = dig.slice(cc.length);
        if (!nsn) continue;
        const { iso, rule } = resolveCountry(countryHint, cc, nsn);
        return { e164: `+${dig}`, cc, nsn, iso, rule };
      }
    }
    // Unknown calling code: treat whole as E.164 digits
    const { iso, rule } = resolveCountry(countryHint, null, dig);
    return { e164: `+${dig}`, cc: null, nsn: dig, iso, rule };
  }

  // National form — needs country
  const isoHint = (countryHint || "").trim().toUpperCase();
  if (!isoHint || !ISO_SET.has(isoHint)) {
    throw new UserError("national phone requires country= ISO 3166-1 alpha-2 (e.g. GB), or pass E.164 with leading + / 00", 400);
  }
  const rule = BY_ISO[isoHint];
  let dig = digitsOnly(s);
  // Drop trunk 0 for most countries (not NANP)
  if (rule.cc !== "1" && dig.startsWith("0")) dig = dig.slice(1);
  // NANP: strip leading 1 if 11 digits
  if (rule.cc === "1" && dig.length === 11 && dig.startsWith("1")) dig = dig.slice(1);
  const e164 = `+${rule.cc}${dig}`;
  return { e164, cc: rule.cc, nsn: dig, iso: isoHint, rule };
}

export function validatePhone(input: { phone?: string; country?: string }) {
  const raw = (input.phone == null ? "" : String(input.phone)).trim();
  if (!raw) throw new UserError("phone required", 400);
  const countryArg = input.country == null ? undefined : String(input.country).trim();
  if (countryArg && !/^[A-Za-z]{2}$/.test(countryArg)) {
    throw new UserError("country must be ISO 3166-1 alpha-2 (e.g. GB, US)", 400);
  }

  const { e164, cc, nsn, iso, rule } = parseToE164(raw, countryArg);
  const dig = digitsOnly(e164);
  const e164_len_ok = dig.length >= 8 && dig.length <= 15;

  let length_ok: boolean;
  if (rule) {
    length_ok = nsn.length >= rule.nsn[0] && nsn.length <= rule.nsn[1] && e164_len_ok;
  } else {
    length_ok = e164_len_ok;
  }

  const country_known = rule != null;
  const type_guess = guessType(rule, nsn);
  // Structure valid: E.164 length + (if known country) NSN in range + digits-only after +
  const valid = e164_len_ok && length_ok && /^\+\d{8,15}$/.test(e164);

  return {
    product: "phone",
    price: "$0.001",
    disclaimer: DISCLAIMER,
    phone_e164: e164,
    valid,
    country: iso,
    calling_code: cc,
    national_number: nsn,
    length_ok,
    country_known,
    type_guess,
    source: "E.164 + country length tables (offline)",
    upsell: {
      email_check: { path: "/email-check", price: "$0.002", why: "validate contact email (syntax + MX)" },
      iban: { path: "/iban", price: "$0.001", why: "offline IBAN mod-97 checksum" },
      kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB pack (registry + VAT + LEI + sanctions)" },
      sanctions: { path: "/sanctions", price: "$0.05", why: "screen a name against OFAC/UK/UN/EU lists" },
    },
  };
}
