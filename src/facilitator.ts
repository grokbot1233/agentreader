import { HTTPFacilitatorClient } from "@x402/core/server";
import { createFacilitatorConfig } from "@coinbase/x402";

export const CANONICAL = "https://api.axiomworks.co.uk";
export const CONTACT = "info@axiomworks.co.uk";
// Primary: Coinbase CDP facilitator (Base mainnet, indexes into the CDP Bazaar). Fallback: PayAI (no keys).
export function facilitatorClient(env: any) {
  if (env.CDP_API_KEY_ID && env.CDP_API_KEY_SECRET && env.FACILITATOR !== "payai")
    return new HTTPFacilitatorClient(createFacilitatorConfig(env.CDP_API_KEY_ID, env.CDP_API_KEY_SECRET) as any);
  return new HTTPFacilitatorClient({ url: env.FACILITATOR_URL || "https://facilitator.payai.network" });
}
