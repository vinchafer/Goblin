import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { type SupabaseClient } from '@supabase/supabase-js';
import {
  getGoblinHostedConfig,
  getGoblinClient,
  parseGoblinTier,
  GOBLIN_DEFAULT_TIER,
  GOBLIN_MAX_TOKENS_PER_REQUEST,
  type GoblinHostedConfig,
  type GoblinTierId,
} from './goblin-hosted';
import {
  isOverMonthlyAllowance,
  isOverDailyGuard,
  nextMonthlyResetISO,
} from '../lib/goblin-cap';
import { decryptData, decryptUserData } from './encryption';
import { getSupabaseAdmin } from '../lib/supabase';
import { derivePlanTruth } from '../lib/plan-truth';
import { PROVIDERS, PROVIDER_BASE_URLS, type ProviderId } from '../config/providers';
import { GoblinError, isGoblinError, litellmStream } from './litellm-client';
import { formatTokenDisplay } from '../config/pricing';
import { trackCompletion } from '../lib/track-completion';
import { recordOutcome, getHealth, isModelNotFound } from './provider-health';

export type { GoblinError };
export { isGoblinError };

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModelLayer = 'byok' | 'free_api' | 'goblin_hosted';
export type ProviderName = ProviderId;

export interface RouteResult {
  layer: ModelLayer;
  provider: ProviderName;
  apiKey: string;
  baseURL: string;
  model: string;
  modelSlug: string;
  // Exact model string sent to the provider on the wire. For BYOK/free this equals
  // `model`. For goblin_hosted it is the wholesale provider slug (e.g. a DeepInfra
  // model id), while `model`/`modelSlug` stay the Goblin tier id — so the provider
  // slug NEVER reaches the browser or the DB (two-level truth, HR-6).
  apiModel: string;
  // LiteLLM-native model name for pass-through routing (provider/model format)
  litellmModel: string;
  // The Goblin tier (only set for layer === 'goblin_hosted').
  goblinTier?: GoblinTierId;
}

// ─── Free-API Pool ────────────────────────────────────────────────────────────

interface FreePoolEntry {
  provider: ProviderName;
  envVar: string;
  baseURL: string;
  model: string;
  slug: string;
  // LiteLLM-native model identifier (provider/model format for pass-through routing)
  litellmModel: string;
}

// FREE_API_POOL (Goblin-owned keys) is intentionally disabled — Strategy V1 C-8 fix.
// Goblin does not resell provider free tiers. Users must connect their own API keys (BYOK).
// Free-tier provider recommendations are shown in Settings → API Keys.
const FREE_API_POOL: FreePoolEntry[] = [];

/**
 * Is the Goblin-owned free pool live? (DD §C / F5-1) Mirrors `isGoblinHostedEnabled`.
 * The catalog gates `free_api` rows on this so the picker never advertises a "FREE"
 * model that can't actually route (the pool is empty by design → `resolveFreeApi()`
 * always returns null). Flipping `FREE_API_POOL` back to a non-empty list re-enables
 * both routing AND the picker rows from this single source of truth.
 */
export function isFreeApiPoolEnabled(): boolean {
  return FREE_API_POOL.length > 0;
}

// Provider priority for auto-selection
export const PROVIDER_PRIORITY: ProviderName[] = ['anthropic', 'openai', 'deepseek', 'groq', 'mistral', 'google', 'xai', 'together'];

// Backwards-compat: OpenAI-compatible base URLs
export const OPENAI_COMPATIBLE: Record<string, { baseURL: string; defaultModel: string }> = Object.fromEntries(
  Object.entries(PROVIDERS)
    .filter(([id]) => id !== 'anthropic' && id !== 'custom')
    .map(([id, p]) => [id, { baseURL: p.baseURL, defaultModel: p.models[0]?.id ?? 'gpt-4o' }])
) as Record<string, { baseURL: string; defaultModel: string }>;

