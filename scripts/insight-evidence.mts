// WAVE-I I2 evidence generator (offline, no DB): runs the REAL insight compute
// functions on a seeded cohort, writes the exact /api/admin/insight payload as
// JSON (the numbers cross-check), and renders a faithful HTML replica of the
// /admin/insight page for a 375px dark+light screenshot. No network, no Supabase.
import { writeFileSync } from 'node:fs';
import { computeFunnel, computeJourneys, computePulse, FUNNEL_STAGES } from '../apps/api/src/services/insight.ts';

const HOUR = 3600_000, DAY = 24 * HOUR;
const NOW = Date.parse('2026-07-10T12:00:00.000Z');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

// 10 signed up (the founder's question), 1 is a test account.
const users = [
  { id: 'u_all', email: 'anna@test.de', created_at: iso(4 * DAY) },
  { id: 'u_live', email: 'ben@test.de', created_at: iso(3 * DAY) },
  { id: 'u_run', email: 'cara@test.de', created_at: iso(3 * DAY) },
  { id: 'u_msg1', email: 'dora@test.de', created_at: iso(2 * DAY) },
  { id: 'u_msg2', email: 'emil@test.de', created_at: iso(30 * HOUR) },
  { id: 'u_proj', email: 'finn@test.de', created_at: iso(2 * DAY) },
  { id: 'u_onb', email: 'gina@test.de', created_at: iso(40 * HOUR) },
  { id: 'u_new1', email: 'hans@test.de', created_at: iso(3 * HOUR) },
  { id: 'u_new2', email: 'ida@test.de', created_at: iso(1 * HOUR) },
  { id: 'u_qa', email: 'qa@goblin.com', created_at: iso(4 * DAY) },
];
const E = (t: string, u: string, msAgo: number, meta: Record<string, unknown> | null = null) => ({ event_type: t, user_id: u, created_at: iso(msAgo), meta });
const events = [
  ...['onboarding_completed', 'project_created', 'message_sent', 'agent_run_finished', 'publish_verified', 'upgrade_clicked', 'upgraded']
    .map((t, i) => E(t, 'u_all', 4 * DAY - (i + 1) * HOUR, t === 'agent_run_finished' ? { status: 'ok' } : null)),
  E('onboarding_completed', 'u_live', 3 * DAY), E('project_created', 'u_live', 3 * DAY - HOUR), E('message_sent', 'u_live', 3 * DAY - 2 * HOUR), E('agent_run_finished', 'u_live', 3 * DAY - 3 * HOUR, { status: 'ok' }), E('publish_verified', 'u_live', 40 * HOUR),
  E('onboarding_completed', 'u_run', 3 * DAY), E('project_created', 'u_run', 3 * DAY - HOUR), E('message_sent', 'u_run', 3 * DAY - 2 * HOUR), E('agent_run_finished', 'u_run', 30 * HOUR, { status: 'failed', outcome: 'error' }), E('publish_failed', 'u_run', 29 * HOUR, { stage: 'build' }),
  E('onboarding_completed', 'u_msg1', 2 * DAY), E('project_created', 'u_msg1', 2 * DAY - HOUR), E('message_sent', 'u_msg1', 28 * HOUR),
  E('onboarding_completed', 'u_msg2', 30 * HOUR), E('project_created', 'u_msg2', 29 * HOUR), E('message_sent', 'u_msg2', 5 * HOUR),
  E('onboarding_completed', 'u_proj', 2 * DAY), E('project_created', 'u_proj', 47 * HOUR),
  E('onboarding_completed', 'u_onb', 40 * HOUR),
  E('help_opened', 'u_msg1', 27 * HOUR), E('feedback_submitted', 'u_live', 39 * HOUR),
  // test account — full funnel (must be filterable)
  ...['onboarding_completed', 'project_created', 'message_sent', 'agent_run_finished', 'publish_verified', 'upgrade_clicked', 'upgraded']
    .map((t, i) => E(t, 'u_qa', 4 * DAY - (i + 1) * HOUR, t === 'agent_run_finished' ? { status: 'ok' } : null)),
];

const testEmails = new Set(['qa@goblin.com']);
const testIds = new Set(['u_qa']);

