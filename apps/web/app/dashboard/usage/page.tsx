'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { useLang, t, type Lang } from '@/lib/use-lang';
import GoblinUsageBar, { type CapStatus } from '@/components/usage/GoblinUsageBar';

// DD §A: the legacy request-count is retired. Activity is the real `agent_runs` count
// (totalInPeriod / byTier / goblinBuilds, all plain BUILD counts); the only limit is
// the weighted Goblin allowance (goblinCap). No monthlyUsed/monthlyLimit here.
interface UsageData {
  plan: string;
  daysUntilReset: number | null;
  period: string;
  totalInPeriod: number;
  byTier: { byok: number; free_api: number; goblin_hosted: number };
  // D1: per-Goblin-model activity in BUILDS (run counts, never cost units).
  goblinBuilds: { swift: number; forge: number };
  byModel: Array<{ model: string; count: number }>;
  byProject: Array<{ projectId: string; name: string; count: number }>;
  // Weighted Goblin allowance (present only when the Goblin-hosted flag is on).
  goblinCap?: CapStatus | null;
}

type Period = '7d' | '30d' | '90d';

const PERIOD_LABEL: Record<Period, string> = { '7d': '7 TAGE', '30d': '30 TAGE', '90d': '90 TAGE' };
const MODEL_COLORS = ['var(--green)', 'var(--accent-bright)', '#6db97b', '#3A6B8A', '#7A4A8A'];

/** User-facing unit: "Build" (loanword in DE, common in dev contexts). Defined once.
 *  Identical in DE/EN, so the lang arg is accepted for call-site uniformity only. */
function builds(n: number, _lang: Lang): string {
  return `${n} ${n === 1 ? 'Build' : 'Builds'}`;
}

// Plain-language status sentence — leads the screen. Reads as ACTIVITY (how much you
// built), never "X von Y" cap: the real cap is the weighted allowance bar below.
function statusSentence(u: UsageData, lang: Lang): { headline: string } {
  const n = u.totalInPeriod;
  if (n === 0) {
    return { headline: t(lang, 'Diesen Zeitraum noch nichts gebaut — leg los.', "Nothing built in this window yet — let's go.") };
  }
  return {
    headline: t(
      lang,
      `Du hast ${builds(n, lang)} in diesem Zeitraum gemacht.`,
      `You've made ${builds(n, lang)} in this window.`,
    ),
  };
}

