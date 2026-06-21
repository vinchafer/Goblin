'use client';

import { useEffect, useRef, useState } from 'react';

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 250, padding: 16,
};
const panel: React.CSSProperties = {
  background: 'var(--panel, #fff)', padding: 20, borderRadius: 'var(--radius-lg, 14px)',
  width: '100%', maxWidth: 420, fontFamily: 'var(--font-sans)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
};
const h3: React.CSSProperties = {
  margin: '0 0 10px', fontFamily: 'var(--font-sans)',
  fontSize: 'var(--t-h3-fs)', lineHeight: 'var(--t-h3-lh)', color: 'var(--text)',
};
const ghostBtn: React.CSSProperties = {
  padding: '8px 14px', background: 'transparent', color: 'var(--text)',
  border: '1px solid var(--div)', borderRadius: 8, cursor: 'pointer',
  fontFamily: 'var(--font-sans)', fontSize: 'var(--t-small-fs)',
};

// ── Confirm (destructive) ───────────────────────────────────────────────────
export function ConfirmDialog({
  open, title, body, confirmLabel, cancelLabel, danger = true, onConfirm, onClose,
}: {
  open: boolean; title: string; body?: string; confirmLabel: string; cancelLabel: string;
  danger?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setBusy(false); }, [open]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel} data-testid="confirm-dialog">
        <h3 style={h3}>{title}</h3>
        {body && (
          <p style={{ margin: '0 0 16px', fontSize: 'var(--t-small-fs)', lineHeight: 1.5, color: 'var(--ink-2, #5a5a52)' }}>
            {body}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={ghostBtn}>{cancelLabel}</button>
          <button
            data-testid="confirm-accept"
            disabled={busy}
            onClick={() => { setBusy(true); onConfirm(); }}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
              fontSize: 'var(--t-small-fs)',
              background: danger ? 'var(--rust, #B4451F)' : 'var(--brand-green)',
              color: '#fff',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rename ──────────────────────────────────────────────────────────────────
export function RenameDialog({
  open, title, initialValue, saveLabel, cancelLabel, placeholder, onSave, onClose,
}: {
  open: boolean; title: string; initialValue: string; saveLabel: string; cancelLabel: string;
  placeholder?: string; onSave: (v: string) => void; onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => { if (open) setValue(initialValue); }, [open, initialValue]);
  if (!open) return null;
  const submit = () => { const v = value.trim(); if (v) onSave(v); };
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel} data-testid="rename-dialog">
        <h3 style={h3}>{title}</h3>
        <input
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          maxLength={100}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } else if (e.key === 'Escape') onClose(); }}
          style={{
            width: '100%', padding: '10px 12px', border: '1px solid var(--div)',
            borderRadius: 8, fontSize: 'var(--t-body-fs)', background: 'var(--white, #fff)',
            color: 'var(--text)', marginBottom: 12, boxSizing: 'border-box', fontFamily: 'var(--font-sans)',
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={ghostBtn}>{cancelLabel}</button>
          <button
            data-testid="rename-save"
            onClick={submit}
            disabled={!value.trim()}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', fontWeight: 600,
              cursor: value.trim() ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)',
              fontSize: 'var(--t-small-fs)',
              background: value.trim() ? 'var(--brand-green)' : 'rgba(0,0,0,0.10)', color: '#fff',
            }}
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Move-to-project picker ──────────────────────────────────────────────────
export interface MoveTarget { id: string; name: string }
export function MoveDialog({
  open, title, projects, currentProjectId, noProjectLabel, cancelLabel, onSelect, onClose,
}: {
  open: boolean; title: string; projects: MoveTarget[]; currentProjectId?: string | null;
  noProjectLabel: string; cancelLabel: string; onSelect: (projectId: string | null) => void; onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  if (!open) return null;
  const Option = ({ id, name }: { id: string | null; name: string }) => {
    const selected = (currentProjectId ?? null) === id;
    return (
      <button
        type="button"
        onClick={() => onSelect(id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
          textAlign: 'left', fontFamily: 'var(--font-sans)', fontSize: 'var(--t-small-fs)',
          background: selected ? 'rgba(45,74,43,0.06)' : 'transparent',
          color: selected ? 'var(--brand-green)' : 'var(--text)', fontWeight: selected ? 600 : 400,
        }}
        onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
        onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        {selected && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
    );
  };
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...panel, maxWidth: 380 }} data-testid="move-dialog">
        <h3 style={h3}>{title}</h3>
        <div ref={listRef} style={{ maxHeight: '50vh', overflowY: 'auto', margin: '0 -4px' }}>
          <Option id={null} name={noProjectLabel} />
          {projects.map((p) => <Option key={p.id} id={p.id} name={p.name} />)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onClose} style={ghostBtn}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}
