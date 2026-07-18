// WAVE-B B1 — deterministic tests for the Supabase provider with a mocked fetch. Proves the
// "attested, never fabricated" contract: the ref/keys come from the mocked API responses and
// the latency is measured from the injected clock; nothing is invented.

import { describe, it, expect, vi } from 'vitest';
import { SupabaseProvider, type SupabaseProviderDeps } from './supabase-provider';
import { ProvisionError } from './types';

function jsonRes(status: number, body: unknown): Response {
  return { status, json: async () => body } as unknown as Response;
}

interface RouteMap {
  organizations?: () => Response;
  createProject?: () => Response;
  apiKeys?: () => Response;
  query?: () => Response;
  del?: () => Response;
}

function makeDeps(routes: RouteMap, clock: number[] = [1000, 5200]): SupabaseProviderDeps {
  let tick = 0;
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    if (u.endsWith('/v1/organizations')) return routes.organizations?.() ?? jsonRes(200, [{ id: 'org_1' }]);
    if (u.endsWith('/v1/projects') && method === 'POST') return routes.createProject?.() ?? jsonRes(201, { ref: 'newref01', endpoint: 'db.newref01.supabase.co' });
    if (u.includes('/api-keys')) return routes.apiKeys?.() ?? jsonRes(200, [{ name: 'anon', api_key: 'ANON' }, { name: 'service_role', api_key: 'SRK' }]);
    if (u.includes('/database/query')) return routes.query?.() ?? jsonRes(201, []);
    if (method === 'DELETE') return routes.del?.() ?? jsonRes(200, {});
    return jsonRes(404, {});
  });
  return {
    getToken: vi.fn().mockResolvedValue('user_oauth_token'),
    fetch: fetchMock as unknown as typeof fetch,
    sleep: vi.fn().mockResolvedValue(undefined),
    now: vi.fn(() => clock[Math.min(tick++, clock.length - 1)] as number),
  };
}

const req = { name: 'Aufgaben Liste!', tables: [{ name: 'tasks', columns: [{ name: 'title', type: 'text' as const }] }] };

describe('SupabaseProvider.provision', () => {
  it('attests ref + keys from the API and measures latency from the clock', async () => {
    const p = new SupabaseProvider(makeDeps({}, [1000, 5200]));
    const b = await p.provision('u1', req);
    expect(b.projectRef).toBe('newref01');
    expect(b.projectUrl).toBe('https://newref01.supabase.co');
    expect(b.anonKey).toBe('ANON');
    expect(b.serviceRoleKey).toBe('SRK');
    expect(b.provisionLatencyMs).toBe(4200); // 5200 - 1000, measured, not invented
  });

  it('maps a quota/limit response to a coded, honest error', async () => {
    const p = new SupabaseProvider(makeDeps({ createProject: () => jsonRes(402, { message: 'limit' }) }));
    await expect(p.provision('u1', req)).rejects.toMatchObject({ code: 'supabase_quota' });
  });

  it('maps unauthorized to a reconnect-coded error', async () => {
    const p = new SupabaseProvider(makeDeps({ organizations: () => jsonRes(401, {}) }));
    await expect(p.provision('u1', req)).rejects.toMatchObject({ code: 'supabase_unauthorized' });
  });

  it('never fabricates keys: tags partialRef when keys never arrive', async () => {
    const p = new SupabaseProvider(makeDeps({ apiKeys: () => jsonRes(200, [{ name: 'anon', api_key: 'ANON' }]) }));
    try {
      await p.provision('u1', req);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ProvisionError);
      expect((e as ProvisionError).code).toBe('keys_unavailable');
      expect((e as ProvisionError).partialRef).toBe('newref01'); // recorded for teardown
    }
  });
});

describe('SupabaseProvider.teardown (idempotent, never throws)', () => {
  it('treats 404 as already gone', async () => {
    const p = new SupabaseProvider(makeDeps({ del: () => jsonRes(404, {}) }));
    const r = await p.teardown('u1', 'ref1');
    expect(r).toEqual({ ok: true, status: 404, alreadyGone: true });
  });

  it('no token = nothing was ever provisioned by us → ok', async () => {
    const deps = makeDeps({});
    deps.getToken = vi.fn().mockResolvedValue(null);
    const p = new SupabaseProvider(deps);
    const r = await p.teardown('u1', 'ref1');
    expect(r.ok).toBe(true);
    expect(r.alreadyGone).toBe(true);
  });

  it('reports a non-2xx as a not-confirmed failure (blocks the FW6 cascade)', async () => {
    const p = new SupabaseProvider(makeDeps({ del: () => jsonRes(500, {}) }));
    const r = await p.teardown('u1', 'ref1');
    expect(r.ok).toBe(false);
    expect(r.status).toBe(500);
  });
});

describe('SupabaseProvider.isConnected', () => {
  it('reflects token presence', async () => {
    const deps = makeDeps({});
    expect(await new SupabaseProvider(deps).isConnected('u1')).toBe(true);
    deps.getToken = vi.fn().mockResolvedValue(null);
    expect(await new SupabaseProvider(deps).isConnected('u1')).toBe(false);
  });
});
