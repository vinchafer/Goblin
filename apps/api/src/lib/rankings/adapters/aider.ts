import yaml from 'js-yaml';
import type { SourceAdapter, AdapterResult, RawAdapterEntry } from '../types';
import { canonicalize } from '../canonicalize';
import logger from '../../logger';

interface AiderEntry {
  model: string;
  pass_rate_1?: number;
  pass_rate_2?: number;
  percent_cases_well_formed?: number;
  total_cost?: number;
}

const AIDER_URL =
  'https://raw.githubusercontent.com/Aider-AI/aider/main/aider/website/_data/polyglot_leaderboard.yml';

export const aiderAdapter: SourceAdapter = {
  id: 'aider',
  async fetch(): Promise<AdapterResult> {
    const fetchedAt = new Date().toISOString();
    try {
      const res = await fetch(AIDER_URL, {
        headers: { 'user-agent': 'goblin-rankings/1.0' },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        return { sourceId: 'aider', fetchedAt, entries: [], error: `HTTP ${res.status}` };
      }
      const text = await res.text();
      const parsed = yaml.load(text) as AiderEntry[] | null;
      if (!Array.isArray(parsed)) {
        return { sourceId: 'aider', fetchedAt, entries: [], error: 'unexpected format' };
      }

      const entries: RawAdapterEntry[] = [];
      for (const e of parsed) {
        if (!e.model) continue;
        const canonicalId = canonicalize(e.model);
        const provider = canonicalId.split('/')[0] ?? 'unknown';

        const codingScore = e.pass_rate_2 ?? e.pass_rate_1 ?? null;
        if (codingScore === null) continue;

        entries.push({
          modelId: canonicalId,
          provider,
          displayName: e.model,
          scores: {
            coding: codingScore,
            'instruction-following': e.percent_cases_well_formed ?? undefined,
          },
          meta: {},
        });
      }

      logger.info({ count: entries.length }, 'aider adapter fetched');
      return { sourceId: 'aider', fetchedAt, entries };
    } catch (e) {
      logger.error({ error: (e as Error).message }, 'aider adapter failed');
      return { sourceId: 'aider', fetchedAt, entries: [], error: (e as Error).message };
    }
  },
};
