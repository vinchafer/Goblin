'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { useLang, t } from '@/lib/use-lang';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';
import GoblinUsageBar, { type CapStatus } from '../usage/GoblinUsageBar';
import StorageUsageBar from '../usage/StorageUsageBar';

// Reads the single authoritative endpoint (GET /api/users/me/usage) — the same one
// the sidebar + dashboard usage screen use, so all three agree. DD §A: the legacy
// request-count (monthlyUsed/monthlyLimit) is retired; activity is the real BUILD
// count (byTier / goblinBuilds), the only limit is the weighted allowance (goblinCap).
interface UsageResp {
  plan: string;
  daysUntilReset: number | null;
  totalInPeriod: number;
  byTier: { byok: number; free_api: number; goblin_hosted: number };
  goblinBuilds: { swift: number; forge: number };
  byModel: { model: string; count: number }[];
  goblinCap?: CapStatus | null;
}

/** User-facing unit: "Build" (loanword in DE). Identical in both languages. */
function builds(n: number): string {
  return `${n} ${n === 1 ? 'Build' : 'Builds'}`;
}

export function UsagePage() {
  const lang = useLang();
  const [state, setState] = useState<UsageResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    apiGet<UsageResp>('/api/users/me/usage')
      .then((d) => { if (alive) setState(d); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return <div style={{ padding: 24, color: 'var(--text-meta)', fontFamily: 'var(--font-sans)' }}>{t(lang, 'Lade Nutzung…', 'Loading usage…')}</div>;

  const byok = state?.byTier?.byok ?? 0;
  const swift = state?.goblinBuilds?.swift ?? 0;
  const forge = state?.goblinBuilds?.forge ?? 0;
  const showGoblin = !!state && (!!state.goblinCap || state.byTier.goblin_hosted > 0);

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      {/* Weighted Goblin allowance bar — the only real limit. % only (two-level truth);
          renders its own neutral state when the flag is off / no data. */}
      {state?.goblinCap && (
        <SettingsGroup label={t(lang, 'Goblin-Modelle', 'Goblin models')}>
          <SettingsCard>
            <div style={{ padding: 16 }}>
              <GoblinUsageBar status={state.goblinCap} />
            </div>
          </SettingsCard>
        </SettingsGroup>
      )}

      <SettingsGroup label={t(lang, 'Speicher', 'Storage')}>
        <SettingsCard>
          <div style={{ padding: 16 }}>
            <StorageUsageBar />
          </div>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label={t(lang, 'Diesen Monat', 'This month')}>
        <SettingsCard>
          {/* D1 — per-Goblin-model activity in Builds (run counts, never cost units). */}
          {showGoblin && (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid var(--border-hairline)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 15, color: 'var(--text)' }}>Goblin Swift</span>
                <span style={{ fontSize: 15, color: 'var(--text-meta)', fontFamily: 'var(--font-mono)' }}>{builds(swift)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 15, color: 'var(--text)' }}>Goblin Forge</span>
                <span style={{ fontSize: 15, color: 'var(--text-meta)', fontFamily: 'var(--font-mono)' }}>{builds(forge)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-meta)', lineHeight: 1.5 }}>
                {t(lang,
                  'Forge ist das stärkere Modell und verbraucht dein monatliches Kontingent schneller als Swift.',
                  'Forge is the stronger model and uses your monthly allowance faster than Swift.')}
              </div>
            </div>
          )}

          {/* BYOK — runs over your own keys, no Goblin cap → an honest COUNT, never a percent. */}
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 15, color: 'var(--text)' }}>{t(lang, 'Über deine Keys (BYOK)', 'Via your keys (BYOK)')}</span>
              <span style={{ fontSize: 15, color: 'var(--text-meta)', fontFamily: 'var(--font-mono)' }}>{builds(byok)}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-meta)' }}>
              {t(lang,
                'Läuft über deine eigenen API-Keys — kein Limit von Goblin.',
                'Runs over your own API keys — no limit from Goblin.')}
            </div>
          </div>
        </SettingsCard>
      </SettingsGroup>

      {state?.byModel && state.byModel.length > 0 && (
        <SettingsGroup label={t(lang, 'Pro Modell', 'Per model')}>
          <SettingsCard>
            {state.byModel.map((m) => (
              <div key={m.model} className="list-item" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-hairline)' }}>
                <span style={{ fontSize: 14, color: 'var(--text)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.model}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-meta)', fontFamily: 'var(--font-mono)', flexShrink: 0, marginLeft: 12 }}>{builds(m.count)}</span>
              </div>
            ))}
          </SettingsCard>
        </SettingsGroup>
      )}

      {(() => {
        // F5: count down to the real calendar-month allowance reset (goblinCap.resetDate),
        // not the billing_cycle_start-based daysUntilReset (which read "0 Tagen" on a
        // stale/zero cycle). Fall back to the legacy value only when no cap/resetDate.
        const iso = state?.goblinCap?.resetDate;
        let days: number | null = null;
        if (iso) {
          const d = new Date(`${iso}T00:00:00Z`);
          if (!Number.isNaN(d.getTime())) days = Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
        }
        if (days == null) days = state?.daysUntilReset ?? null;
        return days != null ? (
          <p style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)', marginTop: 16, padding: '0 4px' }}>
            {t(lang,
              `Goblin-Kontingent wird in ${days} ${days === 1 ? 'Tag' : 'Tagen'} zurückgesetzt.`,
              `Goblin allowance resets in ${days} ${days === 1 ? 'day' : 'days'}.`)}
          </p>
        ) : null;
      })()}
    </div>
  );
}
