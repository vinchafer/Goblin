'use client';

// First build with Goblin Swift (Sprint 11 — new final step).
// Replaces the old "fetch a Groq key first" requirement. Goblin Swift is the
// live, no-key default (proven in the Phase-2 truth-test), so the primary path
// drops the user straight into the dashboard to build — no key, no card. BYOK
// is an explicitly OPTIONAL, secondary link. Completing here marks onboarding
// done (server seeds defaults) and routes to /dashboard.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IArrowL, IArrowR } from '../_components/icons';
import { patchOnboardingState } from '../_components/onboarding-state';
import { useOnbLang, STR } from '../_components/i18n';
import { onboardedCookieString, DASHBOARD_ONBOARDED_URL } from '@/lib/onboarding-gate';

export default function BuildStepPage() {
  const router = useRouter();
  const lang = useOnbLang();
  const t = STR[lang].build;
  const [busy, setBusy] = useState(false);

  async function finish() {
    if (busy) return;
    setBusy(true);
    // F-05: set the synchronous completion handshake FIRST, so it rides the very
    // next navigation into the dashboard. This closes the stale-read window — the
    // server guard trusts the cookie even while the DB write (below) is still
    // replicating or RLS-hidden, so it can never bounce us back into /welcome.
    if (typeof document !== 'undefined') document.cookie = onboardedCookieString();
    // Mark onboarding complete (best-effort) before entering the dashboard, so
    // the returning-user guard won't bounce the user back into /welcome.
    await patchOnboardingState({ current_step: 4, completed: true });
    // F-05 standalone hardening (U1): navigate WITH the ?onboarded=1 signal, not a
    // bare /dashboard. In an installed PWA the JS cookie above can be dropped by
    // standalone WebKit; the URL signal rides the navigation itself and middleware
    // promotes it into the same cookie, so the back-leg guard still trusts it.
    router.push(DASHBOARD_ONBOARDED_URL);
  }

  return (
    <div className="buildstep">
      <header className="head">
        <Link href="/welcome/models" className="back"><IArrowL size={12} /> <span>{t.back}</span></Link>
        <div className="eyebrow"><span className="tick" /><span>{t.eyebrow}</span></div>
        <h1>{t.titleA} <span className="gobl-serif">{t.titleB}</span></h1>
        <p className="lead">{t.lead}</p>
      </header>

      <button type="button" className="primary" onClick={finish} disabled={busy}>
        {t.primaryCta} <IArrowR size={16} />
      </button>

      <div className="byok">
        <div className="byok-text">
          <span className="byok-title">{t.byokTitle}</span>
          <span className="byok-body">{t.byokBody}</span>
        </div>
        <Link href="/welcome/provider" className="byok-cta">{t.byokCta} <IArrowR size={13} /></Link>
      </div>

      <div className="footstrip">
        <span className="skip">{t.footNote}</span>
        <button type="button" className="finish" onClick={finish} disabled={busy}>{t.finish}</button>
      </div>

      <style jsx>{`
        .buildstep { padding: 40px 60px 48px; max-width: 720px; margin: 0 auto; }
        @media (max-width: 880px) { .buildstep { padding: 24px 18px 36px; } }
        .head { margin-bottom: 26px; }
        .back {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-mono), monospace; font-size: 10.5px;
          letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 18px;
        }
        .back:hover { color: var(--ink-1); }
        .eyebrow {
          font-family: var(--font-mono), monospace; font-size: 10.5px;
          letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3);
          display: inline-flex; align-items: center; gap: 10px; margin-bottom: 14px;
        }
        .tick { width: 5px; height: 5px; background: var(--accent); transform: rotate(45deg); display: inline-block; }
        h1 {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: clamp(32px, 4.4vw, 52px);
          letter-spacing: -0.034em; line-height: 1.06; color: var(--ink-1); margin-bottom: 12px;
        }
        .lead { font-size: 16.5px; color: var(--ink-2); line-height: 1.5; max-width: 58ch; }
        .primary {
          width: 100%; margin: 4px 0 18px;
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          background: var(--green); color: var(--bone);
          border: 1px solid var(--green); border-radius: var(--radius-md, 12px);
          padding: 18px 24px;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 17px; cursor: pointer; min-height: 52px;
          transition: transform .15s ease, opacity .15s ease;
        }
        .primary:hover { transform: translateY(-1px); }
        .primary:disabled { opacity: .6; cursor: default; transform: none; }
        .byok {
          display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
          background: var(--surface-2); border: 1px solid var(--line);
          border-radius: var(--radius-lg); padding: 16px 18px;
        }
        .byok-text { display: flex; flex-direction: column; gap: 2px; }
        .byok-title {
          font-family: var(--font-onb-display), Manrope, sans-serif; font-weight: 600; font-size: 14px; color: var(--ink-1);
        }
        .byok-body { font-size: 13px; color: var(--ink-3); max-width: 52ch; }
        .byok-cta {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--font-onb-display), Manrope, sans-serif; font-weight: 600; font-size: 13px;
          color: var(--ink-1); text-decoration: none; padding: 9px 15px; border-radius: var(--radius);
          border: 1px solid var(--line-strong); background: var(--surface-elev); white-space: nowrap;
        }
        .byok-cta:hover { border-color: var(--ink-1); }
        .footstrip {
          margin-top: 24px; border-top: 1px solid var(--line); padding: 14px 0;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          font-family: var(--font-mono), monospace; font-size: 11px; letter-spacing: 0.10em;
          text-transform: uppercase; color: var(--ink-3);
        }
        .footstrip .finish {
          background: none; border: none; cursor: pointer;
          font-family: var(--font-mono), monospace; font-size: 11px; letter-spacing: 0.10em;
          text-transform: uppercase; color: var(--ink-2);
        }
        .footstrip .finish:hover { color: var(--ink-1); }
        @media (max-width: 600px) { .footstrip { flex-wrap: wrap; gap: 8px; font-size: 10px; } }
      `}</style>
    </div>
  );
}
