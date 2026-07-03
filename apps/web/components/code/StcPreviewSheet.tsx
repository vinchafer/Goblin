'use client';

// Sprint 10.8-5 — Send-to-Code preview.
//
// Max-walk feedback: "Send to Code" was a black box — the user discovered which
// files landed (and whether they overwrote anything) only after the fact. This
// sheet shows exactly what is about to be sent, lets the user deselect files,
// pick the target project, and warns on overwrites — before anything happens.
//
// Renders as a centred dialog on desktop and a bottom sheet on mobile.

import { useMemo, useState } from 'react';
import { X, FileCode, Warning, ArrowRight } from '@phosphor-icons/react';
import { checkStcIntegrity, applyRenames } from '@goblin/shared/src/stc-integrity';

export interface StcFile {
  path: string;
  content: string;
}

interface Props {
  files: StcFile[];
  /** When provided, the user picks a target; null id == "Neues Projekt". */
  projects?: { id: string; name: string }[];
  /** Pre-selected target when the chat is already project-bound. */
  targetName?: string;
  /** Paths that already exist in the target — shown with an overwrite badge. */
  existingPaths?: string[];
  busy?: boolean;
  onConfirm: (selected: StcFile[], targetProjectId: string | null) => void;
  onCancel: () => void;
}

function lineCount(s: string): number {
  if (!s) return 0;
  return s.split('\n').length;
}

function langOf(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  const map: Record<string, string> = {
    html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS',
    js: 'JavaScript', mjs: 'JavaScript', ts: 'TypeScript',
    jsx: 'JSX', tsx: 'TSX', json: 'JSON', md: 'Markdown',
    py: 'Python', sh: 'Shell', yaml: 'YAML', yml: 'YAML',
  };
  return map[ext] ?? ext.toUpperCase();
}

