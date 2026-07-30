import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * /api/version is the endpoint you reach for when everything else is down. On
 * 2026-07-30 it went down with everything else, and the founder's first
 * diagnostic told him nothing. These tests exist so that cannot recur: whatever
 * the environment looks like, this route answers 200 and describes itself.
 *
 * The route reads its variables at module scope (deliberately — see the comment
 * on REQUIRED_WEB_ENV), so every case re-imports the module under a fresh env.
 */

const ORIGINAL_ENV = process.env;

async function callGet() {
  vi.resetModules();
  const mod = await import('./route');
  const res = await mod.GET();
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('/api/version — the diagnosis endpoint cannot 500', () => {
  const CRITICAL = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_API_URL',
    'NEXT_PUBLIC_APP_URL',
  ];

  it('answers 200 with a complete env', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    process.env.NEXT_PUBLIC_API_URL = 'https://goblinapi-production.up.railway.app';
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.justgoblin.com';

    const { status, body } = await callGet();
    expect(status).toBe(200);
    expect(body.webReady).toBe(true);
    expect(body.config.healthy).toBe(true);
    expect(body.config.problems).toEqual([]);
  });

  it('answers 200 with each critical variable missing in turn, and names it', async () => {
    for (const missing of CRITICAL) {
      process.env = { ...ORIGINAL_ENV };
      for (const name of CRITICAL) process.env[name] = 'https://placeholder.example';
      delete process.env[missing];

      const { status, body } = await callGet();
      expect(status, `${missing} missing`).toBe(200);
      expect(body.webReady).toBe(true);
      expect(body.config.absent, `${missing} should be reported absent`).toContain(missing);
      expect(body.config.healthy).toBe(false);
    }
  });

  it('answers 200 with every critical variable missing at once', async () => {
    for (const name of CRITICAL) delete process.env[name];
    const { status, body } = await callGet();
    expect(status).toBe(200);
    expect(body.config.absent).toEqual(expect.arrayContaining(CRITICAL));
  });

  // The production value, verbatim — and under NODE_ENV=production, so the
  // fallback under test is the one production would actually have used.
  it('answers 200 under the exact 2026-07-30 poisoned value, and explains it', async () => {
    process.env.NEXT_PUBLIC_API_URL =
      'https://goblinapi-production.up.railway.app/api/auth/email-hook\n';
    (process.env as Record<string, string>).NODE_ENV = 'production';

    const { status, body } = await callGet();
    expect(status).toBe(200);
    expect(body.apiUrl).toBe('https://goblinapi-production.up.railway.app');
    expect(body.config.healthy).toBe(false);
    expect(body.config.problems.join(' ')).toContain('NEXT_PUBLIC_API_URL');
  });

  it('never returns the value of any variable — names and reasons only', async () => {
    const secretish = 'https://leaked-value.example';
    process.env.NEXT_PUBLIC_SUPABASE_URL = `${secretish}/supabase`;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = `${secretish}-anon-key`;
    process.env.NEXT_PUBLIC_APP_URL = `${secretish}/app`;
    process.env.NEXT_PUBLIC_API_URL = `${secretish}/api-origin`;

    const { status, body } = await callGet();
    expect(status).toBe(200);
    // apiUrl is the *normalised* origin, so a rejected value never echoes back.
    expect(JSON.stringify(body.config)).not.toContain(secretish);
  });

  it('reports a malformed value as a problem rather than throwing', async () => {
    for (const bad of ['not-a-url', 'ftp://host.example', 'https://host.example/some/path', '   ']) {
      process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_API_URL: bad };
      const { status, body } = await callGet();
      expect(status, JSON.stringify(bad)).toBe(200);
      expect(body.apiUrl.startsWith('http')).toBe(true);
      expect(body.config.healthy).toBe(false);
    }
  });
});
