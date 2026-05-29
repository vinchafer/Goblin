'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';

interface UsageState {
  requestsThisMonth: number;
  requestsLimit: number;
  storageUsedMb: number;
  storageLimitMb: number;
  byProvider: { provider: string; requests: number; tokens: number }[];
  resetAt: string | null;
}

function formatNum(n: number) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div style={{ height: 8, borderRadius: 4, background: 'var(--subtle)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand-green)', transition: 'width 300ms ease' }} />
    </div>
  );
}

export function UsagePage() {
  const [state, setState] = useState<UsageState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
        const r = await fetch(`${apiBase}/api/usage/summary`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (r.ok) setState(await r.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ padding: 24, color: 'var(--text-meta)', fontFamily: 'var(--font-sans)' }}>Lade Nutzung...</div>;

  const req = state?.requestsThisMonth ?? 0;
  const reqLimit = state?.requestsLimit ?? 200;
  const stor = state?.storageUsedMb ?? 0;
  const storLimit = state?.storageLimitMb ?? 5120;
  const resetAt = state?.resetAt ? new Date(state.resetAt).toLocaleDateString('de-DE') : null;

  return (
    <div style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <SettingsGroup label="Diesen Monat">
        <SettingsCard>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 15, color: 'var(--text)' }}>AI-Anfragen</span>
              <span style={{ fontSize: 15, color: 'var(--text-meta)', fontFamily: 'var(--font-mono)' }}>{formatNum(req)} / {formatNum(reqLimit)}</span>
            </div>
            <ProgressBar value={req} max={reqLimit} />
          </div>
          <div style={{ padding: 20, borderTop: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 15, color: 'var(--text)' }}>Speicher</span>
              <span style={{ fontSize: 15, color: 'var(--text-meta)', fontFamily: 'var(--font-mono)' }}>{(stor / 1024).toFixed(2)} / {(storLimit / 1024).toFixed(0)} GB</span>
            </div>
            <ProgressBar value={stor} max={storLimit} />
          </div>
        </SettingsCard>
      </SettingsGroup>

      {state?.byProvider && state.byProvider.length > 0 && (
        <SettingsGroup label="Pro Provider">
          <SettingsCard>
            {state.byProvider.map((p) => (
              <div key={p.provider} style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-hairline)' }}>
                <span style={{ fontSize: 15, color: 'var(--text)' }}>{p.provider}</span>
                <span style={{ fontSize: 13, color: 'var(--text-meta)', fontFamily: 'var(--font-mono)' }}>{formatNum(p.requests)} req · {formatNum(p.tokens)} tok</span>
              </div>
            ))}
          </SettingsCard>
        </SettingsGroup>
      )}

      {resetAt && (
        <p style={{ fontSize: 12, color: 'var(--text-meta)', marginTop: 16, padding: '0 4px' }}>
          Zähler werden am {resetAt} zurückgesetzt.
        </p>
      )}
    </div>
  );
}
