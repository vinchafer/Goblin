'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { Icon } from '@/components/ui/icon';

interface BYOKKey { provider: string }
interface Me { is_comped?: boolean; isComped?: boolean }

const DISMISS_KEY = 'goblin_chat_key_banner_dismissed_v1';

export function ChatKeyBanner() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    (async () => {
      try {
        const [keys, me] = await Promise.all([
          apiGet<BYOKKey[]>('/api/byok-keys').catch(() => []),
          apiGet<Me>('/api/users/me').catch(() => ({} as Me)),
        ]);
        const hasKey = Array.isArray(keys) && keys.length > 0;
        const isComped = !!(me?.is_comped ?? me?.isComped);
        if (!hasKey && !isComped) setShow(true);
      } catch { /* silent */ }
    })();
  }, []);

  if (!show) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setShow(false);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px',
      background: 'rgba(45,74,43,0.06)',
      borderBottom: '1px solid rgba(45,74,43,0.12)',
      fontSize: 13,
      fontFamily: 'DM Sans, sans-serif',
      color: 'var(--text)',
      flexShrink: 0,
    }}>
      <Icon name="apiKey" size={14} color="var(--moss)" />
      <span style={{ flex: 1 }}>
        Noch kein API-Key —{' '}
        <button
          onClick={() => router.push('/onboarding/choose-provider')}
          style={{
            background: 'none', border: 'none', color: 'var(--moss)',
            textDecoration: 'underline', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, padding: 0,
            fontFamily: 'DM Sans, sans-serif',
          }}
        >Free-Tier einrichten</button>
      </span>
      <button
        onClick={dismiss}
        aria-label="Schließen"
        style={{
          background: 'none', border: 'none', color: 'var(--meta)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2,
        }}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
