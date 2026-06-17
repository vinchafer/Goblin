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
// Rows the mocked `models` table returns. Tests can inject a stale goblin_hosted
// row to prove it is never surfaced (HR-1 leak guard).
let modelRows: unknown[] = [];
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from(table: string) {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        order: () => Promise.resolve({ data: table === 'models' ? modelRows : [] }),
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
  modelRows = [];
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

  it('a stale goblin_hosted DB row (e.g. "Qwen Coder 32B") is NEVER surfaced — HR-1 leak guard', async () => {
    userPlan = 'trial';
    // The pre-pivot seed row from migration 0009. If it leaked through, the browser
    // would see a Goblin-tier model carrying an underlying open-source model name.
    modelRows = [
      {
        id: 'qwen-coder-32b', name: 'Qwen Coder 32B', slug: 'qwen-coder-32b',
        provider: 'goblin', layer: 'goblin_hosted',
        description: 'Goblin-hosted. No key required.', tags: ['coding', 'hosted'],
        requires_key: false, available: false, phase: 3,
      },
    ];
    const catalog = await getCatalogForUser('u1');

    // The stale row is gone…
    expect(catalog.find((m) => m.slug === 'qwen-coder-32b')).toBeUndefined();
    expect(catalog.find((m) => m.name === 'Qwen Coder 32B')).toBeUndefined();
    // …and only the two canonical tiers carry the goblin_hosted layer.
    const hosted = catalog.filter((m) => m.layer === 'goblin_hosted');
    expect(hosted.map((m) => m.slug).sort()).toEqual(['goblin/efficient', 'goblin/premium']);
    // No underlying model name on the GOBLIN-TIER surface. (Scoped to goblin_hosted:
    // BYOK DeepSeek is a separate, legitimate user-facing provider — banning the word
    // globally would be wrong. HR-1 forbids the underlying name on the Goblin tier.)
    const hostedBlob = JSON.stringify(hosted).toLowerCase();
    expect(hostedBlob).not.toContain('qwen');
    expect(hostedBlob).not.toContain('deepseek');
    expect(hostedBlob).not.toContain('kimi');
    expect(hostedBlob).not.toContain('moonshot');
    expect(hostedBlob).not.toContain('deepinfra');
  });

  it('neither tier appears when the flag is OFF (no "(soon)" stub possible)', async () => {
    disableFlag();
    userPlan = 'trial';
    const catalog = await getCatalogForUser('u1');
    expect(catalog.find((m) => m.slug === 'goblin/efficient')).toBeUndefined();
    expect(catalog.find((m) => m.slug === 'goblin/premium')).toBeUndefined();
  });
});
