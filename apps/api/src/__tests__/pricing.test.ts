import { describe, it, expect } from 'vitest';
import { calcCostUsd, formatTokenDisplay, PRICING_PER_M } from '../config/pricing.js';

describe('calcCostUsd', () => {
  it('calculates cost for anthropic/claude-sonnet-4-6 with 1M input + 1M output = $18.00', () => {
    const result = calcCostUsd('anthropic/claude-sonnet-4-6', 1_000_000, 1_000_000);
    // input: 3.00/M * 1M = 3.00 | output: 15.00/M * 1M = 15.00 | total = 18.00
    expect(result).toBe(18.00);
  });

  it('calculates cost = 0 for free/gemini-flash', () => {
    const result = calcCostUsd('free/gemini-flash', 1_000_000, 1_000_000);
    expect(result).toBe(0);
  });

  it('returns null for an unknown slug', () => {
    const result = calcCostUsd('unknown/some-model-xyz', 1000, 1000);
    expect(result).toBeNull();
  });

  it('returns 0 for 0 tokens on a known model', () => {
    const result = calcCostUsd('anthropic/claude-sonnet-4-6', 0, 0);
    expect(result).toBe(0);
  });

  it('calculates only input cost when outputTokens = 0', () => {
    // claude-sonnet-4-6: $3/M input
    const result = calcCostUsd('anthropic/claude-sonnet-4-6', 1_000_000, 0);
    expect(result).toBe(3.00);
  });

  it('calculates only output cost when inputTokens = 0', () => {
    // claude-sonnet-4-6: $15/M output
    const result = calcCostUsd('anthropic/claude-sonnet-4-6', 0, 1_000_000);
    expect(result).toBe(15.00);
  });
});

describe('formatTokenDisplay', () => {
  it('goblin_hosted layer returns only token counts (no cost)', () => {
    const result = formatTokenDisplay(1000, 500, 'goblin_hosted', 'anthropic/claude-sonnet-4-6');
    // Should NOT contain "·" (cost separator)
    expect(result).not.toContain('·');
    expect(result).toContain('↑');
    expect(result).toContain('↓');
    expect(result).toContain('tokens');
  });

  it('free_api layer returns counts + "Free"', () => {
    const result = formatTokenDisplay(1000, 500, 'free_api', 'free/gemini-flash');
    expect(result).toContain('Free');
    expect(result).toContain('·');
  });

  it('byok layer with known model returns "$X.XXXX" format', () => {
    // 100_000 input at $3/M = $0.3000, 100_000 output at $15/M = $1.5000 → total $1.8000
    const result = formatTokenDisplay(100_000, 100_000, 'byok', 'anthropic/claude-sonnet-4-6');
    expect(result).toMatch(/\$\d+\.\d{4}/);
    expect(result).toContain('· $1.8000');
  });

  it('byok layer with unknown model returns only token counts', () => {
    const result = formatTokenDisplay(1000, 500, 'byok', 'unknown/model-xyz');
    expect(result).not.toContain('·');
    expect(result).toContain('tokens');
  });

  it('very small cost shows as "< $0.0001"', () => {
    // 1 input token at $3/M = $0.000003 → below threshold
    const result = formatTokenDisplay(1, 0, 'byok', 'anthropic/claude-sonnet-4-6');
    expect(result).toContain('<$0.0001');
  });

  it('formats 0 tokens as "↑0 ↓0 tokens"', () => {
    const result = formatTokenDisplay(0, 0, 'goblin_hosted', 'anthropic/claude-sonnet-4-6');
    expect(result).toBe('↑0 ↓0 tokens');
  });

  it('free_api with 0 tokens returns counts + Free', () => {
    const result = formatTokenDisplay(0, 0, 'free_api', 'free/gemini-flash');
    expect(result).toBe('↑0 ↓0 tokens · Free');
  });
});
