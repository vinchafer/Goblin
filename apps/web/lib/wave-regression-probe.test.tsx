// @vitest-environment jsdom
/**
 * FOUNDER-WALK-7 · U9 — regression probes on paths this wave did NOT target.
 *
 * A repair wave's real risk is not the defect it aims at; it is the path next door.
 * These are the three places where this wave's changes could plausibly have reached
 * behaviour nobody asked it to change.
 *
 * 1. A chat with no Send-to-Code at all. U2 added a failure state to the routing
 *    path; an ordinary session must still produce no notice whatsoever.
 * 2. A code block rendered OUTSIDE the ThemeProvider. U8 made highlighting
 *    theme-aware via a context; a tree without the provider must degrade to the
 *    light rendering (what every surface had before), not throw and take the
 *    message down with it.
 * 3. `apiGet` on a SUCCESSFUL response. U7 rewrote the error path of all five api
 *    helpers; the success path must be untouched.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { classifyStcOutcome, stcNeedsNotice } from './stc-outcome';
import { useResolvedTheme } from './theme';
import type { CreateSessionResult } from '@/hooks/code/useCodeSessions';

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: 't' } }, error: null }),
      refreshSession: async () => ({ data: { session: null } }),
    },
  }),
}));

const SESSION = {
  id: 's1', name: 'Neue Session', model_id: null, state: 'active' as const,
  created_at: '2026-08-18T09:00:00Z', updated_at: '2026-08-18T09:00:00Z', draftCount: 0,
};

describe('probe 1 — an ordinary session, no Send-to-Code, behaves as before', () => {
  it('creating a plain "Neue Session" produces no notice of any kind', () => {
    const plain = { ...SESSION, initialFile: { requested: false, landed: false, path: null } } as CreateSessionResult;
    expect(stcNeedsNotice(classifyStcOutcome(plain, null))).toBe(false);
  });

  it('a server that predates this wave (no initialFile field) also produces no notice', () => {
    // The Railway API and the Vercel web deploy do not ship in lockstep. A web build
    // carrying U2 will, for some minutes, talk to an API that does not yet report
    // `initialFile` — and it must not start accusing that API of losing payloads.
    expect(stcNeedsNotice(classifyStcOutcome(SESSION as CreateSessionResult, null))).toBe(false);
    expect(classifyStcOutcome(SESSION as CreateSessionResult, null).kind).toBe('unreported');
  });
});

describe('probe 2 — a code block outside the ThemeProvider still renders', () => {
  it('useResolvedTheme degrades to light instead of throwing', () => {
    // `useTheme` throws without a provider — correct for a settings control, fatal
    // for a chat message. U8 must not have made a code block provider-dependent.
    const { result } = renderHook(() => useResolvedTheme());
    expect(result.current.resolvedTheme).toBe('light');
  });
});

describe('probe 3 — the api helpers\' success path is untouched by U7', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('a 200 still resolves to the parsed body, not an ApiError', async () => {
    const { apiGet } = await import('./api');
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ apps: [{ appId: 'a1' }] }),
    } as unknown as Response)));

    await expect(apiGet('/api/ops/apps')).resolves.toEqual({ apps: [{ appId: 'a1' }] });
  });
});
