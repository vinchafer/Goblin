// AKT 2 · PHASE 1 · U1.4 gate — "code tolerant to the table's absence".
//
// Migration 0099 is authored, not applied. Until the founder applies it, `ops_apps`
// does not exist. These tests drive the reader against BOTH database states and
// assert it never throws and never mistakes one for the other.

import { describe, it, expect, vi } from 'vitest';
import { listUserOpsApps, findOpsAppByName, opsAppsTableAvailable } from './ops-apps-store';

type QueryResult = { data?: unknown[] | null; error?: { code?: string; message?: string } | null };

/**
 * Minimal Supabase double: every chained builder method returns the builder, and
 * awaiting it yields the queued result. Enough to exercise the exact chains the
 * store uses, without a database.
 */
function fakeSb(results: QueryResult[]) {
  const calls: string[] = [];
  let i = 0;
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'order', 'limit']) {
    builder[m] = (...args: unknown[]) => {
      calls.push(`${m}(${args.map(String).join(',')})`);
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

const ROW = {
  app_id: 'a1',
  user_id: 'u1',
  project_id: 'p1',
  app_name: 'meine-app',
  status: 'active',
  caps_profile: 'free-static',
  r2_prefix: 'apps/a1/',
  route_key: 'route:meine-app',
  worker_script_name: null,
  d1_database_id: null,
  last_published_at: '2026-07-28T00:00:00.000Z',
  created_at: '2026-07-28T00:00:00.000Z',
};

const ABSENT = { data: null, error: { code: '42P01', message: 'relation "ops_apps" does not exist' } };
const ABSENT_PGRST = { data: null, error: { code: 'PGRST205', message: "Could not find the table in the schema cache" } };

describe('pre-migration (0099 not applied)', () => {
  it('detects the table as absent from either absence signature', async () => {
    for (const absent of [ABSENT, ABSENT_PGRST]) {
      const { sb } = fakeSb([absent]);
      expect(await opsAppsTableAvailable(sb)).toBe(false);
    }
  });

  it('lists as empty instead of throwing', async () => {
    const { sb } = fakeSb([ABSENT]);
    await expect(listUserOpsApps('u1', sb)).resolves.toEqual([]);
  });

  it('resolves a name lookup to null instead of throwing', async () => {
    const { sb } = fakeSb([ABSENT]);
    await expect(findOpsAppByName('meine-app', sb)).resolves.toBeNull();
  });

  it('does not run the real query once the table is known absent', async () => {
    const { sb, calls } = fakeSb([ABSENT]);
    await listUserOpsApps('u1', sb);
    expect(calls.filter((c) => c.startsWith('from('))).toHaveLength(1); // the probe only
  });
});

describe('post-migration (0099 applied)', () => {
  it('maps a row into the typed shape', async () => {
    const { sb } = fakeSb([{ data: [ROW], error: null }, { data: [ROW], error: null }]);
    const apps = await listUserOpsApps('u1', sb);
    expect(apps).toHaveLength(1);
    expect(apps[0]).toEqual({
      appId: 'a1',
      userId: 'u1',
      projectId: 'p1',
      appName: 'meine-app',
      status: 'active',
      capsProfile: 'free-static',
      r2Prefix: 'apps/a1/',
      routeKey: 'route:meine-app',
      workerScriptName: null,
      d1DatabaseId: null,
      lastPublishedAt: '2026-07-28T00:00:00.000Z',
      createdAt: '2026-07-28T00:00:00.000Z',
    });
  });

  it('excludes deleted rows and scopes to the user', async () => {
    const { sb, calls } = fakeSb([{ data: [], error: null }, { data: [], error: null }]);
    await listUserOpsApps('u1', sb);
    expect(calls).toContain('eq(user_id,u1)');
    expect(calls).toContain('neq(status,deleted)');
  });

  it('lower-cases the name on lookup (hostnames are case-insensitive)', async () => {
    const { sb, calls } = fakeSb([{ data: [], error: null }, { data: [ROW], error: null }]);
    const app = await findOpsAppByName('  Meine-App ', sb);
    expect(calls).toContain('eq(app_name,meine-app)');
    expect(app?.appName).toBe('meine-app');
  });

  it('returns [] on a real query error without throwing', async () => {
    const { sb } = fakeSb([
      { data: [], error: null },
      { data: null, error: { code: '57014', message: 'statement timeout' } },
    ]);
    await expect(listUserOpsApps('u1', sb)).resolves.toEqual([]);
  });
});

describe('an absence signature is not confused with a real failure', () => {
  it('treats a permission/RLS error as "the table exists"', async () => {
    const { sb } = fakeSb([{ data: null, error: { code: '42501', message: 'permission denied for table ops_apps' } }]);
    expect(await opsAppsTableAvailable(sb)).toBe(true);
  });

  it('re-probes rather than caching absence, so applying the migration takes effect without a restart', async () => {
    const probe = vi.fn();
    let applied = false;
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'order', 'limit']) builder[m] = () => builder;
    (builder as { then: unknown }).then = (resolve: (v: QueryResult) => unknown) => {
      probe();
      return Promise.resolve(applied ? { data: [ROW], error: null } : ABSENT).then(resolve);
    };
    const sb = { from: () => builder } as never;

    expect(await opsAppsTableAvailable(sb)).toBe(false);
    applied = true; // the founder runs 0099 — no redeploy
    expect(await opsAppsTableAvailable(sb)).toBe(true);
    expect(probe).toHaveBeenCalledTimes(2);
  });
});
