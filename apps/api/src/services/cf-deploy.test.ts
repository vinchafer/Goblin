// ACT 2 · PHASE 1 · U1.2 — the Cloudflare adapter.
//
// DETERMINISTIC UNIT TESTS. Cloudflare is mocked here; no network is touched and
// no credential exists in this process. These tests prove the adapter's OWN
// contract — typed results, no raw throws, per-call timeouts, batched deletes,
// redaction, prefix-jailed keys — and deliberately do NOT prove that Cloudflare
// accepts our requests. That is U1.5's job, against the real API, from the
// deployed code path.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── S3 mock ────────────────────────────────────────────────────────────────
const s3send = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  class Base {
    constructor(public input: Record<string, unknown>) {}
  }
  return {
    S3Client: class {
      send(cmd: unknown, opts: unknown) {
        return s3send(cmd, opts);
      }
    },
    PutObjectCommand: class extends Base {
      readonly tag = 'put';
    },
    GetObjectCommand: class extends Base {
      readonly tag = 'get';
    },
    HeadBucketCommand: class extends Base {
      readonly tag = 'head';
    },
    ListObjectsV2Command: class extends Base {
      readonly tag = 'list';
    },
    DeleteObjectsCommand: class extends Base {
      readonly tag = 'delete';
    },
  };
});

const cf = await import('./cf-deploy');

type AnyCmd = { tag: string; input: Record<string, unknown> };

const ENV = {
  CF_ACCOUNT_ID: 'acct-1234567890',
  CF_API_TOKEN: 'cf-token-SUPERSECRET-000',
  CF_R2_ACCESS_KEY_ID: 'r2-key-SUPERSECRET-111',
  CF_R2_SECRET_ACCESS_KEY: 'r2-secret-SUPERSECRET-222',
  CF_R2_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
  CF_R2_BUCKET: 'goblin-apps',
  CF_KV_NAMESPACE_ID: 'kv-namespace-1234',
  OPS_APPS_DOMAIN: 'justgoblin.app',
};

function setEnv(overrides: Partial<typeof ENV> = {}) {
  for (const [k, v] of Object.entries({ ...ENV, ...overrides })) process.env[k] = v;
}
function clearEnv() {
  for (const k of Object.keys(ENV)) delete process.env[k];
  delete process.env.CF_TIMEOUT_MS;
  delete process.env.CF_WORKER_COMPAT_DATE;
}

const fetchMock = vi.fn();

beforeEach(() => {
  clearEnv();
  setEnv();
  cf.__resetCfClientsForTest();
  s3send.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearEnv();
  cf.__resetCfClientsForTest();
});

/** A Cloudflare JSON envelope response. */
function cfOk(result: unknown) {
  return { ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify({ success: true, result }) };
}
function cfErr(status: number, message = 'nope', code = 10000) {
  return {
    ok: false,
    status,
    statusText: 'Error',
    text: async () => JSON.stringify({ success: false, errors: [{ code, message }] }),
  };
}
function cfRaw(body: string) {
  return { ok: true, status: 200, statusText: 'OK', text: async () => body };
}

// ────────────────────────────────────────────────────────────────────────────

describe('keys and content types — the single place the R2/KV layout is defined', () => {
  it('builds the app prefix and the route key', () => {
    expect(cf.appPrefix('app-1')).toBe('apps/app-1/');
    expect(cf.routeKey('meine-app')).toBe('route:meine-app');
  });

  it('derives content types from the extension, with an honest fallback', () => {
    expect(cf.contentTypeFor('index.html')).toBe('text/html; charset=utf-8');
    expect(cf.contentTypeFor('assets/app.css')).toBe('text/css; charset=utf-8');
    expect(cf.contentTypeFor('logo.svg')).toBe('image/svg+xml');
    expect(cf.contentTypeFor('data.bin')).toBe('application/octet-stream');
    expect(cf.contentTypeFor('LICENSE')).toBe('application/octet-stream');
  });
});

