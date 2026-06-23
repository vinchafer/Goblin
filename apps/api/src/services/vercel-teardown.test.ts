/**
 * teardownVercelProject — scope-resolution regression (teardown- session).
 *
 * Goblin deploys into a TEAM scope, where a no-teamId DELETE returns 404 even
 * though the team project is LIVE. The first cut returned success on that first
 * personal 404 and never swept the team scopes → team sites stayed online
 * (flaky: only torn down when Vercel happened to answer 403). These tests lock
 * the corrected behavior: 404 falls through to the team sweep; "already gone" is
 * only concluded when personal AND every team return 404 with no errors.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const getActiveKeyByProvider = vi.fn(async () => 'tok_123' as string | null);
vi.mock('./byok-service', () => ({ getActiveKeyByProvider }));
vi.mock('../lib/vercel-guard', () => ({ guardVercelCall: vi.fn() }));
vi.mock('./file-storage', () => ({ listFiles: vi.fn(), downloadFile: vi.fn() }));

const { teardownVercelProject } = await import('./vercel-service');

type Resp = { status: number; ok: boolean; json: () => Promise<unknown> };
function resp(status: number, body: unknown = {}): Resp {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  getActiveKeyByProvider.mockResolvedValue('tok_123');
  global.fetch = fetchMock as unknown as typeof fetch;
});

const isDelete = (url: string, init?: { method?: string }) => init?.method === 'DELETE';
const teamId = (url: string) => new URL(url).searchParams.get('teamId');

it('personal 404 → sweeps teams → deletes the team project (the bug)', async () => {
  fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (isDelete(url, init)) return resp(teamId(url) ? 204 : 404); // personal 404, team 204
    return resp(200, { teams: [{ id: 'team_abc' }] });
  });
  const r = await teardownVercelProject('u1', 'My Site');
  expect(r.ok).toBe(true);
  expect(r.alreadyGone).toBe(false); // actually deleted, not "already gone"
  expect(r.status).toBe(204);
});

it('personal 404 + every team 404 → truly already gone', async () => {
  fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (isDelete(url, init)) return resp(404);
    return resp(200, { teams: [{ id: 'team_abc' }] });
  });
  const r = await teardownVercelProject('u1', 'My Site');
  expect(r.ok).toBe(true);
  expect(r.alreadyGone).toBe(true);
});

it('personal 204 → deleted immediately, no team sweep needed', async () => {
  fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (isDelete(url, init)) return resp(204);
    return resp(200, { teams: [] });
  });
  const r = await teardownVercelProject('u1', 'My Site');
  expect(r.ok).toBe(true);
  expect(r.alreadyGone).toBe(false);
});

it('personal 404 but team enumeration fails → cannot claim gone → failure', async () => {
  fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (isDelete(url, init)) return resp(404);
    return resp(500); // /v2/teams not ok
  });
  const r = await teardownVercelProject('u1', 'My Site');
  expect(r.ok).toBe(false);
  expect(r.alreadyGone).toBe(false);
});

it('no Vercel token → nothing was ever deployed → success/alreadyGone', async () => {
  getActiveKeyByProvider.mockResolvedValue(null);
  // fresh userId — the module-level token cache is keyed by userId and other
  // tests warmed 'u1', which would mask a null lookup.
  const r = await teardownVercelProject('u-no-token', 'My Site');
  expect(r.ok).toBe(true);
  expect(r.alreadyGone).toBe(true);
  expect(fetchMock).not.toHaveBeenCalled();
});
