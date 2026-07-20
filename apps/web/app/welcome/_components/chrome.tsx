'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAuthHeaders, API_URL } from '@/lib/api';
import { GMark } from './icons';
import { useOnbLang, STR } from './i18n';
import { getOnboardingState } from './onboarding-state';
import { readVibeKnown, stepInfo, type VibeKnown } from './flow';
import { onboardedCookieString, DASHBOARD_ONBOARDED_URL } from '@/lib/onboarding-gate';

// Numbering is owned by flow.ts (single source of truth). The header chip +
// footer read {step,total} for the CURRENT branch; off-flow optional pages
// (provider / tools / integrations) return null → no chip. This removes the
// old off-by-one (pages no longer embed their own "Schritt 0X von 06").

export function OnboardingChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/welcome';
  const router = useRouter();
  const lang = useOnbLang();
  const tc = STR[lang].chrome;
  const [checking, setChecking] = useState(true);

  // Experience branch drives the honest per-branch total. Read on mount and on
  // every path change (the experience step writes it just before navigating).
  const [vibe, setVibe] = useState<VibeKnown | null>(null);
  useEffect(() => { setVibe(readVibeKnown()); }, [pathname]);

  const info = stepInfo(pathname, vibe);
  const step = info ? info.step - 1 : 0; // 0-indexed for pip styling
  const total = info?.total ?? 0;
  const pipSteps = Array.from({ length: total }, (_, i) => i);

  // Returning-user guard: skip onboarding only for users who have ALREADY
  // COMPLETED it. 10.10 C.2 fix: previously this fired whenever ANY key
  // existed, which kicked a *new* user who just added a provider key mid-flow
  // out to /dashboard — and the dashboard's new-user guard then bounced them to
  // /welcome/language (the founder's "GitHub/Vercel → Step-0 bounce"). Gating
  // on completion keeps mid-flow users in the flow regardless of keys.
  useEffect(() => {
    let cancelled = false;
    // Dev-only preview escape: lets QA walk onboarding even when completed.
    // Dead in production builds (NODE_ENV === 'production').
    if (
      process.env.NODE_ENV !== 'production' &&
      typeof window !== 'undefined' &&
      window.localStorage.getItem('goblin:preview-onboarding') === '1'
    ) {
      setChecking(false);
      return;
    }
    // Re-run from Settings (Sprint 11 "Preference Flow"): a completed user can
    // replay the guided flow on demand. The settings entry sets this flag; we
    // honor it in production too (unlike the dev preview flag above), clear it
    // immediately, and DO NOT touch any account data — only the steps re-show.
    if (
      typeof window !== 'undefined' &&
      window.localStorage.getItem('goblin:rerun-flow') === '1'
    ) {
      try { window.localStorage.removeItem('goblin:rerun-flow'); } catch { /* ignore */ }
      setChecking(false);
      return;
    }
    (async () => {
      try {
        const state = await getOnboardingState();
        if (!cancelled && state?.completed) {
          // F-05 loop-breaker: this guard (service-role read) sees completion
          // before the user-scoped dashboard read may. Set the handshake cookie
          // so the dashboard's back leg trusts it and can't bounce us here again.
          if (typeof document !== 'undefined') document.cookie = onboardedCookieString();
          // Standalone hardening (U1): carry the ?onboarded=1 signal so middleware
          // re-promotes the cookie even if standalone WebKit dropped the JS write.
          router.replace(DASHBOARD_ONBOARDED_URL);
          return;
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
        <Link href="/dashboard" className="gobl-onb-lockup" aria-label="Goblin — zum Dashboard">
          <GMark size={22} />
          <span className="gobl-onb-wordmark">GOBLIN</span>
        </Link>
        <div className="gobl-onb-top-right">
          {info && (
            <span className="gobl-onb-step">
              <span className="gobl-onb-step-num">{tc.step} 0{info.step} / 0{total}</span>
              <span className="gobl-onb-pips">
                {pipSteps.map((n) => (
                  <span
                    key={n}
                    className={`gobl-onb-pip ${n < step ? 'done' : n === step ? 'active' : ''}`}
                  />
                ))}
              </span>
            </span>
          )}
          <Link href="/help" className="gobl-onb-help">{tc.help}</Link>
        </div>
      </header>

      <main className="gobl-onb-body">{children}</main>

      <footer className="gobl-onb-footstrip">
        <span className="gobl-mono">JUSTGOBLIN.COM</span>
        {info && (
          <span className="gobl-mono">
            <span className="gobl-onb-foot-dot" />
            {tc.step} 0{info.step} {tc.of} 0{total}
          </span>
        )}
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
          /* FOUNDER-WALK-2 U4: the /welcome flow was never covered by the
             safe-area waves (#41/#44 treated the app shell) — the GOBLIN logo
             overlapped the iOS clock and "HILFE" collided with the battery.
             Reuse the shipped env() idiom: keep the design padding, add the top
             inset; left/right insets clear the landscape notch. */
          padding-top: calc(22px + env(safe-area-inset-top));
          padding-left: max(32px, env(safe-area-inset-left));
          padding-right: max(32px, env(safe-area-inset-right));
          display: flex; align-items: center; justify-content: space-between;
          gap: 18px;
          border-bottom: 1px solid var(--line);
          background: var(--surface);
        }
        .gobl-onb-lockup {
          display: inline-flex; align-items: center; gap: 10px;
          text-decoration: none; cursor: pointer;
          transition: opacity .15s;
        }
        .gobl-onb-lockup:hover { opacity: 0.72; }
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
          /* U4: the footer line (justgoblin.com · SCHRITT x VON y) sat in the
             home-indicator zone on a standalone PWA. Add the bottom inset (the
             founder saw the dark-mode bottom cut here); left/right for landscape. */
          padding-bottom: calc(18px + env(safe-area-inset-bottom));
          padding-left: max(32px, env(safe-area-inset-left));
          padding-right: max(32px, env(safe-area-inset-right));
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
          .gobl-onb-top {
            padding: 16px 18px; gap: 12px;
            padding-top: calc(16px + env(safe-area-inset-top));
            padding-left: max(18px, env(safe-area-inset-left));
            padding-right: max(18px, env(safe-area-inset-right));
          }
          .gobl-onb-top-right { gap: 12px; }
          .gobl-onb-pips { display: none; }
          .gobl-onb-help { font-size: 10px; letter-spacing: 0.18em; }
          .gobl-onb-footstrip {
            padding: 14px 18px; font-size: 10px;
            padding-bottom: calc(14px + env(safe-area-inset-bottom));
            padding-left: max(18px, env(safe-area-inset-left));
            padding-right: max(18px, env(safe-area-inset-right));
          }
        }
      `}</style>
    </div>
  );
}
