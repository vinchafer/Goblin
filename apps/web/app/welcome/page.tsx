'use client';

// Step 2 — Experience fork (Sprint 11 onboarding restructure).
// Replaces the old "How should Goblin talk to AI?" hero (which led with a
// COMING-SOON key card). We now ask one honest question — does the user know
// "vibe coding"? — and branch:
//   • experienced → straight to "How Goblin works" (/welcome/routing)
//   • new         → an encouraging explainer first (/welcome/explainer)
// The choice drives the per-branch step counter (flow.ts) and is persisted
// best-effort (localStorage + onboarding_steps.experience_level).
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IArrowR, ICheck } from './_components/icons';
import { patchOnboardingState, type ExperienceLevel } from './_components/onboarding-state';
import { useOnbLang, STR } from './_components/i18n';
import { setVibeKnown } from './_components/flow';

export default function WelcomeExperienceFork() {
  const router = useRouter();
  const lang = useOnbLang();
  const t = STR[lang].experience;
  const [choice, setChoice] = useState<ExperienceLevel>('new');
  const [busy, setBusy] = useState(false);

  async function go() {
    if (busy) return;
    setBusy(true);
    const known = choice === 'experienced';
    setVibeKnown(known ? 'yes' : 'no');
    // Best-effort — non-blocking; flow continues regardless.
    void patchOnboardingState({ current_step: 1, experience_level: choice });
    router.push(known ? '/welcome/routing' : '/welcome/explainer');
  }

  const OPTIONS: { id: ExperienceLevel; label: string; desc: string }[] = [
    { id: 'experienced', label: t.yesLabel, desc: t.yesDesc },
    { id: 'new', label: t.noLabel, desc: t.noDesc },
  ];

  return (
    <div className="expfork">
      <div className="panel">
        <div className="eyebrow"><span className="tick" />{t.eyebrow}</div>
        <h1>{t.titleA} <span className="gobl-serif">{t.titleB}</span></h1>
        <p className="lead">{t.lead}</p>

        <div className="rows" role="radiogroup" aria-label={t.eyebrow}>
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={choice === o.id}
              className={`row ${choice === o.id ? 'active' : ''}`}
              onClick={() => setChoice(o.id)}
            >
              <span className="dot" aria-hidden>{choice === o.id ? <ICheck size={12} /> : null}</span>
              <span className="rtext">
                <span className="name">{o.label}</span>
                <span className="desc">{o.desc}</span>
              </span>
            </button>
          ))}
        </div>

        <button type="button" className="cta" onClick={go} disabled={busy}>
          {t.cta} <IArrowR size={15} />
        </button>
      </div>

      <style jsx>{`
        .expfork {
          display: flex; justify-content: center; align-items: flex-start;
          padding: 48px 20px 64px;
        }
        .panel { width: 100%; max-width: 460px; }
        .eyebrow {
          font-family: var(--font-mono), 'JetBrains Mono', monospace;
          font-size: 10.5px; font-weight: 500;
          letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3);
          display: inline-flex; align-items: center; gap: 10px;
          margin-bottom: 16px;
        }
        .tick {
          width: 5px; height: 5px; background: var(--accent);
          transform: rotate(45deg); display: inline-block;
        }
        h1 {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600;
          font-size: clamp(26px, 4vw, 36px);
          letter-spacing: -0.03em; line-height: 1.1;
          color: var(--ink-1); margin: 0 0 12px;
        }
        .lead { font-size: 15px; color: var(--ink-2); line-height: 1.5; margin: 0 0 24px; }
        .rows { display: flex; flex-direction: column; gap: 10px; }
        .row {
          display: flex; align-items: flex-start; gap: 14px;
          width: 100%; text-align: left;
          background: var(--surface-elev);
          border: 1px solid var(--line);
          border-radius: var(--radius-md, 12px);
          padding: 16px 18px;
          cursor: pointer; min-height: 44px;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .row:hover { border-color: var(--line-strong); }
        .row.active { border-color: var(--green); box-shadow: 0 0 0 1px var(--green); }
        .row .dot {
          width: 22px; height: 22px; flex: none; margin-top: 1px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 50%;
          border: 1.5px solid var(--line-strong);
          color: var(--bone); background: transparent;
        }
        .row.active .dot { background: var(--green); border-color: var(--green); }
        .rtext { display: flex; flex-direction: column; gap: 2px; }
        .row .name {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 16px;
          letter-spacing: -0.01em; color: var(--ink-1);
        }
        .row .desc { font-size: 13px; color: var(--ink-3); }
        .cta {
          width: 100%; margin-top: 22px;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          background: var(--green); color: var(--bone);
          border: 1px solid var(--green);
          border-radius: var(--radius-md, 12px);
          padding: 14px 22px;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 15px;
          cursor: pointer; min-height: 44px;
          transition: transform .15s ease, opacity .15s ease;
        }
        .cta:hover { transform: translateY(-1px); }
        .cta:disabled { opacity: .6; cursor: default; transform: none; }
      `}</style>
    </div>
  );
}
