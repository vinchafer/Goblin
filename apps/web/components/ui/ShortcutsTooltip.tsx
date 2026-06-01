'use client';

import { useState, useEffect, useCallback } from 'react';

const SHORTCUTS = [
  { keys: '⌘K', label: 'Befehlspalette' },
  { keys: '⌘1/2/3', label: 'Tab wechseln' },
  { keys: '⌘↵', label: 'Senden' },
  { keys: '⌘B', label: 'Sidebar' },
  { keys: '?', label: 'Alle Shortcuts' },
];

// Sprint 9 P1: the panel no longer auto-pops on inactivity (it squatted on every
// screen and wouldn't stay dismissed). It is now a desktop-only, `?`-toggled
// reference: press `?` to show, `?`/Esc/× to hide. Hidden entirely on touch
// devices, where keyboard hints are meaningless.
export function ShortcutsTooltip() {
  const [visible, setVisible] = useState(false);

  const dismiss = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Touch / coarse-pointer devices: never render keyboard hints.
    if (window.matchMedia?.('(pointer: coarse)').matches) return;

    const isTypingTarget = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || node.isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setVisible(false); return; }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed', bottom: 72, right: 16, zIndex: 200,
        background: '#1a2e18', border: '1px solid #2d5229',
        borderRadius: 12, padding: '14px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'slideIn 0.2s ease-out',
        minWidth: 200,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--brand-gold)',
          fontFamily: 'var(--font-sans)', letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          Keyboard Shortcuts
        </span>
        <button
          onClick={dismiss}
          style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
            cursor: 'pointer', fontSize: 'var(--t-body-fs)', lineHeight: 1, padding: '0 2px',
          }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {SHORTCUTS.map(s => (
          <div key={s.keys} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 'var(--t-caption-fs)', color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sans)' }}>
              {s.label}
            </span>
            <kbd style={{
              fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 5, padding: '2px 7px', color: 'rgba(255,255,255,0.75)',
            }}>
              {s.keys}
            </kbd>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.2)',
        fontFamily: 'var(--font-sans)', textAlign: 'center',
      }}>
        Drücke ? für alle Shortcuts
      </div>
    </div>
  );
}