describe('redaction — no secret value can leave this module', () => {
  it('scrubs every secret env value out of a message', () => {
    const leaky = `boom token=${ENV.CF_API_TOKEN} key=${ENV.CF_R2_ACCESS_KEY_ID} sec=${ENV.CF_R2_SECRET_ACCESS_KEY}`;
    const clean = cf.redactSecrets(leaky);
    expect(clean).not.toContain(ENV.CF_API_TOKEN);
    expect(clean).not.toContain(ENV.CF_R2_ACCESS_KEY_ID);
    expect(clean).not.toContain(ENV.CF_R2_SECRET_ACCESS_KEY);
    expect(clean).toContain('[redacted:CF_API_TOKEN]');
  });

  it('scrubs a secret that an upstream error echoed back', async () => {
    fetchMock.mockResolvedValue(cfErr(403, `invalid token ${ENV.CF_API_TOKEN}`));
    const res = await cf.listWorkers();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('auth');
    expect(res.error.message).not.toContain(ENV.CF_API_TOKEN);
    expect(res.error.message).toContain('[redacted:CF_API_TOKEN]');
  });

  it('leaves non-secret env values (bucket, domain, account id) intact', () => {
    expect(cf.redactSecrets(`bucket=${ENV.CF_R2_BUCKET}`)).toContain(ENV.CF_R2_BUCKET);
    expect(cf.opsAppsDomain()).toBe('justgoblin.app');
  });
});

describe('env presence — names and booleans, never values', () => {
  it('reports all eight vars present', () => {
    const presence = cf.cfEnvPresence();
    expect(Object.keys(presence).sort()).toEqual([...cf.CF_ENV_VARS].sort());
    expect(Object.values(presence).every(Boolean)).toBe(true);
  });

  it('reports a missing var as false and carries no value anywhere', () => {
    delete process.env.CF_KV_NAMESPACE_ID;
    const presence = cf.cfEnvPresence();
    expect(presence.CF_KV_NAMESPACE_ID).toBe(false);
    expect(JSON.stringify(presence)).not.toContain(ENV.CF_API_TOKEN);
    expect(Object.values(presence).every((v) => typeof v === 'boolean')).toBe(true);
  });

  it('does not list CF_R2_API_TOKEN — the adapter does not use it (reserved-unused)', () => {
    expect([...cf.CF_ENV_VARS]).not.toContain('CF_R2_API_TOKEN');
  });
});

/**
 * PR #77 hardened seventeen env parsers and left this file out (it reads
 * identifiers, not comparison keys). That exemption does not survive contact with
 * a Railway dashboard: a pasted `CF_R2_BUCKET="goblin-apps"` is non-empty, so it
 * passes every presence check and every emptiness guard, and then addresses a
 * bucket that does not exist. The failure lands far from the paste, which is the
 * expensive kind.
 */
describe('pasted env values — one pair of quotes is stripped, nothing is repaired', () => {
  it('addresses the bucket the founder meant, not the quoted string', async () => {
    setEnv({ CF_R2_BUCKET: '"goblin-apps"' });
    cf.__resetCfClientsForTest();
    s3send.mockResolvedValue({ Contents: [], IsTruncated: false });

    await cf.listAppFiles('app-1');
    const cmd = s3send.mock.calls[0]![0] as AnyCmd;
    expect(cmd.input.Bucket).toBe('goblin-apps');
  });

  it('strips single quotes and surrounding whitespace from an identifier used in a URL', async () => {
    setEnv({ CF_ACCOUNT_ID: "  'acct-1234567890'  ", CF_KV_NAMESPACE_ID: '"kv-namespace-1234"' });
    fetchMock.mockResolvedValue(cfRaw('app-1'));

    await cf.getRoute('meine-app');
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('/accounts/acct-1234567890/storage/kv/namespaces/kv-namespace-1234/');
    expect(url).not.toContain('%22');
    expect(url).not.toContain('%27');
  });

  it('sends the token without its quotes, and still redacts the unquoted value', async () => {
    setEnv({ CF_API_TOKEN: `"${ENV.CF_API_TOKEN}"` });
    fetchMock.mockResolvedValue(cfOk([]));

    await cf.listWorkers();
    const init = fetchMock.mock.calls[0]![1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBe(`Bearer ${ENV.CF_API_TOKEN}`);
    expect(cf.redactSecrets(`leak ${ENV.CF_API_TOKEN}`)).not.toContain(ENV.CF_API_TOKEN);
  });

  it('a quote-only value is EMPTY — reported as unconfigured rather than sent upstream', async () => {
    setEnv({ CF_R2_BUCKET: '""' });
    cf.__resetCfClientsForTest();

    const res = await cf.listAppFiles('app-1');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('not_configured');
      expect(res.error.message).toContain('CF_R2_BUCKET');
    }
    expect(s3send).not.toHaveBeenCalled();
  });

  it('leaves an unmatched quote alone — one pair only, so a different mistake stays visible', async () => {
    setEnv({ CF_R2_BUCKET: '"goblin-apps' });
    cf.__resetCfClientsForTest();
    s3send.mockResolvedValue({ Contents: [], IsTruncated: false });

    await cf.listAppFiles('app-1');
    const cmd = s3send.mock.calls[0]![0] as AnyCmd;
    expect(cmd.input.Bucket).toBe('"goblin-apps');
  });

  it('honours a quoted CF_TIMEOUT_MS instead of silently falling back to the default', async () => {
    // Number('"250"') is NaN. Before unwrapping, a quoted override was ignored and
    // nothing said so — the worst shape a configuration bug can take.
    process.env.CF_TIMEOUT_MS = '"25"';
    fetchMock.mockImplementation(() => new Promise(() => {})); // never answers

    const res = await cf.listWorkers();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('timeout');
      expect(res.error.message).toContain('25ms');
    }
  });
});

