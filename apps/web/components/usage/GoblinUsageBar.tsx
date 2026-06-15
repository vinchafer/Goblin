'use client';

// Goblin-bundled (Layer 2) fair-use consumption bar — v6.1 API-first scaffold.
//
// Flag OFF (default): neutral "coming soon" state. Renders an empty track and a
// provider-agnostic label — NO cap numbers, NO "limit" wording, nothing that
// implies a live cap is enforced. (HR-8 / HR-9 discipline.)
//
// Flag ON (NEXT_PUBLIC_GOBLIN_HOSTED_API=true — manual local test only): renders the
// real consumption bar from a CapStatus. The status is computed server-side by
// apps/api/src/lib/goblin-cap.ts over the goblin_hosted_monthly_tokens rollup
// (mig 0067); this component only renders it, so the cap logic stays single-source.
//
// Design system locked (HR-13): brand green track fill, gold ONLY as a filled
// surface (warn/over), no gold borders, no emojis. Numbers in JetBrains Mono.

import { GOBLIN_HOSTED_ENABLED } from '@/lib/goblin-hosted-models';
import { useLang, t } from '@/lib/use-lang';

export type CapState = 'ok' | 'warn' | 'over';

export interface CapStatus {
  usedTokens: number;
  capTokens: number;
  remainingTokens: number;
  percent: number; // 0-100, already clamped
  state: CapState;
}

function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

const mono = "var(--font-mono, 'JetBrains Mono', monospace)";

export default function GoblinUsageBar({ status }: { status?: CapStatus | null }) {
  const lang = useLang();

  // ── Flag OFF — neutral, non-committal coming-soon state ───────────────────
  if (!GOBLIN_HOSTED_ENABLED) {
    return (
      <div style={wrap}>
        <div style={headRow}>
          <span style={label}>{t(lang, 'Goblin-Modelle', 'Goblin-bundled models')}</span>
          <span style={badge}>{t(lang, 'Bald verfügbar', 'Coming soon')}</span>
        </div>
        <div style={track} aria-hidden />
        <p style={note}>
          {t(
            lang,
            'Eigene, gebündelte Modelle — kein Key, kein Token-Stress. Bald verfügbar.',
            'Curated, bundled models — no key, no token anxiety. Coming soon.',
          )}
        </p>
      </div>
    );
  }

  // ── Flag ON but no data yet — clean empty state ───────────────────────────
  if (!status) {
    return (
      <div style={wrap}>
        <div style={headRow}>
          <span style={label}>{t(lang, 'Goblin-Modelle', 'Goblin-bundled models')}</span>
          <span style={{ ...badge, fontFamily: mono }}>0%</span>
        </div>
        <div style={track} aria-hidden />
      </div>
    );
  }

  const fill =
    status.state === 'over' || status.state === 'warn'
      ? 'var(--brand-gold)'
      : 'var(--brand-green)';

  const stateLabel =
    status.state === 'over'
      ? t(lang, 'Fair-Use-Limit erreicht', 'Fair-use limit reached')
      : status.state === 'warn'
        ? t(lang, 'Limit nähert sich', 'Approaching limit')
        : t(lang, 'Inklusive', 'Included');

  return (
    <div style={wrap}>
      <div style={headRow}>
        <span style={label}>{t(lang, 'Goblin-Modelle · diesen Monat', 'Goblin-bundled · this month')}</span>
        <span style={{ ...badge, fontFamily: mono }}>{status.percent}%</span>
      </div>
      <div
        style={track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={status.percent}
        aria-label={t(lang, 'Goblin-Modell-Nutzung', 'Goblin-bundled usage')}
      >
        <div style={{ ...fillBase, width: `${status.percent}%`, background: fill }} />
      </div>
      <p style={{ ...note, fontFamily: mono }}>
        {formatTokens(status.usedTokens)} / {formatTokens(status.capTokens)} · {stateLabel}
      </p>
    </div>
  );
}

// ── Inline styles (matches the app's token-var + inline-style convention) ────
const wrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '12px 14px',
  borderRadius: 10,
  background: 'var(--color-surface-2, #F4ECD8)',
};
const headRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};
const label: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--ink-1, #0F2B1E)',
};
const badge: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--brand-green, #1A3A2A)',
};
const track: React.CSSProperties = {
  position: 'relative',
  height: 8,
  width: '100%',
  borderRadius: 999,
  background: 'var(--color-paper, #FBF7EC)',
  overflow: 'hidden',
};
const fillBase: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  borderRadius: 999,
  transition: 'width 240ms ease',
};
const note: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: 'var(--ink-2, #355043)',
};
