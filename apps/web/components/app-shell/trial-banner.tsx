'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { getAuthHeaders, API_URL } from '@/lib/api';
import { isDemoActive } from '@/lib/demo/demo-flag';
import { useLang, t } from '@/lib/use-lang';

interface TrialInfo {
  trialStatus: 'not_started' | 'active' | 'expired' | 'subscribed' | 'none';
  trialEndsAt?: string;
  daysLeft?: number;
  extensionUsed?: boolean;
}

export function TrialBanner() {
  const router = useRouter();
  const lang = useLang();
  const [info, setInfo] = useState<TrialInfo | null>(null);
  const [extending, setExtending] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Demo (Sprint 10 §7): no trial fetch → info stays null → banner renders nothing.
    if (isDemoActive()) return;
    apiGet<TrialInfo>('/api/users/me/trial').then(setInfo).catch(() => null);
  }, []);

  const handleExtend = async () => {
    setExtending(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/users/me/trial/extend`, { method: 'POST', headers });
      if (res.ok) {
        const data = await res.json() as { newEnd: string };
        setInfo(prev => prev ? { ...prev, daysLeft: 2, trialEndsAt: data.newEnd, extensionUsed: true } : prev);
      }
    } finally {
      setExtending(false);
    }
  };

  if (!info || dismissed) return null;
  if (info.trialStatus === 'subscribed' || info.trialStatus === 'none' || info.trialStatus === 'not_started') return null;

  if (info.trialStatus === 'expired') {
    return (
      <div style={{
        background: 'rgba(184,92,60,0.08)',
        borderBottom: '2px solid rgba(184,92,60,0.3)',
        padding: '8px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 'var(--t-small-fs)', color: 'var(--danger)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
          {t(lang, 'Deine kostenlose Testphase ist beendet.', 'Your free trial has ended.')}
        </span>
        <button
          onClick={() => router.push('/dashboard/upgrade')}
          style={{
            padding: '5px 14px', background: 'var(--danger)', color: '#fff',
            border: 'none', borderRadius: 7, fontSize: 'var(--t-caption-fs)', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          {t(lang, 'Upgrade — 11 $/Monat →', 'Upgrade — $11/mo →')}
        </button>
      </div>
    );
  }

  if (info.trialStatus === 'active') {
    const days = info.daysLeft ?? 0;
    const urgent = days <= 1;
    return (
      <div style={{
        background: urgent ? 'rgba(212,169,74,0.12)' : 'rgba(45,74,43,0.06)',
        borderBottom: `1px solid ${urgent ? 'rgba(212,169,74,0.4)' : 'rgba(45,74,43,0.12)'}`,
        padding: '6px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: 'var(--t-caption-fs)', fontFamily: 'var(--font-sans)',
          color: urgent ? '#b88a20' : 'var(--brand-green)', fontWeight: 500, flex: 1,
        }}>
          {days === 0
            ? t(lang, 'Testphase endet heute.', 'Trial ends today.')
            : t(
                lang,
                `Tag ${7 - days + (info.extensionUsed ? 2 : 0) + 1} von ${info.extensionUsed ? 9 : 7} in deiner Testphase.`,
                `Day ${7 - days + (info.extensionUsed ? 2 : 0) + 1} of ${info.extensionUsed ? 9 : 7} in your free trial.`,
              )}
          {' '}
          <button
            onClick={() => router.push('/dashboard/upgrade')}
            style={{
              background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline',
              cursor: 'pointer', fontSize: 'var(--t-caption-fs)', fontFamily: 'var(--font-sans)', fontWeight: 600,
            }}
          >
            {t(lang, 'Upgrade →', 'Upgrade →')}
          </button>
        </span>

        {!info.extensionUsed && days <= 1 && (
          <button
            onClick={handleExtend}
            disabled={extending}
            style={{
              padding: '4px 10px', background: 'transparent',
              border: '1px solid currentColor', borderRadius: 6,
              fontSize: 'var(--t-caption-fs)', color: '#b88a20', cursor: extending ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)', fontWeight: 500, opacity: extending ? 0.6 : 1,
            }}
          >
            {extending ? '...' : t(lang, '+2 Tage', '+2 days')}
          </button>
        )}

        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'none', border: 'none', color: 'rgba(0,0,0,0.3)',
            cursor: 'pointer', fontSize: 'var(--t-body-fs)', lineHeight: 1, padding: '2px 4px',
          }}
        >
          ×
        </button>
      </div>
    );
  }

  return null;
}
