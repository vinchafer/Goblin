// F-43 (FIX-WAVE 2) GATE — search-augmented chat generation.
//
// The "Websuche" toggle now routes a project/base-chat send through the REAL
// search service instead of a placebo directive. These deterministic probes lock
// the contract that makes it non-phantom: it resolves a provider, honours the
// per-user daily cap (platform only; BYOK exempt), degrades honestly on failure,
// and formats real hits with the citation instruction. The live-model "cites a
// source" step is the founder's prod-verbatim gate (post-merge).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SearchResult } from './types';

// Control the underlying search service. augment.ts talks only to ./index — the
// same hardened layer the agent's web_search tool uses.
const mocks = vi.hoisted(() => ({
  resolveSearchProvider: vi.fn(),
  remainingPlatformSearches: vi.fn(),
  recordPlatformSearch: vi.fn(),
  searchDailyCap: vi.fn(() => 25),
}));

vi.mock('./index', () => mocks);

import { runChatWebSearch, buildSearchContextBlock } from './augment';

const hits: SearchResult[] = [
  { title: 'Tailwind CSS', url: 'https://tailwindcss.com', snippet: 'v4 is the current stable release.' },
  { title: 'Release notes', url: 'https://github.com/tailwindlabs/tailwindcss/releases', snippet: 'Latest tags.' },
];

function platformProvider(search: () => Promise<SearchResult[]>) {
  return { provider: { name: 'brave', search: vi.fn(search) }, source: 'platform' as const, capExempt: false };
}

describe('runChatWebSearch', () => {
  beforeEach(() => {
    mocks.resolveSearchProvider.mockReset();
    mocks.remainingPlatformSearches.mockReset().mockReturnValue(25);
    mocks.recordPlatformSearch.mockReset();
  });

  it('no provider configured → ran:false, reason no_provider (honest, no phantom)', async () => {
    mocks.resolveSearchProvider.mockResolvedValue(null);
    const r = await runChatWebSearch('u1', 'aktuelle tailwind version');
    expect(r.ran).toBe(false);
    expect(r.reason).toBe('no_provider');
    expect(mocks.recordPlatformSearch).not.toHaveBeenCalled();
  });

  it('runs a real search and returns a citation-instructing context block', async () => {
    mocks.resolveSearchProvider.mockResolvedValue(platformProvider(async () => hits));
    const r = await runChatWebSearch('u1', 'Welche stabile Tailwind-Version ist aktuell?');
    expect(r.ran).toBe(true);
    expect(r.results).toHaveLength(2);
    expect(r.contextBlock).toContain('Quelle: <url>');
    expect(r.contextBlock).toContain('https://tailwindcss.com');
    expect(mocks.recordPlatformSearch).toHaveBeenCalledWith('u1'); // platform → consumes cap
  });

  it('enforces the daily cap on the platform key (no search when exhausted)', async () => {
    mocks.remainingPlatformSearches.mockReturnValue(0);
    const prov = platformProvider(async () => hits);
    mocks.resolveSearchProvider.mockResolvedValue(prov);
    const r = await runChatWebSearch('u1', 'x');
    expect(r.ran).toBe(false);
    expect(r.reason).toBe('daily_cap');
    expect(prov.provider.search).not.toHaveBeenCalled();
    expect(mocks.recordPlatformSearch).not.toHaveBeenCalled();
  });

  it('a BYOK (user) key is cap-exempt and never consumes the platform allowance', async () => {
    mocks.remainingPlatformSearches.mockReturnValue(0); // platform is exhausted…
    mocks.resolveSearchProvider.mockResolvedValue({
      provider: { name: 'brave', search: vi.fn(async () => hits) },
      source: 'user', capExempt: true,
    });
    const r = await runChatWebSearch('u1', 'x'); // …but the user's own key still works
    expect(r.ran).toBe(true);
    expect(r.results).toHaveLength(2);
    expect(mocks.recordPlatformSearch).not.toHaveBeenCalled();
  });

  it('a provider failure degrades honestly (ran:true, search_failed) — never breaks the send', async () => {
    mocks.resolveSearchProvider.mockResolvedValue(platformProvider(async () => { throw new Error('brave 429'); }));
    const r = await runChatWebSearch('u1', 'x');
    expect(r.ran).toBe(true);
    expect(r.reason).toBe('search_failed');
    expect(r.contextBlock).toBeUndefined();
  });

  it('zero hits → ran:true, reason empty, no injected block', async () => {
    mocks.resolveSearchProvider.mockResolvedValue(platformProvider(async () => []));
    const r = await runChatWebSearch('u1', 'nichtsdergefundenwird');
    expect(r.ran).toBe(true);
    expect(r.reason).toBe('empty');
    expect(r.contextBlock).toBeUndefined();
  });

  it('an empty query never touches the provider', async () => {
    const r = await runChatWebSearch('u1', '   ');
    expect(r.ran).toBe(false);
    expect(r.reason).toBe('empty');
    expect(mocks.resolveSearchProvider).not.toHaveBeenCalled();
  });
});

describe('buildSearchContextBlock', () => {
  it('numbers hits and demands citation, never fabrication', () => {
    const block = buildSearchContextBlock('tailwind', hits);
    expect(block).toContain('1. Tailwind CSS');
    expect(block).toContain('2. Release notes');
    expect(block).toMatch(/Erfinde niemals Treffer/);
    expect(block).toContain('Quelle: <url>');
  });
});
