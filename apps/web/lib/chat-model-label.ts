// Two-level truth (HR-4 / H-2): turn a raw streamed model id + source tier into the
// ONLY thing a user may see — a human label. NEVER show the internal tier id
// (`goblin/efficient` / `goblin/premium`), the `source_tier` (`goblin_hosted` /
// `byok` / `free_api`), or a raw provider slug under a chat message.
//
// - Goblin-bundled tiers → their display name ("Goblin Swift" / "Goblin Forge").
// - Anything else (a user's own BYOK model) → the slug with the provider prefix
//   stripped and lightly humanized. The source_tier is dropped entirely.

import { GOBLIN_HOSTED_MODELS } from './goblin-hosted-models';

const GOBLIN_BY_ID: Record<string, string> = Object.fromEntries(
  GOBLIN_HOSTED_MODELS.map((m) => [m.id, m.name]),
);

/** Human label for a streamed assistant message. Empty string → render nothing. */
export function chatModelLabel(modelUsed?: string | null): string {
  if (!modelUsed) return '';
  // Goblin-bundled tier id → its display name (never the raw id).
  if (GOBLIN_BY_ID[modelUsed]) return GOBLIN_BY_ID[modelUsed]!;
  // A stray "goblin/<x>" we don't recognise must still never leak the slug.
  if (modelUsed.startsWith('goblin/')) return 'Goblin';
  // BYOK / other: strip the provider prefix and tidy the remainder.
  const bare = modelUsed.replace(/^[a-z0-9-]+\//i, '');
  return bare || modelUsed;
}
