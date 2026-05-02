import { describe, it, expect } from 'vitest';
import { calcCostUsd, formatTokenDisplay, PRICING_PER_M } from '../config/pricing.js';

describe('pricing-calculations — precision & edge cases', () => {
  it('1000 input tokens at $3/M = $0.003', () => {
    // claude-sonnet-4-6 input: $3.00 per 1M tokens
    // 1000 / 1_000_000 * 3.00 = 0.003
    const result = calcCostUsd('anthropic/claude-sonnet-4-6', 1000, 0);
    expect(result).toBeCloseTo(0.003, 10);
  });

  it('very small cost (1 token) formats as "< $0.0001" in formatTokenDisplay', () => {
    // 1 input token at $3/M = $0.000003 — well below $0.0001 threshold
    const display = formatTokenDisplay(1, 0, 'byok', 'anthropic/claude-sonnet-4-6');
    expect(display).toContain('<$0.0001');
  });

  it('cost above $0.0001 threshold is shown as dollar amount, not "< $0.0001"', () => {
    // claude-sonnet-4-6 input: $3/M
    // 1000 tokens → $0.003 — above the 0.0001 threshold → shown as "$0.0030"
    const cost = calcCostUsd('anthropic/claude-sonnet-4-6', 1000, 0);
    expect(cost).toBeGreaterThan(0.0001);
    const display = formatTokenDisplay(1000, 0, 'byok', 'anthropic/claude-sonnet-4-6');
    expect(display).not.toContain('<$0.0001');
    expect(display).toMatch(/\$\d+\.\d{4}/);
  });

  it('all entries in PRICING_PER_M have non-negative input and output prices', () => {
    for (const [slug, prices] of Object.entries(PRICING_PER_M)) {
      expect(prices.input, `${slug} input price should be >= 0`).toBeGreaterThanOrEqual(0);
      expect(prices.output, `${slug} output price should be >= 0`).toBeGreaterThanOrEqual(0);
    }
  });

  it('PRICING_PER_M contains at least one entry', () => {
    expect(Object.keys(PRICING_PER_M).length).toBeGreaterThan(0);
  });

  it('calcCostUsd is additive: input cost + output cost = total', () => {
    const slug = 'openai/gpt-4o';
    const inputTokens = 500_000;
    const outputTokens = 200_000;
    const inputOnly = calcCostUsd(slug, inputTokens, 0)!;
    const outputOnly = calcCostUsd(slug, 0, outputTokens)!;
    const total = calcCostUsd(slug, inputTokens, outputTokens)!;
    expect(total).toBeCloseTo(inputOnly + outputOnly, 10);
  });

  it('cost scales linearly with token count', () => {
    const slug = 'anthropic/claude-sonnet-4-6';
    const cost1 = calcCostUsd(slug, 1_000, 0)!;
    const cost2 = calcCostUsd(slug, 2_000, 0)!;
    expect(cost2).toBeCloseTo(cost1 * 2, 10);
  });

  it('free models always return 0 regardless of token count', () => {
    expect(calcCostUsd('free/gemini-flash', 999_999_999, 999_999_999)).toBe(0);
    expect(calcCostUsd('free/llama-70b', 1_000_000, 1_000_000)).toBe(0);
  });

  it('calcCostUsd handles large token counts without overflow', () => {
    // 1 billion tokens each
    const result = calcCostUsd('anthropic/claude-sonnet-4-6', 1_000_000_000, 1_000_000_000);
    expect(result).toBe(18_000); // 3000 + 15000
    expect(Number.isFinite(result!)).toBe(true);
  });
});
