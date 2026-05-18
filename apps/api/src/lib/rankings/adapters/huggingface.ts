import type { SourceAdapter, AdapterResult, RawAdapterEntry } from '../types';
import { canonicalize } from '../canonicalize';
import logger from '../../logger';

const HF_API_BASE =
  'https://datasets-server.huggingface.co/rows?dataset=open-llm-leaderboard%2Fcontents&config=default&split=train&length=100';

interface HfRow {
  row: {
    eval_name?: string;
    Model?: string;
    'Average ⬆️'?: number;
    IFEval?: number;
    BBH?: number;
    'MATH Lvl 5'?: number;
    GPQA?: number;
    MUSR?: number;
    'MMLU-PRO'?: number;
    [k: string]: unknown;
  };
}

export const huggingFaceAdapter: SourceAdapter = {
  id: 'hf',
  async fetch(): Promise<AdapterResult> {
    const fetchedAt = new Date().toISOString();
    const entries: RawAdapterEntry[] = [];

    for (let offset = 0; offset < 500; offset += 100) {
      const url = `${HF_API_BASE}&offset=${offset}`;
      try {
        const res = await fetch(url, {
          headers: { 'user-agent': 'goblin-rankings/1.0' },
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          if (offset === 0) {
            return { sourceId: 'hf', fetchedAt, entries: [], error: `HTTP ${res.status}` };
          }
          break;
        }
        const body = (await res.json()) as { rows?: HfRow[] };
        const rows: HfRow[] = body?.rows ?? [];
        if (rows.length === 0) break;

        for (const r of rows) {
          const modelName = r.row.Model ?? r.row.eval_name;
          if (!modelName) continue;
          const cleanName = String(modelName).replace(/<[^>]+>/g, '').trim();
          if (!cleanName) continue;
          const canonicalId = canonicalize(cleanName);
          const provider = canonicalId.split('/')[0] ?? 'unknown';

          entries.push({
            modelId: canonicalId,
            provider,
            displayName: cleanName,
            scores: {
              overall: r.row['Average ⬆️'],
              reasoning: r.row['BBH'],
              math: r.row['MATH Lvl 5'],
              'instruction-following': r.row['IFEval'],
            },
            meta: { isOpenSource: true },
          });
        }
        if (rows.length < 100) break;
      } catch (e) {
        logger.warn({ offset, error: (e as Error).message }, 'hf adapter page failed');
        break;
      }
    }

    logger.info({ count: entries.length }, 'huggingface adapter fetched');
    return { sourceId: 'hf', fetchedAt, entries };
  },
};
