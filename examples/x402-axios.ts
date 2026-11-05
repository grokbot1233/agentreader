/** Minimal x402-axios client */
import axios from "axios";
import { withPaymentInterceptor, decodeXPaymentResponse } from "x402-axios";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { base } from "viem/chains";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const wallet = createWalletClient({ account, chain: base, transport: http() });
const api = withPaymentInterceptor(axios.create({ baseURL: "https://api.axiomworks.co.uk" }), wallet as any);

const { data, headers } = await api.get("/company", { params: { domain: "example.com" } });
console.log(data, decodeXPaymentResponse(headers["x-payment-response"] || headers["payment-response"]));
