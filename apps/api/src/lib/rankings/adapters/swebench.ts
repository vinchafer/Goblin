import type { SourceAdapter, AdapterResult, RawAdapterEntry } from '../types';
import { canonicalize } from '../canonicalize';
import logger from '../../logger';

// SWE-Bench publishes leaderboard data in the swe-bench.github.io repo
// under data/leaderboards.json. Confirmed via official README.
// Multiple leaderboards exist (Test, Lite, Verified, Multimodal) — we
// use Verified as the primary signal since it has manually-verified tasks
// (gold standard for SWE benchmarks). Lite is a subset, Test is dev-only.
const SWE_BENCH_URL =
  'https://raw.githubusercontent.com/SWE-bench/swe-bench.github.io/master/data/leaderboards.json';

const PRIMARY_LEADERBOARD = 'Verified';

interface SweBenchResult {
  name: string;
  folder?: string;
  resolved?: number;
  date?: string;
  logs?: boolean;
  trajs?: boolean;
  site?: string;
}

interface SweBenchLeaderboard {
  name: string;
  results: SweBenchResult[];
}

interface SweBenchResponse {
  leaderboards: SweBenchLeaderboard[];
}

/**
 * Extract a clean model name from SWE-Bench's combined model+scaffolding name.
 *
 * Examples:
 *   "Trae (Claude 3.7 Sonnet)" → "Claude 3.7 Sonnet"
 *   "SWE-agent + Claude 3.5 Sonnet" → "Claude 3.5 Sonnet"
 *   "OpenHands + DeepSeek V3" → "DeepSeek V3"
 *   "Claude 3.5 Sonnet" → "Claude 3.5 Sonnet"
 */
function extractModelName(combined: string): string | null {
  if (!combined) return null;

  const parens = combined.match(/\(([^)]+)\)/);
  if (parens) return parens[1].trim();

  const plusSplit = combined.split('+');
  if (plusSplit.length > 1) return plusSplit[plusSplit.length - 1].trim();

  return combined.trim();
}

/**
 * Aggregate multiple scaffolding-based entries for the same underlying LLM
 * by taking the maximum resolved percentage. Rationale: the best scaffold-
 * agnostic measure of an LLM's SWE capability is its best showing.
 */
function aggregateByModel(results: SweBenchResult[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const r of results) {
    if (r.resolved == null) continue;
    const modelName = extractModelName(r.name);
    if (!modelName) continue;
    const current = best.get(modelName) ?? 0;
    if (r.resolved > current) best.set(modelName, r.resolved);
  }
  return best;
}

export const sweBenchAdapter: SourceAdapter = {
  id: 'swebench',
  async fetch(): Promise<AdapterResult> {
    const fetchedAt = new Date().toISOString();

    try {
      const res = await fetch(SWE_BENCH_URL, {
        headers: { 'user-agent': 'goblin-rankings/1.0' },
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        return { sourceId: 'swebench', fetchedAt, entries: [], error: `HTTP ${res.status}` };
      }

      const body = (await res.json()) as SweBenchResponse;
      if (!Array.isArray(body?.leaderboards)) {
        return {
          sourceId: 'swebench',
          fetchedAt,
          entries: [],
          error: 'unexpected response shape — missing leaderboards array',
        };
      }

      const verified = body.leaderboards.find((lb) => lb.name === PRIMARY_LEADERBOARD);
      if (!verified) {
        return {
          sourceId: 'swebench',
          fetchedAt,
          entries: [],
          error: `${PRIMARY_LEADERBOARD} leaderboard not found in response. Available: ${body.leaderboards.map((l) => l.name).join(', ')}`,
        };
      }

      const aggregated = aggregateByModel(verified.results ?? []);

      const entries: RawAdapterEntry[] = [];
      for (const [modelName, resolved] of aggregated.entries()) {
        const canonicalId = canonicalize(modelName);
        const provider = canonicalId.split('/')[0] ?? 'unknown';

        entries.push({
          modelId: canonicalId,
          provider,
          displayName: modelName,
          scores: {
            coding: resolved,
          },
          meta: {},
        });
      }

      logger.info(
        {
          count: entries.length,
          leaderboard: PRIMARY_LEADERBOARD,
          totalRawResults: verified.results?.length ?? 0,
        },
        'swebench adapter fetched',
      );

      return { sourceId: 'swebench', fetchedAt, entries };
    } catch (e) {
      logger.error({ error: (e as Error).message }, 'swebench adapter failed');
      return {
        sourceId: 'swebench',
        fetchedAt,
        entries: [],
        error: (e as Error).message,
      };
    }
  },
};
