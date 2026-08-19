'use client';

/**
 * PhoneMock — the pitch repo's iPhone mockup, ported into the landing.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * Founder call, 2026-08-17, after the third pass on this section: the hand-built
 * Send-to-Code mock was replaced rather than polished again. This is
 * `components/mock/MockIPhonePostLogin.tsx` + `ScaledMock.tsx` +
 * `prodShell.module.css` from vinchafer/justgoblin-pitch @ 92e6931, ported here
 * and adapted to the landing's responsive rules.
 *
 * The pitch mock is itself a read-only pixel replica of the production dashboard
 * (built Sprint 11 §C.2 from `app/dashboard/page.tsx` + `chat/ChatInput.tsx` +
 * `layout/Header.tsx`), which is why it was the right thing to port: it was
 * derived FROM the app, not imagined next to it.
 *
 * ── WHAT WAS CORRECTED DURING THE PORT ──────────────────────────────────────
 * Every visible element was re-verified against the app as it stands TODAY, not
 * as it stood in Sprint 11. The full element → file:line → kept/removed table is
 * in docs/WAVE_MAIL_LANDING_AUDIT.md §2.4. Four things had drifted and are fixed
 * here, not carried over. (Line refs re-verified against master 33ad3a8 on
 * 2026-08-17: PR #104 edited Header.tsx, so every Header ref below moved. The
 * affordances did not — they were re-found by content, then re-pinned.)
 *
 *   1. "Alle Updates →" is gone. The real section link reads "Help & FAQ →" and
 *      points at /help — dashboard/page.tsx:561-564 carries the comment explaining
 *      that it must not promise a changelog it does not reach.
 *   2. The avatar is 30px on --gold-700 with #2a1f0f ink (AvatarMenu.tsx:145-155),
 *      not 32px on --brand-gold.
 *   3. --radius-lg is 20px (design-tokens.css:133), not the 14px the pitch's
 *      token copy still carried.
 *   4. Project-row dots take the STATUS colour (dashboard/page.tsx:513, via
 *      statusLabel), not a per-project colour.
 *
 * ── LANGUAGE ────────────────────────────────────────────────────────────────
 * Rendered in ENGLISH, and that is accurate here: every string on this surface
 * goes through t()/useLang in the real dashboard, so an English visitor really
 * does see exactly this. (Unlike the chat code-block, which is German-only —
 * the reason the previous mock needed a caption.) Every English string below is
 * copied verbatim from the app's own `en` branch.
 *
 * No handlers, no state, no links: this is a picture of the product, and a
 * clickable-looking control that does nothing is a phantom affordance.
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { copy } from '@/components/landing/copy';
import type { Lang } from '@/lib/locale';

const SANS = "var(--lp2-font-sans), Manrope, sans-serif";
const MONO = "var(--lp2-font-mono), 'JetBrains Mono', monospace";

// The design resolution the pitch mock is drawn at (iPhone 9:19).
const DESIGN_W = 390;
const DESIGN_H = 823;

/**
 * ScaledMock, ported verbatim from the pitch repo: renders the fixed-resolution
 * replica and scales it into a fluid frame with a transform. No dependencies,
 * no animation — a ResizeObserver and one `scale()`.
 */
