import { UserError } from "./core";
const DISCLAIMER = "Dutch KvK number structure only (offline, 8 digits). KvK has no mandatory public checksum; elfproef shown as informational (older numbers usually pass). Not proof the number is assigned or active. Not a KYB/AML determination.";
const UPSELL = { eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate NL VAT via VIES" }, lei: { path: "/lei", price: "$0.005", why: "GLEIF LEI lookup" }, kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB pack" }, sanctions: { path: "/sanctions", price: "$0.05", why: "sanctions screen" } };
export function validateKvk(input: { kvk?: string }) {
  const raw = (input.kvk == null ? "" : String(input.kvk)).trim();
  if (!raw) throw new UserError("kvk required", 400);
  let c = raw.replace(/[\s\-.]/g, "").toUpperCase();
  if (c.startsWith("KVK")) c = c.slice(3);
  if (!/^\d+$/.test(c)) throw new UserError("kvk must be digits only (optional KvK prefix)", 400);
  if (c.length !== 8) throw new UserError("kvk must be exactly 8 digits", 400);
  let sum = 0; for (let i = 0; i < 8; i++) sum += (c.charCodeAt(i) - 48) * (8 - i);
  const elfproef_ok = sum % 11 === 0;
  return { product: "kvk-nl", price: "$0.001", disclaimer: DISCLAIMER, kvk: c, valid: true, length_ok: true, digits: 8, elfproef_ok, source: "Dutch KvK structure (offline)", upsell: UPSELL };
}
