/**
 * Catalog — free_api advertising gate (DD §C / F5-1).
 *
 * The free pool is OFF by design (`FREE_API_POOL = []` in model-router) but the
 * static/DB sources still mark the `free_api` rows `available:true`. Before the fix
 * the picker advertised "Gemini 2.0 Flash · FREE" / "Llama 3.3 70B · FREE" — selecting
 * one couldn't route (`resolveFreeApi()` → null) and silently substituted. The fix
 * gates the `free_api` push in the catalog on the live pool flag, so:
 *   • pool OFF  → no free_api rows surface (no mislabel),
 *   • pool ON   → they return from the same single source,
 * and a keyless user still has the live Goblin Swift tier as a real default.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('./byok-service', () => ({
  listKeys: vi.fn(async () => []), // keyless user
  getDiscoveredModelsByProvider: vi.fn(async () => ({}) as Record<string, string[]>),
}));

let userPlan: unknown = 'trial';
let modelRows: unknown[] = [];
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from(table: string) {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        order: () => Promise.resolve({ data: table === 'models' ? modelRows : [] }),
        single: () =>
          Promise.resolve(table === 'users' ? { data: { plan: userPlan } } : { data: null }),
      };
      return chain;
    },
  }),
}));

// The lever under test — flip the free pool without a non-empty FREE_API_POOL.
let poolOn = false;
vi.mock('./model-router', () => ({ isFreeApiPoolEnabled: () => poolOn }));

import { getCatalogForUser } from './catalog';

const FREE_ROW = {
  id: 'gemini-2-flash', name: 'Gemini 2.0 Flash', slug: 'free/gemini-flash',
  provider: 'google', layer: 'free_api', description: 'Free tier.', tags: [],
  requires_key: false, available: true, phase: 1,
};

const ORIGINAL = process.env.GOBLIN_HOSTED_API;
beforeEach(() => { process.env.GOBLIN_HOSTED_API = 'true'; poolOn = false; userPlan = 'trial'; modelRows = []; });
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.GOBLIN_HOSTED_API;
  else process.env.GOBLIN_HOSTED_API = ORIGINAL;
  vi.clearAllMocks();
});

describe('catalog — free_api advertising gate (F5-1)', () => {
  it('hides every free_api row while the pool is OFF (no silent-substitution mislabel)', async () => {
    poolOn = false;
    modelRows = [FREE_ROW];
    const catalog = await getCatalogForUser('u1');
    expect(catalog.find((m) => m.slug === 'free/gemini-flash')).toBeUndefined();
    expect(catalog.some((m) => m.layer === 'free_api')).toBe(false);
    expect(catalog.some((m) => m.badge === 'FREE')).toBe(false);
  });

  it('restores free_api rows when the pool is flipped ON (same single source)', async () => {
    poolOn = true;
    modelRows = [FREE_ROW];
    const catalog = await getCatalogForUser('u1');
    const free = catalog.find((m) => m.slug === 'free/gemini-flash');
    expect(free, 'free row surfaces when pool live').toBeTruthy();
    expect(free!.badge).toBe('FREE');
    expect(free!.layer).toBe('free_api');
  });

  it('keyless default: Goblin Swift is an available real tier while the pool is OFF', async () => {
    // modelRows empty → exercises the real static FREE_API_MODELS source too; the
    // gate must hold there as well, while Goblin Swift stays selectable as the wedge.
    poolOn = false;
    modelRows = [];
    const catalog = await getCatalogForUser('u1');
    const swift = catalog.find((m) => m.slug === 'goblin/efficient');
    expect(swift, 'Goblin Swift present').toBeTruthy();
    expect(swift!.available).toBe(true);
    expect(swift!.layer).toBe('goblin_hosted');
    expect(catalog.some((m) => m.layer === 'free_api')).toBe(false);
  });
});
