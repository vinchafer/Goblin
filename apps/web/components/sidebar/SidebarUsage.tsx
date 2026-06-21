'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { planLabel } from '@/lib/plan-label';
import { useLang, t } from '@/lib/use-lang';
import { isDemoActive } from '@/lib/demo/demo-flag';
import type { CapStatus } from '@/components/usage/GoblinUsageBar';

// Wired to the same usage endpoint the usage screen uses: GET /api/users/me/usage.
// DD §A: the legacy monthlyUsed/monthlyLimit request-count is retired. The headline
// is now the weighted Goblin allowance percent (goblinCap) when a cap exists, or a
// plain BUILD count (totalInPeriod) when it doesn't (comped / no plan / flag off).
interface UsageData {
  plan: string;
  daysUntilReset: number | null;
  totalInPeriod: number;
  goblinCap?: CapStatus | null;
}

/** "Build" loanword, identical DE/EN. */
function builds(n: number): string {
  return `${n} ${n === 1 ? 'Build' : 'Builds'}`;
}

/** F5: whole days until an ISO (YYYY-MM-DD) reset date, clamped ≥ 0. The Goblin
 *  allowance resets at the calendar-month boundary (goblinCap.resetDate) — NOT the
 *  billing_cycle_start the legacy daysUntilReset used, which read "0 Tagen" on
 *  accounts with a stale/zero cycle. */
function daysUntilISO(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
}

export function SidebarUsage() {
  const lang = useLang();
  const [data, setData] = useState<UsageData | null>(null);
  const [isComped, setIsComped] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Demo (Sprint 10 §7): no usage fetch → failed=true → widget renders nothing.
    if (isDemoActive()) { setFailed(true); return; }
    let alive = true;
    apiGet<UsageData>('/api/users/me/usage')
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setFailed(true); });
    apiGet<{ is_comped?: boolean }>('/api/users/me')
      .then((u) => { if (alive) setIsComped(!!u?.is_comped); })
      .catch(() => { /* default: not comped */ });
    return () => { alive = false; };
  }, []);

  // Loading — calm placeholder.
  if (!data && !failed) {
    return (
      <div style={{
        margin: '0 12px 8px',
        height: 52,
        borderRadius: 8,
        background: 'rgba(15,43,30,0.05)',
      }} />
    );
  }

  // Couldn't reach the endpoint — stay quiet rather than show a fake number.
  if (failed || !data) return null;

  const labelStyle: React.CSSProperties = {
    display: 'block', textDecoration: 'none',
    margin: '0 12px 8px', padding: '10px 12px', borderRadius: 8,
    background: 'rgba(15,43,30,0.05)',
    border: '1px solid var(--line, rgba(15,43,30,.10))',
    fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
    color: 'var(--ink-1, #0F2B1E)',
  };

  // A weighted Goblin allowance exists → show the consumption BAR (W1). This is the
  // same data source (goblinCap) and two-level-truth rules (% only, no tokens/cost/
  // weight) as the full usage page's GoblinUsageBar — a compact version for the
  // sidebar so consumption is visible at a glance. Comped accounts are shown the bar
  // too: they are NOT cap-exempt (model-router enforces the weighted allowance with
  // no comped bypass), so a bar is honest, not a lie — only the plan badge differs.
  if (data.goblinCap) {
    const pct = Math.min(100, Math.max(0, data.goblinCap.percent));
    // Match GoblinUsageBar semantics: gold (filled) at warn/over, brand green at ok
    // (H-4 — gold is a filled surface only, never a border). State comes from the
    // server cap logic, not an ad-hoc pct threshold.
    const hot = data.goblinCap.state === 'warn' || data.goblinCap.state === 'over';
    const barColor = hot ? 'var(--brand-gold, #D4A737)' : 'var(--brand-green, #1A3A2A)';
    // Keep a sliver visible once any allowance is used, so low percentages still read
    // as a bar rather than an empty track.
    const fillWidth = pct > 0 ? Math.max(pct, 2) : 0;
    return (
      <Link href="/dashboard/usage" style={labelStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--ink-2, #2c4538)' }}>
            {t(lang, 'Kontingent', 'Allowance')}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono, JetBrains Mono), monospace',
            fontSize: 'var(--t-mono-fs)', fontWeight: 600,
            color: hot ? 'var(--brand-gold-ink, #7A5A12)' : 'var(--ink-1, #0F2B1E)',
          }}>
            {pct}&nbsp;%
          </span>
        </div>
        <div
          style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: 'rgba(15,43,30,0.10)' }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={t(lang, 'Goblin-Kontingent-Nutzung', 'Goblin allowance usage')}
        >
          <div style={{ height: '100%', width: `${fillWidth}%`, borderRadius: 999, background: barColor, transition: 'width .24s ease' }} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 7, fontSize: 'var(--t-caption-fs)', color: 'var(--ink-3, #5c6f64)',
        }}>
          <span>{planLabel(data.plan, isComped)}</span>
          {(() => {
            // F5: prefer the calendar-month reset the cap actually uses; fall back
            // to the legacy billing-cycle value only if no resetDate is present.
            const days = daysUntilISO(data.goblinCap.resetDate) ?? data.daysUntilReset;
            return days != null ? (
              <span>{t(lang, `Reset in ${days} ${days === 1 ? 'Tag' : 'Tagen'}`, `Resets in ${days} ${days === 1 ? 'day' : 'days'}`)}</span>
            ) : null;
          })()}
        </div>
      </Link>
    );
  }

  // No cap (flag off / no goblin usage) → a plain, honest Build count, never a fake
  // percent. The plan badge still reflects comped ("Vollzugriff") when applicable.
  return (
    <Link href="/dashboard/usage" style={labelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--ink-2, #2c4538)' }}>
          {t(lang, 'Verbrauch', 'Usage')}
        </span>
        <span style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--brand-green, #0F2B1E)' }}>
          {planLabel(data.plan, isComped)}
        </span>
      </div>
      <div style={{ marginTop: 6, fontSize: 'var(--t-caption-fs)', color: 'var(--ink-3, #5c6f64)' }}>
        {t(lang, `${builds(data.totalInPeriod)} diesen Monat`, `${builds(data.totalInPeriod)} this month`)}
      </div>
    </Link>
  );
}
