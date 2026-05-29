'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';

// Wired to the same usage endpoint screen 10 uses: GET /api/users/me/usage.
// We only need the monthly headline numbers + plan here; the full breakdown
// lives on the usage screen.
interface UsageData {
  plan: string;
  monthlyUsed: number;
  monthlyLimit: number;
  daysUntilReset: number | null;
}

export function SidebarUsage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    apiGet<UsageData>('/api/users/me/usage')
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setFailed(true); });
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

  const limit = data.monthlyLimit > 0 ? data.monthlyLimit : 0;
  const pct = limit > 0 ? Math.min(100, Math.round((data.monthlyUsed / limit) * 100)) : 0;
  const near = pct >= 90;
  const barColor = near ? 'var(--danger, #a04230)' : 'var(--green, #0F2B1E)';

  return (
    <Link
      href="/dashboard/usage"
      style={{
        display: 'block', textDecoration: 'none',
        margin: '0 12px 8px',
        padding: '10px 12px',
        borderRadius: 8,
        background: 'rgba(15,43,30,0.05)',
        border: '1px solid var(--line, rgba(15,43,30,.10))',
        fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
        color: 'var(--ink-1, #0F2B1E)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 7,
      }}>
        <span style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--ink-2, #2c4538)' }}>
          Verbrauch
        </span>
        <span style={{
          fontFamily: 'var(--font-mono, JetBrains Mono), monospace',
          fontSize: 'var(--t-mono-fs)', fontWeight: 600,
          color: near ? 'var(--danger, #a04230)' : 'var(--ink-1, #0F2B1E)',
        }}>
          {pct}&nbsp;%
        </span>
      </div>

      {/* Slim, calm progress bar */}
      <div style={{
        height: 4, borderRadius: 2, overflow: 'hidden',
        background: 'rgba(15,43,30,0.10)',
      }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, transition: 'width .3s' }} />
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 7, fontSize: 'var(--t-caption-fs)', color: 'var(--ink-3, #5c6f64)',
      }}>
        <span style={{ textTransform: 'capitalize' }}>{data.plan}</span>
        {data.daysUntilReset != null && (
          <span>Reset in {data.daysUntilReset} {data.daysUntilReset === 1 ? 'Tag' : 'Tagen'}</span>
        )}
      </div>
    </Link>
  );
}
