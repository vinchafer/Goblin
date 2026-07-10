// I2 (WAVE-I insight): the founder dashboard's data layer. Reads platform_events
// (behaviour, migration 0085) + users (signup anchor) ONLY — no third-party
// analytics service. All computation is in-memory: at tester scale (tens of
// users, thousands of metadata rows) a full read + JS reduce is simpler and
// cheaper than round-tripping aggregate SQL, and keeps the funnel definition in
// one readable place.
//
// Privacy: every field returned is a count, a rate, a timestamp, a stage name,
// or a user id/email (founder-only, already visible in /admin/users) — never
// message content, file contents, or generated code (events never carried any).

import { getSupabaseAdmin } from '../lib/supabase';

// The canonical funnel, in order. `source: 'signup'` is derived from
// users.created_at; every other stage is the first occurrence of its event.
export const FUNNEL_STAGES = [
  { key: 'signup', label: 'Registriert', source: 'signup' as const },
  { key: 'onboarding_completed', label: 'Onboarding fertig', source: 'event' as const, event: 'onboarding_completed' },
  { key: 'project_created', label: 'Projekt erstellt', source: 'event' as const, event: 'project_created' },
  { key: 'first_message_sent', label: 'Erste Nachricht', source: 'event' as const, event: 'message_sent' },
  { key: 'first_agent_run_finished', label: 'Erster Agent-Lauf', source: 'event' as const, event: 'agent_run_finished' },
  { key: 'first_publish_verified', label: 'Live-App (verifiziert)', source: 'event' as const, event: 'publish_verified' },
  { key: 'upgrade_clicked', label: 'Upgrade geklickt', source: 'event' as const, event: 'upgrade_clicked' },
  { key: 'upgraded', label: 'Upgegradet', source: 'event' as const, event: 'upgraded' },
] as const;

type StageKey = (typeof FUNNEL_STAGES)[number]['key'];

interface UserRow { id: string; email: string | null; created_at: string }
interface EventRow { event_type: string; user_id: string | null; created_at: string; meta: Record<string, unknown> | null }

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Founder + test emails (env, comma-separated; ADMIN_EMAIL and TEST_ACCOUNT_EMAIL
 * fold in as sensible defaults). Lower-cased for a case-insensitive match. These
 * users are tagged `isTest` so every view can filter them — the founder's own
 * QA traffic must never inflate the real tester funnel.
 */
function testEmailSet(): Set<string> {
  const raw = [
    process.env.INSIGHT_TEST_EMAILS,
    process.env.ADMIN_EMAIL,
    process.env.TEST_ACCOUNT_EMAIL,
  ]
    .filter(Boolean)
    .join(',');
  return new Set(
    raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
}

async function loadUsers(): Promise<UserRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('users')
    .select('id, email, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw new Error(`insight users read failed: ${error.message}`);
  return (data ?? []) as UserRow[];
}

async function loadEvents(sinceDays: number): Promise<EventRow[]> {
  const sb = getSupabaseAdmin();
  // A generous window (max of the two funnel windows + pulse span) so one read
  // serves every view; cap defensively.
  const since = new Date(Date.now() - Math.max(sinceDays, 30) * DAY_MS).toISOString();
  const { data, error } = await sb
    .from('platform_events')
    .select('event_type, user_id, created_at, meta')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50000);
  if (error) throw new Error(`insight events read failed: ${error.message}`);
  return (data ?? []) as EventRow[];
}

function isTestUser(u: UserRow, testEmails: Set<string>): boolean {
  return !!u.email && testEmails.has(u.email.toLowerCase());
}

// ── Funnel ────────────────────────────────────────────────────────────────────
// Cohort = users who signed up within `days`. For that cohort, count how many
// reached each stage (≥1 event of the stage type, at any time — the event IS the
// achievement). Conversion is relative to the signup cohort; drop-off is the
// step-to-step loss.
export interface FunnelStageResult {
  key: StageKey;
  label: string;
  count: number;
  conversionPct: number; // vs signup
  dropFromPrevPct: number; // loss vs the previous stage
}

