import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

export type PaidFetch = typeof fetch;

/** Resolve an EVM private key from common env names. */
export function resolvePrivateKey(): `0x${string}` | undefined {
  const raw =
    process.env.AGENTREADER_PRIVATE_KEY ||
    process.env.EVM_PRIVATE_KEY ||
    process.env.PRIVATE_KEY ||
    process.env.X402_PRIVATE_KEY;
  if (!raw) return undefined;
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      "Invalid AGENTREADER_PRIVATE_KEY / EVM_PRIVATE_KEY (expected 32-byte hex with optional 0x)",
    );
  }
  return key as `0x${string}`;
}

/** Build a fetch that auto-settles x402 exact USDC on Base when a key is present. */
export function createFetch(): { fetch: PaidFetch; paying: boolean } {
  const key = resolvePrivateKey();
  if (!key) return { fetch: globalThis.fetch.bind(globalThis), paying: false };
  const account = privateKeyToAccount(key);
  const client = new x402Client().register("eip155:8453", new ExactEvmScheme(account));
  return { fetch: wrapFetchWithPayment(globalThis.fetch.bind(globalThis), client), paying: true };
}
