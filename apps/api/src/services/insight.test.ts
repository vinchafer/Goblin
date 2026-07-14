// I2 (WAVE-I insight) GATE: the founder-dashboard math. Seeds a known cohort +
// event set and asserts the funnel counts / conversion, the stuck-user flag, the
// pulse rates, and — critically — that test-account traffic is filterable in
// every view (the founder's own QA must never inflate the real tester funnel).

import { describe, it, expect } from 'vitest';
import { computeFunnel, computeJourneys, computePulse } from './insight';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// Anchor fixtures to the REAL clock, not a frozen date. computeFunnel has no
// injectable "now" — it computes its 7-day cohort window against Date.now() — so a
// frozen NOW let the oldest fixture (NOW − 3 days) drift out of the window as
// wall-clock time advanced, flaking cohortSize by one in the afternoon (pre-existing,
// orthogonal to FIX-WAVE 4). Real-clock offsets keep every fixture safely inside the
// window regardless of time-of-day (nearest boundary has ~4 days of margin).
const NOW = Date.now();
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

// Four real testers + one founder/test account.
const users = [
  { id: 'u_all', email: 'a@x.com', created_at: iso(2 * DAY) },   // full funnel → upgraded
  { id: 'u_mid', email: 'b@x.com', created_at: iso(2 * DAY) },   // reached first message, then stuck 26h
  { id: 'u_new', email: 'c@x.com', created_at: iso(1 * HOUR) },  // just signed up
  { id: 'u_live', email: 'd@x.com', created_at: iso(3 * DAY) },  // reached a live app
  { id: 'u_test', email: 'qa@goblin.com', created_at: iso(2 * DAY) }, // TEST account, full funnel
];

const events = [
  // u_all — every stage
  { event_type: 'onboarding_completed', user_id: 'u_all', created_at: iso(2 * DAY - HOUR), meta: null },
  { event_type: 'project_created', user_id: 'u_all', created_at: iso(2 * DAY - 2 * HOUR), meta: null },
  { event_type: 'message_sent', user_id: 'u_all', created_at: iso(2 * DAY - 3 * HOUR), meta: null },
  { event_type: 'agent_run_started', user_id: 'u_all', created_at: iso(2 * DAY - 4 * HOUR - 60000), meta: { model_slug: 'goblin/efficient' } },
  { event_type: 'agent_run_finished', user_id: 'u_all', created_at: iso(2 * DAY - 4 * HOUR), meta: { status: 'ok' } },
  { event_type: 'publish_verified', user_id: 'u_all', created_at: iso(2 * DAY - 5 * HOUR), meta: null },
  { event_type: 'upgrade_clicked', user_id: 'u_all', created_at: iso(2 * DAY - 6 * HOUR), meta: null },
  { event_type: 'upgraded', user_id: 'u_all', created_at: iso(2 * HOUR), meta: null },
  // u_mid — onboarding + project + message, last activity 26h ago → stuck
  { event_type: 'onboarding_completed', user_id: 'u_mid', created_at: iso(2 * DAY), meta: null },
  { event_type: 'project_created', user_id: 'u_mid', created_at: iso(30 * HOUR), meta: null },
  { event_type: 'message_sent', user_id: 'u_mid', created_at: iso(26 * HOUR), meta: null },
  // u_live — reached a live app (not stuck even if quiet, they got there)
  { event_type: 'onboarding_completed', user_id: 'u_live', created_at: iso(3 * DAY), meta: null },
  { event_type: 'project_created', user_id: 'u_live', created_at: iso(3 * DAY - HOUR), meta: null },
  { event_type: 'message_sent', user_id: 'u_live', created_at: iso(3 * DAY - 2 * HOUR), meta: null },
  { event_type: 'agent_run_started', user_id: 'u_live', created_at: iso(3 * DAY - 3 * HOUR - 60000), meta: { model_slug: 'goblin/efficient' } },
  // u_live also STARTED a second run that never finished (crash/abandon) — the
  // started-vs-finished gap the rider makes visible.
  { event_type: 'agent_run_started', user_id: 'u_live', created_at: iso(40 * HOUR), meta: { model_slug: 'goblin/premium' } },
  { event_type: 'agent_run_finished', user_id: 'u_live', created_at: iso(3 * DAY - 3 * HOUR), meta: { status: 'failed', outcome: 'error' } },
  { event_type: 'publish_verified', user_id: 'u_live', created_at: iso(50 * HOUR), meta: null },
  { event_type: 'publish_failed', user_id: 'u_live', created_at: iso(51 * HOUR), meta: { stage: 'build' } },
  // u_test — full funnel but a TEST account
  { event_type: 'onboarding_completed', user_id: 'u_test', created_at: iso(2 * DAY), meta: null },
  { event_type: 'project_created', user_id: 'u_test', created_at: iso(2 * DAY - HOUR), meta: null },
  { event_type: 'message_sent', user_id: 'u_test', created_at: iso(2 * DAY - 2 * HOUR), meta: null },
  { event_type: 'agent_run_finished', user_id: 'u_test', created_at: iso(2 * DAY - 3 * HOUR), meta: { status: 'ok' } },
  { event_type: 'publish_verified', user_id: 'u_test', created_at: iso(2 * DAY - 4 * HOUR), meta: null },
];

