'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { SetupBuddy } from '@/components/onboarding/setup-buddy';
import { apiGet } from '@/lib/api';

interface OnboardingState {
  goal?: string;
  ai_provider_choice?: string;
  code_hosting_choice?: string;
  deploy_choice?: string;
  completed?: boolean;
}

export default function OnboardingChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isResume = searchParams.get('resume') === 'true';
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<OnboardingState>('/api/onboarding/state')
      .then(s => setState(s))
      .catch(() => setState({}))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #E8E4DC', borderTopColor: '#2D4A2B', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--cream)' }}>
      {/* Header */}
      <header style={{
        height: 52, background: '#2D4A2B',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(212,169,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#D4A94A', fontFamily: 'Fraunces, serif' }}>G</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>
            Setup Buddy
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
            background: 'rgba(212,169,74,0.2)', color: '#D4A94A',
            fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.5px', textTransform: 'uppercase',
          }}>
            AI
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link
            href="/onboarding"
            style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'DM Sans, sans-serif', textDecoration: 'none' }}
          >
            Switch to wizard →
          </Link>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '4px 6px' }}
          >
            ×
          </button>
        </div>
      </header>

      {/* Chat */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <SetupBuddy initialState={state ?? {}} isResume={isResume} />
      </div>
    </div>
  );
}
