/**
 * LiveBench Adapter — DISABLED as of 2026-05-18 (Session 10).
 *
 * Reason: LiveBench does not provide an official data export.
 * See: https://github.com/LiveBench/LiveBench/issues/82
 *
 * The aggregator skips this adapter when model_sources.enabled = false
 * (set by migration 0041_disable_livebench.sql). The code below stays
 * as a skeleton for future re-enable.
 *
 * To re-enable:
 * 1. Verify LiveBench publishes an official JSON/CSV endpoint
 * 2. Update the URL constants and parsing logic
 * 3. Set model_sources.enabled = true via SQL migration
 */
import type { SourceAdapter, AdapterResult, RawAdapterEntry } from '../types';
import { canonicalize } from '../canonicalize';
import logger from '../../logger';

const LIVEBENCH_URL_PRIMARY =
  'https://raw.githubusercontent.com/livebench/livebench/main/livebench/leaderboard_full.json';
const LIVEBENCH_URL_FALLBACK =
  'https://raw.githubusercontent.com/livebench/livebench/main/data/leaderboard.json';

interface LiveBenchEntry {
  model: string;
  organization?: string;
  global_average?: number;
  reasoning_average?: number;
  coding_average?: number;
  mathematics_average?: number;
  data_analysis_average?: number;
  language_average?: number;
  if_average?: number;
}

export const liveBenchAdapter: SourceAdapter = {
  id: 'livebench',
  async fetch(): Promise<AdapterResult> {
    const fetchedAt = new Date().toISOString();
    let raw: LiveBenchEntry[] = [];

    for (const url of [LIVEBENCH_URL_PRIMARY, LIVEBENCH_URL_FALLBACK]) {
      try {
        const res = await fetch(url, {
          headers: { 'user-agent': 'goblin-rankings/1.0' },
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) continue;
        const body = (await res.json()) as unknown;
        if (Array.isArray(body)) raw = body as LiveBenchEntry[];
        else if (Array.isArray((body as { data?: unknown[] })?.data))
          raw = (body as { data: LiveBenchEntry[] }).data;
        else if (Array.isArray((body as { leaderboard?: unknown[] })?.leaderboard))
          raw = (body as { leaderboard: LiveBenchEntry[] }).leaderboard;
        if (raw.length > 0) break;
      } catch (e) {
        logger.warn({ url, error: (e as Error).message }, 'livebench url failed');
      }
    }

    if (raw.length === 0) {
      return { sourceId: 'livebench', fetchedAt, entries: [], error: 'no data from any livebench URL' };
    }

    const entries: RawAdapterEntry[] = [];
    for (const e of raw) {
      if (!e.model) continue;
      const canonicalId = canonicalize(e.model);
      const provider = canonicalId.split('/')[0] ?? 'unknown';
      entries.push({
        modelId: canonicalId,
        provider,
        displayName: e.model,
        scores: {
          overall: e.global_average,
          reasoning: e.reasoning_average,
          coding: e.coding_average,
          math: e.mathematics_average,
          'instruction-following': e.if_average,
        },
        meta: {},
      });
    }

    logger.info({ count: entries.length }, 'livebench adapter fetched');
    return { sourceId: 'livebench', fetchedAt, entries };
  },
};
