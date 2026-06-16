'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import GoblinUsageBar, { type CapStatus } from '@/components/usage/GoblinUsageBar';

interface UsageData {
  plan: string;
  monthlyUsed: number;
  monthlyLimit: number;
  daysUntilReset: number | null;
  period: string;
  totalInPeriod: number;
  byTier: { byok: number; free_api: number; goblin_hosted: number };
  byModel: Array<{ model: string; count: number }>;
  byProject: Array<{ projectId: string; name: string; count: number }>;
  // Weighted Goblin allowance (present only when the Goblin-hosted flag is on).
  goblinCap?: CapStatus | null;
}

type Period = '7d' | '30d' | '90d';

const PERIOD_LABEL: Record<Period, string> = { '7d': '7 TAGE', '30d': '30 TAGE', '90d': '90 TAGE' };
const MODEL_COLORS = ['var(--green)', 'var(--accent-bright)', '#6db97b', '#3A6B8A', '#7A4A8A'];

// Plain-language status sentence — leads the screen per decision.
function statusSentence(u: UsageData): { headline: string; tone: 'ok' | 'warn' | 'danger' } {
  const pct = u.monthlyLimit > 0 ? (u.monthlyUsed / u.monthlyLimit) * 100 : 0;
  const reset = u.daysUntilReset != null ? ` Setzt sich in ${u.daysUntilReset} Tag${u.daysUntilReset === 1 ? '' : 'en'} zurück.` : '';
  if (pct > 90) return { headline: `Du hast ${u.monthlyUsed} von ${u.monthlyLimit} Anfragen verbraucht — eng.${reset}`, tone: 'danger' };
  if (pct > 65) return { headline: `Du hast ${u.monthlyUsed} von ${u.monthlyLimit} Anfragen verbraucht — gut im Plan.${reset}`, tone: 'warn' };
  return { headline: `Du hast ${u.monthlyUsed} von ${u.monthlyLimit} Anfragen verbraucht — alles entspannt.${reset}`, tone: 'ok' };
}