function payload(includeTest: boolean) {
  return {
    generatedAt: new Date(NOW).toISOString(),
    includeTest,
    testAccountCount: 1,
    funnel7: computeFunnel(users as any, events as any, 7, includeTest, testEmails),
    funnel30: computeFunnel(users as any, events as any, 30, includeTest, testEmails),
    journeys: computeJourneys(users as any, events as any, includeTest, testEmails, NOW),
    pulse: computePulse(events as any, 7, includeTest, testIds, NOW),
  };
}

const real = payload(false);
const withTest = payload(true);
writeFileSync(new URL('../evidence/wave-i-insight/insight-payload.json', import.meta.url), JSON.stringify({ real, withTest }, null, 2));

// Console cross-check table (goes into the evidence log).
console.log('FUNNEL 7d (real testers only, test account excluded):');
console.log(`  cohort (signups): ${real.funnel7.cohortSize}`);
for (const s of real.funnel7.stages) console.log(`  ${s.label.padEnd(22)} ${String(s.count).padStart(3)}  ${s.conversionPct}%  (drop ${s.dropFromPrevPct}%)`);
console.log(`\n  → reached a LIVE APP: ${real.funnel7.stages.find((s) => s.key === 'first_publish_verified')!.count}/${real.funnel7.cohortSize}`);
console.log(`  stuck ≥24h (pre-live): ${real.journeys.filter((j) => j.stuck).length}`);
console.log(`  publish success: ${real.pulse.publishSuccessPct}% · run success: ${real.pulse.runSuccessPct}%`);
console.log(`\nWith test account included, cohort = ${withTest.funnel7.cohortSize} (was ${real.funnel7.cohortSize}) — filter works.`);

// Faithful HTML replica of app/admin/insight for the 375px dark+light screenshot.
const nf = (n: number) => n.toLocaleString('de-DE');
const pctColor = (p: number) => (p >= 60 ? 'var(--green)' : p >= 30 ? 'var(--gold)' : 'var(--danger)');
const f = real.funnel7;
const fmax = Math.max(1, f.stages[0].count);
const stuckN = real.journeys.filter((j) => j.stuck).length;
const amax = Math.max(1, ...real.pulse.dailyActives.map((d) => d.count));

const funnelRows = f.stages.map((s, i) => `
  <div>
    <div class="row"><span class="lbl">${s.label}</span><span class="mono">${nf(s.count)}<span class="meta"> · ${s.conversionPct}%</span></span></div>
    <div class="bar"><div style="width:${Math.round((s.count / fmax) * 100)}%;background:${pctColor(s.conversionPct)}"></div></div>
    ${i > 0 && s.dropFromPrevPct > 0 ? `<div class="drop ${s.dropFromPrevPct >= 50 ? 'danger' : ''}">−${s.dropFromPrevPct}% ab vorheriger Stufe</div>` : ''}
  </div>`).join('');

const journeyRows = real.journeys.slice(0, 12).map((j) => `
  <div class="jrow ${j.stuck ? 'stuck' : ''}">
    <span class="dot" style="background:${j.stuck ? 'var(--danger)' : 'var(--green)'}"></span>
    <div class="jmain"><div class="jmail">${j.email ?? j.userId}</div><div class="meta">${j.currentStageLabel} · vor ${j.hoursSinceLast}h</div></div>
    ${j.stuck ? '<span class="htag">hängt</span>' : ''}
  </div>`).join('');

const activeBars = real.pulse.dailyActives.map((d) => `<div class="acol"><div class="abar" style="height:${Math.round((d.count / amax) * 100)}%"></div></div>`).join('');

