import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(process.execPath, [path.join(root, "dist/index.js")], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env },
  // no private key => preview mode
});

const rl = createInterface({ input: child.stdout });
let nextId = 1;
const pending = new Map();

function send(method, params) {
  const id = nextId++;
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 30000);
    pending.set(id, (res) => {
      clearTimeout(t);
      resolve(res);
    });
  });
}

rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    console.error("non-json", line.slice(0, 200));
    return;
  }
  if (msg.id != null && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

async function main() {
  const init = await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "pack-test", version: "1.0.0" },
  });
  console.log(
    "initialize:",
    JSON.stringify({
      name: init.result?.serverInfo?.name,
      version: init.result?.serverInfo?.version,
      error: init.error,
    }),
  );
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  const listed = await send("tools/list", {});
  const tools = listed.result?.tools || [];
  console.log("tools/list count:", tools.length);
  console.log("tools:", tools.map((t) => t.name).join(", "));
  if (tools.length < 26) throw new Error(`expected >= 26 tools, got ${tools.length}`);

  const pricing = await send("tools/call", { name: "pricing", arguments: {} });
  const ptext = pricing.result?.content?.[0]?.text || "";
  console.log("pricing ok:", !pricing.error && ptext.includes("x402"), "len:", ptext.length);

  const preview = await send("tools/call", {
    name: "check_domain",
    arguments: { domain: "example.com" },
  });
  const text = preview.result?.content?.[0]?.text || "";
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  console.log(
    "check_domain preview:",
    JSON.stringify({
      preview: body.preview,
      domain: body.domain,
      score: body.score,
      error: body.error,
      isError: preview.result?.isError,
    }),
  );
  if (!body.preview && body.error !== "payment_required") {
    // Accept either preview payload or payment_required
    throw new Error("expected preview or payment_required, got: " + text.slice(0, 400));
  }

  child.kill();
  console.log("MCP stdio test PASSED");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  child.kill();
  process.exit(1);
});