// ─── Key resolution ───────────────────────────────────────────────────────────

async function resolveByokKey(
  userId: string,
  preferredProvider?: ProviderName,
  preferredModel?: string,
  supabase?: SupabaseClient,
): Promise<{ provider: ProviderName; apiKey: string } | null> {
  const sb = supabase ?? getSupabaseAdmin();

  const [keysResult, userResult] = await Promise.all([
    sb
      .from('byok_keys')
      .select('provider, key_encrypted')
      .eq('user_id', userId)
      .eq('status', 'active'),
    sb
      .from('users')
      .select('encryption_salt')
      .eq('id', userId)
      .single(),
  ]);

  const keys = keysResult.data;
  if (!keys || keys.length === 0) return null;

  const userSalt = (userResult.data as { encryption_salt?: string } | null)?.encryption_salt ?? null;

  function safeDecrypt(encrypted: string): string {
    try {
      if (userSalt) {
        try {
          return decryptUserData(encrypted, userSalt);
        } catch {
          // Fall through to legacy
        }
      }
      return decryptData(encrypted);
    } catch {
      throw new GoblinError('decryption_error', 'API key needs to be re-entered. Please go to Settings → API Keys.');
    }
  }

  if (preferredProvider) {
    const match = keys.find(k => k.provider === preferredProvider);
    if (match) return { provider: match.provider as ProviderName, apiKey: safeDecrypt(match.key_encrypted) };
  }

  // Single key: auto-select it without further lookup
  if (keys.length === 1) {
    const only = keys[0]!;
    return { provider: only.provider as ProviderName, apiKey: safeDecrypt(only.key_encrypted) };
  }

  // Multiple keys: check user's saved default provider preference
  const { data: userRow } = await sb
    .from('users')
    .select('default_chat_model')
    .eq('id', userId)
    .single();

  if (userRow?.default_chat_model) {
    const defaultProvider = slugToProvider(userRow.default_chat_model as string);
    if (defaultProvider) {
      const match = keys.find(k => k.provider === defaultProvider);
      if (match) return { provider: match.provider as ProviderName, apiKey: safeDecrypt(match.key_encrypted) };
    }
  }

  for (const provider of PROVIDER_PRIORITY) {
    const match = keys.find(k => k.provider === provider);
    if (match) return { provider, apiKey: safeDecrypt(match.key_encrypted) };
  }

  const first = keys[0]!;
  return { provider: first.provider as ProviderName, apiKey: safeDecrypt(first.key_encrypted) };
}

function resolveFreeApi(): (FreePoolEntry & { provider: ProviderName }) | null {
  for (const entry of FREE_API_POOL) {
    const key = process.env[entry.envVar];
    if (key) return { ...entry, apiKey: key } as FreePoolEntry & { provider: ProviderName } & { apiKey: string };
  }
  return null;
}

// Goblin-internal tier-tagged slugs → LiteLLM-native model identifier
// "free/" prefix is tier metadata, not a provider — strip and map to real provider model
const FREE_SLUG_TO_LITELLM: Record<string, { provider: ProviderName; litellm: string }> = {
  'free/gemini-flash':    { provider: 'google',  litellm: 'gemini/gemini-1.5-flash' },
  'free/groq-llama':      { provider: 'groq',    litellm: 'groq/llama-3.3-70b-versatile' },
  'free/openrouter-free': { provider: 'openrouter', litellm: 'openrouter/meta-llama/llama-3.3-70b-instruct:free' },
};

function resolveFreeSlug(slug: string): { provider: ProviderName; litellm: string } | undefined {
  return FREE_SLUG_TO_LITELLM[slug];
}

