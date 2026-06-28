/**
 * BYOK per-provider key cap (2/provider, uniform across plans).
 *
 * Proves:
 *  - adding a 3rd key for a provider already at the cap is BLOCKED, with the
 *    bilingual (EN+DE) marker the frontend keys off to offer a replace;
 *  - GRANDFATHER: a user already holding >2 keys (legacy cap of 5) is still
 *    blocked from ADDING, but no existing row is mutated (no update/delete) —
 *    their keys are untouched;
 *  - under the cap (count < 2) the cap gate passes through to validation.
 *
 * Supabase is an in-memory fake; no network/DB is touched. The cap check runs
 * before any provider validation, so the block paths never reach the network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable state the fake reads, plus a record of mutating ops to prove
// existing keys are never touched on a blocked add.
let activeCount = 0;
const mutations = { update: 0, delete: 0, insert: 0 };

function makeBuilder() {
  const b: any = {
    select: () => b,
    eq: () => b,
    update: () => { mutations.update++; return b; },
    delete: () => { mutations.delete++; return b; },
    insert: () => { mutations.insert++; return b; },
    // Awaiting the count query resolves to { count }.
    then: (resolve: (v: { count: number }) => void) => resolve({ count: activeCount }),
  };
  return b;
}

vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from: () => makeBuilder() }),
}));

// The cap throws before these run on a blocked add; mock them so an accidental
// pass-through can't make a real network call during the under-cap test.
vi.mock('./provider-discovery', () => ({ discoverModels: vi.fn(async () => []) }));

import { createKey } from './byok-service';

beforeEach(() => {
  activeCount = 0;
  mutations.update = 0;
  mutations.delete = 0;
  mutations.insert = 0;
});

describe('BYOK key cap (2 per provider)', () => {
  it('blocks the 3rd key for a provider at the cap, bilingual marker for replace UX', async () => {
    activeCount = 2;
    await expect(
      createKey('user-1', 'anthropic', 'k3', 'sk-test'),
    ).rejects.toThrow(/Maximum 2 keys per provider \(max\. 2 Keys pro Anbieter\)/);
  });

  it('GRANDFATHER: user with 5 legacy keys is blocked from adding, existing rows untouched', async () => {
    activeCount = 5;
    await expect(
      createKey('user-1', 'openai', 'k6', 'sk-test'),
    ).rejects.toThrow(/Maximum 2 keys per provider/);
    // No row was revoked/updated/inserted — the legacy keys stay exactly as they are.
    expect(mutations.update).toBe(0);
    expect(mutations.delete).toBe(0);
    expect(mutations.insert).toBe(0);
  });

  it('passes the cap gate when under the limit (count < 2)', async () => {
    activeCount = 1;
    // Under the cap → the gate does NOT throw the cap error. It proceeds to key
    // validation (which fails for the fake key) — proving the cap let it through.
    await expect(
      createKey('user-1', 'anthropic', 'k2', 'sk-not-a-real-key'),
    ).rejects.not.toThrow(/Maximum 2 keys per provider/);
  });
});
