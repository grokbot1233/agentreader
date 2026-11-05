/** Vercel AI SDK tool — call AgentReader after settling x402 in your fetch layer */
import { tool } from "ai";
import { z } from "zod";

export const ukCompanyLite = tool({
  description:
    "Cheap UK Companies House snapshot: status, compliance flags, red flags. $0.05 USDC via x402. Use uk_company for full officers/PSC/filings.",
  parameters: z.object({ number: z.string().optional(), name: z.string().optional() }),
  execute: async ({ number, name }, { abortSignal }) => {
    const q = number ? `number=${encodeURIComponent(number)}` : `name=${encodeURIComponent(name!)}`;
    // Inject your wrapFetchWithPayment fetch as global or import fetchPaid
    const r = await fetch(`https://api.axiomworks.co.uk/uk-company-lite?${q}`, { signal: abortSignal });
    if (r.status === 402) return { error: "payment_required", hint: "use @x402/fetch wrapFetchWithPayment" };
    return r.json();
  },
});
