// I0 (MOBILE-1 telemetry pre-unit): completion_costs attribution.
// Verifies project chat vs standalone are distinguishable (project_id +
// chat_session_id) and that the write is pre-migration tolerant (retries without
// project_id when the column is absent, rather than dropping the cost row).

import { describe, it, expect, beforeEach, vi } from 'vitest';

type InsertResult = { error: { message: string } | null };

let inserted: Array<Record<string, unknown>>;
let results: InsertResult[];

const fakeSupabase = {
  from: (_table: string) => ({
    insert: (row: Record<string, unknown>) => {
      inserted.push(row);
      const r = results.shift() ?? { error: null };
      return Promise.resolve(r);
    },
  }),
};

vi.mock('./supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));

// eslint-disable-next-line import/first
import { trackCompletion } from './track-completion';

describe('trackCompletion — I0 attribution', () => {
  beforeEach(() => {
    inserted = [];
    results = [];
  });

  it('writes project_id and chat_session_id for a project chat completion', async () => {
    await trackCompletion({
      userId: 'u1',
      chatSessionId: 's1',
      projectId: 'p1',
      provider: 'groq',
      model: 'llama-x',
      tokensIn: 100,
      tokensOut: 50,
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ user_id: 'u1', chat_session_id: 's1', project_id: 'p1' });
  });

  it('a standalone completion is distinguishable (project_id null)', async () => {
    await trackCompletion({
      userId: 'u1',
      provider: 'groq',
      model: 'llama-x',
      tokensIn: 10,
      tokensOut: 5,
    });
    expect(inserted[0]).toMatchObject({ project_id: null, chat_session_id: null });
  });

  it('retries WITHOUT project_id when the column is absent — pre-migration tolerant', async () => {
    // First insert (with project_id) errors; the retry must succeed and keep the row.
    results = [{ error: { message: 'column "project_id" does not exist' } }, { error: null }];
    await trackCompletion({
      userId: 'u1',
      projectId: 'p1',
      provider: 'groq',
      model: 'llama-x',
      tokensIn: 10,
      tokensOut: 5,
    });
    expect(inserted).toHaveLength(2);
    // First attempt carried project_id...
    expect(inserted[0]).toHaveProperty('project_id', 'p1');
    // ...the fallback insert dropped it (no property at all), so the cost row survives.
    expect(inserted[1]).not.toHaveProperty('project_id');
    expect(inserted[1]).toMatchObject({ user_id: 'u1', tokens_in: 10 });
  });

  // P1.8 — speed measurement (migration 0080), same pre-migration tolerance as I0.
  it('writes ttft_ms and duration_ms when the timing columns are accepted', async () => {
    await trackCompletion({
      userId: 'u1',
      chatSessionId: 's1',
      projectId: 'p1',
      provider: 'groq',
      model: 'llama-x',
      tokensIn: 100,
      tokensOut: 50,
      ttftMs: 120,
      durationMs: 800,
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ ttft_ms: 120, duration_ms: 800 });
  });

  it('retries WITHOUT the timing columns (and project_id) when they are absent — pre-migration tolerant', async () => {
    // First insert (with timing + project_id) errors as if pre-0080; retry must succeed.
    results = [{ error: { message: 'column "ttft_ms" does not exist' } }, { error: null }];
    await trackCompletion({
      userId: 'u1',
      projectId: 'p1',
      provider: 'groq',
      model: 'llama-x',
      tokensIn: 10,
      tokensOut: 5,
      ttftMs: 120,
      durationMs: 800,
    });
    expect(inserted).toHaveLength(2);
    // First attempt carried the timing fields...
    expect(inserted[0]).toMatchObject({ ttft_ms: 120, duration_ms: 800 });
    // ...the fallback dropped them (and project_id) entirely, so the cost row survives.
    expect(inserted[1]).not.toHaveProperty('ttft_ms');
    expect(inserted[1]).not.toHaveProperty('duration_ms');
    expect(inserted[1]).not.toHaveProperty('project_id');
    expect(inserted[1]).toMatchObject({ user_id: 'u1', tokens_in: 10 });
  });
});
