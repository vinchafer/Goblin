// ACT 2 · PHASE 1 · U1.3 — the ops health probe.
//
// Two things are under test and they matter in this order:
//   1. INVISIBILITY — /api/ops/health does not exist for anyone the allowlist has
//      not admitted, read-only though it is.
//   2. NO SECRET MATERIAL — the response reports env vars by NAME with a boolean,
//      and no response body on any path (ok, degraded, down, upstream-echoed-the-
//      token) may contain a secret value.
//
// Cloudflare is mocked. This proves the probe's shape and its silence, not that
// the real substrate answers — that is U1.5.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const getUser = vi.fn();
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({ auth: { getUser: (...a: unknown[]) => getUser(...a) } }),
}));

const checkR2 = vi.fn();
const checkKvNamespace = vi.fn();
const listWorkers = vi.fn();

vi.mock('../services/cf-deploy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/cf-deploy')>();
  return {
    ...actual,
    checkR2: () => checkR2(),
    checkKvNamespace: () => checkKvNamespace(),
    listWorkers: () => listWorkers(),
  };
});

const { ops } = await import('./ops');

const BETA = 'vinc.hafner3@gmail.com';
const COHORT = 'real.user@example.com';
const TOKEN_VALUE = 'cf-token-SUPERSECRET-000';

const CF_ENV = {
  CF_ACCOUNT_ID: 'acct-1234567890',
  CF_API_TOKEN: TOKEN_VALUE,
  CF_R2_ACCESS_KEY_ID: 'r2-key-SUPERSECRET-111',
  CF_R2_SECRET_ACCESS_KEY: 'r2-secret-SUPERSECRET-222',
  CF_R2_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
  CF_R2_BUCKET: 'goblin-apps',
  CF_KV_NAMESPACE_ID: 'kv-namespace-1234',
  OPS_APPS_DOMAIN: 'justgoblin.app',
};

/** The probe's response shape, as a test reads it. */
interface HealthBody {
  status: string;
  hostingEnabled: boolean;
  appsDomain: string;
  tookMs: number;
  checks: Record<string, Record<string, never>>;
}

function health(headers: Record<string, string> = {}) {
  return ops.request('/health', { headers });
}

/** Read the body as HealthBody, and read one check without index-signature noise. */
async function healthBody(headers: Record<string, string>): Promise<HealthBody> {
  return (await (await health(headers)).json()) as HealthBody;
}
function check(body: HealthBody, name: string): Record<string, never> {
  const c = body.checks[name];
  if (!c) throw new Error(`health report has no "${name}" check`);
  return c;
}

function allGreen() {
  checkR2.mockResolvedValue({ ok: true, value: { bucket: 'goblin-apps', latencyMs: 12 } });
  checkKvNamespace.mockResolvedValue({ ok: true, value: { title: 'goblin-routes', latencyMs: 20 } });
  listWorkers.mockResolvedValue({ ok: true, value: { count: 0, latencyMs: 18 } });
}

beforeEach(() => {
  getUser.mockReset();
  checkR2.mockReset();
  checkKvNamespace.mockReset();
  listWorkers.mockReset();
  for (const [k, v] of Object.entries(CF_ENV)) process.env[k] = v;
  process.env.OPS_HOSTING_ENABLED = 'true';
  process.env.OPS_BETA_ACCOUNTS = BETA;
  getUser.mockResolvedValue({ data: { user: { id: 'u-beta', email: BETA } }, error: null });
});

afterEach(() => {
  for (const k of Object.keys(CF_ENV)) delete process.env[k];
  delete process.env.OPS_HOSTING_ENABLED;
  delete process.env.OPS_BETA_ACCOUNTS;
});

describe('cohort invisibility — the probe is gated even though it is read-only', () => {
  it('404s with the kill switch off, and makes no Cloudflare call at all', async () => {
    process.env.OPS_HOSTING_ENABLED = 'false';
    allGreen();
    const res = await health({ Authorization: 'Bearer valid' });
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('404 Not Found');
    expect(checkR2).not.toHaveBeenCalled();
    expect(checkKvNamespace).not.toHaveBeenCalled();
    expect(listWorkers).not.toHaveBeenCalled();
  });

  it('404s for an anonymous request', async () => {
    expect((await health()).status).toBe(404);
  });

  it('404s for a live Act-1 cohort user holding a perfectly valid token', async () => {
    allGreen();
    getUser.mockResolvedValue({ data: { user: { id: 'u-cohort', email: COHORT } }, error: null });
    const res = await health({ Authorization: 'Bearer valid-cohort' });
    expect(res.status).toBe(404);
    expect(checkR2).not.toHaveBeenCalled();
  });
});

