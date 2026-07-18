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

/**
 * F-40 orphan guard: hard wall-clock ceiling for a single run (default 10 min). A run
 * now continues server-side after the client disconnects (it is no longer bound to the
 * request), so an abandoned run could otherwise burn tokens until the iteration budget
 * is spent. This timer aborts the run with an honest timeout landing. Env-overridable
 * (`AGENT_MAX_RUNTIME_MS`) — the documented cost control for background runs (ledger M10).
 */
export function agentMaxRuntimeMs(): number {
  const raw = Number(process.env.AGENT_MAX_RUNTIME_MS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 600_000;
}

/**
 * WAVE-H · H4 — global concurrent-run admission cap (the N-6 closer). The single-box
 * process has no admission control today (Code-DD N-6: no p-limit/semaphore); an
 * unbounded in-flight count is what turns provider throttling into a full-node outage
 * (the shared circuit breaker OPENs after 3 failures) and grows heap without limit.
 *
 * This is the ceiling for TOTAL simultaneous agent runs in this process. LIVE USERS: the
 * default (50) is generous — far above any realistic concurrent load for the current
 * cohort, yet below the ~100-concurrent point the DD locates as the first breaking point,
 * so it protects the box without throttling a real user at merge. Env-overridable; set
 * `AGENT_GLOBAL_MAX_CONCURRENT=0` to DISABLE the cap entirely (founder knob).
 */
export function maxConcurrentRunsGlobal(): number {
  const raw = Number(process.env.AGENT_GLOBAL_MAX_CONCURRENT);
  if (Number.isFinite(raw) && raw === 0) return 0; // explicit disable
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 50;
}

/**
 * WAVE-H · H4 — per-user concurrent-run cap. A single human effectively never needs more
 * than one or two builds running at once; a request for a third simultaneous run is either
 * a stuck client or an abuse vector (one account fanning out hundreds of runs — the exact
 * scale-out multiplier the DD warns about). Default 2 (generous for honest use, a hard
 * ceiling against fan-out). Env-overridable; `AGENT_MAX_CONCURRENT_PER_USER=0` disables.
 * This complements — does not replace — the existing per-hour cap (agentRunsPerHour).
 */
export function maxConcurrentRunsPerUser(): number {
  const raw = Number(process.env.AGENT_MAX_CONCURRENT_PER_USER);
  if (Number.isFinite(raw) && raw === 0) return 0; // explicit disable
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 2;
}

/**
 * Retry-After hint (seconds) handed to a user whose run was shed by the admission cap.
 * Short by design: runs are bounded and slots free quickly, so "einen kurzen Moment" is
 * honest. Env-overridable (`AGENT_CAPACITY_RETRY_AFTER_SEC`).
 */
export function capacityRetryAfterSec(): number {
  const raw = Number(process.env.AGENT_CAPACITY_RETRY_AFTER_SEC);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 8;
}

/**
 * The AbortController reason the F-40 max-runtime guard uses, so it is distinguishable
 * from an explicit user Stop (disconnect ≠ stop ≠ timeout — the three signals must be
 * architecturally distinct). The orchestrator reads `stopSignal.reason` to land an honest
 * "Zeitlimit erreicht" report instead of a plain user "gestoppt".
 */
export const MAX_RUNTIME_ABORT_REASON = 'max_runtime';

/** The AbortController reason an explicit user Stop uses (F-23 stop-card semantics). */
export const USER_STOP_ABORT_REASON = 'user_stop';

/**
 * FW5-U6 (Forge heartbeat): how long the FIRST agent turn may run silently before the
 * run surface shows an honest in-progress line. The agent turn is non-streaming (no
 * first-token delta to hook), so a big Forge run would otherwise sit visually silent
 * between the `meta` frame and the first narration/step. Default 6s — long enough that
 * a quick Swift turn never shows it, short enough that a slow Forge wait feels attended.
 * Env-overridable (`AGENT_FORGE_HEARTBEAT_MS`). No token cost — a local timer + one
 * event through the existing stream.
 */
export function forgeHeartbeatDelayMs(): number {
  const raw = Number(process.env.AGENT_FORGE_HEARTBEAT_MS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 6_000;
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
