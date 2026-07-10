// I1 (WAVE-I insight) GATE: the scripted canonical-funnel mini-journey.
//
// Drives one user through every funnel stage in order and asserts (a) the exact
// expected event_type sequence lands in platform_events, and (b) the PRIVACY
// LAW of this wave — every emitted row carries METADATA ONLY: no message text,
// no file contents, no generated code, anywhere in any column or meta payload.
//
// This is the emitter-level twin of the on-stack journey (the real routes call
// the same insertPlatformEvent / trackEvent). It runs with no DB — the Supabase
// client is faked and every insert is captured for assertion.

import { describe, it, expect, beforeEach, vi } from 'vitest';

type InsertResult = { error: { message: string } | null };
let inserted: Array<Record<string, unknown>>;
let nextResult: InsertResult;

const fakeSupabase = {
  from: (_table: string) => ({
    insert: (row: Record<string, unknown>) => {
      inserted.push(row);
      return Promise.resolve(nextResult);
    },
  }),
};

vi.mock('./supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));

// eslint-disable-next-line import/first
import { insertPlatformEvent, trackEvent, type PlatformEventType, type PlatformEvent } from './platform-events';

// The canonical number-chain that matters (signup is derived from
// users.created_at, so it is NOT an emitted event and not in this sequence).
const CANONICAL_FUNNEL: PlatformEventType[] = [
  'onboarding_completed',
  'project_created',
  'message_sent',
  'agent_run_finished',
  'publish_verified',
  'upgrade_clicked',
  'upgraded',
];

// Any meta key or column that would betray content. The audit fails hard if a
// row ever carries one of these — the sink must never become a content log.
const FORBIDDEN_META_KEYS = [
  'content', 'message', 'text', 'body', 'code', 'file', 'files',
  'prompt', 'response', 'html', 'source', 'snippet', 'report',
];

beforeEach(() => {
  inserted = [];
  nextResult = { error: null };
});

describe('I1 canonical funnel — scripted mini-journey', () => {
  it('emits every stage exactly once, in canonical order', async () => {
    const userId = 'journey-user';
    const projectId = 'journey-project';

    // Replay the journey in the same order the real truth-gates fire.
    await insertPlatformEvent({ eventType: 'onboarding_completed', userId });
    await insertPlatformEvent({ eventType: 'project_created', userId, projectId, meta: { intent: 'web_app' } });
    await insertPlatformEvent({ eventType: 'message_sent', userId, projectId, meta: { surface: 'project' } });
    await insertPlatformEvent({ eventType: 'agent_run_finished', userId, projectId, meta: { status: 'ok', outcome: 'done', iterations: 3, duration_ms: 4200 } });
    await insertPlatformEvent({ eventType: 'publish_verified', userId, projectId });
    await insertPlatformEvent({ eventType: 'upgrade_clicked', userId, meta: { target_plan: 'build' } });
    await insertPlatformEvent({ eventType: 'upgraded', userId, meta: { plan: 'build' } });

    const sequence = inserted.map((r) => r.event_type);
    expect(sequence).toEqual(CANONICAL_FUNNEL);
    // Every row is attributed to the user (so it joins the purge + journeys).
    expect(inserted.every((r) => r.user_id === userId)).toBe(true);
  });

  it('PRIVACY AUDIT: no row carries any content field, in any column or meta', async () => {
    const userId = 'audit-user';
    const projectId = 'audit-project';
    // A realistic spread including the product signals + a Wave-J-ready one.
    const journey: PlatformEvent[] = [
      { eventType: 'onboarding_completed', userId },
      { eventType: 'project_created', userId, projectId, meta: { intent: 'landing_page' } },
      { eventType: 'message_sent', userId, projectId, meta: { surface: 'standalone' } },
      { eventType: 'agent_run_finished', userId, projectId, meta: { status: 'failed', outcome: 'error', duration_ms: 900 } },
      { eventType: 'publish_failed', userId, projectId, meta: { stage: 'verification', check: 'asset 404', failed_assets: 2 } },
      { eventType: 'publish_verified', userId, projectId },
      { eventType: 'login', userId },
      { eventType: 'trial_card_shown', userId, meta: { variant: 'toast' } },
      { eventType: 'trial_card_clicked', userId, meta: { variant: 'toast' } },
      { eventType: 'help_opened', userId },
      { eventType: 'upgrade_clicked', userId, meta: { target_plan: 'pro' } },
      { eventType: 'upgraded', userId, meta: { plan: 'pro' } },
    ];
    for (const e of journey) await insertPlatformEvent(e);

    for (const row of inserted) {
      const meta = (row.meta ?? {}) as Record<string, unknown>;
      // (a) no forbidden key names.
      for (const k of Object.keys(meta)) {
        expect(FORBIDDEN_META_KEYS).not.toContain(k.toLowerCase());
      }
      // (b) no long free-text value that could hide content (tags are short).
      for (const v of Object.values(meta)) {
        if (typeof v === 'string') expect(v.length).toBeLessThanOrEqual(120);
      }
      // (c) the payload columns are metadata only — the row shape never even has
      // a content/text/body column (only the 0078/0085 schema columns exist).
      const cols = Object.keys(row);
      for (const forbidden of FORBIDDEN_META_KEYS) {
        expect(cols).not.toContain(forbidden);
      }
    }
  });
});

describe('trackEvent — fire-and-forget', () => {
  it('returns void synchronously and never throws even when the insert errors', () => {
    nextResult = { error: { message: 'relation "public.platform_events" does not exist' } };
    // Must not throw and must not return a promise the caller has to await.
    expect(trackEvent({ eventType: 'login', userId: 'u1' })).toBeUndefined();
  });

  it('still attempts the insert (measurement, deferred on pre-migration)', async () => {
    trackEvent({ eventType: 'help_opened', userId: 'u1' });
    // Let the detached microtask run.
    await Promise.resolve();
    await Promise.resolve();
    expect(inserted.some((r) => r.event_type === 'help_opened')).toBe(true);
  });
});