// Map modelSlug prefix to provider
function slugToProvider(slug: string): ProviderName | undefined {
  const free = resolveFreeSlug(slug);
  if (free) return free.provider;
  const prefix = slug.split('/')[0];
  if (!prefix) return undefined;
  const providerMap: Record<string, ProviderName> = {
    'anthropic': 'anthropic', 'openai': 'openai', 'gemini': 'google',
    'groq': 'groq', 'mistral': 'mistral', 'xai': 'xai',
    'deepseek': 'deepseek', 'together_ai': 'together', 'fireworks_ai': 'fireworks',
    'openrouter': 'openrouter',
  };
  return providerMap[prefix];
}

// Extract the actual model ID from a slug (strip provider prefix)
function slugToModelId(slug: string): string {
  const free = resolveFreeSlug(slug);
  if (free) {
    // strip provider prefix from litellm slug: 'gemini/gemini-1.5-flash' → 'gemini-1.5-flash'
    const parts = free.litellm.split('/');
    return parts.slice(1).join('/');
  }
  const parts = slug.split('/');
  if (parts.length <= 1) return slug;
  if (parts[0] === 'together_ai' || parts[0] === 'fireworks_ai') {
    return parts.slice(1).join('/');
  }
  return parts.slice(1).join('/');
}

// ─── Goblin-hosted route + plan lookup ──────────────────────────────────────────

/** Build a goblin_hosted RouteResult for a tier. `model`/`modelSlug` are the public
 *  tier id; `apiModel` is the wholesale provider slug (never surfaced). */
function buildGoblinRoute(hosted: GoblinHostedConfig, tierId: GoblinTierId): RouteResult {
  const providerModel = hosted.resolveModel(tierId); // throws if invariant violated (fail closed)
  return {
    layer: 'goblin_hosted',
    provider: 'openai', // OpenAI-compatible wholesale endpoint
    apiKey: hosted.apiKey,
    baseURL: hosted.baseURL,
    model: tierId,
    modelSlug: tierId,
    apiModel: providerModel,
    litellmModel: `openai/${providerModel}`,
    goblinTier: tierId,
  };
}

/** Read the user's subscription plan for tier gating. Defaults to '' (no plan). */
/** Read plan + preferred language together (one query) — used by the Goblin-hosted
 *  cap/daily-guard enforcement for both the gating and the EN/DE refusal copy. */
async function getUserPlanAndLang(
  userId: string,
  supabase?: SupabaseClient,
): Promise<{ plan: string; lang: 'en' | 'de' }> {
  try {
    const sb = supabase ?? getSupabaseAdmin();
    const { data } = await sb
      .from('users')
      .select('plan, preferred_lang, is_comped, stripe_subscription_id, cloud_trial_ends_at')
      .eq('id', userId)
      .single();
    const row = data as
      | { plan?: string; preferred_lang?: string; is_comped?: boolean; stripe_subscription_id?: string | null; cloud_trial_ends_at?: string | null }
      | null;
    const lang = row?.preferred_lang === 'en' ? 'en' : 'de';
    // Allowance must follow the DERIVED entitlement, not the raw `plan` column —
    // a default user (plan='build', no sub) must resolve to trial-level, not 17.4M.
    const plan = derivePlanTruth(row).allowanceKey;
    return { plan, lang };
  } catch {
    return { plan: '', lang: 'de' };
  }
}

interface GoblinWeightedUsage {
  monthSwift: number; monthForge: number; daySwift: number; dayForge: number;
}

/** One month-scoped read of the user's goblin_hosted completions, split into
 *  Swift vs Forge tokens for both the current calendar month and today. The
 *  Swift/Forge split (by completion_costs.model = the tier id) is what the weighted
 *  allowance needs — no schema change, same table the rollup view aggregates.
 *  Best-effort: any read failure returns zeros (never blocks on a glitch). */