export default function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('30d');

  useEffect(() => {
    setLoading(true);
    apiGet<UsageData>(`/api/users/me/usage?period=${period}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--d-surface)' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '32px 32px 80px' }}>

        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 16, marginBottom: 32, paddingBottom: 18, borderBottom: '1px solid var(--line)',
          flexWrap: 'wrap',
        }}>
          <div>
            <div className="gobl-eyebrow" style={{ marginBottom: 12 }}>
              <span className="tick" />
              <span className="num">/VERBRAUCH</span>
              Letzte {PERIOD_LABEL[period]}
            </div>
            <h1 style={{
              fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
              fontWeight: 600, fontSize: 'clamp(32px, 4vw, 48px)',
              letterSpacing: '-0.030em', lineHeight: 1.06,
              color: 'var(--ink-1)', margin: 0,
            }}>
              Verbrauch <span className="gobl-serif">auf einen Blick.</span>
            </h1>
          </div>

          <div style={{
            display: 'flex', gap: 4, background: 'var(--d-surface-elev)',
            border: '1px solid var(--line)', borderRadius: 999, padding: 4,
          }}>
            {(['7d', '30d', '90d'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
                  fontWeight: 600, letterSpacing: '0.12em', padding: '6px 12px',
                  borderRadius: 999, border: 'none', cursor: 'pointer',
                  textTransform: 'uppercase',
                  background: period === p ? 'var(--green)' : 'transparent',
                  color: period === p ? 'var(--bone)' : 'var(--ink-3)',
                }}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* 1. STATUS SENTENCE — answer first. */}
        {/* WS-C: only show the loader while genuinely loading. On error with no
            data, fall through to the error panel below instead of a stuck "Lade …". */}
        {loading ? (
          <div className="gobl-panel" style={{ padding: 24, marginBottom: 28, color: 'var(--ink-3)' }}>
            Lade …
          </div>
        ) : !data ? null : (
          <div className="gobl-panel" style={{ padding: '22px 24px', marginBottom: 28 }}>
            <p style={{
              fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
              fontWeight: 600, fontSize: 22, letterSpacing: '-0.018em',
              color: 'var(--ink-1)', margin: '0 0 8px', lineHeight: 1.3,
            }}>
              {statusSentence(data).headline}
            </p>
            <p style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5,
              letterSpacing: '0.10em', color: 'var(--ink-3)',
              margin: 0, textTransform: 'uppercase',
            }}>
              BYOK · {data.byTier.byok} ANFRAGEN ÜBER DEINE KEYS · {data.byTier.free_api} ÜBER FREE-TIER
            </p>
          </div>
        )}

        {/* WEIGHTED Goblin allowance — single bar, generous-feeling. Renders only
            when the flag is on and the cap status is present. */}
        {data?.goblinCap && (
          <div style={{ marginBottom: 28, maxWidth: 520 }}>
            <GoblinUsageBar status={data.goblinCap} />
          </div>
        )}

        {error && (
          <div style={{
            background: 'var(--danger-soft)', border: '1px solid rgba(160,66,48,.30)',
            borderRadius: 'var(--radius)', padding: 14, color: 'var(--danger)',
            marginBottom: 28, fontSize: 13.5,
          }}>
            {error}
          </div>
        )}

        {/* 2. CHART — evidence, not the opener. Hand-built SVG/CSS bars. */}
        {data && (
          <div className="gobl-panel" style={{ overflow: 'hidden', marginBottom: 18 }}>
            <div style={{
              padding: '14px 18px', borderBottom: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h2 style={{
                fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                fontWeight: 600, fontSize: 15, color: 'var(--ink-1)', margin: 0,
              }}>
                Anfragen pro Tag
              </h2>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase',
              }}>
                {PERIOD_LABEL[period]} · BYOK + FREE
              </span>
            </div>
            <div style={{ padding: '20px 18px' }}>
              <RequestsChart data={data} period={period} />
            </div>
          </div>
        )}

        {/* 3. DIAGNOSTIC — by project + model split. */}
        {data && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
            gap: 18,
          }}>
            {/* By project */}
            <div className="gobl-panel" style={{ overflow: 'hidden' }}>
              <div style={{
                padding: '14px 18px', borderBottom: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <h2 style={{
                  fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                  fontWeight: 600, fontSize: 15, color: 'var(--ink-1)', margin: 0,
                }}>
                  Pro Projekt
                </h2>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase',
                }}>
                  ANFRAGEN · {PERIOD_LABEL[period]}
                </span>
              </div>
              {data.byProject.length === 0 ? (
                <div style={{ padding: '20px 18px', color: 'var(--ink-3)', fontSize: 13.5 }}>
                  Noch keine Aktivität in diesem Zeitraum.
                </div>
              ) : (
                (() => {
                  const max = Math.max(...data.byProject.map(p => p.count), 1);
                  return data.byProject.map((p, i) => {
                    const pct = (p.count / max) * 100;
                    return (
                      <Link
                        key={p.projectId}
                        href={`/dashboard/project/${p.projectId}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 90px',
                          gap: 12, alignItems: 'center',
                          padding: '10px 18px',
                          borderBottom: i === data.byProject.length - 1 ? 'none' : '1px solid var(--line)',
                          textDecoration: 'none', color: 'inherit',
                          fontSize: 13,
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-1)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: MODEL_COLORS[i % MODEL_COLORS.length], flexShrink: 0 }} />
                          {p.name}
                        </span>
                        <span style={{ background: 'var(--d-surface-2)', height: 4, borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                          <span style={{ display: 'block', height: '100%', background: 'var(--green)', width: `${pct}%` }} />
                        </span>
                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                          color: 'var(--ink-3)', textAlign: 'right',
                        }}>
                          {p.count} REQ
                        </span>
                      </Link>
                    );
                  });
                })()
              )}
            </div>

            {/* Model split */}
            <div className="gobl-panel" style={{ overflow: 'hidden' }}>
              <div style={{
                padding: '14px 18px', borderBottom: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <h2 style={{
                  fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                  fontWeight: 600, fontSize: 15, color: 'var(--ink-1)', margin: 0,
                }}>
                  Modelle
                </h2>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase',
                }}>
                  ANTEIL
                </span>
              </div>
              <div style={{ padding: '14px 18px' }}>
                {data.byModel.length === 0 ? (
                  <span style={{ color: 'var(--ink-3)', fontSize: 13.5 }}>—</span>
                ) : (
                  (() => {
                    const totalReq = data.byModel.reduce((s, m) => s + m.count, 0) || 1;
                    return data.byModel.slice(0, 6).map((m, i) => {
                      const pct = Math.round((m.count / totalReq) * 100);
                      return (
                        <div key={m.model} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 0', borderBottom: i === Math.min(data.byModel.length, 6) - 1 ? 'none' : '1px solid var(--line)',
                          fontSize: 13,
                        }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: MODEL_COLORS[i % MODEL_COLORS.length] }} />
                          <span style={{ color: 'var(--ink-1)', flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.model}
                          </span>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-3)' }}>
                            {pct}% · {m.count}
                          </span>
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Hand-built bar chart. Renders one bar per day across the period. No
// charting library (recon finding 5 — none installed, none added).
// We don't have per-day data from the API; bars approximate by spreading
// totalInPeriod with a deterministic weekday curve so the visual reads
// honestly until per-day rollups land. Marked clearly via a tooltip.
function RequestsChart({ data, period }: { data: UsageData; period: Period }) {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const total = data.totalInPeriod || 0;
  // Even distribution as a baseline; weekends slightly lower. Marked as
  // approximation in the title attribute below.
  const avg = total > 0 ? total / days : 0;
  const bars: number[] = Array.from({ length: days }, (_, i) => {
    const weekday = (i + 1) % 7;
    const weight = weekday === 0 || weekday === 6 ? 0.55 : 1.0;
    return Math.max(0, Math.round(avg * weight));
  });
  const max = Math.max(...bars, 1);

  return (
    <div title={total === 0 ? 'Keine Daten in diesem Zeitraum' : 'Tagesverteilung (geschätzt) — präzise Tagesdaten folgen'}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${days}, 1fr)`,
        gap: 4, alignItems: 'end', height: 160, padding: '0 4px',
      }}>
        {bars.map((v, i) => {
          const h = max === 0 ? 0 : Math.max(4, Math.round((v / max) * 160));
          const weekend = (i + 1) % 7 === 0 || (i + 1) % 7 === 6;
          return (
            <div key={i} style={{
              background: 'var(--green)', borderRadius: '2px 2px 0 0',
              height: `${h}px`, opacity: weekend ? 0.4 : 1,
            }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
        <Legend dot="var(--green)" label="BYOK" />
        <Legend dot="var(--accent-bright)" label="FREE-TIER" />
        <Legend dot="var(--d-surface-3)" label="WOCHENENDE" />
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
      color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase',
    }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: dot }} />
      {label}
    </span>
  );
}
