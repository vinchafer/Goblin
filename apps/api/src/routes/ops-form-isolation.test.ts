/**
 * AKT 2 · PHASE 4 · U4.8 — ISOLATION EVIDENCE.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * THE CLAIM UNDER TEST: an app cannot read or write another app's submissions.
 *
 * U4.8 asks for the ATTEMPT and the REFUSAL, not the intention. So this file stands
 * up TWO apps with TWO databases and two different owners, and then tries — through
 * every surface Phase 4 opened — to get one app's data out of the other's door.
 * Every attempt has to come back with nothing, and the in-memory D1 below is what
 * makes "nothing" checkable: it records which database id every statement was sent
 * to, so the assertion is about the WIRE, not about a return value that happened to
 * be empty.
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Why this is more than a where-clause test: there is no shared table. The
 * isolation is a URL — `/d1/database/{id}/query` — and `{id}` comes from the
 * registry row of the app being addressed. The property to prove is therefore
 * narrow and total: NO REQUEST INPUT EVER REACHES THAT SLOT.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── the two apps ────────────────────────────────────────────────────────────

const APP_A = {
  appId: 'aaaa1111-1111-4111-8111-111111111111',
  userId: 'user-a',
  projectId: 'proj-a',
  appName: 'annas-laden',
  status: 'active' as const,
  capsProfile: 'free-static',
  r2Prefix: 'apps/a/',
  routeKey: 'route:annas-laden',
  workerScriptName: null,
  d1DatabaseId: 'db-anna',
  lastPublishedAt: null,
  createdAt: '2026-08-01T00:00:00Z',
};
const APP_B = {
  ...APP_A,
  appId: 'bbbb2222-2222-4222-8222-222222222222',
  userId: 'user-b',
  projectId: 'proj-b',
  appName: 'bertas-laden',
  routeKey: 'route:bertas-laden',
  d1DatabaseId: 'db-berta',
};

const ANNA = 'vinc.hafner3@gmail.com';
const BERTA = 'berta@example.com';

/** Every statement that reached "D1", with the database it was addressed to. */
const wire: Array<{ databaseId: string; sql: string; params: unknown[] }> = [];

/** The rows each database holds. Anna's message must never appear under Berta's id. */
const ROWS: Record<string, Array<Record<string, unknown>>> = {
  'db-anna': [
    { id: 'sub-anna', form_id: 'kontakt', created_at: '2026-08-14T09:00:00Z', shape_version: 1,
      payload: JSON.stringify({ nachricht: 'ANNAS-GEHEIMNIS' }), field_count: 1, bytes: 30, read_at: null },
  ],
  'db-berta': [
    { id: 'sub-berta', form_id: 'kontakt', created_at: '2026-08-14T09:00:00Z', shape_version: 1,
      payload: JSON.stringify({ nachricht: 'BERTAS-GEHEIMNIS' }), field_count: 1, bytes: 30, read_at: null },
  ],
};

const getUser = vi.fn();
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    auth: { getUser: (...a: unknown[]) => getUser(...a) },
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ single: async () => ({ data: null }) }), limit: async () => ({ data: [] }), single: async () => ({ data: null }) }),
        limit: async () => ({ data: [] }),
      }),
    }),
  }),
}));

/**
 * The seam. `queryD1` is the ONE function through which every statement in this
 * codebase reaches a user app's database, so recording its first argument records
 * the entire isolation surface.
 */
vi.mock('../services/cf-deploy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/cf-deploy')>();
  return {
    ...actual,
    opsAppsDomain: () => 'justgoblin.app',
    queryD1: async (databaseId: string, sql: string, params: unknown[] = []) => {
      wire.push({ databaseId, sql, params });
      if (/count\(\*\)/i.test(sql)) return { ok: true, value: { rows: [{ n: (ROWS[databaseId] ?? []).length }], rowsRead: 1, rowsWritten: 0, durationMs: 1 } };
      if (/from meta/i.test(sql)) return { ok: true, value: { rows: [], rowsRead: 0, rowsWritten: 0, durationMs: 1 } };
      if (/from usage_months/i.test(sql)) return { ok: true, value: { rows: [{ accepted: 1 }], rowsRead: 1, rowsWritten: 0, durationMs: 1 } };
      if (/^select .* from submissions/i.test(sql.trim())) {
        return { ok: true, value: { rows: ROWS[databaseId] ?? [], rowsRead: 1, rowsWritten: 0, durationMs: 1 } };
      }
      return { ok: true, value: { rows: [], rowsRead: 0, rowsWritten: 0, durationMs: 1 } };
    },
  };
});

