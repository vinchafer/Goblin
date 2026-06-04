// Sprint 10.8 — Dynamic model catalog.
//
// The `models` DB table is a CACHE, not a source of truth. This service keeps it
// in sync with what the LiteLLM proxy actually serves (`GET /v1/models`). When
// LiteLLM is unreachable or returns nothing, we keep the existing cache rather
// than wiping it — the static `providers.ts` list remains the last-resort
// fallback in the read path (routes/models.ts).
//
// LiteLLM /v1/models docs: https://docs.litellm.ai/docs/proxy/model_management

import { getSupabaseAdmin } from '../lib/supabase';
import { PROVIDERS, type ProviderId } from '../config/providers';

// ── LiteLLM endpoint resolution (mirrors litellm-client.ts) ──────────────────
function getLiteLLMBase(): string | null {
  const raw = process.env.LITELLM_BASE_URL;
  if (!raw) return null;
  return raw.startsWith('http') ? raw.replace(/\/$/, '') : `https://${raw.replace(/\/$/, '')}`;
}

function getLiteLLMKey(): string | undefined {
  return process.env.LITELLM_MASTER_KEY || process.env.LITELLM_API_KEY || undefined;
}

// ── Provider derivation ──────────────────────────────────────────────────────
// LiteLLM serves model ids either prefixed ("anthropic/claude-...", "gemini/...")
// or bare ("gpt-4o"). Map back to a Goblin ProviderId via the configured prefix,
// then fall back to owned_by, then to a sensible default.
const PREFIX_TO_PROVIDER: Record<string, ProviderId> = Object.fromEntries(
  Object.values(PROVIDERS)
    .filter((p) => p.litellmPrefix)
    .map((p) => [p.litellmPrefix.replace(/\/$/, ''), p.id]),
) as Record<string, ProviderId>;

const OWNED_BY_TO_PROVIDER: Record<string, ProviderId> = {
  anthropic: 'anthropic',
  openai: 'openai',
  'system': 'openai',
  google: 'google',
  'google-ai-studio': 'google',
  groq: 'groq',
  mistralai: 'mistral',
  mistral: 'mistral',
  xai: 'xai',
  deepseek: 'deepseek',
  'together-ai': 'together',
  together: 'together',
  fireworks: 'fireworks',
  openrouter: 'openrouter',
};

export function deriveProvider(id: string, ownedBy?: string): ProviderId {
  const prefix = id.includes('/') ? id.split('/')[0]! : '';
  if (prefix && PREFIX_TO_PROVIDER[prefix]) return PREFIX_TO_PROVIDER[prefix]!;
  if (ownedBy && OWNED_BY_TO_PROVIDER[ownedBy.toLowerCase()]) {
    return OWNED_BY_TO_PROVIDER[ownedBy.toLowerCase()]!;
  }
  // Bare ids: infer from common substrings.
  const lid = id.toLowerCase();
  if (lid.startsWith('claude')) return 'anthropic';
  if (lid.startsWith('gpt') || lid.startsWith('o1') || lid.startsWith('o3')) return 'openai';
  if (lid.startsWith('gemini')) return 'google';
  if (lid.startsWith('llama') || lid.startsWith('mixtral')) return 'groq';
  if (lid.startsWith('mistral')) return 'mistral';
  if (lid.startsWith('grok')) return 'xai';
  if (lid.startsWith('deepseek')) return 'deepseek';
  return 'custom';
}

// Capability heuristics — LiteLLM /v1/models rarely returns rich capability data,
// so we infer from the id. Conservative: everything is chat-capable.
export function deriveCapabilities(id: string): Record<string, boolean> {
  const lid = id.toLowerCase();
  const vision =
    lid.includes('vision') || lid.includes('4o') || lid.includes('gemini') ||
    lid.includes('claude-3') || lid.includes('claude-opus') || lid.includes('claude-sonnet') ||
    lid.includes('claude-haiku') || lid.includes('grok') && !lid.includes('mini');
  const reasoning =
    lid.includes('o1') || lid.includes('o3') || lid.includes('reasoner') ||
    lid.includes('-r1') || lid.includes('thinking');
  return { chat: true, vision, function_calling: true, reasoning };
}

function humanizeName(id: string): string {
  const bare = id.includes('/') ? id.split('/').slice(1).join('/') : id;
  return bare
    .split(/[-_]/)
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/\b(\d)\.(\d)\b/g, '$1.$2');
}

interface LiteLLMModel {
  id: string;
  object?: string;
  owned_by?: string;
}