export function computeFunnel(
  users: UserRow[],
  events: EventRow[],
  days: number,
  includeTest: boolean,
  testEmails: Set<string>,
): { days: number; stages: FunnelStageResult[]; cohortSize: number } {
  const cutoff = Date.now() - days * DAY_MS;
  const cohort = users.filter(
    (u) => (includeTest || !isTestUser(u, testEmails)) && new Date(u.created_at).getTime() >= cutoff,
  );
  const cohortIds = new Set(cohort.map((u) => u.id));

  // For each funnel event type, the set of cohort users who have it.
  const reached: Record<string, Set<string>> = {};
  for (const s of FUNNEL_STAGES) {
    if (s.source === 'event') reached[s.event] = new Set();
  }
  for (const e of events) {
    if (!e.user_id || !cohortIds.has(e.user_id)) continue;
    const set = reached[e.event_type];
    if (set) set.add(e.user_id);
  }

  const signupCount = cohort.length;
  const stages: FunnelStageResult[] = [];
  let prevCount = signupCount;
  for (const s of FUNNEL_STAGES) {
    const count = s.source === 'signup' ? signupCount : reached[s.event]!.size;
    stages.push({
      key: s.key,
      label: s.label,
      count,
      conversionPct: signupCount > 0 ? Math.round((count / signupCount) * 1000) / 10 : 0,
      dropFromPrevPct: prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * 1000) / 10 : 0,
    });
    prevCount = count;
  }
  return { days, stages, cohortSize: signupCount };
}

// ── Journeys ───────────────────────────────────────────────────────────────────
// Per user: the furthest stage reached, their last event + when, and a
// "stuck ≥24h" flag — last activity is ≥24h old AND they have not yet reached a
// live app (the number the founder chases). Test users are tagged, not dropped,
// so the view can toggle them.
export interface JourneyRow {
  userId: string;
  email: string | null;
  isTest: boolean;
  currentStage: StageKey;
  currentStageLabel: string;
  lastEventType: string | null;
  lastEventAt: string | null;
  hoursSinceLast: number | null;
  stuck: boolean;
}

const STAGE_ORDER: StageKey[] = FUNNEL_STAGES.map((s) => s.key);
const EVENT_TO_STAGE: Record<string, StageKey> = {
  onboarding_completed: 'onboarding_completed',
  project_created: 'project_created',
  message_sent: 'first_message_sent',
  agent_run_finished: 'first_agent_run_finished',
  publish_verified: 'first_publish_verified',
  upgrade_clicked: 'upgrade_clicked',
  upgraded: 'upgraded',
};
const LIVE_APP_INDEX = STAGE_ORDER.indexOf('first_publish_verified');

export function computeJourneys(
  users: UserRow[],
  events: EventRow[],
  includeTest: boolean,
  testEmails: Set<string>,
  now = Date.now(),
): JourneyRow[] {
  const byUser = new Map<string, EventRow[]>();
  for (const e of events) {
    if (!e.user_id) continue;
    (byUser.get(e.user_id) ?? byUser.set(e.user_id, []).get(e.user_id)!).push(e);
  }

  const rows: JourneyRow[] = [];
  for (const u of users) {
    const isTest = isTestUser(u, testEmails);
    if (!includeTest && isTest) continue;

    const evs = byUser.get(u.id) ?? [];
    // Furthest stage reached (signup is always reached).
    let maxIdx = 0;
    for (const e of evs) {
      const st = EVENT_TO_STAGE[e.event_type];
      if (st) maxIdx = Math.max(maxIdx, STAGE_ORDER.indexOf(st));
    }
    // Last event (events are loaded newest-first, but a user's slice may include
    // older reads — pick the true max timestamp).
    let lastAt = new Date(u.created_at).getTime();
    let lastType: string | null = null;
    for (const e of evs) {
      const t = new Date(e.created_at).getTime();
      if (t >= lastAt) { lastAt = t; lastType = e.event_type; }
    }
    const hoursSince = Math.floor((now - lastAt) / (60 * 60 * 1000));
    const stuck = hoursSince >= 24 && maxIdx < LIVE_APP_INDEX;
    const stage = FUNNEL_STAGES[maxIdx] ?? FUNNEL_STAGES[0];

    rows.push({
      userId: u.id,
      email: u.email,
      isTest,
      currentStage: stage.key,
      currentStageLabel: stage.label,
      lastEventType: lastType,
      lastEventAt: new Date(lastAt).toISOString(),
      hoursSinceLast: hoursSince,
      stuck,
    });
  }
  // Stuck users first, then most-recently-active.
  rows.sort((a, b) => {
    if (a.stuck !== b.stuck) return a.stuck ? -1 : 1;
    return (b.lastEventAt ?? '').localeCompare(a.lastEventAt ?? '');
  });
  return rows;
}

