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
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#141a12', border: '1px solid #2d4a2b', borderRadius: 14,
        width: '100%', maxWidth: 800, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #1e3a1c',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          background: '#0f1410',
        }}>
          <span style={{ fontSize: 16 }}>📝</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#c5d0c0', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {filePath}
            </div>
            <div style={{ fontSize: 11, color: '#6b8a6b', fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>
              Review changes before applying
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
          <button onClick={onDiscard} style={{ background: 'none', border: 'none', color: '#6b8a6b', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 4px' }}>
            ×
          </button>
        </div>

        {/* Diff content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
          {!hasChanges ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6b8a6b', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>
              No changes to apply.
            </div>
          ) : (
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.6 }}>
              {lines.map((line, i) => {
                if (line.type === 'header') {
                  return (
                    <div key={i} style={{ padding: '2px 16px', background: '#1e2a1c', color: '#4a6a4a', borderBottom: '1px solid #1e3a1c' }}>
                      {line.content}
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'flex-start',
                      background: line.type === 'add' ? 'rgba(74,124,59,0.15)' : line.type === 'remove' ? 'rgba(184,92,60,0.12)' : 'transparent',
                      borderLeft: `3px solid ${line.type === 'add' ? 'var(--success)' : line.type === 'remove' ? 'var(--danger)' : 'transparent'}`,
                    }}
                  >
                    <span style={{
                      width: 20, flexShrink: 0, textAlign: 'center', padding: '1px 0',
                      color: line.type === 'add' ? 'var(--success)' : line.type === 'remove' ? 'var(--danger)' : 'var(--moss)',
                      fontSize: 11, userSelect: 'none',
                    }}>
                      {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                    </span>
                    <pre style={{
                      flex: 1, margin: 0, padding: '1px 12px 1px 4px',
                      color: line.type === 'add' ? '#8adc8a' : line.type === 'remove' ? '#e87a5a' : '#8aaa85',
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
          padding: '14px 20px', borderTop: '1px solid #1e3a1c',
          display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0,
          background: '#0f1410',
        }}>
          <button
            onClick={onDiscard}
            style={{
              background: 'transparent', border: '1px solid #2d4a2b',
              color: '#8aaa85', borderRadius: 8, padding: '8px 18px',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            ✗ Discard
          </button>
          <button
            onClick={onApply}
            disabled={!hasChanges}
            style={{
              background: hasChanges ? 'var(--moss)' : 'rgba(45,74,43,0.3)',
              border: 'none', color: hasChanges ? 'var(--ochre)' : '#4a6a4a',
              borderRadius: 8, padding: '8px 22px',
              fontSize: 13, fontWeight: 600, cursor: hasChanges ? 'pointer' : 'not-allowed',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            ✓ Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
