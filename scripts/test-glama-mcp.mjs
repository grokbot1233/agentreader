import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn(process.execPath, [path.join(root, "glama-mcp/index.js")], {
  stdio: ["pipe", "pipe", "inherit"],
  env: process.env,
});

const rl = createInterface({ input: child.stdout });
let nextId = 1;
const pending = new Map();

function send(method, params) {
  const id = nextId++;
  const msg = { jsonrpc: "2.0", id, method, params };
  child.stdin.write(JSON.stringify(msg) + "\n");
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 15000);
    pending.set(id, (res) => { clearTimeout(t); resolve(res); });
  });
}

rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { console.error("non-json", line); return; }
  if (msg.id != null && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

async function main() {
  const init = await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "glama-test", version: "1.0.0" },
  });
  console.log("initialize:", JSON.stringify({
    id: init.id,
    name: init.result?.serverInfo?.name,
    version: init.result?.serverInfo?.version,
    protocol: init.result?.protocolVersion,
    error: init.error,
  }));
  // notifications/initialized (no id)
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  const listed = await send("tools/list", {});
  const tools = listed.result?.tools || [];
  console.log("tools/list count:", tools.length);
  console.log("tools:", tools.map((t) => t.name).join(", "));
  if (tools.length < 8) throw new Error("expected >= 8 tools");

  // One unpaid call should return payment_required payload (needs network)
  const call = await send("tools/call", { name: "pricing", arguments: {} });
  const text = call.result?.content?.[0]?.text || call.error?.message || "";
  console.log("pricing call ok:", !call.error, "snippet:", String(text).slice(0, 160).replace(/\n/g, " "));

  child.kill();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  child.kill();
  process.exit(1);
});
