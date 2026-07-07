// FEEL-4 F4.3 gate (deterministic half): the web_search tool through the executor.
// Proves the adapter is provider-AGNOSTIC (a mock second provider drives it, not
// Brave), the per-run cap and per-user daily cap are enforced, user-key searches are
// cap-exempt, and an unconfigured run has no search capability. The live Brave probe
// (6.4) is evidenced separately in _sprint/feel-4.

import { describe, it, expect, beforeEach } from 'vitest';
import { buildToolExecutor } from './tools';
import { __resetSearchCountsForTest } from '../search';
import type { SearchProvider, SearchResult, ResolvedSearch } from '../search';
import type { ToolContext } from './types';

// web_search never touches the DB — a stub sb keeps buildToolExecutor from
// constructing a real Supabase client (which needs env) in these unit tests.
const stubSb = {} as never;

// A mock provider implementing the SAME interface as Brave — this is the "prove the
// interface" second provider the spec asks for. Swapping providers is a config change.
function mockProvider(results: SearchResult[], calls: string[] = []): SearchProvider {
  return {
    name: 'mock',
    async search(query) {
      calls.push(query);
      return results;
    },
  };
}

const ctx: ToolContext = { userId: 'user-1', projectId: 'proj-1', sessionId: 'sess-1' };
const hit: SearchResult = { title: 'Tailwind v4', url: 'https://tailwindcss.com', snippet: 'stable release' };
const call = (query: string) => ({ id: 'c1', name: 'web_search', args: { query } });

beforeEach(() => __resetSearchCountsForTest());

describe('F4.3 — web_search adapter is provider-agnostic', () => {
  it('returns structured hits from ANY SearchProvider (mock, not Brave)', async () => {
    const calls: string[] = [];
    const search: ResolvedSearch = { provider: mockProvider([hit], calls), source: 'platform', capExempt: false };
    const exec = buildToolExecutor(stubSb, { search });
    const res = await exec(call('current stable Tailwind version'), ctx);
    expect(res.ok).toBe(true);
    expect((res.data as { results: SearchResult[] }).results[0].url).toBe('https://tailwindcss.com');
    expect(calls).toEqual(['current stable Tailwind version']);
  });

  it('has no search capability when no provider is configured', async () => {
    const exec = buildToolExecutor(stubSb, { search: null });
    const res = await exec(call('anything'), ctx);
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('search_unavailable');
  });
});

describe('F4.3 — caps', () => {
  it('enforces the per-run cap (default max), honest error after it', async () => {
    const search: ResolvedSearch = { provider: mockProvider([hit]), source: 'platform', capExempt: false };
    const exec = buildToolExecutor(stubSb, { search, maxSearchesPerRun: 3 });
    for (let i = 0; i < 3; i++) expect((await exec(call(`q${i}`), ctx)).ok).toBe(true);
    const over = await exec(call('q4'), ctx);
    expect(over.ok).toBe(false);
    expect(over.error?.code).toBe('search_run_cap');
  });

  it('enforces the per-user daily cap for platform searches', async () => {
    // A fresh executor per "run" so the per-run cap never masks the daily cap.
    const make = () => buildToolExecutor(stubSb, {
      search: { provider: mockProvider([hit]), source: 'platform', capExempt: false },
      maxSearchesPerRun: 100,
    });
    process.env.SEARCH_DAILY_CAP = '2';
    expect((await make()(call('a'), ctx)).ok).toBe(true);
    expect((await make()(call('b'), ctx)).ok).toBe(true);
    const capped = await make()(call('c'), ctx);
    expect(capped.ok).toBe(false);
    expect(capped.error?.code).toBe('search_daily_cap');
    delete process.env.SEARCH_DAILY_CAP;
  });

  it('user-key searches are cap-exempt (never hit the daily cap)', async () => {
    process.env.SEARCH_DAILY_CAP = '1';
    const make = () => buildToolExecutor(stubSb, {
      search: { provider: mockProvider([hit]), source: 'user', capExempt: true },
      maxSearchesPerRun: 100,
    });
    for (let i = 0; i < 5; i++) expect((await make()(call(`u${i}`), ctx)).ok).toBe(true);
    delete process.env.SEARCH_DAILY_CAP;
  });
});
