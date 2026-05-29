'use client';

// Step 3 of 5 — "Your build team is ready"
// Faithful port of 02b_onboarding_routing_new.html.
//
// Onboarding completion (PUT /api/onboarding/state with completed:true) seeds
// this exact default fallback chain on the server, idempotently. "Change"
// links route to /dashboard/settings/routing where the chain can be tuned.

import Link from 'next/link';
import { useEffect } from 'react';
import { IArrowL, IArrowR, IChat, ICode, ILink, IShield } from '../_components/icons';
import { patchOnboardingState } from '../_components/onboarding-state';

const ROWS = [
  {
    num: '01', kind: 'role' as const,
    label: 'Job · 01', job: 'Writing code',
    Icon: ICode, modelLine: 'Claude Sonnet 4.6 · Anthropic',
    summary: 'Best-in-class at long, correct edits.',
    deep: 'Sonnet 4.6 holds context across hundreds of lines without losing the thread. For multi-file refactors and stubborn bug fixes, it ships fewer broken patches than the alternatives — which is why most Goblin builders settle here.',
  },
  {
    num: '02', kind: 'role' as const,
    label: 'Job · 02', job: 'Chat & planning',
    Icon: IChat, modelLine: 'Gemini 2.5 Pro · Google',
    summary: 'Fast, free, huge context for thinking out loud.',
    deep: "Gemini's 1M-token window swallows long specs and threads whole. On the free tier you can plan all day without watching a meter — and route to Sonnet only when it's time to actually write code.",
  },
  {
    num: '03', kind: 'system' as const,
    label: 'Behaviour · 03', job: 'When one fails',
    Icon: ILink, modelLine: 'Auto-fallback chain',
    summary: 'If a provider errors or hits a limit, Goblin moves to the next — silently.',
    deep: 'Goblin tries the next provider in your chain in milliseconds. No dropped messages, no user-visible errors. The chain order is fully tunable in Settings → Routing, and per-mode chains (chat/code/search) ship in beta soon.',
  },
];