const findOpsAppById = vi.fn();
const findOpsAppByName = vi.fn();
vi.mock('../services/ops-apps-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/ops-apps-store')>()),
  findOpsAppById: (...a: unknown[]) => findOpsAppById(...a),
  findOpsAppByName: (...a: unknown[]) => findOpsAppByName(...a),
  listUserOpsApps: async () => [],
}));

vi.mock('../services/ops-turnstile', () => ({
  verifyTurnstile: async () => ({ ok: true }),
  turnstileConfigured: () => true,
  turnstileSiteKey: () => '0xkey',
}));

vi.mock('../services/ops-form-notify', () => ({
  notifyOwnerOfSubmission: async () => ({ sent: false }),
  notifyOwnerOverCap: async () => ({ sent: false }),
}));

const { ops } = await import('./ops');
const { opsForms } = await import('./ops-forms');
const { __resetRateLimiterForTest } = await import('../services/ops-forms');

const byId = (id: string) => (id === APP_A.appId ? APP_A : id === APP_B.appId ? APP_B : null);
const byName = (name: string) => (name === APP_A.appName ? APP_A : name === APP_B.appName ? APP_B : null);

const asAnna = { Authorization: 'Bearer anna-token' };

beforeEach(() => {
  vi.clearAllMocks();
  wire.length = 0;
  __resetRateLimiterForTest();
  process.env.OPS_HOSTING_ENABLED = 'true';
  process.env.OPS_BETA_ACCOUNTS = `${ANNA},${BERTA}`;
  process.env.OPS_APPS_DOMAIN = 'justgoblin.app';
  delete process.env.OPS_FORMS_ENABLED;
  findOpsAppById.mockImplementation(async (id: string) => byId(id));
  findOpsAppByName.mockImplementation(async (name: string) => byName(name));
  getUser.mockResolvedValue({ data: { user: { id: 'user-a', email: ANNA } }, error: null });
});

// ── READ: can Anna reach Berta's inbox? ─────────────────────────────────────

describe('READING another app’s submissions — the attempt, and the refusal', () => {
  it('Anna reads her OWN inbox: her database, her message', async () => {
    const res = await ops.request(`/apps/${APP_A.appId}/submissions`, { headers: asAnna });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('ANNAS-GEHEIMNIS');
    expect(body).not.toContain('BERTAS-GEHEIMNIS');
    // Every statement went to Anna's database and to no other.
    expect(new Set(wire.map((w) => w.databaseId))).toEqual(new Set(['db-anna']));
  });

  it('THE ATTEMPT: Anna asks for BERTA’s app id → 404, and NOT ONE statement is sent', async () => {
    const res = await ops.request(`/apps/${APP_B.appId}/submissions`, { headers: asAnna });
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('BERTAS-GEHEIMNIS');
    // The refusal happens BEFORE the database is addressed. Berta's database was
    // not queried and then filtered — it was never touched.
    expect(wire).toEqual([]);
  });

  it('THE ATTEMPT: Anna exports BERTA’s app → 404, no CSV, no statement', async () => {
    const res = await ops.request(`/apps/${APP_B.appId}/submissions.csv`, { headers: asAnna });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).not.toContain('text/csv');
    expect(wire).toEqual([]);
  });

  it('a 404 is byte-identical whether the other app exists or not — existence is not leaked', async () => {
    const real = await ops.request(`/apps/${APP_B.appId}/submissions`, { headers: asAnna });
    const fake = await ops.request('/apps/cccc3333-3333-4333-8333-333333333333/submissions', { headers: asAnna });
    expect(real.status).toBe(fake.status);
    expect(await real.text()).toBe(await fake.text());
  });
});

// ── WRITE: can Anna's app write into Berta's database? ──────────────────────

