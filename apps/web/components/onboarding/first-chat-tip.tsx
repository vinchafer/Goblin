"use client";

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'goblin_first_chat_tip_dismissed';

export function FirstChatTip() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  if (!visible) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px',
      background: 'rgba(212,169,74,0.1)',
      borderBottom: '1px solid rgba(212,169,74,0.2)',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💡</span>
      <p style={{ flex: 1, fontSize: 12, color: '#6B6B6B', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5, margin: 0 }}>
        Describe what you want to build. Tap{' '}
        <span style={{ fontWeight: 600, color: '#c9933a' }}>[Send to Code →]</span>{' '}
        on any code block to apply it instantly.
      </p>
      <button
        onClick={dismiss}
        style={{
          background: 'none', border: 'none', color: '#9C9589',
          cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px', flexShrink: 0,
        }}
        aria-label="Dismiss tip"
      >
        ×
      </button>
    </div>
  );
}
