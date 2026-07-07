// F4.3 — Brave Search implementation of the SearchProvider interface.
//
// Brave Web Search REST API: simple GET with an X-Subscription-Token header. Free
// tier ~2k queries/mo. The key is provided by the caller (platform env key OR a
// user's own BYOK key) — this impl is key-agnostic, which is what lets the same
// adapter serve both the bundled platform default and the user-key connector.

import type { SearchProvider, SearchResult } from './types';

const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const DEFAULT_TIMEOUT_MS = 8000;

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
}
interface BraveResponse {
  web?: { results?: BraveWebResult[] };
}

/** Strip Brave's <strong> highlight tags and collapse whitespace in snippets. */
function cleanSnippet(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export function createBraveProvider(apiKey: string): SearchProvider {
  return {
    name: 'brave',
    async search(query, opts): Promise<SearchResult[]> {
      const count = Math.min(Math.max(1, opts?.count ?? 5), 10);
      const url = `${BRAVE_ENDPOINT}?q=${encodeURIComponent(query)}&count=${count}`;

      // Own timeout so a hung provider can't stall the agent run; compose with the
      // run's abort signal when present.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      const onAbort = () => controller.abort();
      if (opts?.signal) {
        if (opts.signal.aborted) controller.abort();
        else opts.signal.addEventListener('abort', onAbort, { once: true });
      }

      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': apiKey,
          },
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`Brave Search HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
        }
        const json = (await res.json()) as BraveResponse;
        const results = json.web?.results ?? [];
        return results
          .filter((r) => r.url && r.title)
          .slice(0, count)
          .map((r) => ({
            title: (r.title ?? '').trim(),
            url: (r.url ?? '').trim(),
            snippet: cleanSnippet(r.description ?? ''),
          }));
      } finally {
        clearTimeout(timeout);
        opts?.signal?.removeEventListener('abort', onAbort);
      }
    },
  };
}
