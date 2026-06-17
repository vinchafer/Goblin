// Sprint 10.8 → 10.9-A1 — Model catalog (OPTION B: no LiteLLM proxy).
//
// ARCHITECTURE NOTE (Phase 0 gate, 2026-06-04 — see sprint-10-9/PHASE_0_GATE.md):
// Goblin routes inference DIRECTLY to provider APIs (Anthropic / OpenAI SDKs),
// not through a LiteLLM proxy. There is no `litellm` npm dependency and no
// functioning proxy service. "LiteLLM" survives only as a *concept* (OpenAI-style
// schema + per-provider adapters / slug prefixes), NOT as a /v1/models source.
//
// Source-of-truth split:
//  - ROUTING slug  → per-user provider-discovery (byok_keys.discovered_models),
//    stored VERBATIM as the provider's own /models returned it. NEVER
//    canonicalized between discovery and routing (the hard slug rule).
//  - DISPLAY list  → the hand-maintained static catalog in config/providers.ts,
//    shown greyed to not-connected users. DISPLAY ONLY, never a routing source.
//
// The dead `GET /v1/models` proxy sync (10.8-1) was retired here in 10.9-A1: it
// targeted an endpoint that does not exist in this architecture and silently
// no-op'd into the static fallback. `syncFromLiteLLM` is kept as a retired no-op
// so its callers keep compiling; the real refresh path is the per-user
// provider-discovery refresh (10.9-2).

import { getSupabaseAdmin } from '../lib/supabase';
import { PROVIDERS, ALL_STATIC_MODELS, FREE_API_MODELS, type ProviderId } from '../config/providers';
import { listKeys, getDiscoveredModelsByProvider } from './byok-service';
import { isGoblinHostedEnabled, GOBLIN_HOSTED_TIERS, tierAllowedForPlan } from './goblin-hosted';

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

export interface SyncResult {
  ok: boolean;
  source: 'litellm' | 'skipped' | 'error' | 'provider-discovery';
  discovered: number;
  upserted: number;
  disabled: number;
  reason?: string;
}

/**
 * RETIRED in 10.9-A1 (OPTION B). The LiteLLM `GET /v1/models` proxy sync this
 * used to perform targeted an endpoint that does not exist in this architecture
 * (see the file header + sprint-10-9/PHASE_0_GATE.md). It is now a no-op so the
 * boot hook and the admin endpoint keep compiling. The real refresh of what each
 * key unlocks is the per-user provider-discovery refresh (10.9-2,
 * `refreshAllUserDiscovery`). DO NOT re-introduce a /v1/models fetch here.
 */
export async function syncFromLiteLLM(_opts: { force?: boolean } = {}): Promise<SyncResult> {
  return {
    ok: true,
    source: 'skipped',
    discovered: 0,
    upserted: 0,
    disabled: 0,
    reason: 'retired in 10.9-A1 — no LiteLLM proxy in this architecture; catalog source is per-user provider-discovery',
  };
}

// ── Catalog read path (models table is a cache, not source-of-truth) ─────────

export type Badge = 'BYOK' | 'FREE' | 'GOBLIN_HOSTED' | 'COMING_SOON';

export interface AnnotatedModel {
  id: string;
  name: string;
  slug: string;
  provider: string;
  layer: 'byok' | 'free_api' | 'goblin_hosted';
  description: string | null;
  tags: string[];
  requires_key: boolean;
  available: boolean;
  phase: number;
  keyConnected: boolean | null;
  badge: Badge;
  capabilities?: Record<string, boolean>;
}

interface SourceModel {
  id?: string;
  name: string;
  slug: string;
  provider: string;
  layer: string;
  description: string | null;
  tags: string[];
  requires_key: boolean;
  available: boolean;
  phase: number;
  capabilities?: Record<string, boolean>;
}

// Discovered /models lists are noisy (embeddings, whisper, tts, image, …).
// Keep only chat/completion-capable ids.
const NON_CHAT_RE =
  /embed|whisper|tts|dall-?e|moderation|audio|image|vision-?only|rerank|guard|transcrib|stable-?diffusion|flux|sdxl|realtime|text-embedding|computer-use|similarity|search-|-search|babbage|^ada-|davinci-002|qwen.*vl|distil-whisper|playai/i;

function isChatModel(id: string): boolean {
  return !NON_CHAT_RE.test(id);
}

/**
 * 10.8-3/10.8-4 — the user-facing catalog. Intersects the synced cache /
 * curated static list with what each user's keys actually unlock:
 *  - connected provider WITH discovered models → show the real discovered list
 *  - connected provider WITHOUT discovery       → show cached/static for it
 *  - not-connected provider                     → show curated static (greyed)
 */
