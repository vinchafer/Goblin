import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { listKeys, getActiveKey } from '../services/byok-service';

type Variables = { userId: string };
const models = new Hono<{ Variables: Variables }>();

models.use('*', authMiddleware);

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