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
// ModelPicker + Modelle rankings can badge / gate a degraded provider.
//
// FIX3-1: the in-memory breaker starts 'healthy' on a cold process, so a model
// proven dead (e.g. Gemini) would briefly look fine again after a redeploy. We
// merge the LAST persisted transition per provider (provider_health_events,
// recent window) so a known-down provider stays gated across restarts until it
// recovers. In-memory state wins when present (it's the freshest signal).
models.get('/health', async (c) => {
  const { getHealthMap } = await import('../services/provider-health');
  const live = getHealthMap();

  const merged: Record<string, 'degraded' | 'down'> = {};
  for (const [provider, state] of Object.entries(live)) {
    if (state === 'degraded' || state === 'down') merged[provider] = state;
  }
  try {
    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(); // 6h window
    const { data } = await supabase
      .from('provider_health_events')
      .select('provider, state, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    // Latest event per provider = its current persisted state.
    const seen = new Set<string>();
    for (const row of (data ?? []) as { provider: string; state: string }[]) {
      if (seen.has(row.provider)) continue;
      seen.add(row.provider);
      if (merged[row.provider]) continue; // live signal already set → keep it
      if (row.state === 'down' || row.state === 'degraded') {
        merged[row.provider] = row.state;
      }
    }
  } catch {
    // provider_health_events may not exist (0063 unapplied) — fall back to live.
  }

  return c.json(merged);
});

// POST /api/models/probe — liveness preflight for "Standard setzen" (FIX4). Does a
// tiny REAL generation with the chosen model + the user's key. Returns ok:false
// when the model doesn't actually answer (proven case: Gemini-via-BYOK errors on
// prod), so the UI can refuse to set a dead model as the default. Deterministic —
// it tests the real route, independent of circuit-breaker warmth.
models.post('/probe', async (c) => {
  const userId = c.get('userId');
  let slug = '';
  try { slug = String(((await c.req.json()) as { slug?: unknown })?.slug ?? ''); } catch { /* ignore */ }
  if (!slug) return c.json({ ok: false, error: 'missing_slug' }, 400);

  const { streamCompletion } = await import('../services/model-router');
  const supabase = getSupabaseAdmin();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    let gotDelta = false;
    for await (const chunk of streamCompletion({
      userId,
      projectId: null,
      message: 'ping',
      chatHistory: [],
      modelPreference: slug,
      supabase,
      timeoutMs: 12_000,
      signal: controller.signal,
    })) {
      let evt: { type?: string; content?: string };
      try { evt = JSON.parse(chunk) as { type?: string; content?: string }; } catch { continue; }
      // Silently rerouted (chosen provider degraded) → the slug the user picked is
      // NOT directly usable; don't let them pin it as default.
      if (evt.type === 'fallback_notice') { clearTimeout(timer); return c.json({ ok: false, error: 'rerouted' }); }
      if (evt.type === 'delta' && evt.content) { gotDelta = true; controller.abort(); break; }
    }
    clearTimeout(timer);
    return c.json({ ok: gotDelta, ...(gotDelta ? {} : { error: 'no_response' }) });
  } catch (e) {
    clearTimeout(timer);
    return c.json({ ok: false, error: e instanceof Error ? e.message.slice(0, 140) : 'probe_failed' });
  }
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