export default function RoutingStepPage() {
  useEffect(() => {
    patchOnboardingState({ current_step: 3 });
  }, []);

  return (
    <div className="step3">
      <header className="head">
        <Link href="/welcome/provider" className="back">
          <IArrowL size={12} /> Back to provider
        </Link>
        <div className="eyebrow"><span className="tick" />Step 03 of 05 — Your build team</div>
        <h1>Your build team is <span className="gobl-serif">ready.</span></h1>
        <p className="lead">
          Goblin sets this up for you — different jobs, different strengths.
          Adjust any of it any time in Settings.
        </p>
      </header>

      <div className="team-card">
        {ROWS.map((row) => {
          const Icon = row.Icon;
          return (
            <div key={row.num} className={`team-row ${row.kind}`}>
              <span className="num">{row.num}</span>
              <div className="body">
                <div className="label">{row.label}</div>
                <div className="job">{row.job}</div>
                <div className="model"><Icon size={13} />{row.modelLine}</div>
                <details className="why">
                  <summary>{row.summary}</summary>
                  <div className="deep">{row.deep}</div>
                </details>
              </div>
              {/* TODO: in-onboarding "Change" should open an inline picker — routes to settings for now */}
              <Link href="/dashboard/settings/routing" className="change">Change later</Link>
            </div>
          );
        })}
      </div>

      <div className="skip-safe">
        <span className="ic"><IShield size={14} /></span>
        <span>
          <b>Goblin sets this up for you.</b> Tune the chain any time in
          Settings → Routing.
        </span>
      </div>

      <div className="actions">
        <Link
          href="/welcome/tools"
          className="btn-primary"
          onClick={() => patchOnboardingState({ current_step: 4 })}
        >
          Got it — continue <IArrowR size={13} />
        </Link>
        <Link
          href="/welcome/tools"
          className="btn-ghost"
          onClick={() => patchOnboardingState({ current_step: 4 })}
        >
          Skip
        </Link>
      </div>

      <div className="footstrip">
        <span className="skip"><IShield size={11} />CHANGE ANY TIME · SETTINGS / ROUTING</span>
        <span className="gobl-mono">/welcome/routing · STEP 03 OF 05</span>
        <Link href="/welcome/tools">SKIP — TUNE LATER →</Link>
      </div>

      <style jsx>{`
        .step3 { padding: 32px 60px 40px; max-width: 1080px; margin: 0 auto; }
        @media (max-width: 880px) { .step3 { padding: 22px 18px 32px; } }
        .head { margin-bottom: 28px; max-width: 760px; }
        .back {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--font-mono), monospace;
          font-size: 10.5px; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--ink-3);
          margin-bottom: 18px;
        }
        .eyebrow {
          font-family: var(--font-mono), monospace; font-size: 10.5px;
          letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3);
          display: inline-flex; align-items: center; gap: 10px; margin-bottom: 14px;
        }
        .tick {
          width: 5px; height: 5px; background: var(--accent);
          transform: rotate(45deg); display: inline-block;
        }
        h1 {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: clamp(34px, 4.4vw, 56px);
          letter-spacing: -0.034em; line-height: 1.06;
          color: var(--ink-1); margin-bottom: 12px;
        }
        .lead { font-size: 16.5px; color: var(--ink-2); line-height: 1.5; max-width: 60ch; }

        .team-card {
          background: var(--surface-elev);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          overflow: hidden; margin-bottom: 18px;
        }
        .team-row {
          display: grid;
          grid-template-columns: 36px 1fr auto;
          gap: 16px; align-items: flex-start;
          padding: 18px 22px;
          border-bottom: 1px solid var(--line);
        }
        .team-row:last-child { border-bottom: none; }
        @media (max-width: 600px) {
          .team-row { grid-template-columns: 28px 1fr; gap: 12px; padding: 14px 16px; }
        }
        .num {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--green); color: var(--bone);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-mono), monospace;
          font-weight: 600; font-size: 11px;
          flex-shrink: 0; margin-top: 2px;
        }
        .team-row.system .num { background: var(--accent-bright); color: var(--green); }
        .label {
          font-family: var(--font-mono), monospace; font-size: 10px;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: var(--ink-3); margin-bottom: 4px;
        }
        .job {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 16px;
          color: var(--ink-1); letter-spacing: -0.014em; line-height: 1.2;
        }
        .model {
          font-family: var(--font-mono), monospace; font-size: 12px;
          color: var(--ink-2); margin-top: 4px;
          display: inline-flex; align-items: center; gap: 8px;
        }
        .model :global(svg) { color: var(--ink-3); }
        .why { margin-top: 8px; }
        .why > summary {
          font-size: 13.5px; color: var(--ink-2); line-height: 1.5;
          cursor: pointer; list-style: none;
          display: flex; align-items: flex-start; gap: 8px;
          max-width: 60ch;
        }
        .why > summary::-webkit-details-marker { display: none; }
        .why > summary::before {
          content: '+'; color: var(--ink-3);
          font-family: var(--font-mono), monospace; font-weight: 600;
          flex-shrink: 0; display: inline-block;
        }
        .why[open] > summary::before { content: '−'; }
        .deep {
          margin-top: 8px; padding: 10px 12px;
          background: var(--surface-2); border-radius: var(--radius);
          font-size: 13px; color: var(--ink-2); line-height: 1.55;
          max-width: 64ch;
        }
        .change {
          font-family: var(--font-mono), monospace; font-size: 10.5px;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--ink-3); text-decoration: underline;
          text-decoration-color: var(--line-strong);
          text-underline-offset: 4px; align-self: center;
        }
        .change:hover { color: var(--ink-1); text-decoration-color: var(--accent); }
        @media (max-width: 600px) {
          .change { grid-column: 2; justify-self: flex-start; margin-top: 8px; }
        }

        .skip-safe {
          background: var(--ok-soft);
          border: 1px solid rgba(47,106,71,.30);
          border-radius: var(--radius);
          padding: 12px 16px; margin-bottom: 18px;
          font-size: 13.5px; color: var(--ok); line-height: 1.5;
          display: flex; align-items: flex-start; gap: 10px;
        }
        .skip-safe .ic { color: var(--ok); margin-top: 3px; flex-shrink: 0; display: inline-flex; }
        .skip-safe b { color: var(--green); font-weight: 600; }

        .actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .btn-primary, .btn-ghost {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 14.5px;
          padding: 14px 20px; border-radius: var(--radius);
          border: 1px solid transparent; cursor: pointer; text-decoration: none;
        }
        .btn-primary { background: var(--green); color: var(--bone); }
        .btn-primary:hover { background: #081710; }
        .btn-ghost { background: transparent; color: var(--ink-2); }
        .btn-ghost:hover { color: var(--ink-1); background: var(--surface-2); }

        .footstrip {
          margin-top: 24px;
          border-top: 1px solid var(--line);
          padding: 14px 0;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
          font-family: var(--font-mono), monospace;
          font-size: 11px; letter-spacing: 0.10em;
          text-transform: uppercase; color: var(--ink-3);
        }
        .footstrip .skip {
          display: inline-flex; align-items: center; gap: 6px;
        }
        .footstrip .skip :global(svg) { color: var(--accent); }
        .footstrip a { color: var(--ink-2); }
        .footstrip a:hover { color: var(--ink-1); }
        @media (max-width: 600px) {
          .footstrip { flex-wrap: wrap; gap: 8px; font-size: 10px; }
        }
      `}</style>
    </div>
  );
}