async function goblinWeightedUsage(
  userId: string,
  supabase?: SupabaseClient,
): Promise<GoblinWeightedUsage> {
  const zero: GoblinWeightedUsage = { monthSwift: 0, monthForge: 0, daySwift: 0, dayForge: 0 };
  try {
    const sb = supabase ?? getSupabaseAdmin();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const dayStartMs = startOfDay.getTime();
    const { data } = await sb
      .from('completion_costs')
      .select('model, tokens_in, tokens_out, created_at')
      .eq('user_id', userId)
      .eq('source_tier', 'goblin_hosted')
      .gte('created_at', startOfMonth.toISOString());
    const rows = (data as Array<{ model: string; tokens_in: number; tokens_out: number; created_at: string }> | null) ?? [];
    const acc = { ...zero };
    for (const r of rows) {
      const tok = (r.tokens_in ?? 0) + (r.tokens_out ?? 0);
      const isForge = r.model === 'goblin/premium';
      if (isForge) acc.monthForge += tok; else acc.monthSwift += tok;
      if (new Date(r.created_at).getTime() >= dayStartMs) {
        if (isForge) acc.dayForge += tok; else acc.daySwift += tok;
      }
    }
    return acc;
  } catch {
    return zero;
  }
}

/** Format an ISO reset date (YYYY-MM-DD) for the user's language. */
function formatResetDate(iso: string, lang: 'en' | 'de'): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE', {
    day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

/** Calm, on-brand "monthly allowance reached" copy (HR-3 / HR-4 — no numbers, no
 *  cost units, just the reset date + upgrade path). */
function allowanceReachedMsg(lang: 'en' | 'de', resetDate: string): string {
  const when = formatResetDate(resetDate, lang);
  return lang === 'en'
    ? `You've used your monthly Goblin allowance. It resets on ${when} — or upgrade your plan for more.`
    : `Du hast dein monatliches Goblin-Kontingent aufgebraucht. Es setzt sich am ${when} zurück — oder hol dir mehr mit einem höheren Plan.`;
}

/** Calm "daily safety limit" copy (anti-abuse guard — framed as a daily pause). */
function dailyGuardMsg(lang: 'en' | 'de'): string {
  return lang === 'en'
    ? "You've hit today's Goblin usage limit. It resets tomorrow — or connect your own API key to keep going."
    : 'Du hast das heutige Goblin-Limit erreicht. Es setzt sich morgen zurück — oder verbinde einen eigenen API-Key, um weiterzumachen.';
}

// ─── Route resolution ─────────────────────────────────────────────────────────

