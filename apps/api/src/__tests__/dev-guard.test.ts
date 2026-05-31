import { describe, it, expect, vi, afterEach } from 'vitest';
import { wrapWithDevGuard, type GuardConfig } from '../lib/supabase-guard.js';

const TEST_ID = '00000000-0000-0000-0000-000000000001';
const TEST_EMAIL = 'vinc.hafner3@gmail.com';

// ── Supabase write-guard (cfg-driven, no env / network needed) ──────────────────

interface Recorded { verb: string; table: string; values?: unknown; filters?: unknown[] }

function makeFakeClient() {
  const calls: Recorded[] = [];
  const makeFilterBuilder = (verb: string, table: string) => {
    const fb: any = {
      _filters: [] as unknown[],
      eq(col: string, val: unknown) { this._filters.push(['eq', [col, val]]); return this; },
      match(obj: unknown) { this._filters.push(['match', [obj]]); return this; },
      then(onF: any, onR: any) {
        calls.push({ verb, table, filters: this._filters });
        return Promise.resolve({ data: [], error: null }).then(onF, onR);
      },
    };
    return fb;
  };
  const client: any = {
    from(table: string) {
      return {
        insert(values: unknown) { calls.push({ verb: 'insert', table, values }); return Promise.resolve({ data: null, error: null }); },
        upsert(values: unknown) { calls.push({ verb: 'upsert', table, values }); return Promise.resolve({ data: null, error: null }); },
        update(_values: unknown) { return makeFilterBuilder('update', table); },
        delete() { return makeFilterBuilder('delete', table); },
        select() { return Promise.resolve({ data: [], error: null }); },
      };
    },
    calls,
  };
  return client;
}

const cfg: GuardConfig = {
  isDevMode: true,
  testUserId: () => TEST_ID,
  testUserEmail: TEST_EMAIL,
};

describe('supabase dev-guard', () => {
  it('blocks INSERT for a non-test-user row', () => {
    const guarded = wrapWithDevGuard(makeFakeClient(), cfg);
    expect(() => guarded.from('projects').insert({ user_id: 'someone-else', name: 'x' }))
      .toThrow(/DEV-GUARD/);
  });

  it('allows INSERT scoped to the test user (user_id)', () => {
    const fake = makeFakeClient();
    const guarded = wrapWithDevGuard(fake, cfg);
    expect(() => guarded.from('projects').insert({ user_id: TEST_ID, name: 'x' })).not.toThrow();
    expect(fake.calls).toHaveLength(1);
  });

  it('allows INSERT scoped to the test user (email column)', () => {
    const guarded = wrapWithDevGuard(makeFakeClient(), cfg);
    expect(() => guarded.from('users').insert({ email: TEST_EMAIL })).not.toThrow();
  });

  it('blocks INSERT of an array if ANY row is not the test user', () => {
    const guarded = wrapWithDevGuard(makeFakeClient(), cfg);
    expect(() => guarded.from('projects').insert([{ user_id: TEST_ID }, { user_id: 'other' }]))
      .toThrow(/DEV-GUARD/);
  });

  it('allows INSERT on a dev-safe table regardless of owner', () => {
    const guarded = wrapWithDevGuard(makeFakeClient(), cfg);
    expect(() => guarded.from('schema_migrations').insert({ version: 42 })).not.toThrow();
  });

  it('blocks UPDATE without a test-user filter (rejects at await)', async () => {
    const guarded = wrapWithDevGuard(makeFakeClient(), cfg);
    await expect(guarded.from('projects').update({ name: 'x' }).eq('user_id', 'other'))
      .rejects.toThrow(/DEV-GUARD/);
  });

  it('allows UPDATE filtered to the test user', async () => {
    const fake = makeFakeClient();
    const guarded = wrapWithDevGuard(fake, cfg);
    await expect(guarded.from('projects').update({ name: 'x' }).eq('user_id', TEST_ID))
      .resolves.toBeDefined();
    expect(fake.calls.some((c: Recorded) => c.verb === 'update')).toBe(true);
  });

  it('blocks DELETE without a test-user filter', async () => {
    const guarded = wrapWithDevGuard(makeFakeClient(), cfg);
    await expect(guarded.from('projects').delete().eq('user_id', 'other'))
      .rejects.toThrow(/DEV-GUARD/);
  });

  it('allows DELETE filtered to the test user', async () => {
    const guarded = wrapWithDevGuard(makeFakeClient(), cfg);
    await expect(guarded.from('projects').delete().eq('user_id', TEST_ID))
      .resolves.toBeDefined();
  });

  it('passes SELECT through untouched', async () => {
    const guarded = wrapWithDevGuard(makeFakeClient(), cfg);
    await expect(guarded.from('projects').select()).resolves.toBeDefined();
  });

  it('returns the client unchanged when isDevMode is false', () => {
    const fake = makeFakeClient();
    const passthrough = wrapWithDevGuard(fake, { ...cfg, isDevMode: false });
    expect(passthrough).toBe(fake);
    expect(() => passthrough.from('projects').insert({ user_id: 'other' })).not.toThrow();
  });
});

