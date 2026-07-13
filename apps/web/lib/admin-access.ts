// F-31 — the single admin-access decision, shared by the /admin layout and the
// /api/admin proxy so they can never drift. Two independent gates grant access:
//   • the account's `is_admin` flag (migration 0064), OR
//   • an ADMIN_EMAIL env exactly matching the signed-in email (the fallback used
//     before is_admin is set — env only, never a hardcoded address).
// Pure and deterministic → unit-testable without a session (the F-31 gate).

export interface AdminAccessInput {
  /** users.is_admin for the signed-in account (null when unknown / pre-migration). */
  isAdmin: boolean | null | undefined;
  /** The signed-in account's email (null when unknown). */
  userEmail: string | null | undefined;
  /** process.env.ADMIN_EMAIL (null/undefined when unset). */
  adminEmail: string | null | undefined;
}

export type AdminDenyReason =
  | 'not_authenticated' // no user at all → caller redirects to /login
  | 'not_admin';        // authenticated, but neither gate grants access

export interface AdminAccessResult {
  allowed: boolean;
  /** Present only when !allowed. */
  reason?: AdminDenyReason;
  /** Which gate granted access (for logs/telemetry). Present only when allowed. */
  via?: 'is_admin' | 'admin_email';
}

/** Case-insensitive, whitespace-tolerant email match. */
function emailMatches(userEmail: string | null | undefined, adminEmail: string | null | undefined): boolean {
  if (!userEmail || !adminEmail) return false;
  return userEmail.trim().toLowerCase() === adminEmail.trim().toLowerCase();
}

/**
 * Decide admin access. `hasUser=false` short-circuits to not_authenticated so the
 * layout can redirect to /login (vs. showing an honest "no admin access" screen
 * to a signed-in non-admin).
 */
export function resolveAdminAccess(input: AdminAccessInput, hasUser = true): AdminAccessResult {
  if (!hasUser) return { allowed: false, reason: 'not_authenticated' };
  if (emailMatches(input.userEmail, input.adminEmail)) return { allowed: true, via: 'admin_email' };
  if (input.isAdmin === true) return { allowed: true, via: 'is_admin' };
  return { allowed: false, reason: 'not_admin' };
}
