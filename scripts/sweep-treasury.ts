// Sweep AgentReader treasury USDC (Base) to Liam's Coinbase deposit address when balance > threshold.
// Usage: npx tsx scripts/sweep-treasury.ts [thresholdUsd=20] [--dry-run]
// Treasury is a plain EOA (key in .treasury_wallet_key, gitignored). A USDC transfer costs ~65k gas; on Base that is
// typically < $0.01 of ETH, so keep ~0.0002 ETH in the treasury address for gas.
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, parseAbi, formatUnits, formatEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DEST = "0xB1A4e2C441fa896AF010222659AAbBb71E9Ef1D1";
const args = process.argv.slice(2); const dry = args.includes("--dry-run");
const threshold = Number(args.find((a) => !a.startsWith("--")) ?? 20);
const abi = parseAbi(["function balanceOf(address) view returns (uint256)", "function transfer(address,uint256) returns (bool)"]);
const account = privateKeyToAccount(readFileSync(new URL("../.treasury_wallet_key", import.meta.url), "utf8").trim() as `0x${string}`);
const rpc = http(process.env.BASE_RPC_URL || "https://mainnet.base.org");
const pub = createPublicClient({ chain: base, transport: rpc });
const bal = await pub.readContract({ address: USDC, abi, functionName: "balanceOf", args: [account.address] });
const eth = await pub.getBalance({ address: account.address });
console.log(`treasury ${account.address}: ${formatUnits(bal, 6)} USDC, ${formatEther(eth)} ETH; threshold $${threshold}`);
if (bal <= BigInt(Math.round(threshold * 1e6))) { console.log("below threshold, nothing to do"); process.exit(0); }
const gas = await pub.estimateContractGas({ address: USDC, abi, functionName: "transfer", args: [DEST, bal], account }).catch(() => 80000n);
const fees = await pub.estimateFeesPerGas(); const cost = gas * (fees.maxFeePerGas ?? 0n);
console.log(`est gas ${gas}, max cost ${formatEther(cost)} ETH`);
if (eth < cost) { console.error(`need more ETH for gas: send >= ${formatEther(cost * 2n)} ETH on Base to ${account.address}`); process.exit(1); }
if (dry) { console.log(`dry run: would send ${formatUnits(bal, 6)} USDC to ${DEST}`); process.exit(0); }
const wallet = createWalletClient({ account, chain: base, transport: rpc });
const hash = await wallet.writeContract({ address: USDC, abi, functionName: "transfer", args: [DEST, bal] });
console.log("tx", hash); const r = await pub.waitForTransactionReceipt({ hash }); console.log("status", r.status);