export interface SyncResult {
  ok: boolean;
  source: 'litellm' | 'skipped' | 'error';
  discovered: number;
  upserted: number;
  disabled: number;
  reason?: string;
}

// In-memory guard so boot + cron don't hammer LiteLLM. 6h TTL.
let lastSyncAt = 0;
const SYNC_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Pull the live model list from LiteLLM and upsert into the `models` cache.
 * Idempotent and defensive: an empty/failed response never wipes the cache.
 */
export async function syncFromLiteLLM(opts: { force?: boolean } = {}): Promise<SyncResult> {
  const base = getLiteLLMBase();
  if (!base) {
    return { ok: false, source: 'skipped', discovered: 0, upserted: 0, disabled: 0, reason: 'LITELLM_BASE_URL not set' };
  }
  if (!opts.force && Date.now() - lastSyncAt < SYNC_TTL_MS) {
    return { ok: true, source: 'skipped', discovered: 0, upserted: 0, disabled: 0, reason: 'within TTL' };
  }

  const key = getLiteLLMKey();
  let models: LiteLLMModel[];
  try {
    const res = await fetch(`${base}/v1/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { ok: false, source: 'error', discovered: 0, upserted: 0, disabled: 0, reason: `LiteLLM ${res.status}` };
    }
    const body = (await res.json()) as { data?: LiteLLMModel[] };
    models = Array.isArray(body.data) ? body.data : [];
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'fetch failed';
    return { ok: false, source: 'error', discovered: 0, upserted: 0, disabled: 0, reason };
  }

  // Defensive: never wipe the cache on an empty response.
  if (models.length === 0) {
    return { ok: false, source: 'error', discovered: 0, upserted: 0, disabled: 0, reason: 'empty LiteLLM response' };
  }

  const now = new Date().toISOString();
  const rows = models
    .filter((m) => m.id && m.id !== 'test')
    .map((m) => {
      const provider = deriveProvider(m.id, m.owned_by);
      return {
        name: humanizeName(m.id),
        slug: m.id,
        provider,
        layer: 'byok' as const,
        description: `${PROVIDERS[provider]?.displayName ?? provider} model (auto-discovered).`,
        tags: [] as string[],
        requires_key: true,
        available: true,
        phase: 1,
        discovered_via: 'litellm' as const,
        last_synced_at: now,
        capabilities: deriveCapabilities(m.id),
      };
    });

  const supabase = getSupabaseAdmin();
  let upserted = 0;
  try {
    const { data, error } = await supabase
      .from('models')
      .upsert(rows, { onConflict: 'slug' })
      .select('slug');
    if (error) {
      return { ok: false, source: 'error', discovered: rows.length, upserted: 0, disabled: 0, reason: error.message };
    }
    upserted = data?.length ?? 0;
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'upsert failed';
    return { ok: false, source: 'error', discovered: rows.length, upserted: 0, disabled: 0, reason };
  }

  // Mark LiteLLM-sourced models that disappeared upstream as unavailable.
  // Never touch manual/provider_api rows — only our own provenance.
  let disabled = 0;
  try {
    const liveSlugs = rows.map((r) => r.slug);
    const { data: stale } = await supabase
      .from('models')
      .select('slug')
      .eq('discovered_via', 'litellm')
      .eq('available', true)
      .not('slug', 'in', `(${liveSlugs.map((s) => `"${s}"`).join(',')})`);
    if (stale && stale.length > 0) {
      const staleSlugs = stale.map((s: { slug: string }) => s.slug);
      await supabase.from('models').update({ available: false }).in('slug', staleSlugs);
      disabled = staleSlugs.length;
    }
  } catch { /* non-fatal — stale rows just linger as available */ }

  lastSyncAt = Date.now();
  return { ok: true, source: 'litellm', discovered: rows.length, upserted, disabled };
}

/**
 * Boot-time trigger — fire-and-forget so a slow/unreachable LiteLLM never blocks
 * API startup. Logs the outcome.
 */
export function scheduleBootSync(): void {
  if (!getLiteLLMBase()) return;
  syncFromLiteLLM()
    .then((r) => {
      if (r.ok && r.source === 'litellm') {
        console.log(`[catalog] LiteLLM sync: ${r.upserted} models cached, ${r.disabled} disabled`);
      } else if (r.source === 'error') {
        console.warn(`[catalog] LiteLLM sync failed: ${r.reason} (keeping existing cache)`);
      }
    })
    .catch((e) => console.warn('[catalog] LiteLLM sync threw:', e));
}
