// F4.3 (feel-4) — provider-agnostic web-search adapter.
//
// The agent's web_search tool talks ONLY to this interface, never to a concrete
// provider. Brave is the first implementation (createBraveProvider); swapping to a
// different search API later is a config change (a new SearchProvider impl + one
// line in the factory), not a rebuild — the "dependency insurance" the founder asked
// for, applied to search the same way the model router applies it to models.

/** One search hit, normalized across providers. */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** A concrete search backend. Implementations must normalize to SearchResult[]. */
export interface SearchProvider {
  /** Stable id for logs/telemetry, e.g. 'brave'. */
  readonly name: string;
  /**
   * Run a query. `count` is an upper bound on results; the provider may return fewer.
   * Throws on a hard failure (network / auth / quota) — the tool layer turns that into
   * an honest structured tool error, never a fabricated result.
   */
  search(query: string, opts?: { count?: number; signal?: AbortSignal }): Promise<SearchResult[]>;
}
