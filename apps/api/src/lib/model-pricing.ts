// USD per 1M tokens. Update quarterly from provider pricing pages.
// Last update: 2026-05-15.

interface ModelPrice {
  in_per_million: number;
  out_per_million: number;
}

const PRICING: Record<string, ModelPrice> = {
  // Anthropic
  'claude-opus-4-7': { in_per_million: 15.0, out_per_million: 75.0 },
  'claude-opus-4-6': { in_per_million: 15.0, out_per_million: 75.0 },
  'claude-sonnet-4-6': { in_per_million: 3.0, out_per_million: 15.0 },
  'claude-haiku-4-5': { in_per_million: 0.80, out_per_million: 4.0 },

  // OpenAI
  'gpt-5.1': { in_per_million: 10.0, out_per_million: 30.0 },
  'gpt-5': { in_per_million: 5.0, out_per_million: 15.0 },
  'gpt-4o-mini': { in_per_million: 0.15, out_per_million: 0.60 },

  // Google
  'gemini-2.5-pro': { in_per_million: 1.25, out_per_million: 5.0 },
  'gemini-2.5-flash': { in_per_million: 0.075, out_per_million: 0.30 },

  // Groq / Llama
  'llama-3.3-70b': { in_per_million: 0.59, out_per_million: 0.79 },

  // Goblin-bundled (Layer 2, API-first) — wholesale per-token cost basis.
  // Efficient = Flash-class default; premium = frontier-adjacent upsell.
  'goblin/efficient': { in_per_million: 0.14, out_per_million: 0.28 },
  'goblin/premium': { in_per_million: 0.95, out_per_million: 3.48 },

  default: { in_per_million: 5.0, out_per_million: 15.0 },
};

export function calculateCost(model: string, tokensIn: number, tokensOut: number): number {
  const price = PRICING[model] ?? PRICING.default!;
  const inCost = (tokensIn / 1_000_000) * price.in_per_million;
  const outCost = (tokensOut / 1_000_000) * price.out_per_million;
  return Number((inCost + outCost).toFixed(6));
}

export function getPricing(model: string): ModelPrice {
  return PRICING[model] ?? PRICING.default!;
}
