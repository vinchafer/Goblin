import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { listKeys, getActiveKey } from '../services/byok-service';
import { ByokProviderSchema } from '@goblin/shared/src/schemas';
import { getCatalogForUser } from '../services/catalog';

type Variables = { userId: string };
const models = new Hono<{ Variables: Variables }>();

models.use('*', authMiddleware);

// 30-second server-side model list cache (per user)
const modelCache = new Map<string, { data: unknown[]; ts: number }>();
const MODEL_CACHE_TTL = 30_000;

// 5-minute credits cache
const creditsCache = new Map<string, { data: unknown; ts: number }>();
const CREDITS_CACHE_TTL = 5 * 60_000;

// GET /api/models — user-aware model list with BYOK + availability filtering
models.get('/', async (c) => {
  const userId = c.get('userId');

  // Cache check
  const cached = modelCache.get(userId);
  if (cached && Date.now() - cached.ts < MODEL_CACHE_TTL) {
    return c.json(cached.data);
  }

  // 10.8-3: catalog read path lives in services/catalog.ts. The models table is
  // a cache (synced from LiteLLM) intersected with each user's discovered BYOK
  // models; static providers.ts is the last-resort fallback inside getCatalogForUser.
  const annotated = await getCatalogForUser(userId);

  modelCache.set(userId, { data: annotated, ts: Date.now() });
  return c.json(annotated);
});

// GET /api/models/health — 10.9-3 per-provider circuit-breaker state. Only
// returns providers that are NOT healthy (empty object = all good), so the
// ModelPicker can badge a degraded provider.
models.get('/health', async (c) => {
  const { getHealthMap } = await import('../services/provider-health');
  return c.json(getHealthMap());
});

// GET /api/models/status — BYOK key status + free API availability
models.get('/status', async (c) => {
  const userId = c.get('userId');
  try {
    const supabase = getSupabaseAdmin();
    const keys = await listKeys(userId);

    const byokProviders = ['anthropic', 'openai', 'google', 'groq', 'mistral', 'deepseek', 'xai', 'together', 'fireworks', 'openrouter'] as const;
    const byok: Record<string, boolean> = {};
    for (const provider of byokProviders) {
      byok[provider] = keys.some(k => k.provider === provider && k.status === 'active');
    }

    const { data: freeApiData } = await supabase
      .from('free_api_usage')
      .select('provider, used_today, daily_limit')
      .eq('user_id', userId);

    const freeApi: Record<string, { available: boolean; usedToday: number; limit: number }> = {
      gemini: { available: true, usedToday: 0, limit: 50 },
      groq:   { available: true, usedToday: 0, limit: 50 },
    };

    if (freeApiData) {
      for (const row of freeApiData) {
        if (row.provider === 'gemini' || row.provider === 'groq') {
          freeApi[row.provider] = {
            available: row.used_today < row.daily_limit,
            usedToday: row.used_today,
            limit: row.daily_limit,
          };
        }
      }
    }

    return c.json({ byok, freeApi });
  } catch {
    return c.json({ error: 'Failed to fetch model status' }, 500);
  }
});

// GET /api/models/:provider/credits — cached live credit check
models.get('/:provider/credits', async (c) => {
  const userId = c.get('userId');
  const rawProvider = c.req.param('provider');
  const providerParsed = ByokProviderSchema.safeParse(rawProvider);
  if (!providerParsed.success) return c.json({ error: 'Invalid provider' }, 400);
  const provider = providerParsed.data;

  const cacheKey = `${userId}:${provider}`;
  const cached = creditsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CREDITS_CACHE_TTL) {
    return c.json(cached.data);
  }

  try {
    const key = await getActiveKey(userId, provider);
    if (!key) {
      return c.json({ supported: false, link: getProviderLink(provider) });
    }

    let result: { supported: boolean; remaining?: string; credits?: number; link?: string };
    const signal = AbortSignal.timeout(4000);

    switch (provider) {
      case 'anthropic': {
        // Anthropic: no public balance endpoint, just verify key works
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 1, messages: [{ role: 'user', content: '.' }] }),
          signal,
        });
        result = res.ok || res.status === 400
          ? { supported: true, remaining: 'Active' }
          : { supported: false, link: 'https://console.anthropic.com/settings/billing' };
        break;
      }

      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/dashboard/billing/subscription', {
          headers: { Authorization: `Bearer ${key}` },
          signal,
        });
        if (res.ok) {
          const data = await res.json() as { hard_limit_usd?: number; soft_limit_usd?: number };
          const remaining = data.hard_limit_usd
            ? `$${(data.hard_limit_usd - (data.soft_limit_usd ?? 0)).toFixed(2)} remaining`
            : 'Active';
          result = { supported: true, remaining };
        } else {
          result = { supported: false, link: 'https://platform.openai.com/usage' };
        }
        break;
      }

      case 'mistral': {
        const res = await fetch('https://api.mistral.ai/v1/users/me', {
          headers: { Authorization: `Bearer ${key}` },
          signal,
        });
        result = res.ok
          ? { supported: true, remaining: 'Active' }
          : { supported: false, link: 'https://console.mistral.ai/billing' };
        break;
      }

      default:
        result = { supported: false, link: getProviderLink(provider) };
    }

    creditsCache.set(cacheKey, { data: result, ts: Date.now() });
    return c.json(result);
  } catch {
    return c.json({ supported: false });
  }
});

// Invalidate model cache when user adds/removes key
export function invalidateModelCache(userId: string) {
  modelCache.delete(userId);
}

function getProviderLink(provider: string): string {
  const links: Record<string, string> = {
    anthropic:  'https://console.anthropic.com/settings/billing',
    openai:     'https://platform.openai.com/usage',
    google:     'https://aistudio.google.com/app/apikey',
    groq:       'https://console.groq.com/keys',
    mistral:    'https://console.mistral.ai/billing',
    deepseek:   'https://platform.deepseek.com/api_keys',
    xai:        'https://console.x.ai/',
    together:   'https://api.together.xyz/settings/api-keys',
    fireworks:  'https://fireworks.ai/account/api-keys',
    openrouter: 'https://openrouter.ai/keys',
  };
  return links[provider] ?? '#';
}

export { models };
