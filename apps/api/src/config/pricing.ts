// Provider pricing per 1M tokens (USD) — last updated April 2026
// Source: official provider pricing pages
export const PRICING_PER_M: Record<string, { input: number; output: number }> = {
  'anthropic/claude-opus-4-5':   { input: 15.00,  output: 75.00  },
  'anthropic/claude-sonnet-4-6': { input:  3.00,  output: 15.00  },
  'anthropic/claude-haiku-4-5':  { input:  0.80,  output:  4.00  },
  'openai/gpt-4o':               { input:  2.50,  output: 10.00  },
  'openai/gpt-4o-mini':          { input:  0.15,  output:  0.60  },
  'openai/o1':                   { input: 15.00,  output: 60.00  },
  'openai/o3-mini':              { input:  1.10,  output:  4.40  },
  'gemini/gemini-2.0-flash':     { input:  0.075, output:  0.30  },
  'gemini/gemini-1.5-pro':       { input:  1.25,  output:  5.00  },
  'groq/llama-3.3-70b-versatile':{ input:  0.59,  output:  0.79  },
  'groq/mixtral-8x7b-32768':     { input:  0.24,  output:  0.24  },
  'mistral/mistral-large-latest': { input:  2.00,  output:  6.00  },
  'mistral/mistral-small-latest': { input:  0.20,  output:  0.60  },
  'xai/grok-3':                  { input:  3.00,  output: 15.00  },
  'xai/grok-3-mini':             { input:  0.30,  output:  0.50  },
  'deepseek/deepseek-chat':      { input:  0.27,  output:  1.10  },
  'deepseek/deepseek-reasoner':  { input:  0.55,  output:  2.19  },
  // Free API — no cost to user
  'free/gemini-flash':           { input: 0, output: 0 },
  'free/llama-70b':              { input: 0, output: 0 },
};

/** Calculate cost in USD. Returns null if price unknown. */
export function calcCostUsd(slug: string, inputTokens: number, outputTokens: number): number | null {
  // Normalize slug for lookup
  const key = Object.keys(PRICING_PER_M).find(k =>
    slug.includes(k) || k.includes(slug) || slug === k
  );
  if (!key) return null;
  const p = PRICING_PER_M[key]!;
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

/** Format token display string: "↑1,240 ↓856 · $0.0024" */
export function formatTokenDisplay(
  inputTokens: number,
  outputTokens: number,
  layer: string,
  slug: string,
): string {
  const counts = `↑${inputTokens.toLocaleString()} ↓${outputTokens.toLocaleString()} tokens`;
  if (layer === 'goblin_hosted') return counts;
  if (layer === 'free_api') return `${counts} · Free`;
  const cost = calcCostUsd(slug, inputTokens, outputTokens);
  if (cost === null) return counts;
  if (cost < 0.0001) return `${counts} · <$0.0001`;
  return `${counts} · $${cost.toFixed(4)}`;
}
