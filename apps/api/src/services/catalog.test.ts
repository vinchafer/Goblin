/**
 * Catalog — Goblin-bundled (Layer 2) availability (SESSION 5, model-"(soon)" fix).
 *
 * Regression guard for the founder-walk blocker: when the server flag is on, the
 * two Goblin tiers must come back from `getCatalogForUser` as SELECTABLE
 * (`available: true`) for EVERY account state — trial, paid, and the anomalous
 * null/unset plan that previously fell through the plan-string gate and rendered
 * the tier greyed + "(soon)". The flag is the only gate; when it is off, neither
 * tier appears at all (so a stale UI can never imply a live cap).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the heavy deps so the catalog read is deterministic and offline.
vi.mock('./byok-service', () => ({
  listKeys: vi.fn(async () => []),
  getDiscoveredModelsByProvider: vi.fn(async () => ({}) as Record<string, string[]>),
}));

let userPlan: unknown = 'trial';
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from(table: string) {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        order: () => Promise.resolve({ data: [] }), // models table → no cache rows
        single: () =>
          Promise.resolve(
            table === 'users' ? { data: { plan: userPlan } } : { data: null },
          ),
      };
      return chain;
    },
  }),
}));

import { getCatalogForUser } from './catalog';

const ORIGINAL = process.env.GOBLIN_HOSTED_API;
function enableFlag() { process.env.GOBLIN_HOSTED_API = 'true'; }
function disableFlag() { process.env.GOBLIN_HOSTED_API = 'false'; }

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.GOBLIN_HOSTED_API;
  else process.env.GOBLIN_HOSTED_API = ORIGINAL;
  vi.clearAllMocks();
});

describe('catalog — Goblin Layer 2 availability', () => {
  beforeEach(enableFlag);

  for (const plan of ['trial', 'build', 'pro', 'power', null, '', 'comped'] as const) {
    it(`both tiers are SELECTABLE (available:true) on a ${JSON.stringify(plan)} plan`, async () => {
      userPlan = plan;
      const catalog = await getCatalogForUser('u1');
      const swift = catalog.find((m) => m.slug === 'goblin/efficient');
      const forge = catalog.find((m) => m.slug === 'goblin/premium');

      expect(swift, 'Goblin Swift present').toBeTruthy();
      expect(forge, 'Goblin Forge present').toBeTruthy();
      expect(swift!.available).toBe(true);
      expect(forge!.available).toBe(true);
      expect(swift!.layer).toBe('goblin_hosted');
      expect(forge!.requires_key).toBe(false);

      // Two-level truth: the user-facing surface never leaks the provider/slug.
      const blob = JSON.stringify([swift, forge]).toLowerCase();
      expect(blob).not.toContain('deepseek');
      expect(blob).not.toContain('kimi');
      expect(blob).not.toContain('deepinfra');
      expect(blob).not.toContain('moonshot');
    });
  }

  it('neither tier appears when the flag is OFF (no "(soon)" stub possible)', async () => {
    disableFlag();
    userPlan = 'trial';
    const catalog = await getCatalogForUser('u1');
    expect(catalog.find((m) => m.slug === 'goblin/efficient')).toBeUndefined();
    expect(catalog.find((m) => m.slug === 'goblin/premium')).toBeUndefined();
  });
});