describe('WRITING into another app’s database — the attempt, and the refusal', () => {
  const submit = (label: string, origin: string) =>
    opsForms.request(`/${label}/kontakt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ nachricht: 'EINDRINGLING', 'cf-turnstile-response': 'tok' }),
    });

  it('a submission to Anna’s form is written to Anna’s database', async () => {
    const res = await submit(APP_A.appName, `https://${APP_A.appName}.justgoblin.app`);
    expect(res.status).toBe(200);
    const inserts = wire.filter((w) => /insert into submissions/i.test(w.sql));
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.databaseId).toBe('db-anna');
  });

  it('THE ATTEMPT: Berta’s page posts to Anna’s form → refused on the origin, nothing written', async () => {
    const res = await submit(APP_A.appName, `https://${APP_B.appName}.justgoblin.app`);
    expect(res.status).toBe(403);
    expect(wire.filter((w) => /insert/i.test(w.sql))).toEqual([]);
  });

  it('THE ATTEMPT: a submission carrying a foreign database id in its BODY changes nothing', async () => {
    // There is no parameter for this. The body is data; the database is the
    // registry's answer. This asserts that on the wire, not by reading the code.
    const res = await opsForms.request(`/${APP_A.appName}/kontakt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: `https://${APP_A.appName}.justgoblin.app` },
      body: JSON.stringify({
        nachricht: 'hallo',
        databaseId: 'db-berta',
        d1DatabaseId: 'db-berta',
        appId: APP_B.appId,
        'cf-turnstile-response': 'tok',
      }),
    });
    expect(res.status).toBe(200);
    expect(new Set(wire.map((w) => w.databaseId))).toEqual(new Set(['db-anna']));
    // …and the smuggled ids were stored as what they are: fields somebody typed.
    const insert = wire.find((w) => /insert into submissions/i.test(w.sql));
    expect(String(insert?.params?.[4])).toContain('db-berta');
    expect(insert?.databaseId).toBe('db-anna');
  });

  it('THE ATTEMPT: a path-traversal-shaped app name resolves to nothing', async () => {
    findOpsAppByName.mockResolvedValue(null);
    const res = await opsForms.request('/..%2Fbertas-laden/kontakt', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://bertas-laden.justgoblin.app' },
      body: JSON.stringify({ a: 'b', 'cf-turnstile-response': 'tok' }),
    });
    expect(res.status).toBe(404);
    expect(wire).toEqual([]);
  });
});

// ── DELETE: can Anna empty Berta's inbox? ───────────────────────────────────

describe('DELETING another app’s submissions — the attempt, and the refusal', () => {
  it('THE ATTEMPT: Anna deletes one of BERTA’s messages → 404, no statement', async () => {
    const res = await ops.request(`/apps/${APP_B.appId}/submissions/sub-berta`, { method: 'DELETE', headers: asAnna });
    expect(res.status).toBe(404);
    expect(wire).toEqual([]);
  });

  it('THE ATTEMPT: Anna empties BERTA’s whole inbox → 404, no statement', async () => {
    const res = await ops.request(`/apps/${APP_B.appId}/submissions?confirm=ALLES-LOESCHEN`, {
      method: 'DELETE',
      headers: asAnna,
    });
    expect(res.status).toBe(404);
    expect(wire).toEqual([]);
  });

  it('THE ATTEMPT: Anna flips BERTA’s notification switch → 404, no statement', async () => {
    const res = await ops.request(`/apps/${APP_B.appId}/notifications`, {
      method: 'POST',
      headers: { ...asAnna, 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(res.status).toBe(404);
    expect(wire).toEqual([]);
  });

  it('Anna CAN empty her own — but only with the confirm token', async () => {
    const without = await ops.request(`/apps/${APP_A.appId}/submissions`, { method: 'DELETE', headers: asAnna });
    expect(without.status).toBe(400);
    expect(wire.filter((w) => /delete from submissions/i.test(w.sql))).toEqual([]);

    const withToken = await ops.request(`/apps/${APP_A.appId}/submissions?confirm=ALLES-LOESCHEN`, {
      method: 'DELETE',
      headers: asAnna,
    });
    expect(withToken.status).toBe(200);
    const deletes = wire.filter((w) => /delete from submissions/i.test(w.sql));
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.databaseId).toBe('db-anna');
  });
});

// ── the whole-file invariant ────────────────────────────────────────────────

describe('the invariant behind all of the above', () => {
  it('across EVERY attempt in this file, no statement was ever addressed to a database the caller does not own', async () => {
    const attempts: Array<() => unknown> = [
      () => ops.request(`/apps/${APP_B.appId}/submissions`, { headers: asAnna }),
      () => ops.request(`/apps/${APP_B.appId}/submissions.csv`, { headers: asAnna }),
      () => ops.request(`/apps/${APP_B.appId}/submissions/sub-berta`, { method: 'DELETE', headers: asAnna }),
      () => ops.request(`/apps/${APP_B.appId}/submissions?confirm=ALLES-LOESCHEN`, { method: 'DELETE', headers: asAnna }),
      () => ops.request(`/apps/${APP_B.appId}/submissions/sub-berta/read`, { method: 'POST', headers: asAnna }),
    ];
    for (const attempt of attempts) await Promise.resolve(attempt());
    expect(wire.filter((w) => w.databaseId === 'db-berta')).toEqual([]);
  });
});
