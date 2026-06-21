'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface KebabItem {
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
  testId?: string;
}

/**
 * Reusable 3-dot (kebab) menu. The trigger lives inside a clickable row, so every
 * pointer handler stops propagation — the kebab never triggers row navigation.
 * The menu renders through a portal (fixed, positioned from the button rect) so it
 * escapes the sidebar's overflow:auto clipping. Click-outside + Escape close it.
 */
export function KebabMenu({ items, ariaLabel = 'Mehr', testId }: { items: KebabItem[]; ariaLabel?: string; testId?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openMenu}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={testId}
        style={{
          width: 24, height: 24, borderRadius: 6, flexShrink: 0,
          background: open ? 'rgba(0,0,0,0.06)' : 'transparent',
          border: 'none', cursor: 'pointer', color: 'var(--ink-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.12s, color 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = 'var(--ink-1)'; }}
        onMouseLeave={(e) => { if (!open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)'; } }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: pos.top, right: pos.right, zIndex: 300,
            minWidth: 168, background: 'var(--panel, #fff)',
            border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.16)', padding: 4,
            fontFamily: 'var(--font-sans)',
            animation: 'gobKebabIn 0.1s ease',
          }}
        >
          {items.map((it, i) => (
            <button
              key={i}
              role="menuitem"
              type="button"
              data-testid={it.testId}
              onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '9px 10px', borderRadius: 7, background: 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                fontSize: 'var(--t-small-fs)', fontFamily: 'var(--font-sans)',
                color: it.danger ? 'var(--rust, #B4451F)' : 'var(--text)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = it.danger ? 'rgba(180,69,31,0.08)' : 'rgba(0,0,0,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {it.icon && <span style={{ display: 'flex', flexShrink: 0 }}>{it.icon}</span>}
              <span>{it.label}</span>
            </button>
          ))}
          <style>{`@keyframes gobKebabIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}`}</style>
        </div>,
        document.body
      )}
    </>
  );
}
