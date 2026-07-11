// I4 (WAVE-I insight) GATE: the daily founder digest. Proves the rendered
// numbers match the insight payload and that the sender is a strict no-op unless
// explicitly enabled with a recipient (no accidental / unsolicited mail).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildDigest, sendFounderDigest } from './insight-digest';
import type { InsightPayload } from './insight';

function samplePayload(): InsightPayload {
  const stage = (key: string, label: string, count: number, conv: number) => ({ key, label, count, conversionPct: conv, dropFromPrevPct: 0 } as any);
  const stages = [
    stage('signup', 'Registriert', 9, 100),
    stage('onboarding_completed', 'Onboarding fertig', 7, 77.8),
    stage('project_created', 'Projekt erstellt', 6, 66.7),
    stage('first_message_sent', 'Erste Nachricht', 5, 55.6),
    stage('first_agent_run_finished', 'Erster Agent-Lauf', 3, 33.3),
    stage('first_publish_verified', 'Live-App (verifiziert)', 2, 22.2),
    stage('upgrade_clicked', 'Upgrade geklickt', 1, 11.1),
    stage('upgraded', 'Upgegradet', 1, 11.1),
  ];
  const funnel = { days: 7, cohortSize: 9, stages } as any;
  return {
    generatedAt: '2026-07-10T07:00:00.000Z',
    includeTest: false,
    testAccountCount: 1,
    funnel7: funnel,
    funnel30: funnel,
    journeys: [
      { userId: 'a', email: 'dora@test.de', isTest: false, currentStage: 'first_message_sent', currentStageLabel: 'Erste Nachricht', lastEventType: 'message_sent', lastEventAt: '2026-07-09T04:00:00Z', hoursSinceLast: 27, stuck: true },
      { userId: 'b', email: 'finn@test.de', isTest: false, currentStage: 'project_created', currentStageLabel: 'Projekt erstellt', lastEventType: 'project_created', lastEventAt: '2026-07-08T12:00:00Z', hoursSinceLast: 47, stuck: true },
      { userId: 'c', email: 'anna@test.de', isTest: false, currentStage: 'upgraded', currentStageLabel: 'Upgegradet', lastEventType: 'upgraded', lastEventAt: '2026-07-10T05:00:00Z', hoursSinceLast: 2, stuck: false },
    ],
    pulse: {
      days: 7, dailyActives: [], runsStarted: 4, runsFinished: 3, runsSucceeded: 2, runSuccessPct: 66.7,
      publishVerified: 2, publishFailed: 1, publishSuccessPct: 66.7, feedbackCount: 1,
    },
  };
}

describe('buildDigest', () => {
  it('renders the headline funnel numbers and every stuck user', () => {
    const { subject, html } = buildDigest(samplePayload());
    // Headline: 9 signed up, 2 reached a live app (22.2%), 1 upgraded.
    expect(html).toContain('<strong>9</strong> registriert');
    expect(html).toContain('<strong>2</strong> erreichten eine Live-App (<strong>22.2%</strong>)');
    // Both stuck users appear; the non-stuck one does not.
    expect(html).toContain('dora@test.de');
    expect(html).toContain('finn@test.de');
    expect(html).not.toContain('anna@test.de');
    // Pulse line.
    expect(html).toContain('Publish-Erfolg');
    expect(html).toContain('66.7%');
    // Subject summarises live/cohort + stuck count.
    expect(subject).toBe('Goblin Insight 2026-07-10 — 2/9 live · 2 hängen');
    // Privacy line present.
    expect(html).toContain('nie Inhalte');
  });

  it('shows the celebratory line when no one is stuck', () => {
    const p = samplePayload();
    p.journeys = p.journeys.map((j) => ({ ...j, stuck: false }));
    const { html } = buildDigest(p);
    expect(html).toContain('Niemand hängt');
  });
});

describe('sendFounderDigest — opt-in only', () => {
  const OLD = { ...process.env };
  beforeEach(() => { delete process.env.GOBLIN_FOUNDER_DIGEST; delete process.env.FOUNDER_DIGEST_EMAIL; delete process.env.ADMIN_EMAIL; });
  afterEach(() => { process.env = { ...OLD }; vi.restoreAllMocks(); });

  it('no-ops when disabled', async () => {
    const r = await sendFounderDigest();
    expect(r).toEqual({ sent: false, reason: 'disabled' });
  });

  it('no-ops when enabled but no recipient configured', async () => {
    process.env.GOBLIN_FOUNDER_DIGEST = 'true';
    const r = await sendFounderDigest();
    expect(r).toEqual({ sent: false, reason: 'no_recipient' });
  });
});
