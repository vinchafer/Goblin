'use client';

import { Icon } from '@/components/ui/icon';

interface InjectedBannerProps {
  pendingCode: { content: string; filename?: string };
  undoPayload: { filePath: string; previousContent: string } | null;
  onApply: () => void;
  onUndo: () => void;
  onDismiss: () => void;
}

/**
 * Sprint 6 — the Zwischenraum. Code arriving from chat ("An Code senden") lands
 * here as a DRAFT (Entwurf), not a one-tap path to a live deploy. The only
 * actions are Ansehen & Sichern (review + persist) and Verwerfen. Deploy is a
 * deliberate, separate step in the action bar — never adjacent to arrival.
 */
export function InjectedBanner({
  pendingCode,
  undoPayload,
  onApply,
  onUndo,
  onDismiss,
}: InjectedBannerProps) {
  return (
    <div style={{
      background: 'color-mix(in srgb, var(--ed-accent) 9%, var(--ed-canvas))',
      borderBottom: '1px solid color-mix(in srgb, var(--ed-accent) 35%, transparent)',
      padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
    }}>
      <span style={{
        width: 9, height: 9, borderRadius: '50%',
        border: '2px solid var(--ed-draft)', boxSizing: 'border-box', flexShrink: 0,
      }} title="Entwurf" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--ed-fg-1)',
          fontFamily: 'var(--font-sans)',
        }}>
          Aus dem Chat übernommen
        </span>
        <span style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--ed-fg-3)', marginLeft: 8, fontFamily: 'var(--font-sans)' }}>
          · Entwurf
        </span>
        {pendingCode.filename && (
          <span style={{
            marginLeft: 8, fontSize: 11, color: 'var(--ed-fg-2)',
            fontFamily: 'JetBrains Mono, monospace',
            background: 'var(--ed-hover)',
            padding: '1px 8px', borderRadius: 4,
          }}>
            {pendingCode.filename}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
        <button
          onClick={onApply}
          style={{
            background: 'var(--ed-primary)', color: 'var(--ed-on-primary)',
            border: 'none',
            borderRadius: 8, padding: '6px 13px', fontSize: 'var(--t-caption-fs)', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Icon name="eye" size={13} /> Ansehen & Sichern
        </button>
        {undoPayload && (
          <button
            onClick={onUndo}
            title="Letzte Übernahme rückgängig"
            style={{
              background: 'transparent', color: 'var(--ed-fg-3)',
              border: '1px solid var(--ed-rule)',
              borderRadius: 8, padding: '6px 11px', fontSize: 'var(--t-caption-fs)',
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Rückgängig
          </button>
        )}
        <button
          onClick={onDismiss}
          aria-label="Verwerfen"
          title="Entwurf verwerfen"
          style={{
            background: 'none', border: 'none', color: 'var(--ed-fg-3)',
            cursor: 'pointer', padding: '4px 6px', lineHeight: 1, display: 'flex', alignItems: 'center',
          }}
        >
          <Icon name="close" size={15} />
        </button>
      </div>
    </div>
  );
}
