// AKT 2 · PHASE 5 · U5.2 gate — "code tolerant to the table's absence", both states.
//
// Migration 0103 is authored, not applied. Until the founder applies it,
// `ops_app_checks` does not exist. These tests drive the store against BOTH
// database states and assert the property this phase turns on: an unavailable
// store answers "we could not look", never "there is nothing" and never a green.

import { describe, it, expect } from 'vitest';
import {
  CHECK_RETENTION_DAYS,
  entryChecksInWindow,
  lastMeasuredAtBySubject,
  newestChecksForAllApps,
  opsChecksTableAvailable,
  pruneOldChecks,
  recentChecksForApp,
  recentPlatformChecks,
  recordChecks,
  subjectCacheKey,
} from './ops-checks-store';

type QueryResult = { data?: unknown[] | null; error?: { code?: string; message?: string } | null };

/**
 * Minimal Supabase double, same shape as ops-apps-store.test.ts: every chained
 * builder method returns the builder, awaiting it yields the queued result.
 */
function fakeSb(results: QueryResult[]) {
  const calls: string[] = [];
  let i = 0;
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'delete', 'eq', 'is', 'not', 'gte', 'lt', 'order', 'limit']) {
    builder[m] = (...args: unknown[]) => {
      calls.push(`${m}(${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(',')})`);
      return builder;
    };
  }
  (builder as { then: unknown }).then = (resolve: (v: QueryResult) => unknown) =>
    Promise.resolve(results[Math.min(i++, results.length - 1)] ?? { data: [], error: null }).then(resolve);
  return {
    sb: { from: (t: string) => (calls.push(`from(${t})`), builder) } as never,
    calls,
  };
}

const ABSENT = { data: null, error: { code: '42P01', message: 'relation "ops_app_checks" does not exist' } };
const ABSENT_PGRST = { data: null, error: { code: 'PGRST205', message: 'Could not find the table in the schema cache' } };
const RLS = { data: null, error: { code: '42501', message: 'permission denied for table ops_app_checks' } };

const ROW = {
  app_id: 'a1',
  subject_key: 'entry',
  outcome: 'ok',
  http_status: 200,
  latency_ms: 87,
  days_remaining: null,
  detail: null,
  measured_at: '2026-08-14T12:00:00.000Z',
};

describe('pre-migration (0103 not applied)', () => {
  it('detects the table as absent from either absence signature', async () => {
    for (const absent of [ABSENT, ABSENT_PGRST]) {
      const { sb } = fakeSb([absent]);
      expect(await opsChecksTableAvailable(sb)).toBe(false);
    }
  });

  it('does NOT mistake an RLS/permission error for "not migrated"', async () => {
    const { sb } = fakeSb([RLS]);
    expect(await opsChecksTableAvailable(sb)).toBe(true);
  });

  it('every read answers available:false — the surfaces render UNKNOWN, not "no checks"', async () => {
    for (const read of [
      () => recentChecksForApp('a1', {}, fakeSb([ABSENT]).sb),
      () => entryChecksInWindow('a1', 1000, {}, fakeSb([ABSENT]).sb),
      () => recentPlatformChecks({}, fakeSb([ABSENT]).sb),
      () => newestChecksForAllApps({}, fakeSb([ABSENT]).sb),
    ]) {
      const r = await read();
      expect(r.available).toBe(false);
      expect(r.rows).toEqual([]);
    }
  });

  it('the write REFUSES rather than throwing — and false is the runner’s stop signal', async () => {
    const { sb } = fakeSb([ABSENT]);
    expect(
      await recordChecks(
        [{ appId: 'a1', subjectKey: 'entry', outcome: 'ok', measuredAt: '2026-08-14T12:00:00.000Z' }],
        sb,
      ),
    ).toBe(false);
  });

  it('the prune answers null — never 0, which would read as "nothing to prune"', async () => {
    const { sb } = fakeSb([ABSENT]);
    expect(await pruneOldChecks({}, sb)).toBeNull();
  });

  it('the due-map answers available:false with an empty map', async () => {
    const { sb } = fakeSb([ABSENT]);
    const r = await lastMeasuredAtBySubject({}, sb);
    expect(r.available).toBe(false);
    expect(r.last.size).toBe(0);
  });
});

