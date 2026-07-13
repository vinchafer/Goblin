// F-43 — search-augmented chat generation.
//
// Founder decision D-C ("build, don't hide"): when the user turns the "Websuche"
// toggle ON in a project chat, the send must ACTUALLY search — not narrate a
// decline, not append a placebo directive to a tool-less completion. Rather than
// build a parallel model-driven tool loop into the chat-completion path (a much
// larger change across every provider), this reuses the SAME hardened search
// service the agent's web_search tool uses: the provider resolution, the daily
// cap, and the per-user COGS accounting all live in ./index.ts. We run ONE real
// search, inject the real hits as context, and instruct the model to cite —
// deterministic search-augmented generation, capped like any other search.

import {
  resolveSearchProvider,
  remainingPlatformSearches,
  recordPlatformSearch,
  searchDailyCap,
} from './index';
import type { SearchResult } from './types';

export type ChatSearchReason = 'no_provider' | 'daily_cap' | 'search_failed' | 'empty';

export interface ChatSearchOutcome {
  /** True when a live search actually executed (regardless of hit count). */
  ran: boolean;
  query: string;
  results: SearchResult[];
  source?: 'user' | 'platform';
  /** Why no usable results — for honest UI/telemetry. Absent on a hit. */
  reason?: ChatSearchReason;
  /** Ready-to-inject system-context block (present only when there are hits). */
  contextBlock?: string;
}

/** One search per augmented send (project chat is not an agent run — no loop). */
const CHAT_SEARCH_RESULT_COUNT = 5;

/**
 * Build the injected context block. Mirrors the agent web_search tool's citation
 * contract verbatim so the model cites `Quelle: <url>` and never fabricates hits.
 */
export function buildSearchContextBlock(query: string, results: SearchResult[]): string {
  const hits = results
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
    .join('\n\n');
  return (
    `[Live-Websuche-Ergebnisse für „${query}" — echte Treffer. Nutze relevante Fakten ` +
    `daraus und zitiere die Quelle im Text als „Quelle: <url>". Erfinde niemals Treffer ` +
    `oder URLs; wenn nichts passt, sag das ehrlich.]\n\n${hits}`
  );
}

/**
 * Resolve → cap-check → search → format. Reuses the platform/BYOK provider stack
 * and the per-user daily cap. Never throws: a hard search failure degrades to
 * `ran:true, reason:'search_failed'` so the caller proceeds with a normal
 * completion instead of erroring the whole send.
 */
export async function runChatWebSearch(
  userId: string,
  rawQuery: string,
  signal?: AbortSignal,
): Promise<ChatSearchOutcome> {
  const query = (rawQuery ?? '').trim().slice(0, 400);
  if (!query) return { ran: false, query: '', results: [], reason: 'empty' };

  const resolved = await resolveSearchProvider(userId);
  if (!resolved) return { ran: false, query, results: [], reason: 'no_provider' };

  // Per-user daily cap — platform key only; the user's own BYOK key is exempt.
  if (!resolved.capExempt && remainingPlatformSearches(userId) <= 0) {
    return { ran: false, query, results: [], source: resolved.source, reason: 'daily_cap' };
  }

  // Consume the allowance BEFORE the call (mirrors the tool) so a flaky provider
  // can't be hammered past the cap.
  if (!resolved.capExempt) recordPlatformSearch(userId);

  let results: SearchResult[];
  try {
    results = await resolved.provider.search(query, { count: CHAT_SEARCH_RESULT_COUNT, signal });
  } catch {
    return { ran: true, query, results: [], source: resolved.source, reason: 'search_failed' };
  }

  if (results.length === 0) {
    return { ran: true, query, results: [], source: resolved.source, reason: 'empty' };
  }

  return {
    ran: true,
    query,
    results,
    source: resolved.source,
    contextBlock: buildSearchContextBlock(query, results),
  };
}

/** Human-readable cap note for the connectors nudge / honest UI, kept in one place. */
export function searchDailyCapNote(): string {
  return `Das tägliche Websuch-Kontingent (${searchDailyCap()}) ist aufgebraucht.`;
}
