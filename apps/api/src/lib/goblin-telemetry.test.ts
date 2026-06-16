import { describe, it, expect } from 'vitest';
import { aggregateTelemetry, tierOf, type CompletionRow } from './goblin-telemetry';
import { weightedCostUnits } from './goblin-cap';

const TS = '2026-06-10T12:00:00Z';
const row = (over: Partial<CompletionRow>): CompletionRow => ({
  user_id: 'u1', model: 'goblin/efficient', tokens_in: 0, tokens_out: 0, cost_usd: 0, created_at: TS, ...over,
});

describe('tierOf', () => {
  it('premium → forge, everything else → swift', () => {
    expect(tierOf('goblin/premium')).toBe('forge');
    expect(tierOf('goblin/efficient')).toBe('swift');
    expect(tierOf('anything')).toBe('swift');
  });
});

describe('aggregateTelemetry — totals + Swift/Forge split', () => {
  const rows: CompletionRow[] = [
    row({ user_id: 'u1', model: 'goblin/efficient', tokens_in: 100, tokens_out: 50, cost_usd: 0.00002 }),
    row({ user_id: 'u1', model: 'goblin/premium',   tokens_in: 200, tokens_out: 100, cost_usd: 0.0003 }),
    row({ user_id: 'u2', model: 'goblin/efficient', tokens_in: 400, tokens_out: 0,  cost_usd: 0.00006 }),
  ];

  it('splits Swift vs Forge raw tokens', () => {
    const s = aggregateTelemetry(rows);
    expect(s.totalSwiftTokens).toBe(100 + 50 + 400); // 550
    expect(s.totalForgeTokens).toBe(200 + 100);      // 300
    expect(s.totalTokens).toBe(850);
  });

  it('weights cost units with Forge×4.4 (cap unit)', () => {
    const s = aggregateTelemetry(rows);
    expect(s.weightedCostUnits).toBe(weightedCostUnits(550, 300));
  });

  it('counts active users + completions and averages per user', () => {
    const s = aggregateTelemetry(rows);
    expect(s.activeUsers).toBe(2);
    expect(s.completions).toBe(3);
    expect(s.avgTokensPerUser).toBe(Math.round(850 / 2));
  });

  it('sums estimated $ (founder-only field)', () => {
    const s = aggregateTelemetry(rows);
    expect(s.estimatedCostUsd).toBeCloseTo(0.00002 + 0.0003 + 0.00006, 6);
  });
});

describe('aggregateTelemetry — plan distribution + heavy tail', () => {
  const rows: CompletionRow[] = [
    row({ user_id: 'heavy', model: 'goblin/premium', tokens_in: 1_000_000, tokens_out: 0 }),
    row({ user_id: 'light', model: 'goblin/efficient', tokens_in: 1_000, tokens_out: 0 }),
    row({ user_id: 'mid',   model: 'goblin/efficient', tokens_in: 50_000, tokens_out: 0 }),
  ];
  const plans = { heavy: 'trial', light: 'pro', mid: 'unknownplan' };

  it('buckets active users by plan (unknown → other)', () => {
    const s = aggregateTelemetry(rows, plans);
    expect(s.planDistribution.trial).toBe(1);
    expect(s.planDistribution.pro).toBe(1);
    expect(s.planDistribution.other).toBe(1);
    expect(s.planDistribution.build).toBe(0);
  });

  it('ranks the heavy tail by weighted units, no PII beyond user id', () => {
    const s = aggregateTelemetry(rows, plans, 2);
    expect(s.topUsers).toHaveLength(2);
    expect(s.topUsers[0]!.userId).toBe('heavy'); // 1M Forge ×4.4 = 4.4M units
    expect(s.topUsers[0]!.weightedUnits).toBe(weightedCostUnits(0, 1_000_000));
    expect(Object.keys(s.topUsers[0]!)).not.toContain('email');
  });
});

describe('aggregateTelemetry — zero/unknown tokens are flagged, never dropped (HR-1)', () => {
  const rows: CompletionRow[] = [
    row({ user_id: 'u1', model: 'goblin/efficient', tokens_in: 0, tokens_out: 0, cost_usd: 0 }),
    row({ user_id: 'u1', model: 'goblin/efficient', tokens_in: 10, tokens_out: 5, cost_usd: 0.000001 }),
  ];

  it('keeps the zero-token completion and counts it as flagged', () => {
    const s = aggregateTelemetry(rows);
    expect(s.completions).toBe(2);            // both kept
    expect(s.zeroTokenCompletions).toBe(1);   // the empty one flagged
    expect(s.topUsers[0]!.zeroTokenCompletions).toBe(1);
    expect(s.totalTokens).toBe(15);           // only real tokens counted
  });

  it('defends against malformed token values (NaN/negative → 0, no throw)', () => {
    const bad = aggregateTelemetry([
      row({ user_id: 'u1', tokens_in: Number.NaN, tokens_out: -5 }),
      row({ user_id: 'u1', model: 'goblin/premium', tokens_in: 100, tokens_out: Number.POSITIVE_INFINITY }),
    ]);
    expect(bad.totalSwiftTokens).toBe(0);
    expect(bad.totalForgeTokens).toBe(100);
    expect(bad.reconciliation.consistent).toBe(true);
  });
});

describe('reconciliation — the "1000%" guarantee', () => {
  it('completion_costs tokens == telemetry rollup == cap rollup', () => {
    const rows: CompletionRow[] = [];
    for (let i = 0; i < 50; i++) {
      rows.push(row({
        user_id: `u${i % 7}`,
        model: i % 3 === 0 ? 'goblin/premium' : 'goblin/efficient',
        tokens_in: (i * 137) % 9000,
        tokens_out: (i * 31) % 4000,
        cost_usd: ((i * 13) % 100) / 100000,
      }));
    }
    const s = aggregateTelemetry(rows);
    const r = s.reconciliation;
    expect(r.completionCostsTokens).toBe(r.telemetryTokens);
    expect(r.capRollupUnits).toBe(r.telemetryRollupUnits);
    expect(r.capRollupUnits).toBe(s.weightedCostUnits);
    expect(r.consistent).toBe(true);
  });

  it('empty month reconciles cleanly at zero', () => {
    const s = aggregateTelemetry([]);
    expect(s.activeUsers).toBe(0);
    expect(s.avgTokensPerUser).toBe(0);
    expect(s.reconciliation.consistent).toBe(true);
    expect(s.weightedCostUnits).toBe(0);
  });
});
