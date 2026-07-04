'use client';

// U2 (feel-sprint-2): compact unified before/after diff for one file — used by
// the Send-to-Code preview to show what a GEÄNDERT file actually changes.
// Mobile-friendly: small mono type, wide lines scroll inside the box.

import { useMemo } from 'react';
import { unifiedDiffLines } from '@/lib/file-compare';

export function DiffView({ path, oldContent, newContent }: {
  path: string;
  oldContent: string;
  newContent: string;
}) {
  const lines = useMemo(
    () => unifiedDiffLines(path, oldContent, newContent),
    [path, oldContent, newContent],
  );

  if (lines.length === 0) {
    return (
      <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--meta)', fontFamily: 'var(--font-sans)' }}>
        Keine inhaltlichen Unterschiede.
      </div>
    );
  }

  return (
    <div
      data-testid="stc-diff-view"
      style={{
        margin: '2px 0 8px', borderRadius: 8, overflow: 'hidden',
        border: '1px solid var(--border-subtle, var(--div))',
        background: 'var(--subtle, rgba(0,0,0,0.02))',
      }}
    >
      <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto' }}>
        <pre style={{ margin: 0, padding: '6px 0', fontSize: 11.5, lineHeight: 1.55, fontFamily: 'var(--font-mono)' }}>
          {lines.map((l, i) => (
            <div
              key={i}
              style={{
                padding: '0 10px', whiteSpace: 'pre',
                ...(l.kind === 'add' && { background: 'rgba(45,74,43,0.10)', color: 'var(--brand-green, #2D4A2B)' }),
                ...(l.kind === 'del' && { background: 'rgba(184,60,60,0.09)', color: '#A03B3B' }),
                ...(l.kind === 'hunk' && { color: 'var(--meta)', padding: '2px 10px' }),
                ...(l.kind === 'ctx' && { color: 'var(--text-2, var(--text))' }),
              }}
            >
              {l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : l.kind === 'hunk' ? '' : ' '}
              {l.text}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
