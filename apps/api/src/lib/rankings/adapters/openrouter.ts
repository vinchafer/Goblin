import type { SourceAdapter, AdapterResult, RawAdapterEntry } from '../types';
import { canonicalize } from '../canonicalize';
import logger from '../../logger';

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  architecture?: { modality?: string };
  created?: number;
}

export const openRouterAdapter: SourceAdapter = {
  id: 'openrouter',
  async fetch(): Promise<AdapterResult> {
    const fetchedAt = new Date().toISOString();
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'user-agent': 'goblin-rankings/1.0' },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        return { sourceId: 'openrouter', fetchedAt, entries: [], error: `HTTP ${res.status}` };
      }
      const body = (await res.json()) as { data?: OpenRouterModel[] };
      const models: OpenRouterModel[] = body?.data ?? [];

      const entries: RawAdapterEntry[] = [];
      for (const m of models) {
        if (!m.id || !m.name) continue;
        const canonicalId = canonicalize(m.id);
        const provider = canonicalId.split('/')[0] ?? 'unknown';

        const priceIn = parseFloat(m.pricing?.prompt ?? '0') * 1_000_000;
        const priceOut = parseFloat(m.pricing?.completion ?? '0') * 1_000_000;

        entries.push({
          modelId: canonicalId,
          provider,
          displayName: m.name,
          scores: {
            'cost-efficiency': priceIn + priceOut > 0 ? 1 / ((priceIn + priceOut) / 2) : 0,
          },
          meta: {
            contextTokens: m.context_length,
            pricingInPerMillion: priceIn || undefined,
            pricingOutPerMillion: priceOut || undefined,
            releasedAt: m.created
              ? new Date(m.created * 1000).toISOString().slice(0, 10)
              : undefined,
          },
        });
      }

      logger.info({ count: entries.length }, 'openrouter adapter fetched');
      return { sourceId: 'openrouter', fetchedAt, entries };
    } catch (e) {
      logger.error({ error: (e as Error).message }, 'openrouter adapter failed');
      return { sourceId: 'openrouter', fetchedAt, entries: [], error: (e as Error).message };
    }
  },
};
