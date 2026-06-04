// Sprint 10.8 — Per-user BYOK model discovery.
//
// When a user adds a provider key, we ask THAT provider's /models endpoint what
// the key actually unlocks. The result is cached on byok_keys.discovered_models
// so the ModelPicker can show the real list per user instead of a hardcoded
// promise. All providers below expose a /models endpoint; the one exception
// (none currently) would fall back to the LiteLLM catalog filtered by provider.
//
// This mirrors the endpoints byok-service.validateKey() already probes, but
// parses the body instead of only checking the status code.

import type { ByokProvider } from '@goblin/shared/src/schemas';

const DISCOVERY_TIMEOUT_MS = 6000;

interface OpenAIModelsResponse {
  data?: Array<{ id?: string }>;
}
interface AnthropicModelsResponse {
  data?: Array<{ id?: string }>;
}
interface GoogleModelsResponse {
  models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
}

async function fetchJson(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS) });
}

function dedupeSorted(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean))).sort();
}

/**
 * Return the list of model ids the given key can access. Bare ids (no provider
 * prefix) — the read path re-prefixes for routing. Returns [] on any failure;
 * callers treat [] as "discovery unavailable, fall back to catalog".
 */
export async function discoverModels(
  provider: ByokProvider,
  key: string,
  baseURL?: string,
): Promise<string[]> {
  try {
    switch (provider) {
      case 'anthropic': {
        const res = await fetchJson('https://api.anthropic.com/v1/models?limit=100', {
          headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        });
        if (!res.ok) return [];
        const body = (await res.json()) as AnthropicModelsResponse;
        return dedupeSorted((body.data ?? []).map((m) => m.id ?? ''));
      }

      case 'google': {
        const res = await fetchJson(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=200`,
          { method: 'GET' },
        );
        if (!res.ok) return [];
        const body = (await res.json()) as GoogleModelsResponse;
        return dedupeSorted(
          (body.models ?? [])
            // Only chat/generate-capable models, strip the "models/" prefix.
            .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
            .map((m) => (m.name ?? '').replace(/^models\//, '')),
        );
      }

      // OpenAI-compatible /models (data:[{id}])
      case 'openai':
      case 'groq':
      case 'mistral':
      case 'deepseek':
      case 'xai':
      case 'together':
      case 'custom': {
        const url = providerModelsUrl(provider, baseURL);
        if (!url) return [];
        const res = await fetchJson(url, { headers: { Authorization: `Bearer ${key}` } });
        if (!res.ok) return [];
        const body = (await res.json()) as OpenAIModelsResponse;
        return dedupeSorted((body.data ?? []).map((m) => m.id ?? ''));
      }

      default:
        return [];
    }
  } catch {
    // Timeout / network / parse error → discovery unavailable.
    return [];
  }
}

function providerModelsUrl(provider: ByokProvider, baseURL?: string): string | null {
  switch (provider) {
    case 'openai':     return 'https://api.openai.com/v1/models';
    case 'groq':       return 'https://api.groq.com/openai/v1/models';
    case 'mistral':    return 'https://api.mistral.ai/v1/models';
    case 'deepseek':   return 'https://api.deepseek.com/models';
    case 'xai':        return 'https://api.x.ai/v1/models';
    case 'together':   return 'https://api.together.xyz/v1/models';
    case 'custom':     return baseURL ? `${baseURL.replace(/\/$/, '')}/models` : null;
    default:           return null;
  }
}