const testEmails = new Set(['qa@goblin.com']);

describe('computeFunnel', () => {
  it('excludes test accounts by default; conversion is vs the signup cohort', () => {
    const f = computeFunnel(users, events, 7, false, testEmails);
    // 4 real signups in-window (u_test excluded).
    expect(f.cohortSize).toBe(4);
    const by = Object.fromEntries(f.stages.map((s) => [s.key, s.count]));
    expect(by.signup).toBe(4);
    expect(by.onboarding_completed).toBe(3); // u_all, u_mid, u_live
    expect(by.project_created).toBe(3);
    expect(by.first_message_sent).toBe(3);
    expect(by.first_agent_run_finished).toBe(2); // u_all, u_live
    expect(by.first_publish_verified).toBe(2); // u_all, u_live
    expect(by.upgraded).toBe(1); // u_all only
    // conversion to live app = 2/4 = 50%
    const live = f.stages.find((s) => s.key === 'first_publish_verified')!;
    expect(live.conversionPct).toBe(50);
  });

  it('includes the test account when includeTest=true', () => {
    const f = computeFunnel(users, events, 7, true, testEmails);
    expect(f.cohortSize).toBe(5);
    const upgraded = f.stages.find((s) => s.key === 'upgraded')!;
    expect(upgraded.count).toBe(1); // only u_all truly upgraded (u_test stopped at publish)
    const live = f.stages.find((s) => s.key === 'first_publish_verified')!;
    expect(live.count).toBe(3); // u_all, u_live, u_test
  });
});

describe('computeJourneys', () => {
  it('flags the ≥24h-stuck pre-live user and sorts stuck first', () => {
    const rows = computeJourneys(users, events, false, testEmails, NOW);
    expect(rows.map((r) => r.userId)).not.toContain('u_test'); // filtered
    const mid = rows.find((r) => r.userId === 'u_mid')!;
    expect(mid.stuck).toBe(true);
    expect(mid.currentStage).toBe('first_message_sent');
    expect(mid.hoursSinceLast).toBeGreaterThanOrEqual(24);
    // u_live reached a live app → never "stuck" even if quiet.
    const live = rows.find((r) => r.userId === 'u_live')!;
    expect(live.stuck).toBe(false);
    expect(live.currentStage).toBe('first_publish_verified');
    // stuck users sort to the top.
    expect(rows[0]!.stuck).toBe(true);
  });

  it('tags test users when included', () => {
    const rows = computeJourneys(users, events, true, testEmails, NOW);
    const test = rows.find((r) => r.userId === 'u_test')!;
    expect(test.isTest).toBe(true);
  });
});

describe('computePulse', () => {
  it('computes publish + run success rates over the window (test excluded)', () => {
    const testIds = new Set(['u_test']);
    const p = computePulse(events, 7, false, testIds, NOW);
    // publishes (real users): 2 verified (u_all, u_live), 1 failed (u_live) → 66.7%
    expect(p.publishVerified).toBe(2);
    expect(p.publishFailed).toBe(1);
    expect(p.publishSuccessPct).toBe(66.7);
    // runs: u_all ok, u_live failed → 1/2 = 50%
    expect(p.runsFinished).toBe(2);
    expect(p.runSuccessPct).toBe(50);
    // started (rider): u_all 1 + u_live 2 = 3 → the 3-vs-2 gap = one run that
    // started but never finished (real users; u_test excluded).
    expect(p.runsStarted).toBe(3);
    expect(p.dailyActives).toHaveLength(7);
  });

  it('includes test traffic when includeTest=true', () => {
    const testIds = new Set(['u_test']);
    const p = computePulse(events, 7, true, testIds, NOW);
    expect(p.publishVerified).toBe(3); // + u_test
    expect(p.runsFinished).toBe(3); // + u_test ok run
  });
});