export function StcPreviewSheet({
  files, projects, targetName, existingPaths, busy, onConfirm, onCancel,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(files.map((f) => f.path)));
  const [projectId, setProjectId] = useState<string | null>(projects && projects.length > 0 ? null : null);
  const existing = useMemo(() => new Set(existingPaths ?? []), [existingPaths]);

  const toggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // P0.3 — filename integrity: user-applied renames (original path → new path)
  // live here; selection stays keyed by the original path.
  const [renames, setRenames] = useState<Record<string, string>>({});

  const chosen = useMemo(
    () => applyRenames(files.filter((f) => selected.has(f.path)), renames),
    [files, selected, renames],
  );
  const integrity = useMemo(() => checkStcIntegrity(chosen), [chosen]);
  const canSend = chosen.length > 0 && !busy;

  return (
    <>
      <div
        onClick={busy ? undefined : onCancel}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', zIndex: 400 }}
      />
      <div
        role="dialog"
        aria-label="An Code senden — Vorschau"
        data-testid="stc-preview-sheet"
        className="stc-preview-sheet"
        style={{
          position: 'fixed', zIndex: 401,
          background: 'var(--panel, var(--surface))',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--brand-green, var(--text))' }}>
              An Code senden — Vorschau
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--meta, var(--text-meta))' }}>
              {files.length} {files.length === 1 ? 'Datei' : 'Dateien'} aus dieser Antwort
              {targetName ? <> → <strong style={{ color: 'var(--text)' }}>{targetName}</strong></> : null}
            </p>
          </div>
          <button
            type="button" onClick={onCancel} aria-label="Schließen"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--meta)', display: 'flex', padding: 6 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Optional target project picker (no-project chat) */}
        {projects && projects.length > 0 && (
          <div style={{ padding: '0 20px 8px' }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}>
              Ziel-Projekt
            </label>
            <select
              value={projectId ?? ''}
              onChange={(e) => setProjectId(e.target.value || null)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14,
                background: 'var(--subtle, var(--surface))', border: '1px solid var(--border-subtle, var(--div))',
                color: 'var(--text)', fontFamily: 'var(--font-sans)',
              }}
            >
              <option value="">+ Neues Projekt</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        {/* File list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', minHeight: 0 }}>
          {files.map((f) => {
            const isOn = selected.has(f.path);
            const shownPath = renames[f.path] ?? f.path;
            const willOverwrite = existing.has(shownPath);
            return (
              <button
                key={f.path}
                type="button"
                onClick={() => toggle(f.path)}
                data-testid="stc-preview-file"
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 12px', borderRadius: 10, marginBottom: 4, cursor: 'pointer',
                  background: isOn ? 'color-mix(in srgb, var(--brand-green, #2D4A2B) 7%, transparent)' : 'transparent',
                  border: `1px solid ${isOn ? 'color-mix(in srgb, var(--brand-green, #2D4A2B) 28%, transparent)' : 'var(--border-subtle, var(--div))'}`,
                }}
              >
                {/* checkbox */}
                <span style={{
                  width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                  border: `2px solid ${isOn ? 'var(--brand-green, #2D4A2B)' : 'var(--meta, #888)'}`,
                  background: isOn ? 'var(--brand-green, #2D4A2B)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700,
                }}>{isOn ? '✓' : ''}</span>
                <FileCode size={18} style={{ color: 'var(--meta)', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 13.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {shownPath}
                    {renames[f.path] && <span style={{ color: 'var(--meta)', fontSize: 11.5 }}> (war {f.path})</span>}
                  </span>
                  <span style={{ fontSize: 11.5, color: 'var(--meta, var(--text-meta))' }}>
                    {langOf(shownPath)} · {lineCount(f.content)} Zeilen
                  </span>
                </span>
                {willOverwrite
                  ? <span style={{ fontSize: 10.5, fontWeight: 700, color: '#B85C3C', background: 'rgba(184,92,60,0.12)', padding: '2px 7px', borderRadius: 5, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Warning size={11} /> Überschreibt</span>
                  : <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--brand-green, #2D4A2B)', background: 'color-mix(in srgb, var(--brand-green, #2D4A2B) 12%, transparent)', padding: '2px 7px', borderRadius: 5 }}>NEU</span>}
              </button>
            );
          })}
        </div>

        {/* P0.3 — filename-integrity warning: never transfer a mismatched set
            silently. Lists what the page references but wouldn't receive, plus
            unreferenced files; offers the unambiguous auto-rename when one exists. */}
        {!integrity.ok && (
          <div
            data-testid="stc-integrity-warning"
            style={{
              margin: '0 20px 4px', padding: '10px 12px', borderRadius: 10,
              background: 'rgba(184,92,60,0.09)', border: '1px solid rgba(184,92,60,0.3)',
              fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5,
            }}
          >
            <strong style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#B85C3C' }}>
              <Warning size={14} /> Dateinamen passen nicht zusammen
            </strong>
            <div style={{ marginTop: 4 }}>
              {integrity.entryPath} verweist auf Dateien, die nicht mitgesendet würden:{' '}
              <code style={{ fontFamily: 'var(--font-mono)' }}>{integrity.missing.join(', ')}</code>.
              {integrity.orphans.length > 0 && (
                <> Nicht verlinkt: <code style={{ fontFamily: 'var(--font-mono)' }}>{integrity.orphans.join(', ')}</code>.</>
              )}
            </div>
            {Object.keys(integrity.renameMap).length > 0 && (
              <button
                type="button"
                data-testid="stc-integrity-rename"
                onClick={() => setRenames((prev) => {
                  const next = { ...prev };
                  for (const [orphan, target] of Object.entries(integrity.renameMap)) {
                    const orig = Object.entries(prev).find(([, v]) => v === orphan)?.[0] ?? orphan;
                    next[orig] = target;
                  }
                  return next;
                })}
                style={{
                  marginTop: 8, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                  background: 'var(--brand-green, #2D4A2B)', color: '#fff', border: 'none',
                  fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-sans)',
                }}
              >
                Automatisch umbenennen ({Object.entries(integrity.renameMap).map(([o, t]) => `${o} → ${t}`).join(', ')})
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, padding: '12px 20px 20px', borderTop: '1px solid var(--border-subtle, var(--div))' }}>
          <button
            type="button" onClick={onCancel} disabled={busy}
            style={{
              flex: '0 0 auto', padding: '12px 18px', borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer',
              background: 'transparent', border: '1px solid var(--border-subtle, var(--div))',
              color: 'var(--text)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-sans)',
            }}
          >Abbrechen</button>
          <button
            type="button"
            onClick={() => onConfirm(chosen, projectId)}
            disabled={!canSend}
            data-testid="stc-preview-confirm"
            style={{
              flex: 1, padding: '12px 18px', borderRadius: 10, border: 'none',
              cursor: canSend ? 'pointer' : 'not-allowed', opacity: canSend ? 1 : 0.5,
              background: 'var(--brand-green, #2D4A2B)', color: '#fff', fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'var(--font-sans)',
            }}
          >
            {busy
              ? 'Sende…'
              : !integrity.ok
                ? <>Trotzdem senden <ArrowRight size={16} weight="bold" /></>
                : <>{chosen.length === files.length ? 'Alle senden' : `Auswahl senden (${chosen.length})`} <ArrowRight size={16} weight="bold" /></>}
          </button>
        </div>
      </div>

      <style jsx>{`
        .stc-preview-sheet {
          top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: min(460px, calc(100vw - 32px));
          max-height: min(76dvh, 640px);
          border-radius: 16px;
        }
        @media (max-width: 640px) {
          .stc-preview-sheet {
            top: auto; bottom: 0; left: 0; transform: none;
            width: 100%; max-height: 82dvh;
            border-radius: 18px 18px 0 0;
          }
        }
      `}</style>
    </>
  );
}
