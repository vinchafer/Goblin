'use client';
import { useState, useEffect } from 'react';

export function SaveIndicator({ saving }: { saving: boolean }) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (saving) {
      setStatus('saving');
    } else if (status === 'saving') {
      setStatus('saved');
      const t = setTimeout(() => setStatus('idle'), 2000);
      return () => clearTimeout(t);
    }
  }, [saving]);

  if (status === 'idle') return null;
  return (
    <span style={{
      fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
      color: status === 'saving' ? '#8aaa85' : '#4a7c3b',
      marginLeft: 'auto', flexShrink: 0,
    }}>
      {status === 'saving' ? '⟳ Saving…' : '✓ Saved'}
    </span>
  );
}