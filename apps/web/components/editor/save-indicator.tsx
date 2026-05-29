'use client';
import { useState, useEffect } from 'react';

type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved';

interface SaveIndicatorProps {
  saving: boolean;
  isDirty?: boolean;
}

export function SaveIndicator({ saving, isDirty }: SaveIndicatorProps) {
  const [status, setStatus] = useState<SaveState>('idle');

  useEffect(() => {
    if (saving) {
      setStatus('saving');
    } else {
      setStatus(prev => {
        if (prev === 'saving') {
          // Will transition to 'saved' after this render via another effect
          return 'saved';
        }
        if (isDirty) return 'unsaved';
        return 'idle';
      });
    }
  }, [saving, isDirty]);

  useEffect(() => {
    if (status === 'saved') {
      const t = setTimeout(() => setStatus(isDirty ? 'unsaved' : 'idle'), 2000);
      return () => clearTimeout(t);
    }
  }, [status, isDirty]);

  if (status === 'idle') return null;

  const config: Record<SaveState, { dot: string; label: string; color: string }> = {
    idle:    { dot: 'transparent', label: '',                color: 'transparent' },
    unsaved: { dot: 'var(--brand-gold)',     label: 'Unsaved changes', color: 'var(--brand-gold)' },
    saving:  { dot: '#8aaa85',     label: 'Saving…',         color: '#8aaa85' },
    saved:   { dot: 'var(--success)',     label: 'Saved ✓',         color: 'var(--success)' },
  };

  const { dot, label, color } = config[status];

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', flexShrink: 0 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color }}>
        {label}
      </span>
    </span>
  );
}