export async function resolveModel(
  userId: string,
  preferredModel?: string,
  supabase?: SupabaseClient,
): Promise<RouteResult> {
  let preferredProvider: ProviderName | undefined;
  let modelId: string | undefined;

  if (preferredModel) {
    preferredProvider = slugToProvider(preferredModel);
    modelId = slugToModelId(preferredModel);
  }

  // Layer 2 (canon) — EXPLICIT Goblin tier selection (Swift / Forge). A user who
  // picks a goblin/* model is routed to the bundled server-side key AHEAD of any
  // BYOK key. Plan-gating is enforced here: a plan that does not expose the tier is
  // cleanly refused (a friendly GoblinError), never crashed. Unreachable while the
  // flag is off (getGoblinHostedConfig → null) — selecting it then falls through to
  // BYOK / the "no model" path.
  const explicitTier = parseGoblinTier(preferredModel);
  if (explicitTier) {
    const hosted = getGoblinHostedConfig();
    if (hosted) {
      // SESSION 3/5 (HR-2): BOTH tiers are available on EVERY plan (trial→power),
      // gated only by the GOBLIN_HOSTED_API flag (getGoblinHostedConfig above). There
      // is no model plan-gating — the weighted monthly allowance (goblin-cap.ts,
      // enforced in streamCompletion) and the trial-gate middleware (expired trials)
      // are the real spend/limit enforcers, not the picker.
      return buildGoblinRoute(hosted, explicitTier);
    }
    // Flag off → fall through to BYOK / free / error below.
  }

  // Layer 3: BYOK
  const byok = await resolveByokKey(userId, preferredProvider, preferredModel, supabase);
  if (byok) {
    const providerCfg = PROVIDERS[byok.provider];
    const baseURL = providerCfg?.baseURL ?? '';
    const defaultModel = providerCfg?.models[0]?.id ?? 'gpt-4o';
    const resolvedModel = modelId ?? defaultModel;
    const slug = preferredModel ?? `${byok.provider}/${resolvedModel}`;
    // free/ slugs are Goblin-internal tier tags — translate to real provider/model for LiteLLM
    const free = preferredModel ? resolveFreeSlug(preferredModel) : undefined;
    const litellmModel = free?.litellm ?? slug;
    return {
      layer: 'byok',
      provider: byok.provider,
      apiKey: byok.apiKey,
      baseURL,
      model: resolvedModel,
      modelSlug: slug,
      apiModel: resolvedModel,
      litellmModel,
    };
  }

  // Layer 2: Free-API Pool
  const free = resolveFreeApi();
  if (free) {
    return {
      layer: 'free_api',
      provider: free.provider,
      apiKey: (free as unknown as { apiKey: string }).apiKey,
      baseURL: free.baseURL,
      model: free.model,
      modelSlug: free.slug,
      apiModel: free.model,
      litellmModel: free.litellmModel, // provider-prefixed for LiteLLM pass-through
    };
  }

  // Layer 2 (canon): Goblin-bundled models — API-first, server-side key.
  // Unreachable while GOBLIN_HOSTED_API is off (getGoblinHostedConfig → null).
  // The default fallback uses the efficient tier (Swift); an EXPLICIT goblin/*
  // selection is handled at the top of resolveModel (ahead of BYOK).
  const hosted = getGoblinHostedConfig();
  if (hosted) {
    return buildGoblinRoute(hosted, GOBLIN_DEFAULT_TIER.id);
  }

  throw new GoblinError(
    'unknown',
    'No AI model connected. Add your own API key in Settings → API Keys. ' +
    'Free options: Groq (groq.com), Google AI Studio (aistudio.google.com), OpenRouter (openrouter.ai).'
  );
}

// ─── 10.9-3 — circuit-breaker fallback ──────────────────────────────────────────
// If the resolved provider is currently 'degraded', try to re-route to the first
// model in the user's fallback chain whose provider is healthy AND which the user
// actually has a key for. Conservative: any uncertainty → keep the original route
// (never throws, never regresses a working generation).
async function applyHealthFallback(
  userId: string,
  route: RouteResult,
  supabase?: SupabaseClient,
): Promise<{ route: RouteResult; reroutedFrom?: ProviderName }> {
  if (getHealth(route.provider).state !== 'degraded') return { route };
  try {
    const chain = await getFallbackChain(userId, getSupabaseAdmin());
    for (const slug of chain) {
      const prov = slugToProvider(slug);
      if (!prov || prov === route.provider) continue;
      if (getHealth(prov).state === 'degraded') continue;
      const alt = await resolveModel(userId, slug, supabase);
      // Only accept the reroute if it actually landed on the intended healthy
      // provider (resolveModel falls back to any key otherwise).
      if (alt.provider === prov && getHealth(alt.provider).state !== 'degraded') {
        return { route: alt, reroutedFrom: route.provider };
      }
    }
  } catch { /* keep original route */ }
  return { route };
}

// ─── Streaming ────────────────────────────────────────────────────────────────

interface StreamCompletionParams {
  userId: string;
  projectId?: string | null;
  message: string;
  chatHistory: Array<{ role: string; content: string }>;
  modelPreference?: string;
  supabase?: SupabaseClient;
  timeoutMs?: number;
  signal?: AbortSignal;
  // F1.1 — platform identity + project context. Sent as the `system` param on
  // Anthropic and as a leading system message on OpenAI-compatible providers.
  systemPrompt?: string;
}