function ScaledMock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setScale(Math.min(w / DESIGN_W, h / DESIGN_H));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="pm-scaler">
      <div
        className="pm-canvas"
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${scale})`,
          visibility: scale > 0 ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Content ────────────────────────────────────────────────────────────────
//
// Every visible string in this mock is quoted VERBATIM from the app's own
// language branch — see components/landing/copy.ts `phone`, which cites the
// source for each. That is not tidiness: the section above this mock says "this
// is the real screen, drawn from the app's own code rather than staged", and a
// mock translated by hand for the German page would make that sentence false on
// /de. The German comes from app/dashboard/page.tsx and
// components/chat/ChatInput.tsx — the same files the English does.
//
// Project NAMES stay untranslated in both languages: they are sample content a
// user typed, not product copy.
const PROJECT_NAMES = ['Marie Lang Portfolio', 'Café Henri Menu', 'Studio Reel'];
const PROJECT_DOTS = ['var(--pm-gold)', '#7A4A8A', '#3A6B8A'];
/** Tags from dashboard/page.tsx UPDATES — identical in both branches. */
const UPDATE_TAGS = [
  { tag: 'NEU', tone: 'gold' },
  { tag: 'NEU', tone: 'gold' },
  { tag: 'UPDATE', tone: 'plain' },
];

function GoblinMarkGold({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} aria-hidden="true">
      <use href="#goblin-mark" />
    </svg>
  );
}

/** layout/Header.tsx — mobile row: hamburger · mark · mode tile · plus · avatar. */
function MockHeader({ lang }: { lang: Lang }) {
  const c = copy(lang).phone;
  return (
    <header className="pm-header">
      {/* Hamburger — Header.tsx:106-124, 40×40, 24px icon. */}
      <span className="pm-hamburger">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </span>

      {/* Brand mark — Header.tsx:126-137. Mobile hides the wordmark. */}
      <span className="pm-mark"><GoblinMarkGold size={26} /></span>

      <span className="pm-spacer" />

      {/* Mode tile — Header.tsx:171-193. Chat is the mode the dashboard opens in. */}
      <span className="pm-mode">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>{c.mode}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ opacity: 0.7 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>

      {/* Plus — Header.tsx:295-315, 30×30 outline circle. */}
      <span className="pm-plus">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </span>

      {/* Avatar — AvatarMenu.tsx:145-161, 30×30 on --gold-700. */}
      <span className="pm-avatar">M</span>
    </header>
  );
}

/** chat/ChatInput.tsx with variant="hero" — placeholder, plus, model pill, hint, mic, send. */
function HeroComposer({ lang }: { lang: Lang }) {
  const c = copy(lang).phone;
  return (
    <div className="pm-composer">
      {/* Placeholder — ChatInput.tsx:928 / dashboard/page.tsx:419 (en). */}
      <div className="pm-composer-text">{c.placeholder}</div>
      <div className="pm-composer-row">
        {/* Attachment plus — ChatInput.tsx:952-966, 28px circle. */}
        <span className="pm-c-plus">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
        {/* Model pill — ChatInput.tsx:989-1013. Shows the selected model's displayName. */}
        <span className="pm-model">
          <span className="pm-model-name">{c.model}</span>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ flexShrink: 0, opacity: 0.6 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
        {/* Hint — ChatInput.tsx:1022 (en branch). */}
        <span className="pm-hint">{c.newLine}</span>
        {/* Voice button — ChatInput.tsx:371-378 (VoiceButton). */}
        <span className="pm-mic">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </span>
        {/* Send — ChatInput.tsx:1046-1072, 32×32 r8. Idle (empty composer) fill. */}
        <span className="pm-send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
          </svg>
        </span>
      </div>
    </div>
  );
}

function MockDashboard({ lang }: { lang: Lang }) {
  const c = copy(lang).phone;
  return (
    <div className="pm-shell">
      <MockHeader lang={lang} />
      <div className="pm-scroll">
        <div className="pm-page">
          {/* Hero — dashboard/page.tsx:315-368. Mobile padding 18/16/16. */}
          <section className="pm-hero">
            <div className="pm-eyebrow">
              <span className="pm-tick" />
              <span className="pm-greeting">{c.greeting}</span>
            </div>
            <h1 className="pm-h1">
              {c.head.a} <span className="pm-serif">{c.head.i}</span>
            </h1>
            <HeroComposer lang={lang} />
            <div className="pm-chips">
              {c.quickPrompts.map((q) => (
                <span key={q} className="pm-chip">{q}</span>
              ))}
            </div>
          </section>

          {/* Projects — mobile slim list, dashboard/page.tsx:502-556. */}
          <section className="pm-section">
            <div className="pm-section-title">
              <h2>{c.projectsTitle}</h2>
              <span className="pm-label">{c.active}</span>
            </div>
            <div className="pm-panel">
              {PROJECT_NAMES.map((name, i) => (
                <div key={name} className="pm-proj" data-last={i === PROJECT_NAMES.length - 1}>
                  <span className="pm-dot" style={{ background: PROJECT_DOTS[i] }} />
                  <span className="pm-proj-name">{name}</span>
                  <span className="pm-proj-ago">{c.ago[i] ?? ''}</span>
                </div>
              ))}
              <div className="pm-proj-new">{c.newProject}</div>
            </div>
          </section>

          {/* What's new — dashboard/page.tsx:557-600. */}
          <section className="pm-section">
            <div className="pm-section-title">
              <h2>{c.whatsNew}</h2>
              {/* Real label + real destination — NOT "All updates". */}
              <span className="pm-label">{c.helpFaq}</span>
            </div>
            <div className="pm-panel">
              {UPDATE_TAGS.map((tag, i) => {
                // Same contract as Pricing: the parity test holds both languages
                // at three updates, and the guard states it rather than casting.
                const u = c.updates[i];
                if (!u) return null;
                return (
                  <div key={u.title} className="pm-update" data-last={i === UPDATE_TAGS.length - 1}>
                    <span className={tag.tone === 'gold' ? 'pm-tag pm-tag-gold' : 'pm-tag'}>{tag.tag}</span>
                    <div className="pm-update-body">
                      <h4>{u.title}</h4>
                      <p>{u.desc}</p>
                    </div>
                    <span className="pm-update-date">{u.date}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function PhoneMock({ lang }: { lang: Lang }) {
  return (
    <div className="pm-frame" aria-hidden="true" style={{ fontFamily: SANS, ['--pm-mono' as string]: MONO }}>
      <span className="pm-notch" />
      <ScaledMock>
        <MockDashboard lang={lang} />
      </ScaledMock>
    </div>
  );
}
