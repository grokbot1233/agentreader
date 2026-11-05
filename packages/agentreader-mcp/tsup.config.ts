import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node18",
  // Keep deps external so npm install resolves them
  external: [
    "@modelcontextprotocol/sdk",
    "@x402/fetch",
    "@x402/evm",
    "viem",
    "zod",
  ],
});
