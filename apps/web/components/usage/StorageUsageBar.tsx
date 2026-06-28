'use client';

// Real per-user storage gauge — "X.X / Y GB used" + a fill bar. Mirrors the visual
// language of GoblinUsageBar (token allowance), but storage IS a concrete figure, so
// unlike the token bar it DOES show the numbers. Reads GET /api/account/storage
// (instant counter, no B2 call). Green fill normally; gold at ≥80% / full. A locked
// plan (limit 0 → none / read-only) reads as a calm "upgrade to store files" state.

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { useLang, t } from '@/lib/use-lang';
import { formatGb } from '@/lib/plan-storage';

interface StorageResp {
  usedBytes: number;
  limitBytes: number;
  percent: number;
}

const mono = "var(--font-mono, 'JetBrains Mono', monospace)";

export default function StorageUsageBar() {
  const lang = useLang();
  const [data, setData] = useState<StorageResp | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let alive = true;
    apiGet<StorageResp>('/api/account/storage')
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setErrored(true); });
    return () => { alive = false; };
  }, []);

  if (errored) return null; // never block the page on a usage read

  const used = data?.usedBytes ?? 0;
  const limit = data?.limitBytes ?? 0;
  const percent = data?.percent ?? 0;
  const locked = limit <= 0;
  const isHot = !locked && percent >= 80;
  const fill = isHot ? 'var(--brand-gold)' : 'var(--brand-green)';

  return (
    <div style={wrap}>
      <div style={headRow}>
        <span style={label}>{t(lang, 'Speicher', 'Storage')}</span>
        <span style={{ ...badge, fontFamily: mono, color: isHot ? 'var(--brand-gold-ink, #7A5A12)' : 'var(--brand-green, #1A3A2A)' }}>
          {locked
            ? t(lang, 'gesperrt', 'locked')
            : `${formatGb(used)} / ${formatGb(limit)}`}
        </span>
      </div>
      <div
        style={track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={locked ? 0 : percent}
        aria-label={t(lang, 'Speichernutzung', 'Storage usage')}
      >
        {!locked && (
          <div style={{ ...fillBase, width: `${Math.max(percent, percent > 0 ? 2 : 0)}%`, background: fill }} />
        )}
      </div>
      <p style={note}>
        {locked
          ? t(lang, 'Dein Plan enthält keinen Cloud-Speicher — upgrade, um Dateien zu speichern.',
                   'Your plan includes no cloud storage — upgrade to store files.')
          : percent >= 100
            ? t(lang, 'Speicher voll — gib Platz frei oder upgrade auf einen grösseren Plan.',
                     'Storage full — free space or upgrade to a larger plan.')
            : isHot
              ? t(lang, 'Dein Speicher wird knapp.', 'Your storage is getting full.')
              : t(lang, 'Genug Platz für deine Projekte.', 'Plenty of room for your projects.')}
      </p>
    </div>
  );
}

// ── Inline styles (matches GoblinUsageBar / the app's token-var convention) ────
const wrap: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
  padding: '12px 14px', borderRadius: 10,
  background: 'var(--color-surface-2, #F4ECD8)',
};
const headRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
};
const label: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--ink-1, #0F2B1E)',
  minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const badge: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--brand-green, #1A3A2A)', flexShrink: 0,
};
const track: React.CSSProperties = {
  position: 'relative', height: 8, width: '100%', borderRadius: 999,
  background: 'var(--color-paper, #FBF7EC)', overflow: 'hidden',
};
const fillBase: React.CSSProperties = {
  position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999,
  transition: 'width 240ms ease',
};
const note: React.CSSProperties = {
  margin: 0, fontSize: 12, color: 'var(--ink-2, #355043)',
};
