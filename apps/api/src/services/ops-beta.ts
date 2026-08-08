/**
 * ACT 2 · PHASE 1 · U1.1 — THE BETA ALLOWLIST (the Act-2 gate).
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * CONTRACT — read this before you add ANY Act-2 route, job, tool or UI surface.
 *
 *   EVERY Act-2 (ops-platform / "Living App" hosting / Keeper) surface — server
 *   route, background job, agent tool, and every web surface that reveals one —
 *   MUST pass through `isOpsBetaAccount()` before it does anything observable.
 *   No exceptions, including read-only surfaces: the existence of an Act-2 route
 *   is itself information the Act-1 cohort must not have.
 *
 *   Two independent dimensions, ANDed. Both must be true:
 *     1. `OPS_HOSTING_ENABLED === 'true'`  — the GLOBAL kill switch. Default OFF.
 *        Absent, empty, 'false', '1', 'yes' → OFF. Only the exact string 'true'
 *        (case-insensitively, trimmed, and with a stray pair of pasted quotes
 *        stripped — see lib/env-value.ts) opens the gate. One Railway variable
 *        turns the whole of Act 2 dark for everyone, instantly, with no deploy.
 *     2. The subject's email ∈ `OPS_BETA_ACCOUNTS` (comma-separated, case-,
 *        whitespace- and quote-insensitive) — the per-account allowlist.
 *
 *   The switch is ordered FIRST on purpose: with the kill switch off, the
 *   allowlist is never consulted and cannot leak through a mis-parsed env value.
 *
 * WHY THIS EXISTS. Real Act-1 test users have been live on production since
 * 2026-07-26. Nothing Act-2-related may be visible or reachable for them while
 * Act 2 is built. This helper is that boundary, and it is the ONLY one — a second
 * gate elsewhere is a second thing to get wrong.
 *
 * WHAT IT IS NOT. It is not authorization for a *resource* (that stays with the
 * usual per-user ownership checks and RLS) and not a plan/entitlement check. It
 * answers exactly one question: "may this human see that Act 2 exists at all?"
 * ════════════════════════════════════════════════════════════════════════════════
 */

/** Env var names, exported so the health probe can report PRESENCE without values. */
import { envFlag, envList } from '../lib/env-value';

export const OPS_HOSTING_ENABLED_ENV = 'OPS_HOSTING_ENABLED';
export const OPS_BETA_ACCOUNTS_ENV = 'OPS_BETA_ACCOUNTS';

/**
 * The global Act-2 kill switch. Default OFF — an unset, empty or malformed value
 * is OFF, never ON. Read at call time (not module load) so a Railway variable
 * change takes effect on the next request after a redeploy, and so tests can
 * toggle it without module-cache games.
 */
export function opsHostingEnabled(): boolean {
  return envFlag(OPS_HOSTING_ENABLED_ENV);
}

/**
 * The allowlisted emails, normalized (unwrapped, lower-cased, blanks dropped).
 * Comma-separated in env: `OPS_BETA_ACCOUNTS=a@example.com,b@example.com`.
 * Returns [] when unset — an empty allowlist admits nobody, which is the safe
 * direction for a fail-closed gate.
 *
 * Normalization goes through `lib/env-value.ts`, so a value pasted with its
 * quotes still on reads as the addresses it visibly contains. See that module's
 * header for why a bare `.trim()` was not enough.
 */
export function opsBetaEmails(): string[] {
  return envList(OPS_BETA_ACCOUNTS_ENV);
}

/** Anything that can identify a human here: a bare email, or an object carrying one. */
export type OpsBetaSubject = string | { email?: string | null } | null | undefined;

function subjectEmail(user: OpsBetaSubject): string {
  const raw = typeof user === 'string' ? user : (user?.email ?? '');
  return raw.trim().toLowerCase();
}

/**
 * THE gate. True iff the global kill switch is on AND this user's email is on the
 * beta allowlist. Fail-closed on every unknown: no user, no email, unset env,
 * malformed env → false.
 */
export function isOpsBetaAccount(user: OpsBetaSubject): boolean {
  if (!opsHostingEnabled()) return false;
  const email = subjectEmail(user);
  if (!email) return false;
  return opsBetaEmails().includes(email);
}

/** Why a subject was refused. */
export type OpsBetaDenyReason = 'hosting_disabled' | 'no_email' | 'not_allowlisted';

/**
 * The reason a subject was refused, or null if admitted.
 *
 * FOR LOGS AND TESTS ONLY — never return this to a client. Telling a caller
 * "not_allowlisted" rather than "hosting_disabled" confirms that an allowlist,
 * and therefore a hidden feature, exists. Act-2 surfaces answer 404 to everyone
 * they refuse, with no discriminating detail (see middleware/ops-gate.ts).
 */
export function opsBetaDenyReason(user: OpsBetaSubject): OpsBetaDenyReason | null {
  if (!opsHostingEnabled()) return 'hosting_disabled';
  const email = subjectEmail(user);
  if (!email) return 'no_email';
  return opsBetaEmails().includes(email) ? null : 'not_allowlisted';
}
