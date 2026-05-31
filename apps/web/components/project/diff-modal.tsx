"use client";

import { useState, useEffect } from "react";
import { parsePatch } from "diff";

interface DiffModalProps {
  filePath: string;
  currentContent: string;
  proposedContent: string;
  diff: string;
  onApply: () => void;
  onDiscard: () => void;
}

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
}

function parseDiffLines(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];
  for (const line of patch.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) {
      lines.push({ type: 'header', content: line });
    } else if (line.startsWith('@@')) {
      lines.push({ type: 'header', content: line });
    } else if (line.startsWith('+')) {
      lines.push({ type: 'add', content: line.slice(1) });
    } else if (line.startsWith('-')) {
      lines.push({ type: 'remove', content: line.slice(1) });
    } else if (line.trim() || line === '') {
      lines.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line });
    }
  }
  return lines;
}

export function DiffModal({ filePath, currentContent, proposedContent, diff, onApply, onDiscard }: DiffModalProps) {
  const lines = parseDiffLines(diff);
  const addCount = lines.filter(l => l.type === 'add').length;
  const removeCount = lines.filter(l => l.type === 'remove').length;

  const hasChanges = addCount > 0 || removeCount > 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: 'var(--surface-overlay)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--rule-strong)', borderRadius: 14,
        width: '100%', maxWidth: 800, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(15,43,30,0.30)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--rule)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          background: 'var(--surface-2)',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid var(--warning)', boxSizing: 'border-box', flexShrink: 0 }} title="Entwurf" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {filePath}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-sans)', marginTop: 2 }}>
              Prüf die Änderungen, bevor du sicherst
              {hasChanges && (
                <>
                  {' · '}
                  <span style={{ color: 'var(--success)' }}>+{addCount}</span>
                  {' '}
                  <span style={{ color: 'var(--danger)' }}>−{removeCount}</span>
                </>
              )}
            </div>
          </div>
          <button onClick={onDiscard} aria-label="Schließen" style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 4px' }}>
            ×
          </button>
        </div>

        {/* Diff content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0', background: 'var(--surface-1)' }}>
          {!hasChanges ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
              Keine Änderungen zu sichern.
            </div>
          ) : (
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 'var(--t-caption-fs)', lineHeight: 1.6 }}>
              {lines.map((line, i) => {
                if (line.type === 'header') {
                  return (
                    <div key={i} style={{ padding: '2px 16px', background: 'var(--surface-3)', color: 'var(--ink-3)', borderBottom: '1px solid var(--rule)' }}>
                      {line.content}
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'flex-start',
                      background: line.type === 'add' ? 'rgba(61,122,79,0.12)' : line.type === 'remove' ? 'rgba(176,67,42,0.10)' : 'transparent',
                      borderLeft: `3px solid ${line.type === 'add' ? 'var(--success)' : line.type === 'remove' ? 'var(--danger)' : 'transparent'}`,
                    }}
                  >
                    <span style={{
                      width: 20, flexShrink: 0, textAlign: 'center', padding: '1px 0',
                      color: line.type === 'add' ? 'var(--success)' : line.type === 'remove' ? 'var(--danger)' : 'var(--ink-3)',
                      fontSize: 11, userSelect: 'none',
                    }}>
                      {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                    </span>
                    <pre style={{
                      flex: 1, margin: 0, padding: '1px 12px 1px 4px',
                      color: line.type === 'add' ? '#2A6B3E' : line.type === 'remove' ? '#B0432A' : 'var(--ink-2)',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    }}>
                      {line.content || ' '}
                    </pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--rule)',
          display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0,
          background: 'var(--surface-2)',
        }}>
          <button
            onClick={onDiscard}
            style={{
              background: 'transparent', border: '1px solid var(--rule-strong)',
              color: 'var(--ink-2)', borderRadius: 9, padding: '9px 18px',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Verwerfen
          </button>
          <button
            onClick={onApply}
            disabled={!hasChanges}
            style={{
              background: hasChanges ? 'var(--brand-green)' : 'var(--surface-3)',
              border: 'none', color: hasChanges ? 'var(--paper)' : 'var(--ink-disabled)',
              borderRadius: 9, padding: '9px 22px',
              fontSize: 13, fontWeight: 600, cursor: hasChanges ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Sichern
          </button>
        </div>
      </div>
    </div>
  );
}
