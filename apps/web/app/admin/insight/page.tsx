'use client';

// I2 (WAVE-I insight) — /admin/insight: the FOUNDER's live behaviour view.
// "10 signed up — how many reached a live app, and where did the rest stop?"
//
// Gated by the admin layout (session is_admin / ADMIN_EMAIL) + the /api/admin
// proxy (server-side is_admin re-check → 403 for non-founders; injects the admin
// key). Reads GET /api/admin/insight only — platform_events, no third-party
// analytics, metadata only (never message/file/code content). Mobile-first: the
// founder reads this on a phone (legible from 360px), dark + light via CSS vars.

import { useCallback, useEffect, useState } from 'react';
import { adminErrorMessage } from '@/lib/admin/admin-error';

const ADMIN_BASE = '/api/admin';
const mono = "'JetBrains Mono', monospace";
const nf = (n: number) => n.toLocaleString('de-DE');

interface FunnelStage { key: string; label: string; count: number; conversionPct: number; dropFromPrevPct: number }
interface Funnel { days: number; cohortSize: number; stages: FunnelStage[] }
interface Journey {
  userId: string; email: string | null; isTest: boolean;
  currentStage: string; currentStageLabel: string;
  lastEventType: string | null; lastEventAt: string | null;
  hoursSinceLast: number | null; stuck: boolean;
}
interface Pulse {
  days: number;
  dailyActives: Array<{ date: string; count: number }>;
  runsStarted: number; runsFinished: number; runsSucceeded: number; runSuccessPct: number | null;
  publishVerified: number; publishFailed: number; publishSuccessPct: number | null;
  feedbackCount: number;
}
interface Safety {
  days: number; publishBlocked: number; abuseSignals: number;
  byKind: Array<{ kind: string; count: number }>;
  recent: Array<{ type: 'publish_blocked' | 'abuse_signal'; kind: string | null; userId: string | null; at: string }>;
}
interface Insight {
  generatedAt: string; includeTest: boolean; testAccountCount: number;
  funnel7: Funnel; funnel30: Funnel; journeys: Journey[]; pulse: Pulse; safety?: Safety;
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700, color: 'var(--meta)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function pctColor(pct: number): string {
  if (pct >= 60) return 'var(--brand-green)';
  if (pct >= 30) return 'var(--brand-gold, #B8860B)';
  return 'var(--danger)';
}

