/**
 * AKT 2 · PHASE 2.5 · U-C1 — THE FOUNDER ALLOWLIST (the operator identity).
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS ANSWERS, AND WHAT IT DOES NOT.
 *
 *   `isOpsBetaAccount()` (services/ops-beta.ts) answers "may this human see that
 *   Act 2 exists at all". It is a VISIBILITY gate and it is ANDed with the global
 *   kill switch on purpose.
 *
 *   This file answers a different question: "is this human the operator" — the
 *   person who is allowed to suspend an app, tear one down, and drive the ops
 *   console. It is an AUTHORITY check, and it is deliberately INDEPENDENT of both
 *   `OPS_HOSTING_ENABLED` and `OPS_BETA_ACCOUNTS`.
 *
 * ── Why independent, in one sentence you should not have to re-derive ────────
 * `OPS_HOSTING_ENABLED=false` is how Act 2 goes dark. The router serves from KV
 * and R2 and never asks the API anything, so going dark does NOT stop a live
 * hosted app — only the emergency stop can. If the operator's authority were
 * ANDed with the kill switch, then flipping the switch during an incident would
 * disarm the only per-app stop at exactly the moment it is needed. That was an
 * explicit Phase-2 finding (routes/ops-admin.ts, and index.ts where /api/admin/ops
 * is mounted outside the beta gate). This helper preserves it: nothing here reads
 * the kill switch, and nothing here reads the beta allowlist.
 *
 * ── Fail-closed, and the default is nobody ──────────────────────────────────
 * `OPS_FOUNDER_ACCOUNTS` unset, empty or whitespace → the list is empty → NOBODY
 * passes, including the founder. The console's write actions are therefore off by
 * default and are armed by one Railway variable, exactly like every other Act-2
 * switch. An empty allowlist admitting everyone would be the classic inversion;
 * it is tested against explicitly (services/ops-founder.test.ts).
 *
 * ── Server-side only ────────────────────────────────────────────────────────
 * The list is never sent to a client, never embedded in a bundle, and never
 * echoed in a response body. A client learns only whether ITS OWN session passed,
 * and it learns that as a 404 when it did not — see middleware/ops-founder-gate.ts.
 * ════════════════════════════════════════════════════════════════════════════════
 */

import { envList } from '../lib/env-value';

/** Env var name, exported so a health probe can report PRESENCE without the value. */
export const OPS_FOUNDER_ACCOUNTS_ENV = 'OPS_FOUNDER_ACCOUNTS';

/**
 * The founder emails, normalized (unwrapped, lower-cased, blanks dropped).
 * Comma-separated in env: `OPS_FOUNDER_ACCOUNTS=a@example.com,b@example.com`.
 * Read at call time, never cached, so a Railway change takes effect on the next
 * request after the redeploy and so tests can toggle it without module-cache games.
 *
 * Normalization goes through `lib/env-value.ts`, which strips a stray pair of
 * surrounding quotes as well as whitespace. This used to be a bare
 * `.trim().toLowerCase()`, and the difference is not cosmetic: a value pasted as
 * `OPS_FOUNDER_ACCOUNTS="someone@example.com"` produced a one-entry list whose
 * entry still carried its quotes, matched nobody, and refused the founder with
 * the same silent 404 the gate gives a stranger.
 */
export function opsFounderEmails(): string[] {
  return envList(OPS_FOUNDER_ACCOUNTS_ENV);
}

/** True iff the allowlist is configured at all. False = the console is disarmed. */
export function opsFounderConfigured(): boolean {
  return opsFounderEmails().length > 0;
}

/** Anything that can identify a human here: a bare email, or an object carrying one. */
export type OpsFounderSubject = string | { email?: string | null } | null | undefined;

function subjectEmail(user: OpsFounderSubject): string {
  const raw = typeof user === 'string' ? user : (user?.email ?? '');
  return raw.trim().toLowerCase();
}

/**
 * THE operator check. True iff this human's email is on `OPS_FOUNDER_ACCOUNTS`.
 * Fail-closed on every unknown: no user, no email, unset env, malformed env → false.
 *
 * Note what is NOT here: no kill-switch read, no beta-allowlist read. That absence
 * is the feature — see the header.
 */
export function isOpsFounderAccount(user: OpsFounderSubject): boolean {
  const email = subjectEmail(user);
  if (!email) return false;
  return opsFounderEmails().includes(email);
}

/** Why a subject was refused. */
export type OpsFounderDenyReason = 'not_configured' | 'no_email' | 'not_allowlisted';

/**
 * The reason a subject was refused, or null if admitted.
 *
 * FOR LOGS AND TESTS ONLY — never return this to a client. Telling a caller
 * "not_allowlisted" rather than "not_configured" confirms that an allowlist, and
 * therefore a hidden console, exists. The gate answers 404 to everyone it refuses,
 * with no discriminating detail.
 */
export function opsFounderDenyReason(user: OpsFounderSubject): OpsFounderDenyReason | null {
  if (!opsFounderConfigured()) return 'not_configured';
  const email = subjectEmail(user);
  if (!email) return 'no_email';
  return opsFounderEmails().includes(email) ? null : 'not_allowlisted';
}
