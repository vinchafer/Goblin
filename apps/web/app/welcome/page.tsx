'use client';

// Step 1 of 5 — "How should Goblin talk to AI?"
// Faithful port of 01_welcome_new.html.
// Path choice passes via ?path=a|b (mockup used #path-a/#path-b).
//
// Note: this file replaces the previous /welcome content. The
// "user already has a key → /dashboard" guard moved up to layout.tsx.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ICheck, IEye, IArrowR } from './_components/icons';
import { useOnbLang, STR } from './_components/i18n';
import { patchOnboardingState } from './_components/onboarding-state';

export default function WelcomeStep1() {
  const lang = useOnbLang();
  const t = STR[lang].step1;
  const router = useRouter();

  // "Explore first" must actually reach the dashboard. A fresh user is
  // otherwise bounced back to /welcome/language by the dashboard's new-user
  // guard (see PHASE_0.md 0.2). Mark onboarding complete (as a skip) BEFORE
  // navigating so the guard lets them in; keys can be added later in Settings.
  async function explore() {
    await patchOnboardingState({ completed: true, skipped_steps: [1, 2, 3, 4, 5] });
    router.push('/dashboard');
  }

  return (
    <div className="step1">
      <div className="lead-col">
        <div className="eyebrow"><span className="tick" />{t.eyebrow}</div>
        <h1>
          {t.titleA} <span className="gold-rule" />{' '}
          <span className="gobl-serif">{t.titleB}</span>
        </h1>
        <p className="lead">{t.lead}</p>
        <div className="small-print">
          {t.bullets.map((b) => (
            <span key={b} className="line"><span className="ic"><ICheck size={10} /></span>{b}</span>
          ))}
        </div>
      </div>

      <div className="paths">
        {/* Option A — Goblin's own hosted model. The moat, shown first as the
            promise. NOT a working path yet (no GPU server): a non-clickable
            Coming Soon teaser, never starts a keyless session (Rule 1). Becomes
            the hero the day FREE_POOL_ENABLED flips. */}
        <div className="gobl-path-card path-card coming" aria-disabled="true">
          <span className="badge soon-badge">{t.freeBadge}</span>
          <div className="top">
            <span className="num">{t.freeNum}</span>
          </div>
          <h3>{t.freeTitle}</h3>
          <p>{t.freeBody}</p>
          <div className="foot">
            <div className="chips">
              {t.freeTags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
            </div>
          </div>
        </div>

        {/* Option B — guided free key. The RECOMMENDED working entry path
            (permanently — keeps users on a mix of providers, off our server). */}
        <Link href="/welcome/routing?path=b" className="gobl-path-card path-card primary">
          <span className="badge">{t.pathBBadge}</span>
          <div className="top">
            <span className="num">{t.pathBNum}</span>
            <span className="time">{t.pathBTime}</span>
          </div>
          <h3>{t.pathBTitle}</h3>
          <p>{t.pathBBody}</p>
          <div className="foot">
            <div className="chips">
              {t.pathBTags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
            </div>
            <span className="arr">{t.pathBArr} <IArrowR size={14} /></span>
          </div>
        </Link>

        {/* Option C — already have a key. */}
        <Link href="/welcome/routing?path=a" className="gobl-path-card path-card">
          <div className="top">
            <span className="num">{t.pathANum}</span>
            <span className="time">{t.pathATime}</span>
          </div>
          <h3>{t.pathATitle}</h3>
          <p>{t.pathABody}</p>
          <div className="foot">
            <div className="chips">
              <span className="tag">{t.pathATag}</span>
            </div>
            <span className="arr">{t.pathAArr} <IArrowR size={14} /></span>
          </div>
        </Link>

        <button type="button" onClick={explore} className="path-link">
          <IEye size={12} />
          <span>{t.explore}<u>{t.exploreLink}</u>{t.exploreTail}</span>
        </button>
      </div>

      <style jsx>{`
        .step1 {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 72px;
          align-items: center;
          padding: 32px 80px 64px;
        }
        @media (max-width: 880px) {
          .step1 { grid-template-columns: 1fr; gap: 24px; padding: 20px 20px 24px; }
        }
        .eyebrow {
          font-family: var(--font-mono), 'JetBrains Mono', monospace;
          font-size: 10.5px; font-weight: 500;
          letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3);
          display: inline-flex; align-items: center; gap: 10px;
          margin-bottom: 22px;
        }
        .tick {
          width: 5px; height: 5px; background: var(--accent);
          transform: rotate(45deg); display: inline-block;
        }
        h1 {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600;
          font-size: clamp(34px, 5vw, 72px);
          letter-spacing: -0.038em; line-height: 1.04;
          color: var(--ink-1); margin-bottom: 20px;
          max-width: 14ch;
        }
        .gold-rule {
          display: inline-block; width: 0.55em; height: 0.05em;
          background: var(--accent-bright); vertical-align: 0.32em;
          margin: 0 0.18em; border-radius: 2px;
        }
        .lead {
          font-size: 18px; color: var(--ink-2); line-height: 1.5;
          max-width: 44ch;
        }
        @media (max-width: 880px) {
          h1 { font-size: 32px; margin-bottom: 14px; }
          .lead { font-size: 15.5px; }
        }
        .small-print {
          margin-top: 24px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .small-print .line {
          font-family: var(--font-mono), 'JetBrains Mono', monospace;
          font-size: 11px; letter-spacing: 0.06em;
          color: var(--ink-3);
          display: inline-flex; align-items: center; gap: 8px;
        }
        .small-print .ic { color: var(--accent-bright); display: inline-flex; }
        .paths { display: flex; flex-direction: column; gap: 12px; }
        :global(.path-card) {
          display: block;
          background: var(--surface-elev);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 22px 24px;
          text-decoration: none;
          color: var(--ink-1);
          transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease;
          position: relative;
          min-height: 44px;
        }
        :global(.path-card:hover) {
          transform: translateY(-1px);
          border-color: var(--line-strong);
          box-shadow: var(--shadow-card);
        }
        :global(.path-card .top) {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 12px;
        }
        :global(.path-card .num) {
          font-family: var(--font-mono), 'JetBrains Mono', monospace;
          font-size: 10.5px; font-weight: 600;
          letter-spacing: 0.18em; color: var(--ink-3);
        }
        :global(.path-card .time) {
          font-family: var(--font-mono), 'JetBrains Mono', monospace;
          font-size: 10.5px; color: var(--accent);
          letter-spacing: 0.10em;
        }
        :global(.path-card h3) {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 22px;
          letter-spacing: -0.024em; line-height: 1.18;
          color: var(--ink-1); margin-bottom: 8px;
        }
        :global(.path-card p) {
          font-size: 14px; color: var(--ink-2);
          line-height: 1.5; margin-bottom: 18px;
        }
        :global(.path-card .foot) {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding-top: 14px; border-top: 1px solid var(--line);
        }
        :global(.path-card .chips) {
          display: flex; gap: 6px; flex-wrap: wrap;
        }
        :global(.path-card .tag) {
          display: inline-flex; align-items: center;
          font-family: var(--font-mono), 'JetBrains Mono', monospace;
          font-size: 10px; font-weight: 600;
          letter-spacing: 0.14em; text-transform: uppercase;
          padding: 4px 8px; border-radius: 6px;
          background: var(--surface-2); color: var(--ink-2);
          border: 1px solid var(--line);
        }
        :global(.path-card .arr) {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 600; color: var(--ink-1);
        }
        :global(.path-card.primary) {
          background: var(--green); color: var(--bone);
          border-color: var(--green);
        }
        :global(.path-card.primary h3) { color: var(--bone); }
        :global(.path-card.primary p) { color: rgba(244,236,216,.88); }
        :global(.path-card.primary .num),
        :global(.path-card.primary .time) { color: var(--gold); }
        :global(.path-card.primary .foot) { border-top-color: rgba(244,236,216,.22); }
        :global(.path-card.primary .arr) { color: var(--bone); }
        :global(.path-card.primary .tag) {
          background: rgba(244,236,216,.16);
          color: var(--bone);
          border-color: rgba(244,236,216,.32);
        }
        :global(.path-card.primary .badge) {
          position: absolute; top: -10px; right: 18px;
          font-family: var(--font-mono), 'JetBrains Mono', monospace;
          font-size: 10px; font-weight: 600; letter-spacing: 0.18em;
          padding: 4px 8px; border-radius: var(--radius-xs);
          background: var(--gold); color: var(--green);
        }
        /* Option A — Coming Soon teaser: present + honest, not actionable. */
        :global(.path-card.coming) {
          cursor: default;
          border-style: dashed;
          border-color: var(--accent-rule);
          background:
            radial-gradient(120% 140% at 100% 0%, var(--accent-soft) 0%, transparent 55%),
            var(--surface-elev);
        }
        :global(.path-card.coming:hover) {
          transform: none; box-shadow: none; border-color: var(--accent-rule);
        }
        :global(.path-card.coming h3) { color: var(--ink-1); }
        :global(.path-card .soon-badge) {
          position: absolute; top: -10px; right: 18px;
          font-family: var(--font-mono), 'JetBrains Mono', monospace;
          font-size: 10px; font-weight: 600; letter-spacing: 0.18em;
          padding: 4px 8px; border-radius: var(--radius-xs);
          background: var(--gold); color: var(--green);
        }
        .path-link {
          margin-top: 14px;
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 13px; color: var(--ink-2);
          padding: 10px 4px;
          background: none; border: none; cursor: pointer;
          font-family: inherit; text-align: left;
          width: fit-content;
        }
        .path-link u {
          text-decoration-color: var(--accent-rule);
          text-underline-offset: 3px;
        }
        .path-link:hover { color: var(--ink-1); }
      `}</style>
    </div>
  );
}