export default function UsagePage() {
  const lang = useLang();
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

  const showGoblin = !!data && (!!data.goblinCap || data.byTier.goblin_hosted > 0);

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
              <span className="num">/{t(lang, 'VERBRAUCH', 'USAGE')}</span>
              {t(lang, 'Letzte', 'Last')} {PERIOD_LABEL[period]}
            </div>
            <h1 style={{
              fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
              fontWeight: 600, fontSize: 'clamp(32px, 4vw, 48px)',
              letterSpacing: '-0.030em', lineHeight: 1.06,
              color: 'var(--ink-1)', margin: 0,
            }}>
              {t(lang, 'Verbrauch', 'Usage')} <span className="gobl-serif">{t(lang, 'auf einen Blick.', 'at a glance.')}</span>
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

        {/* 1. STATUS SENTENCE — answer first (activity, in Builds). */}
        {loading ? (
          <div className="gobl-panel" style={{ padding: 24, marginBottom: 28, color: 'var(--ink-3)' }}>
            {t(lang, 'Lade …', 'Loading …')}
          </div>
        ) : !data ? null : (
          <div className="gobl-panel" style={{ padding: '22px 24px', marginBottom: 28 }}>
            <p style={{
              fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
              fontWeight: 600, fontSize: 22, letterSpacing: '-0.018em',
              color: 'var(--ink-1)', margin: '0 0 8px', lineHeight: 1.3,
            }}>
              {statusSentence(data, lang).headline}
            </p>
            <p style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5,
              letterSpacing: '0.10em', color: 'var(--ink-3)',
              margin: 0, textTransform: 'uppercase',
            }}>
              {t(lang, 'ÜBER DEINE KEYS', 'VIA YOUR KEYS')} · {builds(data.byTier.byok, lang).toUpperCase()}
            </p>
          </div>
        )}

        {/* WEIGHTED Goblin allowance — single bar, headroom-positive. % only, no
            cost units / tokens / weight (two-level truth). Flag-gated by the bar. */}
        {data?.goblinCap && (
          <div style={{ marginBottom: 16, maxWidth: 520 }}>
            <GoblinUsageBar status={data.goblinCap} />
          </div>
        )}

        {/* D1 — per-Goblin-model ACTIVITY in Builds + BYOK Builds + the qualitative
            Forge explainer (HR-5). All plain run counts; no numbers about cost. */}
        {showGoblin && data && (
          <div className="gobl-panel" style={{ padding: '18px 20px', marginBottom: 28, maxWidth: 520 }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, letterSpacing: '0.14em',
              color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 10,
            }}>
              {t(lang, 'GOBLIN-MODELLE · DIESER MONAT', 'GOBLIN MODELS · THIS MONTH')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'baseline', fontSize: 14, color: 'var(--ink-1)' }}>
              <span style={{ fontWeight: 600 }}>Goblin Swift:</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{builds(data.goblinBuilds.swift, lang)}</span>
              <span style={{ color: 'var(--ink-3)', margin: '0 4px' }}>·</span>
              <span style={{ fontWeight: 600 }}>Goblin Forge:</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{builds(data.goblinBuilds.forge, lang)}</span>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              {t(
                lang,
                'Forge ist das stärkere Modell und verbraucht dein monatliches Kontingent schneller als Swift.',
                'Forge is the stronger model and uses your monthly allowance faster than Swift.',
              )}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              {t(
                lang,
                `Über deine Keys: ${builds(data.byTier.byok, lang)} — kein Limit von Goblin.`,
                `Via your keys: ${builds(data.byTier.byok, lang)} — no limit from Goblin.`,
              )}
            </p>
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

        {/* 2. CHART — evidence. Builds per day (approximation, marked). */}
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
                {t(lang, 'Builds pro Tag', 'Builds per day')}
              </h2>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase',
              }}>
                {PERIOD_LABEL[period]}
              </span>
            </div>
            <div style={{ padding: '20px 18px' }}>
              <RequestsChart data={data} period={period} lang={lang} />
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
                  {t(lang, 'Pro Projekt', 'Per project')}
                </h2>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase',
                }}>
                  {t(lang, 'BUILDS', 'BUILDS')} · {PERIOD_LABEL[period]}
                </span>
              </div>
              {data.byProject.length === 0 ? (
                <div style={{ padding: '20px 18px', color: 'var(--ink-3)', fontSize: 13.5 }}>
                  {t(lang, 'Noch keine Aktivität in diesem Zeitraum.', 'No activity in this window yet.')}
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
                          {builds(p.count, lang)}
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
                  {t(lang, 'Modelle', 'Models')}
                </h2>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase',
                }}>
                  {t(lang, 'ANTEIL', 'SHARE')}
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

// Hand-built bar chart. Renders one bar per day across the period. No charting
// library. We don't have per-day data from the API; bars approximate by spreading
// totalInPeriod with a deterministic weekday curve (marked via a tooltip).
function RequestsChart({ data, period, lang }: { data: UsageData; period: Period; lang: Lang }) {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const total = data.totalInPeriod || 0;
  const avg = total > 0 ? total / days : 0;
  const bars: number[] = Array.from({ length: days }, (_, i) => {
    const weekday = (i + 1) % 7;
    const weight = weekday === 0 || weekday === 6 ? 0.55 : 1.0;
    return Math.max(0, Math.round(avg * weight));
  });
  const max = Math.max(...bars, 1);

  return (
    <div title={total === 0
      ? t(lang, 'Keine Daten in diesem Zeitraum', 'No data in this window')
      : t(lang, 'Tagesverteilung (geschätzt) — präzise Tagesdaten folgen', 'Daily distribution (estimated) — precise daily data to follow')}>
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
        <Legend dot="var(--green)" label={t(lang, 'BUILDS', 'BUILDS')} />
        <Legend dot="var(--d-surface-3)" label={t(lang, 'WOCHENENDE', 'WEEKEND')} />
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
