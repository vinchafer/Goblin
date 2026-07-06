// FEEL-3a — client-side agent-model check. Mirrors the server's D2 model list so the
// web only ATTEMPTS the /agent path for Swift/Forge sessions; the flag/test-account
// gate stays server-side (a 409 there → fall back to the classic /messages path).

const AGENT_MODELS = new Set(['goblin/efficient', 'goblin/premium']);

/** True when this model slug is one the agent loop can drive (Swift default / Forge). */
export function isAgentModel(slug?: string | null): boolean {
  return !!slug && AGENT_MODELS.has(slug);
}