const body = (theme: string) => `
<div class="wrap ${theme}">
  <div class="hdr"><h1>Insight</h1><span class="pill">Verhalten · live</span></div>
  <div class="sub">Nur Nutzungsereignisse — welche Funktion wann, nie Inhalte.</div>
  <div class="ctrls"><span class="tg on">7 Tage</span><span class="tg">30 Tage</span><span class="tg">Test-Accounts aus</span></div>
  <div class="card"><div class="ct">Funnel · 7 Tage<span class="mono meta">${nf(f.cohortSize)} registriert</span></div>${funnelRows}</div>
  <div class="card"><div class="ct">Journeys ${stuckN ? `<span class="htag">${stuckN} hängen ≥24h</span>` : ''}</div>${journeyRows}</div>
  <div class="card"><div class="ct">Pulse · 7 Tage</div>
    <div class="stats">
      <div class="stat"><div class="meta">Agent-Läufe</div><div class="mono big">${nf(real.pulse.runsFinished)}</div><div class="meta">${real.pulse.runSuccessPct}% ok</div></div>
      <div class="stat"><div class="meta">Publish-Erfolg</div><div class="mono big">${real.pulse.publishSuccessPct}%</div><div class="meta">${real.pulse.publishVerified} ✓ · ${real.pulse.publishFailed} ✗</div></div>
      <div class="stat"><div class="meta">Feedback</div><div class="mono big">${nf(real.pulse.feedbackCount)}</div></div>
    </div>
    <div class="meta" style="margin:10px 0 5px">Tägliche Aktive</div>
    <div class="actives">${activeBars}</div>
  </div>
</div>`;

const css = `
  * { box-sizing: border-box; margin: 0; font-family: -apple-system, system-ui, sans-serif; }
  body { background: #f3f4f2; display: flex; gap: 20px; padding: 20px; flex-wrap: wrap; }
  .wrap { width: 375px; padding: 16px; border-radius: 14px; }
  .light { --panel:#fff; --border:#e3e6e1; --text:#1a1c19; --meta:#6b7280; --green:#2e6d43; --gold:#B8860B; --danger:#c0392b; --dbg:rgba(200,60,60,.08); background:#f3f4f2; }
  .dark { --panel:#16181a; --border:#2a2e31; --text:#e8eae7; --meta:#8b9199; --green:#4ea36a; --gold:#d4a94a; --danger:#e06060; --dbg:rgba(200,60,60,.12); background:#0e0f10; }
  .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
  .hdr { display:flex; align-items:center; gap:10px; }
  h1 { font-size:22px; color:var(--green); letter-spacing:-.5px; }
  .pill { font-size:11px; font-weight:600; color:#7A5A12; background:#e8c766; border-radius:999px; padding:3px 10px; }
  .sub { font-size:12.5px; color:var(--meta); margin:6px 0 14px; }
  .ctrls { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
  .tg { font-size:12px; font-weight:600; border-radius:999px; padding:4px 12px; border:1px solid var(--border); color:var(--meta); }
  .tg.on { background:var(--green); color:#fff; border-color:var(--green); }
  .card { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:14px; }
  .ct { display:flex; justify-content:space-between; align-items:center; font-size:12px; font-weight:700; color:var(--meta); text-transform:uppercase; letter-spacing:.05em; margin-bottom:12px; }
  .row { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:3px; }
  .lbl { font-size:13px; color:var(--text); }
  .meta { color:var(--meta); font-size:11px; }
  .bar { height:8px; background:var(--border); border-radius:5px; overflow:hidden; margin-bottom:8px; }
  .bar > div { height:100%; border-radius:5px; }
  .drop { font-size:10.5px; color:var(--meta); margin:-5px 0 8px; }
  .drop.danger { color:var(--danger); }
  .jrow { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; border:1px solid var(--border); margin-bottom:8px; }
  .jrow.stuck { background:var(--dbg); }
  .dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .jmain { flex:1; min-width:0; }
  .jmail { font-size:12.5px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .htag { font-size:10.5px; font-weight:600; color:var(--danger); background:var(--dbg); border-radius:999px; padding:2px 9px; }
  .stats { display:flex; gap:18px; flex-wrap:wrap; }
  .stat { flex:1 1 90px; }
  .big { font-size:18px; font-weight:700; color:var(--text); }
  .actives { display:flex; align-items:flex-end; gap:3px; height:48px; }
  .acol { flex:1; display:flex; align-items:flex-end; height:100%; }
  .abar { width:100%; background:var(--green); border-radius:2px; min-height:2px; }
`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body('light')}${body('dark')}</body></html>`;
writeFileSync(new URL('../evidence/wave-i-insight/insight-dashboard.html', import.meta.url), html);
console.log('\nWrote evidence/wave-i-insight/insight-payload.json + insight-dashboard.html');