describe('supabase dev-guard — project→owner resolution (deploy/build UPDATEs)', () => {
  it('allows UPDATE by project_id when owner resolves to test user', async () => {
    let calls = 0;
    const guarded = wrapWithDevGuard(makeFakeClient(), {
      ...cfg,
      resolveOwnerIsTestUser: async (table, col, val) => { calls++; return col === 'project_id' && val === 'P1'; },
    });
    await expect(guarded.from('build_runs').update({ status: 'done' }).eq('project_id', 'P1'))
      .resolves.toBeDefined();
    expect(calls).toBe(1);
  });

  it('allows UPDATE by id on projects when owner resolves to test user', async () => {
    const guarded = wrapWithDevGuard(makeFakeClient(), { ...cfg, resolveOwnerIsTestUser: async () => true });
    await expect(guarded.from('projects').update({ preview_url: 'https://x' }).eq('id', 'P1'))
      .resolves.toBeDefined();
  });

  it('blocks UPDATE by id when owner is NOT the test user', async () => {
    const guarded = wrapWithDevGuard(makeFakeClient(), { ...cfg, resolveOwnerIsTestUser: async () => false });
    await expect(guarded.from('projects').update({ preview_url: 'https://x' }).eq('id', 'P1'))
      .rejects.toThrow(/DEV-GUARD/);
  });

  it('fails closed (blocks) when no resolver is provided and filter is not user-scoped', async () => {
    const guarded = wrapWithDevGuard(makeFakeClient(), cfg); // cfg has no resolveOwnerIsTestUser
    await expect(guarded.from('projects').update({ preview_url: 'https://x' }).eq('id', 'P1'))
      .rejects.toThrow(/DEV-GUARD/);
  });

  it('user_id filter still short-circuits without calling the resolver', async () => {
    let calls = 0;
    const guarded = wrapWithDevGuard(makeFakeClient(), {
      ...cfg,
      resolveOwnerIsTestUser: async () => { calls++; return false; },
    });
    await expect(guarded.from('projects').update({ name: 'x' }).eq('user_id', TEST_ID))
      .resolves.toBeDefined();
    expect(calls).toBe(0);
  });
});

// ── env.ts + vercel-guard (env-driven; use resetModules for clean re-eval) ───────

async function loadFreshEnv(devMode: boolean, extra: Record<string, string | undefined> = {}) {
  vi.resetModules();
  process.env.GOBLIN_DEV_MODE = devMode ? 'true' : 'false';
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import('../lib/env.js');
}

afterEach(() => {
  delete process.env.GOBLIN_DEV_MODE;
});

describe('env.ts startup guards', () => {
  it('validateDevShield throws when dev-mode is on but no test user', async () => {
    const env = await loadFreshEnv(true, { TEST_ACCOUNT_EMAIL: undefined });
    expect(() => env.validateDevShield()).toThrow(/DEV-GUARD/);
  });

  it('validateDevShield passes when test user is set', async () => {
    const env = await loadFreshEnv(true, { TEST_ACCOUNT_EMAIL: TEST_EMAIL });
    expect(() => env.validateDevShield()).not.toThrow();
  });

  it('assertStripeKeyMode throws on a live key in dev-mode', async () => {
    const env = await loadFreshEnv(true, { TEST_ACCOUNT_EMAIL: TEST_EMAIL, STRIPE_SECRET_KEY: 'sk_live_abc' });
    expect(() => env.assertStripeKeyMode()).toThrow(/DEV-GUARD/);
  });

  it('assertStripeKeyMode allows a test key in dev-mode', async () => {
    const env = await loadFreshEnv(true, { TEST_ACCOUNT_EMAIL: TEST_EMAIL, STRIPE_SECRET_KEY: 'sk_test_abc' });
    expect(() => env.assertStripeKeyMode()).not.toThrow();
  });

  it('assertStripeKeyMode ignores a live key when shield is off (prod)', async () => {
    const env = await loadFreshEnv(false, { STRIPE_SECRET_KEY: 'sk_live_abc' });
    expect(() => env.assertStripeKeyMode()).not.toThrow();
  });
});

describe('vercel-guard', () => {
  it('blocks a non-allowed project in dev-mode', async () => {
    await loadFreshEnv(true, { TEST_ACCOUNT_EMAIL: TEST_EMAIL });
    const { guardVercelCall } = await import('../lib/vercel-guard.js');
    expect(() => guardVercelCall('other-project', 'deploy')).toThrow(/VERCEL-GUARD/);
  });

  it('allows the designated placeholder project in dev-mode', async () => {
    await loadFreshEnv(true, { TEST_ACCOUNT_EMAIL: TEST_EMAIL });
    const { guardVercelCall } = await import('../lib/vercel-guard.js');
    expect(() => guardVercelCall('project-kiy64', 'deploy')).not.toThrow();
  });

  it('allows test-prefixed projects in dev-mode', async () => {
    await loadFreshEnv(true, { TEST_ACCOUNT_EMAIL: TEST_EMAIL });
    const { guardVercelCall } = await import('../lib/vercel-guard.js');
    expect(() => guardVercelCall('test-b1-loop-123', 'deploy')).not.toThrow();
  });

  it('is a no-op when shield is off (prod)', async () => {
    await loadFreshEnv(false);
    const { guardVercelCall } = await import('../lib/vercel-guard.js');
    expect(() => guardVercelCall('any-project', 'deploy')).not.toThrow();
  });
});
