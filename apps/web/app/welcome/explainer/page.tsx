'use client';

// Conditional step (NO branch only) — vibe-coding explainer (Sprint 11).
// Shown when the user said they're NOT yet familiar with vibe coding. Short,
// encouraging, honest: describe → AI writes real code → you ship. Then continues
// into the standard flow (/welcome/routing). Counted in the per-branch counter
// (flow.ts FLOW_NO), so this user sees one more numbered step than the YES path.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IArrowL, IArrowR } from '../_components/icons';
import { patchOnboardingState } from '../_components/onboarding-state';
import { useOnbLang, STR } from '../_components/i18n';

export default function ExplainerStep() {
  const router = useRouter();
  const lang = useOnbLang();
  const t = STR[lang].explainer;
  const [busy, setBusy] = useState(false);

  function go() {
    if (busy) return;
    setBusy(true);
    void patchOnboardingState({ current_step: 2 });
    router.push('/welcome/routing');
  }

  return (
    <div className="explainer">
      <header className="head">
        <Link href="/welcome" className="back"><IArrowL size={12} /> <span>{STR[lang].layers.back}</span></Link>
        <div className="eyebrow"><span className="tick" /><span>{t.eyebrow}</span></div>
        <h1>{t.titleA} <span className="gobl-serif">{t.titleB}</span></h1>
        <p className="lead">{t.lead}</p>
      </header>

      <ol className="points">
        {t.points.map((p, i) => (
          <li key={i} className="point">
            <span className="pnum">{i + 1}</span>
            <div className="pbody">
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="close">{t.close}</p>

      <button type="button" className="cta" onClick={go} disabled={busy}>
        {t.cta} <IArrowR size={14} />
      </button>

      <style jsx>{`
        .explainer { padding: 40px 60px 48px; max-width: 760px; margin: 0 auto; }
        @media (max-width: 880px) { .explainer { padding: 24px 18px 36px; } }
        .head { margin-bottom: 26px; }
        .back {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-mono), monospace; font-size: 10.5px;
          letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-3);
          margin-bottom: 18px;
        }
        .back:hover { color: var(--ink-1); }
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
          font-weight: 600; font-size: clamp(30px, 4.2vw, 46px);
          letter-spacing: -0.03em; line-height: 1.08;
          color: var(--ink-1); margin-bottom: 12px;
        }
        .lead { font-size: 16px; color: var(--ink-2); line-height: 1.5; max-width: 58ch; }
        .points { list-style: none; margin: 0 0 28px; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .point {
          display: grid; grid-template-columns: 40px 1fr; gap: 16px; align-items: start;
          background: var(--surface-elev); border: 1px solid var(--line);
          border-radius: var(--radius-lg); padding: 18px 20px;
        }
        .pnum {
          width: 40px; height: 40px; border-radius: 11px; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 700; font-size: 18px;
          background: var(--green); color: var(--bone); border: 1px solid var(--green);
        }
        .pbody h3 {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 17px; letter-spacing: -0.014em;
          color: var(--ink-1); line-height: 1.25;
        }
        .pbody p { font-size: 14px; color: var(--ink-2); line-height: 1.55; margin-top: 5px; max-width: 60ch; }
        .close {
          font-family: var(--font-onb-serif), Georgia, serif; font-style: italic;
          font-size: 18px; color: var(--ink-1); line-height: 1.45;
          margin: 0 0 26px; max-width: 56ch;
        }
        .cta {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--green); color: var(--bone);
          border: 1px solid var(--green); border-radius: var(--radius);
          padding: 14px 24px;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 15px; cursor: pointer; min-height: 44px;
          transition: transform .15s ease, opacity .15s ease;
        }
        .cta:hover { transform: translateY(-1px); }
        .cta:disabled { opacity: .6; cursor: default; transform: none; }
      `}</style>
    </div>
  );
}
