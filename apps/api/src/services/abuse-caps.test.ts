// WAVE-D · D-2 gate — the abuse-cap primitives. Each cap trips at its threshold and
// leaves legitimate use unaffected; env knobs are honored; denied requests do not
// consume budget.

import { describe, it, expect, afterEach } from 'vitest';
import {
  agentRunsPerHour,
  publishesPerHour,
  attachmentBytesPerDay,
  consumeDailyBytes,
  __resetDailyBytesForTest,
} from './abuse-caps';

afterEach(() => {
  __resetDailyBytesForTest();
  delete process.env.AGENT_RUNS_PER_HOUR;
  delete process.env.PUBLISHES_PER_HOUR;
  delete process.env.ATTACHMENT_BYTES_PER_DAY;
});

describe('env knobs', () => {
  it('use defaults when unset', () => {
    expect(agentRunsPerHour()).toBe(30);
    expect(publishesPerHour()).toBe(20);
    expect(attachmentBytesPerDay()).toBe(100 * 1024 * 1024);
  });
  it('honor a valid override', () => {
    process.env.AGENT_RUNS_PER_HOUR = '5';
    process.env.PUBLISHES_PER_HOUR = '3';
    process.env.ATTACHMENT_BYTES_PER_DAY = '1048576';
    expect(agentRunsPerHour()).toBe(5);
    expect(publishesPerHour()).toBe(3);
    expect(attachmentBytesPerDay()).toBe(1048576);
  });
  it('ignore an invalid/zero/negative override', () => {
    process.env.AGENT_RUNS_PER_HOUR = 'nope';
    process.env.PUBLISHES_PER_HOUR = '0';
    process.env.ATTACHMENT_BYTES_PER_DAY = '-5';
    expect(agentRunsPerHour()).toBe(30);
    expect(publishesPerHour()).toBe(20);
    expect(attachmentBytesPerDay()).toBe(100 * 1024 * 1024);
  });
});

describe('consumeDailyBytes — bytes-per-day cap', () => {
  it('allows usage up to the cap and denies the request that would exceed it', () => {
    const cap = 1000;
    expect(consumeDailyBytes('attachment', 'u1', 600, cap).allowed).toBe(true);
    // 600 + 300 = 900 ≤ 1000 → allowed
    expect(consumeDailyBytes('attachment', 'u1', 300, cap).allowed).toBe(true);
    // 900 + 200 = 1100 > 1000 → denied, and NOT consumed
    const denied = consumeDailyBytes('attachment', 'u1', 200, cap);
    expect(denied.allowed).toBe(false);
    expect(denied.usedBytes).toBe(900); // unchanged — a denied request never counts
    // a smaller request that still fits is allowed (proves the deny didn't consume)
    expect(consumeDailyBytes('attachment', 'u1', 100, cap).allowed).toBe(true);
  });

  it('is per-user (one user hitting the cap does not affect another)', () => {
    const cap = 500;
    expect(consumeDailyBytes('attachment', 'u1', 500, cap).allowed).toBe(true);
    expect(consumeDailyBytes('attachment', 'u1', 1, cap).allowed).toBe(false);
    // u2 has a fresh budget
    expect(consumeDailyBytes('attachment', 'u2', 400, cap).allowed).toBe(true);
  });

  it('resets on a new UTC day', () => {
    const cap = 1000;
    const day1 = Date.parse('2026-07-11T10:00:00Z');
    const day2 = Date.parse('2026-07-12T10:00:00Z');
    expect(consumeDailyBytes('attachment', 'u1', 1000, cap, day1).allowed).toBe(true);
    expect(consumeDailyBytes('attachment', 'u1', 1, cap, day1).allowed).toBe(false);
    // next day → budget refreshed
    expect(consumeDailyBytes('attachment', 'u1', 1000, cap, day2).allowed).toBe(true);
  });
});
