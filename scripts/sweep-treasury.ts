// Sweep AgentReader treasury (Coinbase CDP Server Wallet "agentreader-treasury", key custodied by Coinbase)
// to Liam's Coinbase deposit address when USDC balance > threshold.
// Usage: npx tsx scripts/sweep-treasury.ts [thresholdUsd=20] [--dry-run]
// Env: CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET. Optional: CDP_PAYMASTER_URL (+ --smart) for gasless via
// the smart account "agentreader-treasury-sa" (only if payTo is moved to that smart account).
// Gas: the EOA pays ~60k gas in Base ETH per transfer (< $0.01). Keep ~0.0002 ETH at the treasury address.
import { CdpClient } from "@coinbase/cdp-sdk";
import { createPublicClient, http, parseAbi, formatUnits, formatEther, encodeFunctionData } from "viem";
import { base } from "viem/chains";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const DEST = "0xB1A4e2C441fa896AF010222659AAbBb71E9Ef1D1" as const;
const args = process.argv.slice(2); const dry = args.includes("--dry-run");
const threshold = Number(args.find((a) => !a.startsWith("--")) ?? 20);
const abi = parseAbi(["function balanceOf(address) view returns (uint256)", "function transfer(address,uint256) returns (bool)"]);
const cdp = new CdpClient();
const account = await cdp.evm.getOrCreateAccount({ name: "agentreader-treasury" });
const pub = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org") });
const bal = await pub.readContract({ address: USDC, abi, functionName: "balanceOf", args: [account.address] });
const eth = await pub.getBalance({ address: account.address });
console.log(`treasury ${account.address}: ${formatUnits(bal, 6)} USDC, ${formatEther(eth)} ETH; threshold $${threshold}`);
if (bal <= BigInt(Math.round(threshold * 1e6))) { console.log("below threshold, nothing to do"); process.exit(0); }
const data = encodeFunctionData({ abi, functionName: "transfer", args: [DEST, bal] });
const fees = await pub.estimateFeesPerGas(); const cost = 80000n * (fees.maxFeePerGas ?? 0n);
console.log(`est max gas cost ${formatEther(cost)} ETH`);
if (dry) { console.log(`dry run: would send ${formatUnits(bal, 6)} USDC to ${DEST}`); process.exit(0); }
if (eth < cost) { console.error(`need ETH for gas: send >= ${formatEther(cost * 2n)} ETH on Base to ${account.address}`); process.exit(1); }
const { transactionHash } = await cdp.evm.sendTransaction({ address: account.address, network: "base", transaction: { to: USDC, data } });
console.log("tx", transactionHash); const r = await pub.waitForTransactionReceipt({ hash: transactionHash as `0x${string}` }); console.log("status", r.status);
