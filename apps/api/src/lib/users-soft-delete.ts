/**
 * FOUNDER-WALK-5 · U2 — reading `users` while `users.deleted_at` may not exist yet.
 *
 * Migrations in this repo are authored, not applied (Methodik Gesetz 4), so "the column is
 * not there yet" is a NORMAL state the API must survive rather than a crash. Every other
 * pending-migration consumer in this codebase already degrades — `insertPlatformEvent`
 * silent-fails, `/admin/promo` answers `available: false`, `promo.ts` maps PGRST202 to a
 * decline. The `users.deleted_at` readers were the exception, and `/admin/users` answered a
 * bare 500 because of it.
 *
 * ── Why the degraded read is CORRECT, not just tolerable ─────────────────────
 *
 * Dropping the `.is('deleted_at', null)` filter would normally be a data-correctness risk:
 * soft-deleted users would reappear in admin lists. Here it is not, and the reason is
 * specific — if the column does not exist, then NOTHING has ever been written to it, so the
 * filter it powers is a no-op on every row. `account_deletions` (0042) holds the real
 * deletion record and is untouched by this. The degraded read returns exactly the same rows
 * the filtered read would.
 *
 * That equivalence ends the moment 0101 is applied, which is why every caller reports
 * `degraded` upward instead of hiding it: a surface that shows unfiltered users must be able
 * to say so.
 */

import { isMissingSchema } from './schema-shape';

/**
 * The migration that supplies the column — a REAL filename, checked into this repo.
 *
 * The string this replaces was `'(users.deleted_at — added out of band, no migration in
 * repo)'`, and it was rendered verbatim to the founder in the /admin/insight notice, in the
 * slot where a filename belongs ("Spiel Migration <X> im Supabase-SQL-Editor ein"). A
 * parenthetical note about the repo's own history is not something a user can act on.
 */
export const USERS_DELETED_AT_MIGRATION = '0101_users_deleted_at.sql';

/**
 * Is this error specifically "users.deleted_at is not there yet"?
 *
 * Deliberately narrow. A generic missing-schema check would also swallow a missing `users`
 * TABLE, and retrying that without the filter would just fail again — while making the log
 * claim a column problem. Both halves must match: the shape must be a schema gap AND the
 * message must name this column.
 */
export function isMissingDeletedAt(message: string | null | undefined): boolean {
  if (!message) return false;
  return isMissingSchema(message) && /deleted_at/i.test(message);
}

export interface TolerantReadResult<T> {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
  /** True when the answer came from the fallback — i.e. the soft-delete filter was absent. */
  degraded: boolean;
}

/**
 * Run a `users` read that filters on `deleted_at`, and fall back to the same read without
 * that filter when the column is missing.
 *
 * `run` is called with `hasDeletedAt`, and must build the query BOTH ways — a Supabase query
 * builder cannot be replayed once awaited, so the caller owns the two shapes. Any error that
 * is not this specific gap is returned untouched: this helper makes one failure survivable,
 * it does not swallow failures in general.
 */
export async function readUsersTolerant<T>(
  run: (opts: { hasDeletedAt: boolean }) => PromiseLike<{ data: T | null; error: { message: string } | null; count?: number | null }>,
): Promise<TolerantReadResult<T>> {
  const first = await run({ hasDeletedAt: true });
  if (!first.error || !isMissingDeletedAt(first.error.message)) {
    return { ...first, degraded: false };
  }
  const second = await run({ hasDeletedAt: false });
  return { ...second, degraded: true };
}
