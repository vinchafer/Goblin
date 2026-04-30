import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { listKeys, getActiveKey } from '../services/byok-service';

type Variables = { userId: string };
const models = new Hono<{ Variables: Variables }>();

models.use('*', authMiddleware);

// GET /api/models — DB-driven model list (falls back to static list)
models.get('/', async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .eq('available', true)
      .order('phase', { ascending: true });

    if (!error && data && data.length > 0) {
      return c.json(data);
    }
  } catch {
    // DB table may not exist yet — fall through to static list
  }

  // Static fallback: Phase 1 BYOK models + Free API models
  return c.json([
    // BYOK Models (Phase 1)
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', slug: 'claude-sonnet-4-6', provider: 'anthropic', layer: 'byok', description: 'Fast, capable. Best for most coding tasks.', tags: ['coding', 'fast'], requires_key: true, available: true, phase: 1 },
    { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', slug: 'claude-opus-4-7', provider: 'anthropic', layer: 'byok', description: 'Most powerful. Best for complex reasoning.', tags: ['reasoning', 'coding'], requires_key: true, available: true, phase: 1 },
    { id: 'gpt-4o', name: 'GPT-4o', slug: 'gpt-4o', provider: 'openai', layer: 'byok', description: 'OpenAI flagship. Strong at code and instruction following.', tags: ['coding', 'fast'], requires_key: true, available: true, phase: 1 },
    { id: 'deepseek-chat', name: 'DeepSeek V3', slug: 'deepseek/deepseek-chat', provider: 'deepseek', layer: 'byok', description: 'Best price/performance for coding. Near GPT-4 quality.', tags: ['coding', 'fast'], requires_key: true, available: true, phase: 1 },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', slug: 'gemini/gemini-2.0-flash', provider: 'google', layer: 'byok', description: 'Very fast. Great for quick iterations.', tags: ['fast'], requires_key: true, available: true, phase: 1 },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', slug: 'groq/llama-3.3-70b-versatile', provider: 'groq', layer: 'byok', description: 'Open-source 70B. Extremely fast via Groq inference.', tags: ['fast', 'coding'], requires_key: true, available: true, phase: 1 },
    { id: 'mistral-large', name: 'Mistral Large', slug: 'mistral/mistral-large', provider: 'mistral', layer: 'byok', description: 'European LLM. Strong multilingual support.', tags: ['multilingual', 'coding'], requires_key: true, available: true, phase: 1 },
    { id: 'grok-2', name: 'Grok 2', slug: 'xai/grok-2', provider: 'xai', layer: 'byok', description: 'Elon\'s model. Good reasoning and real-time knowledge.', tags: ['reasoning', 'knowledge'], requires_key: true, available: true, phase: 1 },
    { id: 'llama-3-70b', name: 'Llama 3 70B (Together)', slug: 'together/llama-3-70b', provider: 'together', layer: 'byok', description: 'Open-source 70B via Together AI. Access many open models.', tags: ['open-source', 'coding'], requires_key: true, available: true, phase: 1 },
    
    // Free API Models (no key required)
    { id: 'gemini-2.0-flash-free', name: 'Gemini 2.0 Flash', slug: 'gemini/gemini-2.0-flash', provider: 'google', layer: 'free_api', description: 'Fast, generous free tier. No key required.', tags: ['fast', 'free'], requires_key: false, available: true, phase: 1 },
    { id: 'llama-3.3-70b-free', name: 'Llama 3.3 70B', slug: 'groq/llama-3.3-70b-versatile', provider: 'groq', layer: 'free_api', description: 'Extremely fast inference. Free tier available.', tags: ['fast', 'free', 'coding'], requires_key: false, available: true, phase: 1 },
  ]);
});

// GET /api/models/status — returns BYOK key status and free API availability
models.get('/status', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabase = getSupabaseAdmin();
    const keys = await listKeys(userId);

    // Build BYOK status map
    const byokProviders = ['anthropic', 'openai', 'google', 'groq', 'mistral', 'deepseek', 'xai', 'together'] as const;
    const byok: Record<string, boolean> = {};
    for (const provider of byokProviders) {
      byok[provider] = keys.some(k => k.provider === provider && k.status === 'active');
    }

    // Get free API usage from database
    const { data: freeApiData } = await supabase
      .from('free_api_usage')
      .select('provider, used_today, daily_limit')
      .eq('user_id', userId);

    const freeApi: Record<string, { available: boolean; usedToday: number; limit: number }> = {
      gemini: { available: true, usedToday: 0, limit: 50 },
      groq: { available: true, usedToday: 0, limit: 50 },
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
  } catch (err) {
    console.error('[models/status] Error:', err);
    return c.json({ error: 'Failed to fetch model status' }, 500);
  }
});

// GET /api/models/:provider/credits — returns credit/balance info for a provider
models.get('/:provider/credits', async (c) => {
  const userId = c.get('userId') as string;
  const provider = c.req.param('provider');

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const key = await getActiveKey(userId, provider as any);
    if (!key) {
      return c.json({ supported: false, link: getProviderLink(provider) });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      let result: { supported: boolean; remaining?: string; link?: string };

      switch (provider) {
        case 'anthropic': {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': key,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-3-5-haiku-latest',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'hi' }],
            }),
            signal: controller.signal,
          });

          // Anthropic doesn't have a direct balance endpoint, but we can check
          // the organization usage/limits via their API
          const orgResponse = await fetch('https://api.anthropic.com/v1/organizations', {
            headers: {
              'x-api-key': key,
              'anthropic-version': '2023-06-01',
            },
            signal: controller.signal,
          });

          if (orgResponse.ok) {
            result = { supported: true, remaining: 'Active' };
          } else {
            result = { supported: false, link: 'https://console.anthropic.com/settings/billing' };
          }
          break;
        }

        case 'openai': {
          const response = await fetch('https://api.openai.com/v1/dashboard/billing/subscription', {
            headers: {
              'Authorization': `Bearer ${key}`,
            },
            signal: controller.signal,
          });

          if (response.ok) {
            const data = await response.json() as any;
            const remaining = data.hard_limit_usd
              ? `$${(data.hard_limit_usd - (data.soft_limit_usd || 0)).toFixed(2)} remaining`
              : 'Active';
            result = { supported: true, remaining };
          } else {
            result = { supported: false, link: 'https://platform.openai.com/usage' };
          }
          break;
        }

        default:
          result = { supported: false, link: getProviderLink(provider) };
      }

      clearTimeout(timeout);
      return c.json(result);
    } catch (fetchErr: unknown) {
      clearTimeout(timeout);
      if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') {
        // Timeout — return nothing (frontend will show nothing)
        return c.json({ supported: false });
      }
      throw fetchErr;
    }
  } catch (err) {
    console.error(`[models/credits/${provider}] Error:`, err);
    return c.json({ supported: false });
  }
});

function getProviderLink(provider: string): string {
  const links: Record<string, string> = {
    anthropic: 'https://console.anthropic.com/settings/billing',
    openai: 'https://platform.openai.com/usage',
    google: 'https://aistudio.google.com/app/apikey',
    groq: 'https://console.groq.com/keys',
    mistral: 'https://console.mistral.ai/billing',
    deepseek: 'https://platform.deepseek.com/api_keys',
    xai: 'https://console.x.ai/',
    together: 'https://api.together.xyz/settings/billing',
  };
  return links[provider] || '#';
}

export { models };