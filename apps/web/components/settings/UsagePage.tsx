'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';

// FIX2-3 (BUG-8): single source of truth. The old `/api/usage/summary` endpoint
// did not exist on the API → this page always fell back to a fake "0 / 200",
// contradicting the sidebar and billing. We now read the SAME authoritative
// endpoint the sidebar uses (`/api/users/me/usage`), so all three surfaces agree.
interface UsageResp {
  plan: string;
  monthlyUsed: number;
  monthlyLimit: number;
  daysUntilReset: number | null;
  totalInPeriod: number;
  byTier: { byok: number; free_api: number; goblin_hosted: number };
  byModel: { model: string; count: number }[];
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
  const [state, setState] = useState<UsageResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    apiGet<UsageResp>('/api/users/me/usage')
      .then((d) => { if (alive) setState(d); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return <div style={{ padding: 24, color: 'var(--text-meta)', fontFamily: 'var(--font-sans)' }}>Lade Nutzung…</div>;

  const used = state?.monthlyUsed ?? 0;
  const limit = state?.monthlyLimit ?? 0;
  const byok = state?.byTier?.byok ?? 0;
  const hasGoblinCap = limit > 0;

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <SettingsGroup label="Diesen Monat">
        <SettingsCard>
          {/* Goblin-provided allowance — a real cap exists, so a percent is honest. */}
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 15, color: 'var(--text)' }}>Goblin-Anfragen</span>
              <span style={{ fontSize: 15, color: 'var(--text-meta)', fontFamily: 'var(--font-mono)' }}>
                {hasGoblinCap ? `${formatNum(used)} / ${formatNum(limit)}` : `${formatNum(used)}`}
              </span>
            </div>
            {hasGoblinCap
              ? <ProgressBar value={used} max={limit} />
              : <div style={{ fontSize: 13, color: 'var(--text-meta)' }}>Kein Kontingent aktiv.</div>}
            <div style={{ fontSize: 12, color: 'var(--text-meta)' }}>
              Über das Goblin-Kontingent (Trial / Free-Pool).
            </div>
          </div>

          {/* BYOK — no cap, so we show an honest COUNT, never a fabricated percent. */}
          <div style={{ padding: 20, borderTop: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 15, color: 'var(--text)' }}>Über deine Keys (BYOK)</span>
              <span style={{ fontSize: 15, color: 'var(--text-meta)', fontFamily: 'var(--font-mono)' }}>
                {formatNum(byok)} {byok === 1 ? 'Anfrage' : 'Anfragen'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-meta)' }}>
              Läuft über deine eigenen API-Keys — kein Limit von Goblin.
            </div>
          </div>
        </SettingsCard>
      </SettingsGroup>

      {state?.byModel && state.byModel.length > 0 && (
        <SettingsGroup label="Pro Modell">
          <SettingsCard>
            {state.byModel.map((m) => (
              <div key={m.model} className="list-item" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-hairline)' }}>
                <span style={{ fontSize: 14, color: 'var(--text)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.model.replace(/^(?:anthropic|openai|google|groq)\//, '')}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-meta)', fontFamily: 'var(--font-mono)', flexShrink: 0, marginLeft: 12 }}>{formatNum(m.count)}</span>
              </div>
            ))}
          </SettingsCard>
        </SettingsGroup>
      )}

      {state?.daysUntilReset != null && (
        <p style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)', marginTop: 16, padding: '0 4px' }}>
          Goblin-Kontingent wird in {state.daysUntilReset} {state.daysUntilReset === 1 ? 'Tag' : 'Tagen'} zurückgesetzt.
        </p>
      )}
    </div>
  );
}
