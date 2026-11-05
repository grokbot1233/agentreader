// Emit packages/*/src/chain-routes.json from src/chain.ts so the npm SDK/MCP/AgentKit/LangChain packages stay in sync.
import { writeFileSync } from "node:fs";
import { CHAIN_ROUTES } from "../src/chain";
const meta = CHAIN_ROUTES.map((r) => ({ path: r.path, tool: "chain_" + r.path.slice(7).replace(/-/g, "_"), price: r.price, description: r.desc, params: Object.fromEntries(Object.entries(r.in.properties).map(([k, v]: any) => [k, v.description || (v.enum ? `one of ${v.enum.join("|")}` : k)])), required: r.in.required || [], example: r.ex }));
for (const p of process.argv.slice(2)) writeFileSync(p, JSON.stringify(meta, null, 1));
console.log(meta.length);