export async function getCatalogForUser(userId: string): Promise<AnnotatedModel[]> {
  const supabase = getSupabaseAdmin();

  const [userKeys, discoveredMap, planRow] = await Promise.all([
    listKeys(userId).catch(() => []),
    getDiscoveredModelsByProvider(userId).catch(() => ({} as Record<string, string[]>)),
    supabase.from('users').select('plan').eq('id', userId).single().then(
      (r) => (r.data as { plan?: string } | null) ?? null,
      () => null,
    ),
  ]);
  const userPlan = (planRow?.plan ?? '').toLowerCase();
  const connected = new Set(
    userKeys.filter((k) => k.status === 'active' && (k.provider as string) !== 'vercel').map((k) => k.provider as string),
  );

  // Cached DB models (source-of-truth is upstream; this table is the cache).
  let dbModels: SourceModel[] = [];
  try {
    const { data } = await supabase.from('models').select('*').eq('available', true).order('phase', { ascending: true });
    if (data && data.length > 0) dbModels = data as SourceModel[];
  } catch { /* fall back to static */ }

  const hasDbCache = dbModels.length > 0;
  const staticSource: SourceModel[] = [...ALL_STATIC_MODELS, ...FREE_API_MODELS] as unknown as SourceModel[];

  // Per-provider lookup for cached/static byok entries.
  const byProvider = (src: SourceModel[]) => {
    const m = new Map<string, SourceModel[]>();
    for (const s of src.filter((x) => x.layer === 'byok')) {
      const arr = m.get(s.provider);
      if (arr) arr.push(s);
      else m.set(s.provider, [s]);
    }
    return m;
  };
  const cachedByok = byProvider(hasDbCache ? dbModels : staticSource);
  const staticByok = byProvider(staticSource);

  const out: AnnotatedModel[] = [];
  const seen = new Set<string>();
  const push = (m: AnnotatedModel) => {
    if (seen.has(m.slug)) return;
    seen.add(m.slug);
    out.push(m);
  };

  // BYOK: build per provider.
  const allProviders = Object.values(PROVIDERS).filter((p) => p.id !== 'custom');
  for (const p of allProviders) {
    const isConnected = connected.has(p.id);
    const discovered = (discoveredMap[p.id] ?? []).filter(isChatModel);

    if (isConnected && discovered.length > 0) {
      // Real, user-specific list.
      for (const id of discovered) {
        const slug = id.includes('/') ? id : `${p.litellmPrefix}${id}`;
        const dbMatch = (cachedByok.get(p.id) ?? []).find((s) => s.slug === slug || s.slug.endsWith(`/${id}`));
        push({
          id, name: dbMatch?.name ?? humanizeName(id), slug, provider: p.id, layer: 'byok',
          description: dbMatch?.description ?? `${p.displayName} model.`,
          tags: dbMatch?.tags ?? [], requires_key: true, available: true, phase: dbMatch?.phase ?? 1,
          keyConnected: true, badge: 'BYOK', capabilities: dbMatch?.capabilities ?? deriveCapabilities(id),
        });
      }
    } else {
      // No discovery → curated/cached list for this provider.
      const list = (isConnected ? cachedByok.get(p.id) : staticByok.get(p.id)) ?? staticByok.get(p.id) ?? [];
      for (const s of list) {
        push({
          id: s.id ?? s.slug, name: s.name, slug: s.slug, provider: s.provider, layer: 'byok',
          description: s.description, tags: s.tags ?? [], requires_key: true,
          available: isConnected, phase: s.phase, keyConnected: isConnected, badge: 'BYOK',
          capabilities: s.capabilities,
        });
      }
    }
  }

  // free_api: pass through from source.
  //
  // HR-1 (single-source-of-truth + no-leak): goblin_hosted rows are deliberately
  // NOT passed through from the DB/static source. The ONLY source of a goblin_hosted
  // entry is GOBLIN_HOSTED_TIERS below. A pre-pivot seed row (e.g. migration 0009's
  // "Qwen Coder 32B", slug 'qwen-coder-32b') would otherwise reach the browser as a
  // Goblin-tier model carrying an underlying open-source model name — leaking exactly
  // what the two-level-truth invariant forbids. Filtering the layer here makes the
  // leak impossible regardless of what stale rows live in the prod `models` table.
  for (const s of (hasDbCache ? dbModels : staticSource)) {
    if (s.layer === 'free_api') {
      push({ id: s.id ?? s.slug, name: s.name, slug: s.slug, provider: s.provider, layer: 'free_api',
        description: s.description, tags: s.tags ?? [], requires_key: false, available: s.available, phase: s.phase,
        keyConnected: null, badge: 'FREE', capabilities: s.capabilities });
    }
    // goblin_hosted rows from the cache/static source are intentionally skipped — see above.
  }

  // Goblin-bundled (Layer 2) tiers — only when the flag is on. The SINGLE source of
  // truth for these entries (HR-3). Provider-agnostic: the public tier name is shown,
  // never the wholesale provider or the underlying model slug. `seen` still dedups if
  // a stale models-table row somehow shares a canonical tier slug.
  if (isGoblinHostedEnabled()) {
    for (const tier of GOBLIN_HOSTED_TIERS) {
      const allowed = tierAllowedForPlan(tier, userPlan);
      push({
        id: tier.id, name: tier.name, slug: tier.id, provider: 'goblin', layer: 'goblin_hosted',
        description: tier.description, tags: tier.tierClass === 'premium' ? ['premium'] : ['fast', 'default'],
        requires_key: false, available: allowed, phase: 1, keyConnected: null,
        badge: 'GOBLIN_HOSTED', capabilities: { chat: true, function_calling: true, vision: false, reasoning: false },
      });
    }
  }

  // Sort: connected BYOK → free → unconnected BYOK → hosted.
  const score = (m: AnnotatedModel) => {
    if (m.layer === 'byok' && m.keyConnected) return 0;
    if (m.layer === 'free_api') return 1;
    if (m.layer === 'byok' && !m.keyConnected) return 2;
    return 3;
  };
  out.sort((a, b) => score(a) - score(b));
  return out;
}

/**
 * Boot-time trigger — RETIRED in 10.9-A1. There is no LiteLLM proxy to sync from
 * on boot (OPTION B). Kept as a no-op so the import in index.ts keeps compiling.
 * Per-user discovered_models is populated on key-add (byok-service) and refreshed
 * daily by the provider-discovery cron (10.9-2).
 */
export function scheduleBootSync(): void {
  /* no-op — catalog source is per-user provider-discovery, not a proxy */
}