describe('unconfigured — a typed error, never a throw', () => {
  it('names the missing vars for R2, KV and Workers', async () => {
    clearEnv();
    cf.__resetCfClientsForTest();
    const r2 = await cf.listAppFiles('app-1');
    const kv = await cf.getRoute('meine-app');
    const wk = await cf.listWorkers();
    for (const res of [r2, kv, wk]) {
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_configured');
    }
    if (!r2.ok) expect(r2.error.message).toContain('CF_R2_BUCKET');
    if (!kv.ok) expect(kv.error.message).toContain('CF_KV_NAMESPACE_ID');
    expect(s3send).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('input validation — the prefix jail', () => {
  it('refuses an app id that could escape the prefix', async () => {
    for (const bad of ['../evil', 'a/b', '', 'x'.repeat(65), 'has space']) {
      const res = await cf.listAppFiles(bad);
      expect(res.ok, `app id ${JSON.stringify(bad)} must be refused`).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('invalid_input');
    }
    expect(s3send).not.toHaveBeenCalled();
  });

  it('refuses a file path that could escape the prefix', async () => {
    for (const bad of ['../secrets.env', 'a/../../b', '/etc/passwd', 'a//b', 'back\\slash', '']) {
      const res = await cf.putAppFiles('app-1', [{ path: bad, content: 'x' }]);
      expect(res.ok, `path ${JSON.stringify(bad)} must be refused`).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('invalid_input');
    }
    expect(s3send).not.toHaveBeenCalled();
  });

  it('refuses malformed route and worker names before any request', async () => {
    for (const bad of ['-leading', 'trailing-', 'UPPER', 'has.dot', '', 'a'.repeat(64)]) {
      const res = await cf.setRoute(bad, 'app-1');
      expect(res.ok, `route name ${JSON.stringify(bad)} must be refused`).toBe(false);
    }
    for (const bad of ['-bad', 'Has Space', '']) {
      const res = await cf.deployWorker(bad, 'export default {}');
      expect(res.ok, `script name ${JSON.stringify(bad)} must be refused`).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('R2 — put / list / get', () => {
  it('writes each file under apps/{appId}/ with a derived content type', async () => {
    s3send.mockResolvedValue({});
    const res = await cf.putAppFiles('app-1', [
      { path: 'index.html', content: '<h1>Hallo</h1>' },
      { path: 'assets/app.css', content: 'body{}' },
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual({ files: 2, bytes: Buffer.byteLength('<h1>Hallo</h1>') + Buffer.byteLength('body{}') });
    const cmds = s3send.mock.calls.map((c) => c[0] as AnyCmd);
    expect(cmds.map((c) => c.input.Key)).toEqual(['apps/app-1/index.html', 'apps/app-1/assets/app.css']);
    expect(cmds[0]!.input.ContentType).toBe('text/html; charset=utf-8');
    expect(cmds.every((c) => c.input.Bucket === 'goblin-apps')).toBe(true);
  });

  it('reports a partial upload honestly instead of pretending it was atomic', async () => {
    s3send.mockResolvedValueOnce({}).mockRejectedValueOnce(Object.assign(new Error('boom'), { $metadata: { httpStatusCode: 500 } }));
    const res = await cf.putAppFiles('app-1', [
      { path: 'a.html', content: 'a' },
      { path: 'b.html', content: 'b' },
      { path: 'c.html', content: 'c' },
    ]);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.message).toContain('after 1/3 files');
  });

  it('paginates a listing and strips the prefix from each path', async () => {
    s3send
      .mockResolvedValueOnce({
        Contents: [{ Key: 'apps/app-1/index.html', Size: 12, ETag: '"abc"' }],
        IsTruncated: true,
        NextContinuationToken: 'tok',
      })
      .mockResolvedValueOnce({ Contents: [{ Key: 'apps/app-1/assets/app.css', Size: 6 }], IsTruncated: false });
    const res = await cf.listAppFiles('app-1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.map((f) => f.path)).toEqual(['index.html', 'assets/app.css']);
    expect(res.value[0]!.etag).toBe('abc');
    expect(s3send).toHaveBeenCalledTimes(2);
  });

  it('returns bytes on get, and null (not an error) when the object is absent', async () => {
    s3send.mockResolvedValueOnce({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
      ContentType: 'text/html; charset=utf-8',
    });
    const hit = await cf.getAppFile('app-1', 'index.html');
    expect(hit.ok).toBe(true);
    if (hit.ok) expect(Array.from(hit.value!.bytes)).toEqual([1, 2, 3]);

    s3send.mockRejectedValueOnce(Object.assign(new Error('no key'), { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } }));
    const miss = await cf.getAppFile('app-1', 'gone.html');
    expect(miss.ok).toBe(true);
    if (miss.ok) expect(miss.value).toBeNull();
  });
});

describe('R2 delete — BATCHED (the unbatched-destructive-op anti-pattern)', () => {
  it('chunks 2500 keys into 3 DeleteObjects requests of ≤1000', async () => {
    const keys = Array.from({ length: 2500 }, (_, i) => ({ Key: `apps/app-1/f${i}.html`, Size: 1 }));
    s3send.mockResolvedValueOnce({ Contents: keys, IsTruncated: false }).mockResolvedValue({});

    const res = await cf.deleteAppFiles('app-1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual({ deleted: 2500, batches: 3 });

    const deletes = s3send.mock.calls.map((c) => c[0] as AnyCmd).filter((c) => c.tag === 'delete');
    expect(deletes).toHaveLength(3);
    const sizes = deletes.map((d) => ((d.input.Delete as { Objects: unknown[] }).Objects).length);
    expect(sizes).toEqual([1000, 1000, 500]);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(1000);
  });

  it('is a no-op on an empty prefix', async () => {
    s3send.mockResolvedValueOnce({ Contents: [], IsTruncated: false });
    const res = await cf.deleteAppFiles('app-1');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toEqual({ deleted: 0, batches: 0 });
  });

  it('says how many batches succeeded when one fails midway', async () => {
    const keys = Array.from({ length: 1500 }, (_, i) => ({ Key: `apps/app-1/f${i}.html`, Size: 1 }));
    s3send
      .mockResolvedValueOnce({ Contents: keys, IsTruncated: false })
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { $metadata: { httpStatusCode: 500 } }));
    const res = await cf.deleteAppFiles('app-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain('after 1 batch(es)');
  });
});

describe('KV routes', () => {
  it('writes a JSON route record to route:{name} via PUT', async () => {
    fetchMock.mockResolvedValue(cfOk({}));
    const res = await cf.setRoute('meine-app', 'app-1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.appId).toBe('app-1');
    expect(res.value.status).toBe('active');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/accounts/acct-1234567890/storage/kv/namespaces/kv-namespace-1234/values/route%3Ameine-app');
    expect((init as RequestInit).method).toBe('PUT');
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
    // fetch must set the multipart boundary itself
    expect(Object.keys((init as { headers: Record<string, string> }).headers)).toEqual(['Authorization']);
  });

  it('reads a route back and returns null for a missing key', async () => {
    fetchMock.mockResolvedValueOnce(cfRaw(JSON.stringify({ name: 'meine-app', appId: 'app-1', status: 'active' })));
    const hit = await cf.getRoute('meine-app');
    expect(hit.ok).toBe(true);
    if (hit.ok) expect(hit.value).toMatchObject({ name: 'meine-app', appId: 'app-1', status: 'active' });

    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found', text: async () => '' });
    const miss = await cf.getRoute('weg');
    expect(miss.ok).toBe(true);
    if (miss.ok) expect(miss.value).toBeNull();
  });

  it('tolerates a bare-app-id value (forward/backward safety) and rejects a record with no appId', async () => {
    fetchMock.mockResolvedValueOnce(cfRaw('app-legacy'));
    const legacy = await cf.getRoute('alt');
    expect(legacy.ok).toBe(true);
    if (legacy.ok) expect(legacy.value).toMatchObject({ appId: 'app-legacy', status: 'active' });

    fetchMock.mockResolvedValueOnce(cfRaw(JSON.stringify({ name: 'x' })));
    const broken = await cf.getRoute('alt');
    expect(broken.ok).toBe(false);
  });

  it('preserves a suspended status on read (the abuse-SOP suspend flag)', async () => {
    fetchMock.mockResolvedValueOnce(cfRaw(JSON.stringify({ appId: 'app-1', status: 'suspended' })));
    const res = await cf.getRoute('meine-app');
    if (res.ok) expect(res.value!.status).toBe('suspended');
  });

  it('treats an already-absent route as a successful delete', async () => {
    fetchMock.mockResolvedValueOnce(cfOk({}));
    const first = await cf.deleteRoute('meine-app');
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.value.deleted).toBe(true);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found', text: async () => '' });
    const again = await cf.deleteRoute('meine-app');
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.value.deleted).toBe(false);
  });
});

describe('Workers', () => {
  it('uploads an ES module with a fixed compatibility date', async () => {
    fetchMock.mockResolvedValue(cfOk({ id: 'goblin-router' }));
    const res = await cf.deployWorker('goblin-router', 'export default { fetch() { return new Response("hi") } }');
    expect(res.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/accounts/acct-1234567890/workers/scripts/goblin-router');
    expect((init as RequestInit).method).toBe('PUT');
    const body = (init as RequestInit).body as FormData;
    expect(body.get('metadata')).toBeInstanceOf(Blob);
    expect(await (body.get('metadata') as Blob).text()).toBe(
      JSON.stringify({ main_module: 'worker.mjs', compatibility_date: '2025-01-01' }),
    );
    expect(body.get('worker.mjs')).toBeTruthy();
  });

  it('honors CF_WORKER_COMPAT_DATE only when it is a real date', async () => {
    fetchMock.mockResolvedValue(cfOk({}));
    process.env.CF_WORKER_COMPAT_DATE = 'gestern';
    await cf.deployWorker('w1', 'export default {}');
    const bad = (fetchMock.mock.calls[0]![1] as RequestInit).body as FormData;
    expect(await (bad.get('metadata') as Blob).text()).toContain('2025-01-01');

    fetchMock.mockClear();
    process.env.CF_WORKER_COMPAT_DATE = '2026-03-01';
    await cf.deployWorker('w1', 'export default {}');
    const good = (fetchMock.mock.calls[0]![1] as RequestInit).body as FormData;
    expect(await (good.get('metadata') as Blob).text()).toContain('2026-03-01');
  });

  it('reads a worker back and reports absence as null', async () => {
    fetchMock.mockResolvedValueOnce(cfRaw('export default {}'));
    const hit = await cf.getWorker('goblin-router');
    expect(hit.ok).toBe(true);
    if (hit.ok) expect(hit.value).toEqual({ scriptName: 'goblin-router', size: 17 });

    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found', text: async () => '' });
    const miss = await cf.getWorker('goblin-router');
    expect(miss.ok).toBe(true);
    if (miss.ok) expect(miss.value).toBeNull();
  });

  it('deletes with force=true and treats already-gone as success', async () => {
    fetchMock.mockResolvedValueOnce(cfOk({}));
    const res = await cf.deleteWorker('goblin-router');
    expect(res.ok).toBe(true);
    expect(fetchMock.mock.calls[0]![0]).toContain('?force=true');
  });

  it('counts scripts for the token-scope check', async () => {
    fetchMock.mockResolvedValueOnce(cfOk([{ id: 'a' }, { id: 'b' }]));
    const res = await cf.listWorkers();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.count).toBe(2);
  });
});

describe('error mapping — every upstream shape becomes a typed result', () => {
  it('maps status codes to codes', async () => {
    const cases: Array<[number, string]> = [
      [401, 'auth'],
      [403, 'auth'],
      [429, 'rate_limited'],
      [500, 'upstream'],
    ];
    for (const [status, code] of cases) {
      fetchMock.mockResolvedValueOnce(cfErr(status));
      const res = await cf.listWorkers();
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code, `status ${status}`).toBe(code);
    }
  });

  it('maps a success:false envelope on a 200 to upstream', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ success: false, errors: [{ code: 10001, message: 'nope' }] }),
    });
    const res = await cf.listWorkers();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('upstream');
  });

  it('maps a transport failure without throwing', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    const res = await cf.listWorkers();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('upstream');
  });

  it('caps a giant upstream error body', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Error', text: async () => 'x'.repeat(50_000) });
    const res = await cf.listWorkers();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message.length).toBeLessThan(600);
  });
});

