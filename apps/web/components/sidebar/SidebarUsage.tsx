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

  // Comped users have no cap and no trial — a percent or countdown would be a lie.
  // Show a calm "Vollzugriff" state + an honest Build count.
  if (isComped) {
    return (
      <Link href="/dashboard/usage" style={labelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--ink-2, #2c4538)' }}>
            {t(lang, 'Verbrauch', 'Usage')}
          </span>
          <span style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--brand-green, #0F2B1E)' }}>
            {planLabel(data.plan, true)}
          </span>
        </div>
        <div style={{ marginTop: 6, fontSize: 'var(--t-caption-fs)', color: 'var(--ink-3, #5c6f64)' }}>
          {t(lang, `${builds(data.totalInPeriod)} diesen Monat`, `${builds(data.totalInPeriod)} this month`)}
        </div>
      </Link>
    );
  }

  // A weighted Goblin allowance exists → show its percent (the only honest cap).
  if (data.goblinCap) {
    const pct = Math.min(100, Math.max(0, data.goblinCap.percent));
    const near = pct >= 90;
    const barColor = near ? 'var(--danger, #a04230)' : 'var(--green, #0F2B1E)';
    return (
      <Link href="/dashboard/usage" style={labelStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--ink-2, #2c4538)' }}>
            {t(lang, 'Kontingent', 'Allowance')}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono, JetBrains Mono), monospace',
            fontSize: 'var(--t-mono-fs)', fontWeight: 600,
            color: near ? 'var(--danger, #a04230)' : 'var(--ink-1, #0F2B1E)',
          }}>
            {pct}&nbsp;%
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 2, overflow: 'hidden', background: 'rgba(15,43,30,0.10)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barColor, transition: 'width .3s' }} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 7, fontSize: 'var(--t-caption-fs)', color: 'var(--ink-3, #5c6f64)',
        }}>
          <span>{planLabel(data.plan)}</span>
          {data.daysUntilReset != null && (
            <span>{t(lang, `Reset in ${data.daysUntilReset} ${data.daysUntilReset === 1 ? 'Tag' : 'Tagen'}`, `Resets in ${data.daysUntilReset} ${data.daysUntilReset === 1 ? 'day' : 'days'}`)}</span>
          )}
        </div>
      </Link>
    );
  }

  // No cap (no plan / flag off) → a plain, honest Build count, never a fake percent.
  return (
    <Link href="/dashboard/usage" style={labelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--ink-2, #2c4538)' }}>
          {t(lang, 'Verbrauch', 'Usage')}
        </span>
        <span style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--brand-green, #0F2B1E)' }}>
          {planLabel(data.plan)}
        </span>
      </div>
      <div style={{ marginTop: 6, fontSize: 'var(--t-caption-fs)', color: 'var(--ink-3, #5c6f64)' }}>
        {t(lang, `${builds(data.totalInPeriod)} diesen Monat`, `${builds(data.totalInPeriod)} this month`)}
      </div>
    </Link>
  );
}
