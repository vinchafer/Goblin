import type { SourceAdapter, AdapterResult, RawAdapterEntry } from '../types';
import { canonicalize } from '../canonicalize';
import logger from '../../logger';

const SWE_BENCH_URL = 'https://www.swebench.com/data/results.json';
const SWE_BENCH_GH_URL =
  'https://raw.githubusercontent.com/swe-bench/experiments/main/evaluation/verified/results.json';

interface SweBenchEntry {
  name?: string;
  model?: string;
  resolved?: number;
  total?: number;
  date?: string;
  is_verified?: boolean;
}

export const sweBenchAdapter: SourceAdapter = {
  id: 'swebench',
  async fetch(): Promise<AdapterResult> {
    const fetchedAt = new Date().toISOString();
    let data: SweBenchEntry[] = [];

    for (const url of [SWE_BENCH_URL, SWE_BENCH_GH_URL]) {
      try {
        const res = await fetch(url, {
          headers: { 'user-agent': 'goblin-rankings/1.0' },
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) continue;
        const body = (await res.json()) as unknown;
        if (Array.isArray(body)) data = body as SweBenchEntry[];
        else if (Array.isArray((body as { results?: unknown[] })?.results))
          data = (body as { results: SweBenchEntry[] }).results;
        else if (Array.isArray((body as { verified?: unknown[] })?.verified))
          data = (body as { verified: SweBenchEntry[] }).verified;
        if (data.length > 0) break;
      } catch (e) {
        logger.warn({ url, error: (e as Error).message }, 'swebench url failed');
      }
    }

    if (data.length === 0) {
      return { sourceId: 'swebench', fetchedAt, entries: [], error: 'no data' };
    }

    const entries: RawAdapterEntry[] = [];
    for (const e of data) {
      const modelName = e.model ?? e.name;
      if (!modelName) continue;
      if (e.resolved == null) continue;
      const canonicalId = canonicalize(modelName);
      const provider = canonicalId.split('/')[0] ?? 'unknown';

      entries.push({
        modelId: canonicalId,
        provider,
        displayName: modelName,
        scores: { coding: e.resolved },
        meta: {},
      });
    }

    logger.info({ count: entries.length }, 'swebench adapter fetched');
    return { sourceId: 'swebench', fetchedAt, entries };
  },
};
