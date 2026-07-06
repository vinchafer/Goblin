// FEEL-3a — agent loop configuration: the feature flag, eligibility, and budget knobs.
//
// Flags follow the codebase convention (plain `process.env.X === 'true'` reads, no
// framework). The loop activates ONLY when: the flag is on (or the caller is the
// test account), the chat is a PROJECT chat (D4 — tools are project-scoped), and the
// model is on the verified-capable list (D2 — Swift default, Forge opt-in). Anything
// else keeps today's behavior — no silent degradation into a broken agent.

import { parseGoblinTier, type GoblinTierId } from '../goblin-hosted';
import { FORGE_WEIGHT } from '../../lib/goblin-cap';

/** Budget: max model turns per run (spec §7 default 8). Env-overridable. */
export function agentMaxIterations(): number {
  const raw = Number(process.env.AGENT_MAX_ITERATIONS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 8;
}

/** Budget: max weighted cost units per run (spec §7 default 200k). Env-overridable. */
export function agentMaxUnits(): number {
  const raw = Number(process.env.AGENT_MAX_UNITS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 200_000;
}

/** The verified-capable model list for agent mode (D2): Swift (default) + Forge. */
const AGENT_ELIGIBLE_TIERS: GoblinTierId[] = ['goblin/efficient', 'goblin/premium'];

/** Is this model slug eligible to drive the agent loop? */
export function isAgentEligibleModel(modelSlug?: string | null): boolean {
  const tier = parseGoblinTier(modelSlug);
  return tier !== null && AGENT_ELIGIBLE_TIERS.includes(tier);
}

/**
 * Is the agent loop enabled for this caller? Default OFF (flag `AGENT_LOOP`), but
 * always ON for the test account (`TEST_ACCOUNT_EMAIL`) so the founder can exercise
 * it in prod without flipping the flag for everyone.
 */
export function isAgentLoopEnabled(userEmail?: string | null): boolean {
  if (process.env.AGENT_LOOP === 'true') return true;
  const testEmail = process.env.TEST_ACCOUNT_EMAIL;
  if (testEmail && userEmail && userEmail.toLowerCase() === testEmail.toLowerCase()) return true;
  return false;
}

/**
 * Final eligibility gate: flag/test-account AND a project chat AND an eligible model.
 * A standalone chat (no projectId) is never eligible (D4). Returns the reason it was
 * blocked (for logging) or null when eligible.
 */
export function agentEligibility(input: {
  userEmail?: string | null;
  projectId?: string | null;
  modelSlug?: string | null;
}): { eligible: boolean; reason?: string } {
  if (!isAgentLoopEnabled(input.userEmail)) return { eligible: false, reason: 'flag_off' };
  if (!input.projectId) return { eligible: false, reason: 'standalone_chat' };
  if (!isAgentEligibleModel(input.modelSlug)) return { eligible: false, reason: 'model_not_eligible' };
  return { eligible: true };
}

/**
 * Weighted cost units for a run's tokens on a given tier — reuses the LOCKED
 * FORGE_WEIGHT (goblin-cap, single source). A run uses one model, so Forge tokens
 * weight 4.4× and Swift tokens 1×.
 */
export function runWeightedUnits(modelSlug: string | null | undefined, tokensIn: number, tokensOut: number): number {
  const total = Math.max(0, tokensIn) + Math.max(0, tokensOut);
  const tier = parseGoblinTier(modelSlug);
  const weight = tier === 'goblin/premium' ? FORGE_WEIGHT : 1;
  return Math.floor(total * weight);
}
