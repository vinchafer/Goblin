'use client';

// Step 1 of 5 — "How should Goblin talk to AI?"
// Faithful port of 01_welcome_new.html.
// Path choice passes via ?path=a|b (mockup used #path-a/#path-b).
//
// Note: this file replaces the previous /welcome content. The
// "user already has a key → /dashboard" guard moved up to layout.tsx.
import Link from 'next/link';
import { ICheck, IEye, IArrowR } from './_components/icons';

export default function WelcomeStep1() {
  return (
    <div className="step1">
      <div className="lead-col">
        <div className="eyebrow"><span className="tick" />Set up your workshop</div>
        <h1>
          How should Goblin <span className="gold-rule" />{' '}
          <span className="gobl-serif">talk to AI?</span>
        </h1>
        <p className="lead">
          Goblin doesn&apos;t run the model — you do. Bring a key, or let us
          walk you through getting a free one. Either way, you stay in control.
        </p>
        <div className="small-print">
          <span className="line"><span className="ic"><ICheck size={10} /></span>BYOK — Anthropic, OpenAI, Google, Groq</span>
          <span className="line"><span className="ic"><ICheck size={10} /></span>No card on file. Cancel anytime.</span>
          <span className="line"><span className="ic"><ICheck size={10} /></span>Your keys live in your account, encrypted.</span>
        </div>
      </div>

      <div className="paths">
        <Link href="/welcome/provider?path=b" className="gobl-path-card path-card primary">
          <span className="badge">RECOMMENDED</span>
          <div className="top">
            <span className="num">PATH B</span>
            <span className="time">~ 2 MIN</span>
          </div>
          <h3>I&apos;m new to this.</h3>
          <p>No key yet? We&apos;ll walk you through getting a free one from Google — no card, no jargon.</p>
          <div className="foot">
            <div className="chips">
              <span className="tag">GUIDED</span>
              <span className="tag">FREE</span>
            </div>
            <span className="arr">Walk me through it <IArrowR size={14} /></span>
          </div>
        </Link>

        <Link href="/welcome/provider?path=a" className="gobl-path-card path-card">
          <div className="top">
            <span className="num">PATH A</span>
            <span className="time">~ 60 SEC</span>
          </div>
          <h3>I already have a key.</h3>
          <p>Anthropic, OpenAI, Google, Groq and more — paste it, test it, you&apos;re building.</p>
          <div className="foot">
            <div className="chips">
              <span className="tag">PASTE &amp; GO</span>
            </div>
            <span className="arr">Continue <IArrowR size={14} /></span>
          </div>
        </Link>

        <Link href="/dashboard" className="path-link">
          <IEye size={12} />
          <span>Just looking? <u>Explore first</u> — no key needed, soft limits on.</span>
        </Link>
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
        .path-link {
          margin-top: 14px;
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 13px; color: var(--ink-2);
          padding: 10px 4px;
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
