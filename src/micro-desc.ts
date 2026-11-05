const C = " Chains: base (default), ethereum, arbitrum, optimism, polygon.";
export const MICRO_DESC: Record<string, string> = {
  ens_lookup: "Use this to resolve an ENS name to an address plus avatar/url/twitter/github/description records, or reverse-resolve an address to its forward-verified primary name. Pass name OR address. $0.002 USDC.",
  token_metadata: "Use this when you only need an ERC20's name, symbol, decimals and total supply (formatted + raw), e.g. to format amounts. Cheaper than token_check." + C + " $0.001 USDC.",
  token_allowance: "Use this before transferFrom/Permit/x402 flows or for approval hygiene: ERC20 allowance owner->spender, unlimited flag, owner balance, spendable-now." + C + " $0.002 USDC.",
  contract_info: "Use this to inspect an address: contract vs wallet vs EIP-7702 delegated EOA, bytecode size, EIP-1967 implementation/admin/beacon, EIP-1167 clone target, owner(), ERC20/721/1155 detection, Sourcify verified name." + C + " $0.003 USDC.",
  gas_fees: "Use this before sending a transaction: base fee, priority-fee percentiles, suggested EIP-1559 maxFee/maxPriority, block utilisation and USD cost of a transfer, ERC20 transfer and swap." + C + " $0.001 USDC.",
  block_lookup: "Use this to fetch a block by number/latest/finalized, or find the last block at or before a timestamp (unix or ISO) for historical queries. Returns number, hash, time, tx count, base fee." + C + " $0.001 USDC.",
  nft_lookup: "Use this to look up one NFT: ERC721 owner, tokenURI and fetched JSON metadata (IPFS/Arweave/data URIs resolved), collection name/symbol." + C + " $0.002 USDC.",
};
