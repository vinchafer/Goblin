'use client';

// Goblin-bundled (Layer 1) WEIGHTED allowance bar — Session 3.
//
// ONE allowance, weighted automatically. The user sees a single monthly Goblin
// allowance as "X% used" + the reset date — NEVER cost units, "$", the 4.4×
// Forge weight, raw token counts, or the provider name (HR-4 two-level truth).
// Forge simply moves the bar faster than Swift; that asymmetry lives in the
// behavior, never in the copy.
//
// HR-5 — must read as HEADROOM, not scarcity. Default/empty + normal states say
// "plenty left". Gold appears ONLY as a filled surface at warn/over; the normal
// track fill is brand green. No gold borders, no emojis, mono numbers. Legible at
// 390px in every state. The reset date is shown; no anxiety countdown.
//
// Flag OFF (default): neutral "coming soon" state, no cap implied.
// Status is computed server-side (apps/api/src/lib/goblin-cap.ts) over the
// goblin_hosted completions split by tier; this component only renders it.

import { GOBLIN_HOSTED_ENABLED } from '@/lib/goblin-hosted-models';
import { useLang, t, type Lang } from '@/lib/use-lang';

export type CapState = 'ok' | 'warn' | 'over';

export interface CapStatus {
  // Internal economics — present for completeness but NEVER rendered (HR-4).
  usedTokens: number;
  capTokens: number;
  remainingTokens: number;
  percent: number; // 0-100, already clamped — the only number shown
  state: CapState;
  /** ISO date (YYYY-MM-DD) the allowance resets — start of next calendar month. */
  resetDate?: string;
}

const mono = "var(--font-mono, 'JetBrains Mono', monospace)";

/** Localize the ISO reset date to a short, calm "1. Juli" / "July 1" form. */
function formatReset(iso: string | undefined, lang: Lang): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE', {
    day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

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

  const reset = formatReset(status?.resetDate, lang);
  const resetLine = reset ? t(lang, `Zurücksetzung am ${reset}.`, `Resets ${reset}.`) : null;

  // ── Flag ON but no data yet — clean empty state that reads as headroom ─────
  if (!status) {
    return (
      <div style={wrap}>
        <div style={headRow}>
          <span style={label}>{t(lang, 'Goblin-Kontingent · diesen Monat', 'Goblin allowance · this month')}</span>
          <span style={{ ...badge, fontFamily: mono }}>0%</span>
        </div>
        <div style={track} aria-hidden />
        <p style={note}>
          {t(lang, 'Viel Spielraum diesen Monat.', 'Plenty of headroom this month.')}
          {resetLine ? ` ${resetLine}` : ''}
        </p>
      </div>
    );
  }

  const isHot = status.state === 'over' || status.state === 'warn';
  const fill = isHot ? 'var(--brand-gold)' : 'var(--brand-green)';

  // Copy is headroom-first for ok, calm-and-actionable for warn/over. No numbers
  // beyond the percent; no scarcity framing.
  const noteText =
    status.state === 'over'
      ? t(lang, 'Kontingent für diesen Monat erreicht.', 'Monthly allowance reached.')
      : status.state === 'warn'
        ? t(lang, 'Du näherst dich deinem Kontingent.', 'Approaching your allowance.')
        : status.percent <= 0
          ? t(lang, 'Viel Spielraum diesen Monat.', 'Plenty of headroom this month.')
          : t(lang, 'Alles entspannt — viel Spielraum.', 'Plenty left — all relaxed.');

  return (
    <div style={wrap}>
      <div style={headRow}>
        <span style={label}>{t(lang, 'Goblin-Kontingent · diesen Monat', 'Goblin allowance · this month')}</span>
        <span style={{ ...badge, fontFamily: mono, color: isHot ? 'var(--brand-gold-ink, #7A5A12)' : 'var(--brand-green, #1A3A2A)' }}>
          {status.percent}%
        </span>
      </div>
      <div
        style={track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={status.percent}
        aria-label={t(lang, 'Goblin-Kontingent-Nutzung', 'Goblin allowance usage')}
      >
        <div style={{ ...fillBase, width: `${Math.max(status.percent, status.percent > 0 ? 2 : 0)}%`, background: fill }} />
      </div>
      <p style={note}>
        {noteText}
        {resetLine ? ` ${resetLine}` : ''}
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
  gap: 8,
};
const label: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--ink-1, #0F2B1E)',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const badge: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--brand-green, #1A3A2A)',
  flexShrink: 0,
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
