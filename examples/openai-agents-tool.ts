/** OpenAI Agents SDK function tool shape for AgentReader */
export const agentReaderTools = [
  {
    type: "function" as const,
    name: "uk_company_lite",
    description:
      "Use for a cheap UK company snapshot (status + red flags). $0.05 USDC x402. Prefer uk_company for full DD.",
    parameters: {
      type: "object",
      properties: {
        number: { type: "string", description: "Companies House number e.g. 00445790" },
        name: { type: "string", description: "Registered company name to search" },
      },
    },
  },
];
// In your agent runner: on tool call, settle via @x402/fetch then return JSON.