export async function* streamCompletion({
  userId,
  projectId,
  message,
  chatHistory,
  modelPreference,
  supabase,
  timeoutMs = 120_000,
  signal,
  systemPrompt,
}: StreamCompletionParams): AsyncGenerator<string, void, unknown> {
  const resolved = await resolveModel(userId, modelPreference, supabase);
  // 10.9-3 — if the resolved provider is degraded, transparently re-route to a
  // healthy provider in the user's fallback chain (no-op when all healthy).
  const { route, reroutedFrom } = await applyHealthFallback(userId, resolved, supabase);

  const messages = [
    ...chatHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];
  // OpenAI-compatible providers (incl. LiteLLM + the Goblin-hosted wholesale
  // endpoint) take the system prompt as a leading system message; Anthropic
  // takes it as the dedicated `system` param below.
  const oaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = systemPrompt
    ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
    : messages;

  let inputTokens = 0;
  let outputTokens = 0;

  // HR-3 fair-use enforcement — only for the Goblin-hosted (server-keyed) tier, and
  // ALWAYS pre-stream so the current run is never cut mid-build. The run that pushes
  // a user over the line still completes; THIS next run is what gets the calm
  // refusal. Two checks, both in weighted cost units (Swift + Forge×4.4):
  //   1. monthly allowance (user-facing fair use) → resets next month / upgrade
  //   2. per-plan daily guard (anti-abuse firewall) → resets tomorrow
  if (route.layer === 'goblin_hosted') {
    const { plan, lang } = await getUserPlanAndLang(userId, supabase);
    const usage = await goblinWeightedUsage(userId, supabase);

    if (isOverMonthlyAllowance(usage.monthSwift, usage.monthForge, plan)) {
      yield JSON.stringify({
        type: 'error',
        code: 'allowance_reached',
        message: allowanceReachedMsg(lang, nextMonthlyResetISO()),
      });
      return;
    }

    if (isOverDailyGuard(usage.daySwift, usage.dayForge, plan)) {
      yield JSON.stringify({
        type: 'error',
        code: 'daily_guard',
        message: dailyGuardMsg(lang),
      });
      return;
    }
  }

  if (reroutedFrom) {
    yield JSON.stringify({
      type: 'fallback_notice',
      reason: `${reroutedFrom} ist gerade instabil — Routing zu ${route.provider}.`,
    });
  }

  yield JSON.stringify({
    type: 'meta',
    source_tier: route.layer,
    model: route.model,
    model_slug: route.modelSlug,
    provider: route.provider,
  });

  const { createClient } = await import('@supabase/supabase-js');
  const sb = supabase ?? getSupabaseAdmin();

  const { data: agentRun } = await sb
    .from('agent_runs')
    .insert({ user_id: userId, project_id: projectId, model_used: route.model, source_tier: route.layer, status: 'running' })
    .select().single();

  // Try LiteLLM first if configured. The Goblin-hosted tier always uses its own
  // injectable client (never the optional LiteLLM proxy) so the wholesale provider
  // call path stays single-source and deterministically testable.
  const litellmBase = route.layer === 'goblin_hosted' ? undefined : process.env.LITELLM_BASE_URL;
  if (litellmBase) {
    try {
      for await (const delta of litellmStream(route.litellmModel, oaiMessages, { apiKey: route.apiKey, timeout: timeoutMs, signal })) {
        if (delta.type === 'delta' && delta.content) {
          yield JSON.stringify({ type: 'delta', content: delta.content });
        } else if (delta.type === 'usage') {
          inputTokens = delta.input_tokens ?? 0;
          outputTokens = delta.output_tokens ?? 0;
        }
      }
      // Done — emit token info
      const tokenDisplay = formatTokenDisplay(inputTokens, outputTokens, route.layer, route.modelSlug);
      if (agentRun) {
        await sb.from('agent_runs').update({ status: 'success', input_tokens: inputTokens, output_tokens: outputTokens, completed_at: new Date().toISOString() }).eq('id', agentRun.id);
      }
      await trackCompletion({
        userId,
        provider: route.provider,
        model: route.model,
        sourceTier: route.layer,
        tokensIn: inputTokens,
        tokensOut: outputTokens,
      });
      recordOutcome(route.provider, true);
      yield JSON.stringify({ type: 'done', input_tokens: inputTokens, output_tokens: outputTokens, token_display: tokenDisplay, source_tier: route.layer, model_used: route.model });
      return;
    } catch (err) {
      recordOutcome(route.provider, false, { slug: route.modelSlug, modelNotFound: isModelNotFound(err) });
      if (!isGoblinError(err) || (err.code !== 'rate_limit' && err.code !== 'provider_down')) {
        throw err; // Hard error (invalid key, etc.) — propagate
      }
      // Soft error (rate limit / down) — fall through to direct API
      yield JSON.stringify({ type: 'fallback_notice', reason: err.message });
    }
  }

  // Direct SDK fallback — the real routing path (OPTION B; see
  // sprint-10-9/PHASE_0_GATE.md). HARD SLUG RULE (10.9, §1): `route.model` is the
  // model id exactly as the provider's own /models endpoint returned it
  // (provider-discovery → byok_keys.discovered_models, prefix stripped by
  // slugToModelId). Send it to the provider VERBATIM. Do NOT canonicalize it to a
  // "LiteLLM-canonical" name or guess an alias here — when Goblin talks directly
  // to a provider, the provider only accepts its own slug. A provider
  // "model not found / invalid model" error is a slug failure: it must surface
  // (and feed the 10.9-3 circuit breaker), never be silently rewritten.
  try {
    if (route.layer === 'goblin_hosted') {
      // Goblin-bundled (server-side key) tier — routed through the injectable
      // DeepInfra client (real in prod, deterministic mock in Stage-A tests). Sends
      // the wholesale provider slug (route.apiModel), never the tier id.
      const hosted = getGoblinHostedConfig();
      if (!hosted) throw new GoblinError('unknown', 'Goblin model service is unavailable.');
      const client = getGoblinClient(hosted);
      for await (const part of client.stream({
        model: route.apiModel,
        messages: oaiMessages,
        maxTokens: GOBLIN_MAX_TOKENS_PER_REQUEST,
        signal,
      })) {
        if (part.type === 'delta' && part.content) {
          yield JSON.stringify({ type: 'delta', content: part.content });
        } else if (part.type === 'usage') {
          inputTokens = part.inputTokens ?? 0;
          outputTokens = part.outputTokens ?? 0;
        }
      }
    } else if (route.provider === 'anthropic') {
      const anthropic = new Anthropic({ apiKey: route.apiKey });
      const model = route.apiModel;
      const stream = await anthropic.messages.create({ model, max_tokens: 8096, messages, stream: true, ...(systemPrompt ? { system: systemPrompt } : {}) });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield JSON.stringify({ type: 'delta', content: event.delta.text });
        } else if (event.type === 'message_start') {
          inputTokens = event.message.usage.input_tokens;
        } else if (event.type === 'message_delta' && event.usage) {
          outputTokens = event.usage.output_tokens;
        }
      }
    } else {
      const openai = new OpenAI({ apiKey: route.apiKey, baseURL: route.baseURL });
      const model = route.apiModel;
      const stream = await openai.chat.completions.create({ model, max_tokens: 8096, messages: oaiMessages, stream: true, stream_options: { include_usage: true } });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) yield JSON.stringify({ type: 'delta', content: text });
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? 0;
          outputTokens = chunk.usage.completion_tokens ?? 0;
        }
      }
    }

    const tokenDisplay = formatTokenDisplay(inputTokens, outputTokens, route.layer, route.modelSlug);
    if (agentRun) {
      await sb.from('agent_runs').update({ status: 'success', input_tokens: inputTokens, output_tokens: outputTokens, completed_at: new Date().toISOString() }).eq('id', agentRun.id);
    }
    await trackCompletion({
      userId,
      provider: route.provider,
      model: route.model,
      sourceTier: route.layer,
      tokensIn: inputTokens,
      tokensOut: outputTokens,
    });
    // Goblin-hosted maps to provider 'openai'; don't let its health bleed into the
    // real OpenAI BYOK breaker.
    if (route.layer !== 'goblin_hosted') recordOutcome(route.provider, true);
    yield JSON.stringify({ type: 'done', input_tokens: inputTokens, output_tokens: outputTokens, token_display: tokenDisplay, source_tier: route.layer, model_used: route.model });
  } catch (err: unknown) {
    if (route.layer !== 'goblin_hosted') recordOutcome(route.provider, false, { slug: route.modelSlug, modelNotFound: isModelNotFound(err) });
    if (agentRun) {
      await sb.from('agent_runs').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', agentRun.id);
    }
    const msg = isGoblinError(err) ? err.message : (err instanceof Error ? err.message : 'Stream failed');
    yield JSON.stringify({ type: 'error', message: msg });
  }
}

