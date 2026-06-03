'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAuthHeaders, API_URL } from '@/lib/api';
import { GMark } from './icons';

const STEP_BY_PATH: Record<string, number> = {
  '/welcome/language': 0,
  '/welcome': 1,
  '/welcome/provider': 2,
  '/welcome/routing': 3,
  '/welcome/tools': 4,
  '/welcome/integrations': 5,
};

// Six steps: 0 (language) … 5 (integrations). Header shows "STEP 0n / 06".
const TOTAL_STEPS = 6;
const PIP_STEPS = [0, 1, 2, 3, 4, 5];

export function OnboardingChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/welcome';
  const step = STEP_BY_PATH[pathname] ?? 1;
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // Returning-user guard: if a BYOK key already exists, skip onboarding.
  // Mirrors the prior app/welcome/page.tsx behaviour, moved up to layout.
  useEffect(() => {
    let cancelled = false;
    // Dev-only preview escape: lets QA walk onboarding even with keys
    // already connected. Dead in production builds (NODE_ENV === 'production'),
    // so it can never leak a returning user back into onboarding on prod.
    if (
      process.env.NODE_ENV !== 'production' &&
      typeof window !== 'undefined' &&
      window.localStorage.getItem('goblin:preview-onboarding') === '1'
    ) {
      setChecking(false);
      return;
    }
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_URL}/api/byok-keys/has-any`, { headers, credentials: 'include' });
        if (!cancelled && res.ok) {
          const body = await res.json();
          if (body?.exists) {
            router.replace('/dashboard');
            return;
          }
        }
      } catch {
        /* fall through — show onboarding */
      }
      if (!cancelled) setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface)',
      }}>
        <GMark size={32} />
      </div>
    );
  }

  return (
    <div className="gobl-onb-shell">
      <header className="gobl-onb-top">
        <span className="gobl-onb-lockup" role="img" aria-label="Goblin">
          <GMark size={22} />
          <span className="gobl-onb-wordmark">GOBLIN</span>
        </span>
        <div className="gobl-onb-top-right">
          <span className="gobl-onb-step">
            <span className="gobl-onb-step-num">STEP 0{step} / 0{TOTAL_STEPS}</span>
            <span className="gobl-onb-pips">
              {PIP_STEPS.map((n) => (
                <span
                  key={n}
                  className={`gobl-onb-pip ${n < step ? 'done' : n === step ? 'active' : ''}`}
                />
              ))}
            </span>
          </span>
          <Link href="/help" className="gobl-onb-help">HELP</Link>
        </div>
      </header>

      <main className="gobl-onb-body">{children}</main>

      <footer className="gobl-onb-footstrip">
        <span className="gobl-mono">JUSTGOBLIN.COM</span>
        <span className="gobl-mono">
          <span className="gobl-onb-foot-dot" />
          STEP 0{step} OF 0{TOTAL_STEPS}
        </span>
      </footer>

      <style jsx global>{`
        .gobl-onb-shell {
          display: flex; flex-direction: column;
          min-height: 100vh;
          background: var(--surface);
          color: var(--ink-1);
        }
        .gobl-onb-top {
          padding: 22px 32px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 18px;
          border-bottom: 1px solid var(--line);
          background: var(--surface);
        }
        .gobl-onb-lockup {
          display: inline-flex; align-items: center; gap: 10px;
        }
        .gobl-onb-wordmark {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 800; font-size: 13px;
          letter-spacing: 0.16em; color: var(--ink-1);
        }
        .gobl-onb-top-right {
          display: inline-flex; align-items: center; gap: 24px;
        }
        .gobl-onb-step {
          display: inline-flex; align-items: center; gap: 12px;
          font-family: var(--font-mono), JetBrains Mono, monospace;
          font-size: 10.5px; letter-spacing: 0.16em;
          text-transform: uppercase; color: var(--ink-3);
        }
        .gobl-onb-step-num { color: var(--ink-1); font-weight: 600; }
        .gobl-onb-pips { display: flex; gap: 5px; }
        .gobl-onb-pip {
          width: 16px; height: 3px;
          background: var(--line-strong); border-radius: 2px;
        }
        .gobl-onb-pip.done { background: var(--green); }
        .gobl-onb-pip.active { background: var(--accent-bright); }
        .gobl-onb-help {
          font-family: var(--font-mono), JetBrains Mono, monospace;
          font-size: 11px; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--ink-3);
        }
        .gobl-onb-help:hover { color: var(--ink-1); }
        .gobl-onb-body { flex: 1; }
        .gobl-onb-footstrip {
          border-top: 1px solid var(--line);
          padding: 18px 32px;
          display: flex; align-items: center; justify-content: space-between;
          font-family: var(--font-mono), JetBrains Mono, monospace;
          font-size: 11px; letter-spacing: 0.10em;
          text-transform: uppercase; color: var(--ink-3);
          background: var(--surface);
        }
        .gobl-onb-foot-dot {
          display: inline-block; width: 4px; height: 4px;
          background: var(--accent); border-radius: 50%; margin-right: 8px;
          vertical-align: middle;
        }
        @media (max-width: 480px) {
          .gobl-onb-top { padding: 16px 18px; gap: 12px; }
          .gobl-onb-top-right { gap: 12px; }
          .gobl-onb-pips { display: none; }
          .gobl-onb-help { font-size: 10px; letter-spacing: 0.18em; }
          .gobl-onb-footstrip { padding: 14px 18px; font-size: 10px; }
        }
      `}</style>
    </div>
  );
}
