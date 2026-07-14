'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { isDemoActive } from '@/lib/demo/demo-flag';
import { useLang, t } from '@/lib/use-lang';

interface TrialInfo {
  trialStatus: 'not_started' | 'active' | 'expired' | 'subscribed' | 'none';
  trialEndsAt?: string;
  daysLeft?: number;
  extensionUsed?: boolean;
}

// D-A (FIX-WAVE 3): the ACTIVE-trial upgrade nudge ("Tag X von 7 … Upgrade →")
// was removed — the founder relocated its "your app is live, keep building"
// emotion into the post-purchase confirmation moment (F-32, PurchaseConfirmation).
// The TRIAL-7 achievement card (AchievementUpgradeCard, the earned first-publish
// celebration) is a separate component and is untouched. This banner now renders
// ONLY the functional expired-state reminder (a hard access-gate cue, not a nudge).
export function TrialBanner() {
  const router = useRouter();
  const lang = useLang();
  const [info, setInfo] = useState<TrialInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Demo (Sprint 10 §7): no trial fetch → info stays null → banner renders nothing.
    if (isDemoActive()) return;
    apiGet<TrialInfo>('/api/users/me/trial').then(setInfo).catch(() => null);
  }, []);

  if (!info || dismissed) return null;
  // Only the expired state renders now; every other state (incl. active trial) is silent.
  if (info.trialStatus !== 'expired') return null;

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