describe('per-call timeouts — the webhook lesson', () => {
  it('gives up on a Cloudflare call that never answers', async () => {
    process.env.CF_TIMEOUT_MS = '50';
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const started = Date.now();
    const res = await cf.listWorkers();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('gives up on an R2 call that never answers', async () => {
    process.env.CF_TIMEOUT_MS = '50';
    s3send.mockImplementation(() => new Promise(() => {}));
    const res = await cf.checkR2();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('timeout');
  });

  it('passes an AbortSignal into every R2 call so the socket is cancelled too', async () => {
    s3send.mockResolvedValue({});
    await cf.checkR2();
    const opts = s3send.mock.calls[0]![1] as { abortSignal?: AbortSignal };
    expect(opts.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it('defaults to 10s and ignores a malformed CF_TIMEOUT_MS', async () => {
    process.env.CF_TIMEOUT_MS = 'bald';
    s3send.mockResolvedValue({});
    const res = await cf.checkR2();
    expect(res.ok).toBe(true); // a malformed knob must not break the call
  });
});

describe('no raw throws into routes', () => {
  it('returns a result object for every surface, whatever the client does', async () => {
    s3send.mockRejectedValue(new Error('kaputt'));
    fetchMock.mockRejectedValue(new Error('kaputt'));
    const calls = [
      cf.checkR2(),
      cf.putAppFiles('app-1', [{ path: 'a.html', content: 'a' }]),
      cf.listAppFiles('app-1'),
      cf.getAppFile('app-1', 'a.html'),
      cf.deleteAppFiles('app-1'),
      cf.checkKvNamespace(),
      cf.setRoute('meine-app', 'app-1'),
      cf.getRoute('meine-app'),
      cf.deleteRoute('meine-app'),
      cf.deployWorker('w1', 'export default {}'),
      cf.getWorker('w1'),
      cf.deleteWorker('w1'),
      cf.listWorkers(),
    ];
    const results = await Promise.allSettled(calls);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      expect(typeof (r.value as { ok: boolean }).ok).toBe('boolean');
    }
  });
});

// ── PHASE 2 · U2.2: bindings, zone, DNS, Worker routes ──────────────────────
//
// Same contract as everything above: typed results, no raw throws, and a MISSING
// SCOPE reported as `auth` rather than crashed on — the founder's next action
// differs completely between "the token cannot do this" and "Cloudflare said no".

describe('deployWorker bindings (Phase 2)', () => {
  it('sends the binding set with the script, so a deploy cannot strip it', async () => {
    fetchMock.mockResolvedValue(cfOk({}));
    const res = await cf.deployWorker('goblin-apps-router', 'export default {}', {
      bindings: [
        { type: 'kv_namespace', name: 'ROUTES', namespace_id: 'kv-1' },
        { type: 'r2_bucket', name: 'APPS', bucket_name: 'goblin-apps' },
        { type: 'plain_text', name: 'APPS_DOMAIN', text: 'justgoblin.app' },
      ],
    });
    expect(res.ok).toBe(true);

    const body = fetchMock.mock.calls[0]![1].body as FormData;
    const metadata = JSON.parse(await (body.get('metadata') as Blob).text());
    expect(metadata.main_module).toBe('worker.mjs');
    expect(metadata.bindings).toHaveLength(3);
    expect(metadata.bindings[0]).toEqual({ type: 'kv_namespace', name: 'ROUTES', namespace_id: 'kv-1' });
    expect(metadata.bindings[1]).toEqual({ type: 'r2_bucket', name: 'APPS', bucket_name: 'goblin-apps' });
  });

  it('omits the bindings key entirely when there are none (Phase-1 behaviour unchanged)', async () => {
    fetchMock.mockResolvedValue(cfOk({}));
    await cf.deployWorker('w1', 'export default {}');
    const body = fetchMock.mock.calls[0]![1].body as FormData;
    const metadata = JSON.parse(await (body.get('metadata') as Blob).text());
    expect(metadata).not.toHaveProperty('bindings');
  });

  it('carries an R2 jurisdiction through to the upload metadata verbatim', async () => {
    // The wire format is the whole point of this test. Cloudflare's multipart
    // metadata reference does not document `jurisdiction` on an r2_bucket binding;
    // its generated API client does, and so does wrangler's config. This pins that
    // the field reaches the request body rather than being dropped in assembly.
    fetchMock.mockResolvedValue(cfOk({}));
    await cf.deployWorker('goblin-apps-router', 'export default {}', {
      bindings: [{ type: 'r2_bucket', name: 'APPS', bucket_name: 'goblin-apps', jurisdiction: 'eu' }],
    });

    const body = fetchMock.mock.calls[0]![1].body as FormData;
    const metadata = JSON.parse(await (body.get('metadata') as Blob).text());
    expect(metadata.bindings[0]).toEqual({
      type: 'r2_bucket',
      name: 'APPS',
      bucket_name: 'goblin-apps',
      jurisdiction: 'eu',
    });
  });
});

/**
 * CF_R2_JURISDICTION — read like every other env value here, and three-way on
 * purpose. "Unset" and "unrecognised" are different answers because one of them
 * is a supported configuration and the other is a founder mistake about where
 * user data lives.
 */
describe('r2Jurisdiction', () => {
  beforeEach(() => {
    delete process.env.CF_R2_JURISDICTION;
  });

  it('unset means the default namespace, not an error', () => {
    expect(cf.r2Jurisdiction()).toEqual({ ok: true, jurisdiction: null });
  });

  it('empty and whitespace-only are unset', () => {
    process.env.CF_R2_JURISDICTION = '';
    expect(cf.r2Jurisdiction()).toEqual({ ok: true, jurisdiction: null });
    process.env.CF_R2_JURISDICTION = '   ';
    expect(cf.r2Jurisdiction()).toEqual({ ok: true, jurisdiction: null });
  });

  it('accepts every jurisdiction R2 defines', () => {
    for (const j of cf.R2_JURISDICTIONS) {
      process.env.CF_R2_JURISDICTION = j;
      expect(cf.r2Jurisdiction()).toEqual({ ok: true, jurisdiction: j });
    }
  });

  it('unwraps a pasted value and folds case', () => {
    for (const raw of ['"eu"', "'eu'", '  EU  ', '"EU"']) {
      process.env.CF_R2_JURISDICTION = raw;
      expect(cf.r2Jurisdiction()).toEqual({ ok: true, jurisdiction: 'eu' });
    }
  });

  it('reports an unrecognised value as unreadable, carrying it back for the message', () => {
    process.env.CF_R2_JURISDICTION = 'europe';
    expect(cf.r2Jurisdiction()).toEqual({ ok: false, raw: 'europe' });
  });

  it('never silently degrades an unrecognised value to the default namespace', () => {
    // The failure mode this exists to prevent: a typo binding the Worker to the
    // default namespace while the founder believes data is pinned to the EU.
    process.env.CF_R2_JURISDICTION = 'eu-central';
    const read = cf.r2Jurisdiction();
    expect(read.ok).toBe(false);
    expect(read).not.toHaveProperty('jurisdiction');
  });

  it('is not in CF_ENV_VARS — unset is correct, and health must not call it missing', () => {
    expect([...cf.CF_ENV_VARS] as string[]).not.toContain('CF_R2_JURISDICTION');
  });
});

describe('findZoneId', () => {
  it('returns the id of the exactly-matching zone', async () => {
    fetchMock.mockResolvedValue(cfOk([{ id: 'zone-abc', name: 'justgoblin.app' }]));
    const res = await cf.findZoneId('justgoblin.app');
    expect(res).toEqual({ ok: true, value: 'zone-abc' });
    expect(fetchMock.mock.calls[0]![0]).toContain('/zones?name=justgoblin.app');
  });

  it('returns null — an answer, not an error — when the domain is not on the account', async () => {
    fetchMock.mockResolvedValue(cfOk([]));
    expect(await cf.findZoneId('justgoblin.app')).toEqual({ ok: true, value: null });
  });

  it('does not accept a near-miss zone name', async () => {
    // A suffix match would happily hand back someone else's zone.
    fetchMock.mockResolvedValue(cfOk([{ id: 'zone-x', name: 'notjustgoblin.app' }]));
    expect(await cf.findZoneId('justgoblin.app')).toEqual({ ok: true, value: null });
  });

  it('reports a missing Zone:Read scope as auth, not as "no such zone"', async () => {
    fetchMock.mockResolvedValue(cfErr(403, 'Actor is not authorized'));
    const res = await cf.findZoneId('justgoblin.app');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('auth');
  });
});

describe('ensureWildcardDns', () => {
  it('creates a PROXIED A record at the RFC 5737 documentation address', async () => {
    fetchMock
      .mockResolvedValueOnce(cfOk([])) // list: nothing there
      .mockResolvedValueOnce(cfOk({ id: 'rec-1', proxied: true })); // create
    const res = await cf.ensureWildcardDns('zone-abc', 'justgoblin.app');
    expect(res).toEqual({ ok: true, value: { created: true, recordId: 'rec-1', proxied: true } });

    const body = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
    expect(body).toMatchObject({ type: 'A', name: '*.justgoblin.app', content: '192.0.2.1', proxied: true });
  });

  it('is idempotent — an existing proxied record is left alone', async () => {
    fetchMock.mockResolvedValueOnce(cfOk([{ id: 'rec-1', name: '*.justgoblin.app', type: 'A', proxied: true }]));
    const res = await cf.ensureWildcardDns('zone-abc', 'justgoblin.app');
    expect(res).toEqual({ ok: true, value: { created: false, recordId: 'rec-1', proxied: true } });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no write
  });

  it('reports an UNPROXIED record truthfully instead of overwriting it', async () => {
    // This is the case that looks configured and silently never runs the Worker.
    fetchMock.mockResolvedValueOnce(cfOk([{ id: 'rec-1', name: '*.justgoblin.app', type: 'A', proxied: false }]));
    const res = await cf.ensureWildcardDns('zone-abc', 'justgoblin.app');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.proxied).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1); // the founder's record is not touched
  });

  it('reports a missing DNS:Edit scope as auth', async () => {
    fetchMock.mockResolvedValueOnce(cfOk([])).mockResolvedValueOnce(cfErr(403, 'nope'));
    const res = await cf.ensureWildcardDns('zone-abc', 'justgoblin.app');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('auth');
  });
});

describe('ensureWorkerRoute', () => {
  it('creates the route when it does not exist', async () => {
    fetchMock.mockResolvedValueOnce(cfOk([])).mockResolvedValueOnce(cfOk({ id: 'route-1' }));
    const res = await cf.ensureWorkerRoute('zone-abc', '*.justgoblin.app/*', 'goblin-apps-router');
    expect(res).toEqual({ ok: true, value: { created: true, updated: false, routeId: 'route-1' } });
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string)).toEqual({
      pattern: '*.justgoblin.app/*',
      script: 'goblin-apps-router',
    });
  });

  it('does nothing when the route already points at the right script', async () => {
    fetchMock.mockResolvedValueOnce(
      cfOk([{ id: 'route-1', pattern: '*.justgoblin.app/*', script: 'goblin-apps-router' }]),
    );
    const res = await cf.ensureWorkerRoute('zone-abc', '*.justgoblin.app/*', 'goblin-apps-router');
    expect(res).toEqual({ ok: true, value: { created: false, updated: false, routeId: 'route-1' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('RE-POINTS a route that serves the wrong script instead of reporting success', async () => {
    fetchMock
      .mockResolvedValueOnce(cfOk([{ id: 'route-1', pattern: '*.justgoblin.app/*', script: 'some-other-worker' }]))
      .mockResolvedValueOnce(cfOk({ id: 'route-1' }));
    const res = await cf.ensureWorkerRoute('zone-abc', '*.justgoblin.app/*', 'goblin-apps-router');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.updated).toBe(true);
    expect(fetchMock.mock.calls[1]![1].method).toBe('PUT');
  });

  it('refuses an invalid script name before making any call', async () => {
    const res = await cf.ensureWorkerRoute('zone-abc', '*.justgoblin.app/*', 'Not A Valid Name!');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('invalid_input');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('opsSiteUrl', () => {
  it('defaults to the marketing site and strips a trailing slash', () => {
    delete process.env.OPS_SITE_URL;
    expect(cf.opsSiteUrl()).toBe('https://justgoblin.com');
    process.env.OPS_SITE_URL = 'https://staging.example.com/';
    expect(cf.opsSiteUrl()).toBe('https://staging.example.com');
    delete process.env.OPS_SITE_URL;
  });

  it('is NOT one of the health probe`s required variables', () => {
    // Adding it there would turn a green Phase-1 health report degraded on merge,
    // for a value that has a correct default.
    expect(cf.CF_ENV_VARS as readonly string[]).not.toContain('OPS_SITE_URL');
  });
});

describe('the Phase-2 calls also never throw', () => {
  it('returns a typed result even when the transport dies', async () => {
    fetchMock.mockRejectedValue(new Error('kaputt'));
    const results = await Promise.allSettled([
      cf.findZoneId('justgoblin.app'),
      cf.listDnsRecords('zone-abc', '*.justgoblin.app'),
      cf.ensureWildcardDns('zone-abc', 'justgoblin.app'),
      cf.listWorkerRoutes('zone-abc'),
      cf.ensureWorkerRoute('zone-abc', '*.justgoblin.app/*', 'goblin-apps-router'),
    ]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    for (const r of results) {
      if (r.status === 'fulfilled') expect(typeof (r.value as { ok: boolean }).ok).toBe('boolean');
    }
  });
});
