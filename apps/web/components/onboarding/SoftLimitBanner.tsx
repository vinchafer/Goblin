'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAuthHeaders, API_URL } from '@/lib/api';

interface SoftLimitStatus {
  hasKey: boolean;
  trialActive: boolean;
  trialDaysLeft: number;
  requestsToday: number;
  requestsLimit: number | null;
  blocked: boolean;
  blockReason?: string;
}

export default function SoftLimitBanner() {
  const [status, setStatus] = useState<SoftLimitStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_URL}/api/account/soft-limit-status`, {
          headers,
          credentials: 'include',
        });
        if (!cancelled && res.ok) {
          const body = await res.json();
          setStatus(body);
        }
      } catch {
        /* silent — banner stays hidden on error */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!status || status.hasKey) return null;

  // Trial active: only nudge from day 2 onward; day 3+ is silent.
  if (status.trialActive && status.trialDaysLeft > 0) {
    if (status.trialDaysLeft >= 3) return null;
    return (
      <div style={{
        padding: 'var(--space-2) var(--space-4)',
        backgroundColor: 'rgba(212, 167, 55, 0.15)',
        borderBottom: '1px solid var(--rule)',
        fontSize: 'var(--text-small)',
        color: 'var(--goblin-green)',
        textAlign: 'center',
        fontFamily: 'var(--font-sans)',
      }}>
        Dein Trial endet in {status.trialDaysLeft} {status.trialDaysLeft === 1 ? 'Tag' : 'Tagen'}.{' '}
        <Link href="/onboarding/choose-provider" style={{
          textDecoration: 'underline',
          color: 'var(--goblin-moss)',
          fontWeight: 600,
        }}>
          Hol dir einen Free-Tier-Key →
        </Link>
      </div>
    );
  }

  // Trial ended, no key.
  if (status.blocked) {
    return (
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        backgroundColor: 'var(--goblin-moss)',
        color: 'var(--goblin-cream)',
        fontSize: 'var(--text-body)',
        textAlign: 'center',
        fontFamily: 'var(--font-sans)',
      }}>
        Tageslimit erreicht.{' '}
        <Link href="/onboarding/choose-provider" style={{
          textDecoration: 'underline',
          color: 'var(--goblin-gold)',
          fontWeight: 600,
        }}>
          Trag deinen Key ein für unbegrenzte Nutzung →
        </Link>
      </div>
    );
  }

  const limit = status.requestsLimit ?? 0;
  const remaining = Math.max(0, limit - status.requestsToday);
  return (
    <div style={{
      padding: 'var(--space-2) var(--space-4)',
      backgroundColor: 'rgba(45, 74, 43, 0.08)',
      borderBottom: '1px solid var(--rule)',
      fontSize: 'var(--text-small)',
      color: 'var(--goblin-green)',
      textAlign: 'center',
      fontFamily: 'var(--font-sans)',
    }}>
      {remaining} Anfragen heute übrig.{' '}
      <Link href="/onboarding/choose-provider" style={{
        textDecoration: 'underline',
        color: 'var(--goblin-moss)',
        fontWeight: 600,
      }}>
        Eigenen Key für unbegrenzt →
      </Link>
    </div>
  );
}
