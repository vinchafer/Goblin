"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const STORAGE_KEY = 'goblin_first_chat_tip_dismissed';

export function FirstChatTip() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = async () => {
      // Fast local check first
      if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) {
        return;
      }
      // Authoritative check via user_metadata
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.user_metadata?.first_chat_tip_dismissed) {
          localStorage.setItem(STORAGE_KEY, '1');
          return;
        }
      } catch {
        // Fallback to localStorage only
      }
      setVisible(true);
    };
    check();
  }, []);

  const dismiss = async () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
    try {
      const supabase = createClient();
      await supabase.auth.updateUser({ data: { first_chat_tip_dismissed: true } });
    } catch {
      // localStorage fallback already set
    }
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
      <p style={{ flex: 1, fontSize: 12, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5, margin: 0 }}>
        Describe what you want to build. Tap{' '}
        <span style={{ fontWeight: 600, color: 'var(--ochre-dark)' }}>[Send to Code →]</span>{' '}
        on any code block to apply it instantly.
      </p>
      <button
        onClick={dismiss}
        style={{
          background: 'none', border: 'none', color: 'var(--text-faint)',
          cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px', flexShrink: 0,
        }}
        aria-label="Dismiss tip"
      >
        ×
      </button>
    </div>
  );
}
