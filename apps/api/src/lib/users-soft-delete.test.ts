/**
 * FOUNDER-WALK-5 · U2 — the `users.deleted_at` gap, as tests.
 *
 * The founder's device: `/admin/users` → "Fehler 500 — column users.deleted_at does not
 * exist". The table is fine; the column has never been created by any migration in this
 * repo (0101 is the first). Two things have to hold from here on:
 *
 *   ① the read survives the gap and returns the SAME rows (the filter is a no-op when the
 *      column does not exist, because nothing was ever written to it), and
 *   ② the gap is reported upward, never swallowed — a surface showing an unfiltered list
 *      must be able to say so, naming a real migration file.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  readUsersTolerant,
  isMissingDeletedAt,
  USERS_DELETED_AT_MIGRATION,
} from './users-soft-delete';

/** The exact string PostgREST/Postgres returns for the founder's failure. */
const FOUNDER_ERROR = 'column users.deleted_at does not exist';

describe('recognising the gap', () => {
  it('matches the error the founder actually saw', () => {
    expect(isMissingDeletedAt(FOUNDER_ERROR)).toBe(true);
    expect(isMissingDeletedAt("Could not find the 'deleted_at' column of 'users' in the schema cache")).toBe(true);
    expect(isMissingDeletedAt('42703')).toBe(false); // a bare code names no column
  });

  it('does NOT match a missing users table — that is a different failure', () => {
    // Retrying a missing TABLE without the filter would fail again while the log claimed a
    // column problem. Both halves of the check must match.
    expect(isMissingDeletedAt("Could not find the table 'public.users' in the schema cache")).toBe(false);
  });

  it('does not match unrelated failures', () => {
    expect(isMissingDeletedAt('canceling statement due to statement timeout')).toBe(false);
    expect(isMissingDeletedAt('')).toBe(false);
    expect(isMissingDeletedAt(null)).toBe(false);
  });
});

describe('the tolerant read', () => {
  it('retries without the filter and returns the rows — no 500', async () => {
    const rows = [{ id: 'u1' }, { id: 'u2' }];
    const run = vi.fn(async ({ hasDeletedAt }: { hasDeletedAt: boolean }) =>
      hasDeletedAt
        ? { data: null, error: { message: FOUNDER_ERROR } }
        : { data: rows, error: null, count: 2 },
    );

    const result = await readUsersTolerant(run);

    expect(result.error).toBeNull();
    expect(result.data).toEqual(rows);
    expect(result.count).toBe(2);
    expect(result.degraded).toBe(true); // ② stated, not hidden
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[0]?.[0]).toEqual({ hasDeletedAt: true });
    expect(run.mock.calls[1]?.[0]).toEqual({ hasDeletedAt: false });
  });

  it('does not retry, and does not claim degradation, on a healthy read', async () => {
    const run = vi.fn(async () => ({ data: [{ id: 'u1' }], error: null, count: 1 }));
    const result = await readUsersTolerant(run);
    expect(result.degraded).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('passes an unrelated failure straight through — it makes ONE failure survivable, not all', async () => {
    const run = vi.fn(async () => ({ data: null, error: { message: 'connection refused' } }));
    const result = await readUsersTolerant(run);
    expect(result.error?.message).toBe('connection refused');
    expect(result.degraded).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('reports the fallback\'s own error rather than pretending the retry worked', async () => {
    const run = vi.fn(async ({ hasDeletedAt }: { hasDeletedAt: boolean }) =>
      hasDeletedAt
        ? { data: null, error: { message: FOUNDER_ERROR } }
        : { data: null, error: { message: 'statement timeout' } },
    );
    const result = await readUsersTolerant(run);
    expect(result.error?.message).toBe('statement timeout');
    expect(result.data).toBeNull();
  });
});

describe('the migration is named by a real file', () => {
  it('is a plain NNNN_name.sql, not a placeholder', () => {
    // The string this replaced was `(users.deleted_at — added out of band, no migration in
    // repo)`, and it was rendered to the founder in the slot that says "apply migration X".
    expect(USERS_DELETED_AT_MIGRATION).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
    expect(USERS_DELETED_AT_MIGRATION).toBe('0101_users_deleted_at.sql');
    expect(USERS_DELETED_AT_MIGRATION).not.toMatch(/out of band|no migration|\(|TODO|placeholder/i);
  });
});
