/**
 * I1 (WAVE-I insight) — the client event ingest (POST /api/events).
 *
 * Exercises the real Hono router via `.request()` against a fake Supabase (auth
 * + a captured platform_events insert). Proves the three guarantees that make
 * this endpoint safe to expose to the browser:
 *   · auth required — no Bearer → 401 (authMiddleware), nothing recorded.
 *   · whitelist — only UI-surface types persist; a client CANNOT forge a
 *     truth-gated funnel event (publish_verified, upgraded, agent_run_finished).
 *   · metadata-only — long free-text values are dropped; the endpoint always
 *     answers 204 and never turns into a content log.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const inserted: Array<Record<string, unknown>> = [];

const fakeSupabase = {
  from: (_t: string) => ({
    insert: (row: Record<string, unknown>) => {
      inserted.push(row);
      return Promise.resolve({ error: null });
    },
  }),
  auth: {
    getUser: (token: string) => {
      const id = token?.startsWith('user:') ? token.slice(5) : null;
      return Promise.resolve(
        id ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { message: 'bad' } },
      );
    },
  },
};

vi.mock('../lib/supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));
vi.mock('../lib/logger', () => ({ default: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { events } = await import('./events');

const auth = (user: string) => ({ Authorization: `Bearer user:${user}`, 'Content-Type': 'application/json' });

// The insert runs fire-and-forget (trackEvent detaches it), so let the
// microtask queue drain before asserting on captured rows.
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

beforeEach(() => { inserted.length = 0; });

describe('POST /api/events', () => {
  it('401 without a valid bearer — nothing recorded', async () => {
    const res = await events.request('/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'help_opened' }) });
    expect(res.status).toBe(401);
    await flush();
    expect(inserted).toHaveLength(0);
  });

  it('records a whitelisted UI event (help_opened) → 204', async () => {
    const res = await events.request('/', { method: 'POST', headers: auth('u1'), body: JSON.stringify({ type: 'help_opened' }) });
    expect(res.status).toBe(204);
    await flush();
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ event_type: 'help_opened', user_id: 'u1' });
  });

  it('records trial_card_clicked with short metadata', async () => {
    const res = await events.request('/', { method: 'POST', headers: auth('u1'), body: JSON.stringify({ type: 'trial_card_clicked', meta: { variant: 'toast' } }) });
    expect(res.status).toBe(204);
    await flush();
    expect(inserted[0]).toMatchObject({ event_type: 'trial_card_clicked', meta: { variant: 'toast' } });
  });

  it('SECURITY: a client CANNOT forge a truth-gated funnel event', async () => {
    for (const forged of ['publish_verified', 'upgraded', 'agent_run_finished', 'project_created', 'platform_cogs']) {
      const res = await events.request('/', { method: 'POST', headers: auth('u1'), body: JSON.stringify({ type: forged }) });
      // Still 204 (never errors), but silently ignored — nothing persisted.
      expect(res.status).toBe(204);
    }
    await flush();
    expect(inserted).toHaveLength(0);
  });

  it('PRIVACY: a smuggled long content value is dropped, not stored', async () => {
    const smuggled = 'x'.repeat(5000); // a pasted message / file body
    const res = await events.request('/', { method: 'POST', headers: auth('u1'), body: JSON.stringify({ type: 'feedback_submitted', meta: { note: smuggled } }) });
    // Schema rejects the oversized value → the whole body fails to parse → ignored.
    expect(res.status).toBe(204);
    await flush();
    expect(inserted).toHaveLength(0);
  });

  it('PRIVACY: nested objects in meta are rejected (no content nesting)', async () => {
    const res = await events.request('/', { method: 'POST', headers: auth('u1'), body: JSON.stringify({ type: 'help_opened', meta: { payload: { message: 'secret' } } }) });
    expect(res.status).toBe(204);
    await flush();
    expect(inserted).toHaveLength(0);
  });
});
