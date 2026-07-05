// I0 (MOBILE-1 telemetry pre-unit): platform_events persistence.
// Verifies the summarizer/retry producers write a row when the table exists and
// no-op cleanly (never throw, never break request flow) when it is absent.

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
import { insertPlatformEvent } from './platform-events';

describe('insertPlatformEvent', () => {
  beforeEach(() => {
    inserted = [];
    nextResult = { error: null };
  });

  it('writes a platform_cogs row with mapped columns when the table exists', async () => {
    await insertPlatformEvent({
      eventType: 'platform_cogs',
      userId: 'u1',
      projectId: 'p1',
      model: 'llama-x',
      tokensIn: 100,
      tokensOut: 20,
      meta: { feature: 'project-state-summarizer' },
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      event_type: 'platform_cogs',
      user_id: 'u1',
      project_id: 'p1',
      model: 'llama-x',
      tokens_in: 100,
      tokens_out: 20,
      meta: { feature: 'project-state-summarizer' },
    });
  });

  it('writes a context_retry row with null tokens', async () => {
    await insertPlatformEvent({
      eventType: 'context_retry',
      userId: 'u1',
      projectId: null,
      model: 'groq-x',
      meta: { reason: 'TPM limit' },
    });
    expect(inserted[0]).toMatchObject({
      event_type: 'context_retry',
      project_id: null,
      tokens_in: null,
      tokens_out: null,
    });
  });

  it('no-ops (does not throw) when the table is absent — pre-migration', async () => {
    nextResult = { error: { message: 'relation "public.platform_events" does not exist' } };
    await expect(
      insertPlatformEvent({ eventType: 'platform_cogs', userId: 'u1' }),
    ).resolves.toBeUndefined();
    // The insert was attempted exactly once; the error was swallowed.
    expect(inserted).toHaveLength(1);
  });
});
