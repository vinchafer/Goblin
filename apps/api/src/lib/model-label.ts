import { GOBLIN_HOSTED_TIERS } from '../services/goblin-hosted';

/** goblin/efficient → "Goblin Swift", goblin/premium → "Goblin Forge". */
const GOBLIN_TIER_LABEL = new Map<string, string>(
  GOBLIN_HOSTED_TIERS.map((t) => [t.id as string, t.name]),
);

/**
 * User-facing label for a model on a usage / activity surface.
 *
 * Two-level truth (HR-4): a Goblin-bundled run is ALWAYS shown as its public tier
 * name (Goblin Swift / Goblin Forge) — NEVER the internal tier id `goblin/efficient`
 * and NEVER the underlying open-source provider slug. BYOK / free models are humanized
 * (provider prefix dropped, trailing date stripped, title-cased) so the breakdown never
 * shows a raw slug like `groq/llama-3.3-70b-versatile`.
 *
 * The `sourceTier` guard is the important safety net: any `goblin_hosted` run whose
 * recorded model is not a known tier id collapses to the neutral "Goblin" label, so a
 * future routing/recording change can never leak the wholesale model slug to the user.
 */
export function usageModelLabel(
  modelUsed: string | null | undefined,
  sourceTier?: string | null,
): string {
  const raw = (modelUsed ?? '').trim();
  if (!raw) return sourceTier === 'goblin_hosted' ? 'Goblin' : 'Unbekannt';

  const tierName = GOBLIN_TIER_LABEL.get(raw);
  if (tierName) return tierName;

  // Defensive: a goblin_hosted run that didn't record a known tier id must not
  // surface its raw value (that would leak the underlying open-source model slug).
  if (sourceTier === 'goblin_hosted') return 'Goblin';

  const bare = raw.includes('/') ? raw.split('/').slice(1).join('/') : raw;
  const cleaned = bare
    .replace(/-?\d{8}$/i, '')        // claude-3-5-sonnet-20240620 → …sonnet
    .replace(/[-_]+/g, ' ')
    .replace(/\bversatile\b/i, '')    // groq llama-3.3-70b-versatile → Llama 3.3 70b
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());

  return cleaned || raw;
}
