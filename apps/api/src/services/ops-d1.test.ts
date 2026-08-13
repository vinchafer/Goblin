/**
 * AKT 2 · PHASE 4 · U4.1 + U4.2 — the per-app database.
 *
 * What is under test here is not "does SQLite work". It is the four properties
 * this phase actually rests on:
 *
 *   1. A database is created in the jurisdiction the privacy page claims, and
 *      provisioning REFUSES rather than creating one it cannot describe.
 *   2. Every statement that touches a visitor's data is PARAMETERISED — the
 *      content never becomes SQL and never becomes a log line.
 *   3. The cap counter is monotonic: deleting the submissions does not hand the
 *      app a second monthly allowance.
 *   4. Teardown reports `gone` only after re-reading, and `null` (could not check)
 *      is never `true`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const createD1Database = vi.fn();
const deleteD1Database = vi.fn();
const getD1Database = vi.fn();
const queryD1 = vi.fn();

vi.mock('./cf-deploy', async () => ({
  ...(await vi.importActual<typeof import('./cf-deploy')>('./cf-deploy')),
  createD1Database: (...a: unknown[]) => createD1Database(...a),
  deleteD1Database: (...a: unknown[]) => deleteD1Database(...a),
  getD1Database: (...a: unknown[]) => getD1Database(...a),
  queryD1: (...a: unknown[]) => queryD1(...a),
}));

const mod = await import('./ops-d1');
const adapter = await vi.importActual<typeof import('./cf-deploy')>('./cf-deploy');

const APP_ID = '11111111-2222-3333-4444-555555555555';
const DB_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const ok = <T>(value: T) => ({ ok: true as const, value });
const err = (code: string, message = 'nope') => ({ ok: false as const, error: { code, message } });
const rows = (r: Array<Record<string, unknown>> = []) => ok({ rows: r, rowsRead: r.length, rowsWritten: 0, durationMs: 1 });

beforeEach(() => {
  vi.clearAllMocks();
  queryD1.mockResolvedValue(rows());
  createD1Database.mockResolvedValue(ok({ id: DB_ID, name: `goblin-app-${APP_ID}`, jurisdiction: 'eu' }));
});

// ── jurisdiction ────────────────────────────────────────────────────────────

describe('d1Jurisdiction — one variable governs R2 and D1', () => {
  beforeEach(() => {
    delete process.env.CF_R2_JURISDICTION;
  });

  it('reads eu from CF_R2_JURISDICTION, so the privacy claim covers both stores', () => {
    process.env.CF_R2_JURISDICTION = 'eu';
    expect(adapter.d1Jurisdiction()).toEqual({ ok: true, jurisdiction: 'eu' });
  });

  it('unset is the default namespace — a supported configuration, not an error', () => {
    expect(adapter.d1Jurisdiction()).toEqual({ ok: true, jurisdiction: null });
  });

  it('a quoted paste still reads as eu (the same hardening R2 needed)', () => {
    process.env.CF_R2_JURISDICTION = '"eu"';
    expect(adapter.d1Jurisdiction()).toEqual({ ok: true, jurisdiction: 'eu' });
  });

  it('fedramp-high is REFUSED rather than silently downgraded — D1 has no such value', () => {
    process.env.CF_R2_JURISDICTION = 'fedramp-high';
    expect(adapter.d1Jurisdiction()).toEqual({ ok: false, raw: 'fedramp-high', reason: 'unsupported_by_d1' });
  });

  it('an unrecognised value is refused, never treated as "default namespace"', () => {
    process.env.CF_R2_JURISDICTION = 'europa';
    expect(adapter.d1Jurisdiction()).toEqual({ ok: false, raw: 'europa', reason: 'unrecognised' });
  });
});

describe('database names carry the app id, so the orphan sweep can ask', () => {
  it('round-trips', () => {
    const name = adapter.d1AppDatabaseName(APP_ID);
    expect(name).toBe(`goblin-app-${APP_ID}`);
    expect(adapter.isAppDatabaseName(name)).toBe(true);
    expect(adapter.appIdFromDatabaseName(name)).toBe(APP_ID);
  });

  it('a database that is not ours is not claimed as ours', () => {
    expect(adapter.isAppDatabaseName('someones-analytics')).toBe(false);
    expect(adapter.appIdFromDatabaseName('someones-analytics')).toBeNull();
  });
});

// ── provisioning ────────────────────────────────────────────────────────────

describe('provisionAppDatabase', () => {
  it('creates the database, applies the schema and records what Cloudflare reported', async () => {
    const res = await mod.provisionAppDatabase(APP_ID);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.databaseId).toBe(DB_ID);
    expect(res.jurisdiction).toBe('eu');

    const statements = queryD1.mock.calls.map((c) => String(c[1]));
    expect(statements.some((s) => /create table if not exists submissions/.test(s))).toBe(true);
    expect(statements.some((s) => /create table if not exists usage_months/.test(s))).toBe(true);
    expect(statements.some((s) => /create table if not exists meta/.test(s))).toBe(true);
    // The recorded jurisdiction is the REPORTED one, written as a parameter.
    const metaWrite = queryD1.mock.calls.find(
      (c) => /insert into meta/.test(String(c[1])) && (c[2] as unknown[])?.[0] === 'jurisdiction',
    );
    expect(metaWrite?.[2]).toEqual(['jurisdiction', 'eu']);
  });

  it('refuses at the free-plan ceiling with a sentence a human can act on', async () => {
    const res = await mod.provisionAppDatabase(APP_ID, {
      countExisting: async () => mod.D1_FREE_PLAN_DATABASE_LIMIT,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('limit_reached');
    expect(res.message).toMatch(/Formular-Apps/);
    expect(createD1Database).not.toHaveBeenCalled();
  });

  it('a count that cannot be taken does NOT block a publish — Cloudflare still enforces the real limit', async () => {
    const res = await mod.provisionAppDatabase(APP_ID, { countExisting: async () => null });
    expect(res.ok).toBe(true);
    expect(createD1Database).toHaveBeenCalled();
  });

  it('a jurisdiction refusal from the adapter surfaces as a data-residency message, not a generic failure', async () => {
    createD1Database.mockResolvedValue(
      err('not_configured', 'CF_R2_JURISDICTION=fedramp-high has no D1 equivalent — refusing to create an app database outside the jurisdiction the privacy page claims'),
    );
    const res = await mod.provisionAppDatabase(APP_ID);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('jurisdiction_refused');
    expect(res.message).toMatch(/Datenschutzseite/);
  });

  it('a schema failure is a failed provision — never a database with no submissions table', async () => {
    queryD1.mockResolvedValueOnce(rows()).mockResolvedValueOnce(err('upstream'));
    const res = await mod.provisionAppDatabase(APP_ID);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('schema_failed');
    expect(res.message).toMatch(/NICHT veröffentlicht/);
  });
});

// ── the content rules ───────────────────────────────────────────────────────

describe('submission content never becomes SQL and never becomes a log line', () => {
  it('every field value travels as a PARAMETER, not as interpolated sql', async () => {
    const nasty = { name: "Robert'); drop table submissions;--", note: 'ünïcödé & <script>' };
    await mod.insertSubmission(DB_ID, { formId: 'kontakt', fields: nasty });

    const insert = queryD1.mock.calls.find((c) => /insert into submissions/.test(String(c[1])));
    expect(insert).toBeDefined();
    const sql = String(insert?.[1]);
    const params = insert?.[2] as unknown[];

    // The SQL is a constant with placeholders. Neither value appears in it.
    expect(sql).not.toContain('drop table');
    expect(sql).not.toContain('Robert');
    expect(sql).not.toContain('script');
    // Seven placeholders for seven values; `read_at` is the literal null, because
    // "not read yet" is not data anybody supplied.
    expect(sql.match(/\?/g)?.length).toBe(7);
    expect(params).toHaveLength(7);
    // The payload rides in params, JSON-encoded, exactly once.
    expect(params.some((p) => typeof p === 'string' && p.includes('drop table'))).toBe(true);
  });

  it('a failed insert reports counts and a code — never the payload', async () => {
    queryD1.mockResolvedValue(err('upstream', 'd1:query: the statement did not succeed'));
    const res = await mod.insertSubmission(DB_ID, { formId: 'kontakt', fields: { email: 'secret@example.com' } });
    expect(res.ok).toBe(false);
    expect(JSON.stringify(res)).not.toContain('secret@example.com');
  });

  it('a row whose payload cannot be parsed is shown EMPTY, never dropped from the list', async () => {
    queryD1
      .mockResolvedValueOnce(rows([{ id: 's1', form_id: 'kontakt', created_at: 'x', payload: 'not json', field_count: 2, bytes: 8, read_at: null, shape_version: 1 }]))
      .mockResolvedValueOnce(rows([{ n: 1 }]));
    const page = await mod.listSubmissions(DB_ID);
    expect(page?.submissions).toHaveLength(1);
    expect(page?.submissions[0]?.fields).toEqual({});
    expect(page?.total).toBe(1);
  });
});

// ── the cap counter ─────────────────────────────────────────────────────────

describe('the monthly counter is monotonic', () => {
  it('counts an accepted submission by upsert, so a month with no row starts at 1', async () => {
    await mod.insertSubmission(DB_ID, { formId: 'f', fields: { a: 'b' }, now: Date.UTC(2026, 7, 13) });
    const bump = queryD1.mock.calls.find((c) => /insert into usage_months/.test(String(c[1])));
    expect(String(bump?.[1])).toMatch(/accepted = accepted \+ 1/);
    expect(bump?.[2]).toEqual(['2026-08']);
  });

  it('deleting every submission does NOT clear usage_months — the allowance does not reset', async () => {
    queryD1.mockResolvedValue(rows([{ n: 7 }]));
    const res = await mod.deleteAllSubmissions(DB_ID);
    expect(res.ok).toBe(true);
    expect(res.deleted).toBe(7);
    const touched = queryD1.mock.calls.map((c) => String(c[1]));
    expect(touched.some((s) => /delete from submissions/.test(s))).toBe(true);
    expect(touched.some((s) => /usage_months/.test(s))).toBe(false);
  });

  it('a counter that cannot be read answers null, never 0', async () => {
    queryD1.mockResolvedValue(err('upstream'));
    expect(await mod.acceptedThisMonth(DB_ID, '2026-08')).toBeNull();
  });

  it('a month with no row is genuinely 0', async () => {
    queryD1.mockResolvedValue(rows([]));
    expect(await mod.acceptedThisMonth(DB_ID, '2026-08')).toBe(0);
  });

  it('usageMonth is UTC — the edge has no local', () => {
    expect(mod.usageMonth(Date.UTC(2026, 0, 1, 0, 30))).toBe('2026-01');
    expect(mod.usageMonth(Date.UTC(2025, 11, 31, 23, 30))).toBe('2025-12');
  });
});

// ── notification opt-out ────────────────────────────────────────────────────

describe('notification opt-out lives in the app’s own database', () => {
  it('defaults to on', async () => {
    queryD1.mockResolvedValue(rows([]));
    expect(await mod.notificationsEnabled(DB_ID)).toBe(true);
  });

  it('a read that FAILS still answers on — an unwanted mail beats an unseen submission', async () => {
    queryD1.mockResolvedValue(err('upstream'));
    expect(await mod.notificationsEnabled(DB_ID)).toBe(true);
  });

  it('off is off', async () => {
    queryD1.mockResolvedValue(rows([{ v: 'off' }]));
    expect(await mod.notificationsEnabled(DB_ID)).toBe(false);
  });
});

// ── teardown (X1's rule) ────────────────────────────────────────────────────

describe('teardownAppDatabase proves the database is gone', () => {
  it('gone only after a re-read says it is absent', async () => {
    deleteD1Database.mockResolvedValue(ok({ deleted: true }));
    getD1Database.mockResolvedValue(ok(null));
    expect(await mod.teardownAppDatabase(DB_ID)).toEqual({ attempted: true, gone: true });
  });

  it('a delete that "succeeded" but left the database standing is NOT gone', async () => {
    deleteD1Database.mockResolvedValue(ok({ deleted: true }));
    getD1Database.mockResolvedValue(ok({ id: DB_ID, name: `goblin-app-${APP_ID}`, jurisdiction: 'eu' }));
    const res = await mod.teardownAppDatabase(DB_ID);
    expect(res.gone).toBe(false);
  });

  it('a verification that could not run is null — and null is not true', async () => {
    deleteD1Database.mockResolvedValue(ok({ deleted: true }));
    getD1Database.mockResolvedValue(err('timeout'));
    const res = await mod.teardownAppDatabase(DB_ID);
    expect(res.gone).toBeNull();
    expect(res.gone).not.toBe(true);
  });

  it('an app that never had a database is not attempted, and that is not a failure', async () => {
    expect(await mod.teardownAppDatabase(null)).toEqual({ attempted: false, gone: null });
    expect(deleteD1Database).not.toHaveBeenCalled();
  });
});
