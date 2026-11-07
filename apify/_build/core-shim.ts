// Minimal stand-in for AgentReader src/core.ts (only UserError is used by the bundled modules).
export class UserError extends Error { constructor(msg: string, public status = 400) { super(msg); } }