// ── Pulse ───────────────────────────────────────────────────────────────────────
export interface PulseResult {
  days: number;
  dailyActives: Array<{ date: string; count: number }>;
  runsFinished: number;
  runsSucceeded: number;
  runSuccessPct: number | null;
  publishVerified: number;
  publishFailed: number;
  publishSuccessPct: number | null;
  feedbackCount: number;
}

export function computePulse(
  events: EventRow[],
  days: number,
  includeTest: boolean,
  testUserIds: Set<string>,
  now = Date.now(),
): PulseResult {
  const cutoff = now - days * DAY_MS;
  const inWindow = events.filter((e) => {
    if (new Date(e.created_at).getTime() < cutoff) return false;
    if (!includeTest && e.user_id && testUserIds.has(e.user_id)) return false;
    return true;
  });

  // Daily actives — distinct users per UTC day.
  const perDay = new Map<string, Set<string>>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS).toISOString().slice(0, 10);
    perDay.set(d, new Set());
  }
  for (const e of inWindow) {
    if (!e.user_id) continue;
    const d = e.created_at.slice(0, 10);
    perDay.get(d)?.add(e.user_id);
  }
  const dailyActives = [...perDay.entries()].map(([date, set]) => ({ date, count: set.size }));

  const runs = inWindow.filter((e) => e.event_type === 'agent_run_finished');
  const runsSucceeded = runs.filter((e) => (e.meta?.status ?? '') !== 'failed' && (e.meta?.outcome ?? '') !== 'error').length;
  const publishVerified = inWindow.filter((e) => e.event_type === 'publish_verified').length;
  const publishFailed = inWindow.filter((e) => e.event_type === 'publish_failed').length;
  const feedbackCount = inWindow.filter((e) => e.event_type === 'feedback_submitted').length;

  const pubTotal = publishVerified + publishFailed;
  return {
    days,
    dailyActives,
    runsFinished: runs.length,
    runsSucceeded,
    runSuccessPct: runs.length > 0 ? Math.round((runsSucceeded / runs.length) * 1000) / 10 : null,
    publishVerified,
    publishFailed,
    publishSuccessPct: pubTotal > 0 ? Math.round((publishVerified / pubTotal) * 1000) / 10 : null,
    feedbackCount,
  };
}

// ── Aggregate (one read serves the whole dashboard) ─────────────────────────────
export interface InsightPayload {
  generatedAt: string;
  includeTest: boolean;
  funnel7: ReturnType<typeof computeFunnel>;
  funnel30: ReturnType<typeof computeFunnel>;
  journeys: JourneyRow[];
  pulse: PulseResult;
  testAccountCount: number;
}

export async function buildInsight(opts: { days: number; includeTest: boolean }): Promise<InsightPayload> {
  const testEmails = testEmailSet();
  const [users, events] = await Promise.all([loadUsers(), loadEvents(30)]);
  const testUserIds = new Set(
    users.filter((u) => isTestUser(u, testEmails)).map((u) => u.id),
  );

  return {
    generatedAt: new Date().toISOString(),
    includeTest: opts.includeTest,
    funnel7: computeFunnel(users, events, 7, opts.includeTest, testEmails),
    funnel30: computeFunnel(users, events, 30, opts.includeTest, testEmails),
    journeys: computeJourneys(users, events, opts.includeTest, testEmails),
    pulse: computePulse(events, opts.days, opts.includeTest, testUserIds),
    testAccountCount: testUserIds.size,
  };
}