describe('post-migration (0103 applied)', () => {
  it('an empty result is available:true with no rows — "we looked, nothing yet"', async () => {
    const { sb } = fakeSb([{ data: [], error: null }]);
    const r = await recentChecksForApp('a1', {}, sb);
    expect(r.available).toBe(true);
    expect(r.rows).toEqual([]);
  });

  it('a failed read on an existing table is available:false, not an empty list', async () => {
    // The distinction the whole phase rests on: "the query broke" is not "the app
    // has no checks", and it must not derive to a confident anything.
    const { sb } = fakeSb([{ data: [], error: null }, { data: null, error: { code: '57014', message: 'canceling statement' } }]);
    const r = await recentChecksForApp('a1', {}, sb);
    expect(r.available).toBe(false);
    expect(r.rows).toEqual([]);
  });

  it('maps a row without inventing values', async () => {
    const { sb } = fakeSb([{ data: [ROW], error: null }, { data: [ROW], error: null }]);
    const r = await recentChecksForApp('a1', {}, sb);
    expect(r.rows[0]).toEqual({
      appId: 'a1',
      subjectKey: 'entry',
      outcome: 'ok',
      httpStatus: 200,
      latencyMs: 87,
      daysRemaining: null,
      detail: null,
      measuredAt: '2026-08-14T12:00:00.000Z',
    });
  });

  it('a null http status stays null — never coerced to 0, which would read as a status', async () => {
    const noResponse = { ...ROW, http_status: null, latency_ms: null, outcome: 'unknown', detail: 'timeout' };
    const { sb } = fakeSb([{ data: [noResponse], error: null }, { data: [noResponse], error: null }]);
    const r = await recentChecksForApp('a1', {}, sb);
    expect(r.rows[0]?.httpStatus).toBeNull();
    expect(r.rows[0]?.latencyMs).toBeNull();
    expect(r.rows[0]?.outcome).toBe('unknown');
  });

  it('truncates detail rather than trusting the caller', async () => {
    const { sb, calls } = fakeSb([{ data: [], error: null }, { data: [], error: null }]);
    await recordChecks(
      [{ appId: 'a1', subjectKey: 'entry', outcome: 'fail', detail: 'x'.repeat(5_000), measuredAt: '2026-08-14T12:00:00.000Z' }],
      sb,
    );
    const insert = calls.find((c) => c.startsWith('insert('));
    expect(insert).toBeDefined();
    const detail = JSON.parse(insert!.slice('insert('.length, -1))[0].detail as string;
    expect(detail.length).toBe(200);
  });

  it('writes the whole tick in ONE insert, so no subject gets a partial batch', async () => {
    const { sb, calls } = fakeSb([{ data: [], error: null }, { data: [], error: null }]);
    await recordChecks(
      [
        { appId: 'a1', subjectKey: 'entry', outcome: 'ok', measuredAt: '2026-08-14T12:00:00.000Z' },
        { appId: 'a2', subjectKey: 'entry', outcome: 'ok', measuredAt: '2026-08-14T12:00:00.000Z' },
        { appId: null, subjectKey: 'web', outcome: 'ok', measuredAt: '2026-08-14T12:00:00.000Z' },
      ],
      sb,
    );
    expect(calls.filter((c) => c.startsWith('insert(')).length).toBe(1);
  });

  it('an empty batch is a no-op success and touches no table', async () => {
    const { sb, calls } = fakeSb([{ data: [], error: null }]);
    expect(await recordChecks([], sb)).toBe(true);
    expect(calls).toEqual([]);
  });

  it('the due-map keeps the NEWEST row per subject and keys apps apart from the platform', async () => {
    const { sb } = fakeSb([
      { data: [], error: null },
      {
        data: [
          { app_id: 'a1', subject_key: 'entry', measured_at: '2026-08-14T12:00:00.000Z' },
          { app_id: 'a1', subject_key: 'entry', measured_at: '2026-08-14T11:55:00.000Z' },
          { app_id: null, subject_key: 'entry', measured_at: '2026-08-14T11:00:00.000Z' },
        ],
        error: null,
      },
    ]);
    const r = await lastMeasuredAtBySubject({}, sb);
    expect(r.available).toBe(true);
    expect(r.last.get(subjectCacheKey('a1', 'entry'))).toBe('2026-08-14T12:00:00.000Z');
    expect(r.last.get(subjectCacheKey(null, 'entry'))).toBe('2026-08-14T11:00:00.000Z');
  });

  it('the fleet read reports truncation instead of silently showing a shorter fleet', async () => {
    const many = Array.from({ length: 3 }, () => ROW);
    const { sb } = fakeSb([{ data: [], error: null }, { data: many, error: null }]);
    const r = await newestChecksForAllApps({ limit: 3 }, sb);
    expect(r.truncated).toBe(true);
  });

  it('the prune cutoff is the retention window back from now', async () => {
    const now = Date.parse('2026-08-14T12:00:00.000Z');
    const { sb } = fakeSb([{ data: [], error: null }, { data: [], error: null }]);
    const r = await pruneOldChecks({ now }, sb);
    expect(r?.cutoff).toBe(new Date(now - CHECK_RETENTION_DAYS * 24 * 60 * 60_000).toISOString());
  });

  it('retention is eight days, so a seven-day question has seven full days', () => {
    expect(CHECK_RETENTION_DAYS).toBe(8);
  });
});
