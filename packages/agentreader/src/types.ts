export type Chain = "base" | "ethereum" | "arbitrum" | "optimism" | "polygon";

export type ClientOptions = {
  /** EVM private key (0x… or bare hex). Enables auto x402 payment on Base. */
  privateKey?: string;
  /** API origin. Default https://api.axiomworks.co.uk */
  origin?: string;
  /**
   * When true (default if no privateKey), append preview=1 on GET paid routes
   * for free truncated samples (8/IP/day). Ignored when paying.
   */
  preview?: boolean;
  /** Optional fetch implementation (defaults to global fetch, wrapped with x402 when paying). */
  fetch?: typeof fetch;
  /** User-Agent suffix */
  userAgent?: string;
};

export type RequestOpts = {
  /** Force preview=1 even when a key is set (still free truncated). */
  preview?: boolean;
  /** Extra query params */
  query?: Record<string, string | number | boolean | undefined | null>;
};