// ─── First-token watchdog ──────────────────────────────────────────────────────
// streamCompletion can stall after the `meta` event if the upstream provider
// accepts the connection but never streams a token (the Gemini "spins forever"
// symptom). The provider-level timeout is 120s — far too long to leave a user
// staring at a spinner with no feedback. This wrapper races the first
// content/done event against a short deadline; on timeout it cancels the
// upstream fetch (via the chained AbortController) and emits a friendly error
// the chat UI already knows how to render.
const FIRST_TOKEN_TIMEOUT_MS = 45_000;

export async function* streamCompletionGuarded(
  params: StreamCompletionParams,
): AsyncGenerator<string, void, unknown> {
  const abort = new AbortController();
  params.signal?.addEventListener('abort', () => abort.abort());

  const it = streamCompletion({ ...params, signal: abort.signal })[Symbol.asyncIterator]();
  let sawContent = false;

  try {
    while (true) {
      const next = it.next();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const guarded: Promise<IteratorResult<string>> = sawContent
        ? next
        : Promise.race([
            next,
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new GoblinError('timeout', 'first-token-timeout')),
                params.timeoutMs ?? FIRST_TOKEN_TIMEOUT_MS,
              );
            }),
          ]);

      let res: IteratorResult<string>;
      try {
        res = await guarded;
      } finally {
        if (timer) clearTimeout(timer);
      }

      if (res.done) break;

      // Once any real content (or a terminal event) has flowed, drop the
      // first-token deadline — long replies are legitimate.
      try {
        const parsed = JSON.parse(res.value) as { type?: string };
        if (parsed.type === 'delta' || parsed.type === 'done' || parsed.type === 'error') {
          sawContent = true;
        }
      } catch { /* non-JSON token — treat as content */ sawContent = true; }

      yield res.value;
    }
  } catch (err) {
    abort.abort(); // cancel the dangling upstream fetch
    const isTimeout = isGoblinError(err) && err.code === 'timeout';
    const message = isTimeout
      ? 'Das Modell hat nicht rechtzeitig geantwortet. Bitte versuche es erneut oder wähle ein anderes Modell.'
      : (err instanceof Error ? err.message : 'Stream failed');
    yield JSON.stringify({ type: 'error', message });
  }
}

// ─── Fallback chain persistence ───────────────────────────────────────────────

export async function saveFallbackChain(userId: string, chain: string[], supabase: SupabaseClient): Promise<void> {
  // Store in a dedicated user preferences table or use project-level preferences
  // For now: store in Supabase user metadata via service role
  const { createClient } = await import('@supabase/supabase-js');
  const sb = supabase ?? getSupabaseAdmin();
  await sb.auth.admin.updateUserById(userId, { user_metadata: { fallback_chain: chain } });
}

export async function getFallbackChain(userId: string, supabase: SupabaseClient): Promise<string[]> {
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  return (user?.user_metadata?.fallback_chain as string[]) ?? [];
}
