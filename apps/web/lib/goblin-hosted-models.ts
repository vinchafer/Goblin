// Goblin-bundled models — Layer 2 (canon), API-first (v6.1 pivot).
// Provider-agnostic, server-side-keyed. Mirrors apps/api/src/services/goblin-hosted.ts
// tier shape. Display names are placeholders the founder can rename without code
// changes — the wholesale provider behind them is never named on a public surface.
//
// Gated by NEXT_PUBLIC_GOBLIN_HOSTED_API (default off). While off, the UI shows a
// neutral "coming soon" state and never implies a live cap is enforced.

export const GOBLIN_HOSTED_MODELS = [
  {
    id: 'goblin/efficient',
    name: 'Goblin Swift',
    description: 'Goblin-bundled coding model — fast, efficient, no key required.',
    plans: ['build', 'pro', 'power'] as string[],
  },
  {
    id: 'goblin/premium',
    name: 'Goblin Forge',
    description: 'Goblin-bundled premium model — frontier-adjacent, Pro and Power plans.',
    plans: ['pro', 'power'] as string[],
  },
] as const;

export const GOBLIN_HOSTED_ENABLED = process.env.NEXT_PUBLIC_GOBLIN_HOSTED_API === 'true';
