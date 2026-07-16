'use client';

// Sprint 10.8-7 — Code-Tab file navigation panel.
//
// Max-walk #3: the Code-Tab showed open-file tabs but gave no way to see/browse
// ALL files in the session (e.g. the other files sent from chat). This slide-in
// panel lists every file, filters by name, opens one on tap, and creates new
// files — desktop = 260px left rail overlay, mobile = full-screen sheet.

import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/icon';

interface SessionFile {
  path: string;
  change_state?: string;
}

interface Props {
  open: boolean;
  files: SessionFile[];
  activePath: string | null;
  onClose: () => void;
  onSelect: (path: string) => void;
  onNewFile: (name: string) => void;
}

export function SessionFileNav({ open, files, activePath, onClose, onSelect, onNewFile }: Props) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? files.filter((f) => f.path.toLowerCase().includes(q)) : files;
    return [...list].sort((a, b) => a.path.localeCompare(b.path));
  }, [files, query]);

  if (!open) return null;

  const submitNew = () => {
    const name = newName.trim().replace(/^\/+/, '');
    if (!name) { setCreating(false); return; }
    onNewFile(name);
    setNewName('');
    setCreating(false);
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.35)' }}
      />
      <div
        className="gb-filenav"
        data-testid="session-file-nav"
        style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 61,
          background: 'var(--ed-chrome)', borderRight: '1px solid var(--ed-rule)',
          display: 'flex', flexDirection: 'column', boxShadow: '4px 0 24px rgba(15,43,30,0.18)',
          fontFamily: 'var(--font-sans)',
          // SAFEAREA-U-BOTTOM: full-height drawer — reserve the iOS home-indicator
          // inset at the bottom so the file list's tail clears it (0 in a browser).
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--ed-rule)', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ed-fg-1)', flex: 1 }}>Dateien</span>
          <button
            onClick={() => setCreating((v) => !v)}
            title="Neue Datei" aria-label="Neue Datei"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid var(--ed-rule)', color: 'var(--ed-fg-2)', borderRadius: 8, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
          >
            <Icon name="add" size={13} /> Neu
          </button>
          <button onClick={onClose} aria-label="Schließen" style={{ background: 'transparent', border: 'none', color: 'var(--ed-fg-3)', cursor: 'pointer', display: 'inline-flex', padding: 4 }}>
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* New-file input */}
        {creating && (
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--ed-rule)', display: 'flex', gap: 6 }}>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitNew(); if (e.key === 'Escape') setCreating(false); }}
              placeholder="z.B. about.html"
              style={{ flex: 1, minWidth: 0, padding: '7px 9px', borderRadius: 7, fontSize: 13, fontFamily: 'JetBrains Mono, monospace', background: 'var(--ed-canvas)', border: '1px solid var(--ed-rule)', color: 'var(--ed-fg-1)', outline: 'none' }}
            />
            <button onClick={submitNew} style={{ background: 'var(--ed-primary)', color: 'var(--ed-on-primary)', border: 'none', borderRadius: 7, padding: '0 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>OK</button>
          </div>
        )}

        {/* Search */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--ed-rule)', flexShrink: 0 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Dateien filtern…"
            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13, background: 'var(--ed-canvas)', border: '1px solid var(--ed-rule)', color: 'var(--ed-fg-1)', outline: 'none', fontFamily: 'var(--font-sans)' }}
          />
        </div>

        {/* File list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', minHeight: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', fontSize: 12.5, color: 'var(--ed-fg-3)' }}>
              {files.length === 0 ? 'Noch keine Dateien.' : 'Keine Treffer.'}
            </div>
          ) : filtered.map((f) => {
            const isActive = f.path === activePath;
            const isDraft = f.change_state === 'draft';
            return (
              <button
                key={f.path}
                onClick={() => onSelect(f.path)}
                data-testid="session-file-nav-item"
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 10px', borderRadius: 8, marginBottom: 2, cursor: 'pointer',
                  background: isActive ? 'var(--ed-hover)' : 'transparent', border: 'none',
                  color: 'var(--ed-fg-1)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5,
                }}
              >
                <Icon name="document" size={14} color="var(--ed-fg-3)" />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</span>
                {isDraft && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ed-draft, #C9922B)', flexShrink: 0 }} title="Entwurf" />}
              </button>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .gb-filenav { width: 260px; }
        @media (max-width: 640px) {
          .gb-filenav { width: 100%; border-right: none; }
        }
      `}</style>
    </>
  );
}