function FunnelView({ f }: { f: Funnel }) {
  const max = Math.max(1, f.stages[0]?.count ?? 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {f.stages.map((s, i) => {
        const w = Math.round((s.count / max) * 100);
        return (
          <div key={s.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{s.label}</span>
              <span style={{ fontFamily: mono, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                {nf(s.count)}
                <span style={{ color: 'var(--meta)', fontSize: 11 }}> · {s.conversionPct}%</span>
              </span>
            </div>
            <div style={{ height: 8, background: 'var(--border)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ width: `${w}%`, height: '100%', background: pctColor(s.conversionPct), transition: 'width .3s' }} />
            </div>
            {i > 0 && s.dropFromPrevPct > 0 ? (
              <div style={{ fontSize: 10.5, color: s.dropFromPrevPct >= 50 ? 'var(--danger)' : 'var(--meta)', marginTop: 2 }}>
                −{s.dropFromPrevPct}% ab vorheriger Stufe
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        borderRadius: 999, padding: '4px 12px', border: '1px solid var(--border)',
        background: on ? 'var(--brand-green)' : 'transparent',
        color: on ? 'var(--on-brand, #fff)' : 'var(--meta)',
      }}
    >
      {children}
    </button>
  );
}

export default function AdminInsightPage() {
  const [data, setData] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<7 | 30>(7);
  const [includeTest, setIncludeTest] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${ADMIN_BASE}/insight?days=${days}&includeTest=${includeTest}`, { headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        // FW3 U5: the SHARED admin error copy (this page's 401 string is now the
        // single source for every admin page). 500 still surfaces the proxy detail.
        const detail = res.status === 500
          ? (await res.json().catch(() => null) as { detail?: string } | null)?.detail
          : undefined;
        setError(adminErrorMessage(res.status, detail));
        return;
      }
      setData(await res.json());
    } catch {
      setError(adminErrorMessage('network'));
    } finally {
      setLoading(false);
    }
  }, [days, includeTest]);

  useEffect(() => { load(); }, [load]);

  const funnel = data ? (days === 30 ? data.funnel30 : data.funnel7) : null;
  const stuckCount = data?.journeys.filter((j) => j.stuck).length ?? 0;

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>
          Insight
        </h1>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand-gold-ink, #7A5A12)', background: 'var(--brand-gold)', borderRadius: 999, padding: '3px 10px' }}>
          Verhalten · live
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--meta)', marginBottom: 14 }}>
        Nur Nutzungsereignisse — welche Funktion wann, nie Inhalte.
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <Toggle on={days === 7} onClick={() => setDays(7)}>7 Tage</Toggle>
        <Toggle on={days === 30} onClick={() => setDays(30)}>30 Tage</Toggle>
        <span style={{ width: 1, height: 18, background: 'var(--border)' }} />
        <Toggle on={includeTest} onClick={() => setIncludeTest((v) => !v)}>
          Test-Accounts {includeTest ? 'an' : 'aus'}
        </Toggle>
        <button onClick={load} style={{ marginLeft: 'auto', fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--meta)', background: 'transparent', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 12px', cursor: 'pointer' }}>
          ↻
        </button>
      </div>

      {loading && !data ? <div style={{ color: 'var(--meta)' }}>Lädt…</div> : null}
      {error ? <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div> : null}

      {data && funnel ? (
        <>
          <Card
            title={`Funnel · ${days} Tage`}
            right={<span style={{ fontFamily: mono, fontSize: 12, color: 'var(--meta)' }}>{nf(funnel.cohortSize)} registriert</span>}
          >
            {funnel.cohortSize === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--meta)' }}>Noch keine Registrierungen in diesem Fenster.</div>
            ) : (
              <FunnelView f={funnel} />
            )}
          </Card>

          <Card
            title="Journeys"
            right={stuckCount > 0
              ? <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', background: 'var(--danger-bg, rgba(200,60,60,0.12))', borderRadius: 999, padding: '2px 9px' }}>{stuckCount} hängen ≥24h</span>
              : <span style={{ fontSize: 11, color: 'var(--meta)' }}>{data.journeys.length} Nutzer</span>}
          >
            {data.journeys.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--meta)' }}>Keine Nutzer.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.journeys.slice(0, 40).map((j) => (
                  <div key={j.userId} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
                    background: j.stuck ? 'var(--danger-bg, rgba(200,60,60,0.08))' : 'var(--bg-subtle, transparent)',
                    border: '1px solid var(--border)',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: j.stuck ? 'var(--danger)' : 'var(--brand-green)' }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {j.email ?? j.userId.slice(0, 8)}
                        {j.isTest ? <span style={{ fontSize: 10, color: 'var(--meta)', marginLeft: 6 }}>TEST</span> : null}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--meta)' }}>
                        {j.currentStageLabel} · {j.hoursSinceLast != null ? `vor ${j.hoursSinceLast}h` : '—'}
                      </div>
                    </div>
                    {j.stuck ? <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--danger)', flexShrink: 0 }}>hängt</span> : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title={`Pulse · ${data.pulse.days} Tage`}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, rowGap: 14, marginBottom: 14 }}>
              <Stat label="Agent-Läufe" value={nf(data.pulse.runsFinished)} sub={data.pulse.runSuccessPct != null ? `${data.pulse.runSuccessPct}% ok` : '—'} />
              <Stat label="Gestartet → fertig" value={`${nf(data.pulse.runsStarted)} → ${nf(data.pulse.runsFinished)}`} sub={data.pulse.runsStarted > data.pulse.runsFinished ? `${nf(data.pulse.runsStarted - data.pulse.runsFinished)} nicht beendet` : 'alle beendet'} />
              <Stat label="Publish-Erfolg" value={data.pulse.publishSuccessPct != null ? `${data.pulse.publishSuccessPct}%` : '—'} sub={`${nf(data.pulse.publishVerified)} ✓ · ${nf(data.pulse.publishFailed)} ✗`} />
              <Stat label="Feedback" value={nf(data.pulse.feedbackCount)} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--meta)', marginBottom: 6 }}>Tägliche Aktive</div>
            <ActivesBars data={data.pulse.dailyActives} />
          </Card>

          {/* K4 (Wave-K) — safety signals. Flags INFORM: the founder sees them here and
              decides; nothing punishes automatically. */}
          {data.safety && (
            <Card title={`Sicherheit · Missbrauchs-Signale · ${data.safety.days} Tage`}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, rowGap: 14, marginBottom: 14 }}>
                <Stat label="Publish blockiert (K3)" value={nf(data.safety.publishBlocked)} />
                <Stat label="Verhaltens-Signale (K4)" value={nf(data.safety.abuseSignals)} />
              </div>
              {data.safety.byKind.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--meta)' }}>Keine Signale im Zeitraum — sauber.</div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: 'var(--meta)', marginBottom: 6 }}>Nach Art</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {data.safety.byKind.map((k) => (
                      <span key={k.kind} style={{ fontFamily: mono, fontSize: 11, color: 'var(--ink-2)', background: 'var(--subtle)', borderRadius: 6, padding: '3px 8px' }}>
                        {k.kind}: {nf(k.count)}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--meta)', marginBottom: 6 }}>Zuletzt</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {data.safety.recent.slice(0, 12).map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: 11, color: 'var(--ink-3)' }}>
                        <span>{r.type === 'publish_blocked' ? '⛔' : '⚑'} {r.kind ?? '—'} · {r.userId?.slice(0, 8) ?? 'anon'}</span>
                        <span style={{ color: 'var(--meta)' }}>{new Date(r.at).toLocaleString('de-DE')}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}

          <div style={{ fontSize: 10.5, color: 'var(--meta)', marginTop: 4 }}>
            Stand {new Date(data.generatedAt).toLocaleString('de-DE')} · {data.testAccountCount} Test-Account(s) erkannt
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ flex: '1 1 90px', minWidth: 90 }}>
      <div style={{ fontSize: 11, color: 'var(--meta)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{value}</div>
      {sub ? <div style={{ fontSize: 10.5, color: 'var(--meta)', marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

function ActivesBars({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 48 }}>
      {data.map((d) => (
        <div key={d.date} title={`${d.date}: ${d.count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
          <div style={{ height: `${Math.round((d.count / max) * 100)}%`, minHeight: d.count > 0 ? 3 : 0, background: 'var(--brand-green)', borderRadius: 2 }} />
        </div>
      ))}
    </div>
  );
}
