// A-5 (WAVE-A) — notifyAgentRunFinished: preference gating + honest content variants.
// web-push and supabase are mocked; VAPID env is stubbed so the key-agnostic guard passes.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// notifications.ts reads VAPID keys at MODULE LOAD; the import below is hoisted above
// ordinary statements, so seed the env in vi.hoisted (which runs before imports) or the
// key-agnostic guard trips and nothing sends.
vi.hoisted(() => {
  process.env.VAPID_PUBLIC_KEY = 'BPUBLIC_TEST';
  process.env.VAPID_PRIVATE_KEY = 'PRIVATE_TEST';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'srk';
});

const sent: Array<{ endpoint: string; payload: unknown }> = [];
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn((sub: { endpoint: string }, payload: string) => {
      sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
      return Promise.resolve();
    }),
  },
}));

// Configurable per-test preference + subscription rows.
let prefRow: { notify_build_complete: boolean } | null = { notify_build_complete: true };
const subRows = [{ endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }];

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      // A flat chainable builder: eq() returns the same builder; it is awaitable
      // (resolves the row set for push_subscriptions) and also exposes maybeSingle
      // (the single user_preferences row). Covers both query shapes the module uses.
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => Promise.resolve({ data: table === 'users' ? prefRow : null, error: null }),
        then: (res: (v: { data: unknown; error: null }) => unknown) =>
          res({ data: table === 'push_subscriptions' ? subRows : [], error: null }),
        delete: () => ({ eq: () => Promise.resolve({}) }),
      };
      return builder;
    },
  }),
}));

// eslint-disable-next-line import/first
import { notifyAgentRunFinished } from './notifications';

describe('A-5 notifyAgentRunFinished', () => {
  beforeEach(() => { sent.length = 0; prefRow = { notify_build_complete: true }; });

  it('published run → "live" title carries the VERIFIED url', async () => {
    await notifyAgentRunFinished('u1', { outcome: 'finished', publishedUrl: 'https://app.vercel.app', projectName: 'Zähler' });
    expect(sent).toHaveLength(1);
    const p = sent[0]!.payload as { title: string; url: string; body: string };
    expect(p.title).toMatch(/live/i);
    expect(p.url).toBe('https://app.vercel.app');
    expect(p.body).toContain('Zähler');
  });

  it('finished (unpublished) run → "fertig" title, no invented url', async () => {
    await notifyAgentRunFinished('u1', { outcome: 'finished' });
    const p = sent[0]!.payload as { title: string; url: string };
    expect(p.title).toMatch(/fertig/i);
    expect(p.url).toBe('/dashboard'); // never fabricates a live URL
  });

  it('honours notify_build_complete = false (no push)', async () => {
    prefRow = { notify_build_complete: false };
    await notifyAgentRunFinished('u1', { outcome: 'finished', publishedUrl: 'https://x.app' });
    expect(sent).toHaveLength(0);
  });

  it('error outcome → honest "nichts kaputt" body, not a success claim', async () => {
    await notifyAgentRunFinished('u1', { outcome: 'error' });
    const p = sent[0]!.payload as { body: string };
    expect(p.body).toMatch(/nicht geklappt|nichts kaputt/i);
  });

  it('F-40 timeout guard → honest "Zeitlimit" copy, not a plain user "gestoppt"', async () => {
    await notifyAgentRunFinished('u1', { outcome: 'stopped', timedOut: true, projectName: 'Zähler' });
    const p = sent[0]!.payload as { title: string; body: string };
    expect(p.body).toMatch(/Zeitlimit/);
    expect(p.body).toMatch(/gesichert/); // partial state is safe
    expect(p.title).not.toMatch(/live/i);
  });

  it('F-40 deep-links the non-published push into the run surface (so the tap lands on the report)', async () => {
    await notifyAgentRunFinished('u1', { outcome: 'finished', deepLinkUrl: '/dashboard/project/p1/work' });
    const p = sent[0]!.payload as { url: string };
    expect(p.url).toBe('/dashboard/project/p1/work');
  });

  it('a published run still opens its VERIFIED url, ignoring the deep link', async () => {
    await notifyAgentRunFinished('u1', { outcome: 'finished', publishedUrl: 'https://app.vercel.app', deepLinkUrl: '/dashboard/project/p1/work' });
    const p = sent[0]!.payload as { url: string };
    expect(p.url).toBe('https://app.vercel.app'); // the live app wins over the deep link
  });
});