describe('cohort invisibility — the destructive self-test route', () => {
  // /selftest writes to and deletes from the real substrate. It is the one route
  // here where an unguarded reach would do more than leak the plane's existence.
  const selftest = (headers: Record<string, string> = {}) => ops.request('/selftest', { method: 'POST', headers });

  it('404s with the kill switch off', async () => {
    process.env.OPS_HOSTING_ENABLED = 'false';
    expect((await selftest({ Authorization: 'Bearer valid' })).status).toBe(404);
  });

  it('404s for an anonymous request and for a cohort user', async () => {
    expect((await selftest()).status).toBe(404);
    getUser.mockResolvedValue({ data: { user: { id: 'u-cohort', email: COHORT } }, error: null });
    expect((await selftest({ Authorization: 'Bearer valid-cohort' })).status).toBe(404);
  });

  it('is not reachable by GET', async () => {
    const res = await ops.request('/selftest', { headers: { Authorization: 'Bearer valid' } });
    expect(res.status).toBe(404);
  });
});

describe('the report — deterministic, and silent about values', () => {
  it('reports ok when all four checks pass', async () => {
    allGreen();
    const res = await health({ Authorization: 'Bearer valid' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthBody;
    expect(body.status).toBe('ok');
    expect(check(body, 'env').status).toBe('ok');
    expect(check(body, 'env').missing).toEqual([]);
    expect(check(body, 'r2').status).toBe('ok');
    expect(check(body, 'kv').status).toBe('ok');
    expect(check(body, 'workers').status).toBe('ok');
    expect(check(body, 'workers').scriptCount).toBe(0);
    expect(body.appsDomain).toBe('justgoblin.app');
    expect(body.hostingEnabled).toBe(true);
  });

  it('reports env presence by NAME with booleans only — no value, no prefix, no length', async () => {
    allGreen();
    const body = await healthBody({ Authorization: 'Bearer valid' });
    const present = check(body, 'env').present as unknown as Record<string, unknown>;
    expect(Object.keys(present).sort()).toEqual(Object.keys(CF_ENV).sort());
    expect(Object.values(present).every((v) => typeof v === 'boolean')).toBe(true);
  });

  it('contains no secret value anywhere in the body, on any path', async () => {
    // The nastiest realistic case: Cloudflare echoes our own token back in an error.
    checkR2.mockResolvedValue({ ok: false, error: { code: 'auth', message: '[redacted:CF_API_TOKEN] rejected' } });
    checkKvNamespace.mockResolvedValue({ ok: false, error: { code: 'not_found', message: 'namespace missing' } });
    listWorkers.mockResolvedValue({ ok: false, error: { code: 'auth', message: 'scope missing' } });
    const raw = await (await health({ Authorization: 'Bearer valid' })).text();
    for (const secret of [CF_ENV.CF_API_TOKEN, CF_ENV.CF_R2_ACCESS_KEY_ID, CF_ENV.CF_R2_SECRET_ACCESS_KEY]) {
      expect(raw).not.toContain(secret);
    }
  });

  it('distinguishes skip (not configured) from fail (configured but broken)', async () => {
    delete process.env.CF_KV_NAMESPACE_ID;
    checkR2.mockResolvedValue({ ok: true, value: { bucket: 'goblin-apps', latencyMs: 5 } });
    listWorkers.mockResolvedValue({ ok: false, error: { code: 'auth', message: 'scope missing' } });
    const body = await healthBody({ Authorization: 'Bearer valid' });
    expect(check(body, 'kv').status).toBe('skip');
    expect(check(body, 'kv').reason).toBe('missing_env');
    expect(check(body, 'workers').status).toBe('fail');
    expect(check(body, 'workers').code).toBe('auth');
    expect(check(body, 'env').status).toBe('fail');
    expect(check(body, 'env').missing).toEqual(['CF_KV_NAMESPACE_ID']);
    expect(body.status).toBe('degraded');
    expect(checkKvNamespace).not.toHaveBeenCalled();
  });

  it('reports down when every check fails', async () => {
    for (const k of Object.keys(CF_ENV)) delete process.env[k];
    const body = await healthBody({ Authorization: 'Bearer valid' });
    // env fails, and the three substrate checks skip for missing_env → degraded,
    // never a false "ok": a probe that cannot check anything must not read green.
    expect(body.status).not.toBe('ok');
    expect((check(body, 'env').missing as unknown as string[]).length).toBe(Object.keys(CF_ENV).length);
  });

  it('caps an upstream detail so a giant error body cannot flood the report', async () => {
    checkR2.mockResolvedValue({ ok: false, error: { code: 'upstream', message: 'x'.repeat(5000) } });
    checkKvNamespace.mockResolvedValue({ ok: true, value: { title: '', latencyMs: 1 } });
    listWorkers.mockResolvedValue({ ok: true, value: { count: 1, latencyMs: 1 } });
    const body = await healthBody({ Authorization: 'Bearer valid' });
    expect((check(body, 'r2').detail as unknown as string).length).toBeLessThanOrEqual(300);
  });
});
