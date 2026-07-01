'use client';

// "How Goblin works" (Sprint 11 honest restructure).
// THREE LAYERS, honestly ordered:
//   Layer 1 (DEFAULT, live now) — Goblin's own built-in models (Swift/Forge),
//     no key, cloud-run. This is the default and works today.
//   Layer 2 (OPTIONAL) — free third-party keys (Groq/Gemini).
//   Layer 3 (OPTIONAL) — BYOK, your own paid providers.
// No "coming soon"/waitlist anywhere: the no-key path is the live default, per
// the Phase-2 truth-test (Goblin Swift built a real page with no key, no card).
// Continues into the models step. Numbering is owned by chrome/flow.ts.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { IArrowL, IArrowR, IShield } from '../_components/icons';
import { patchOnboardingState } from '../_components/onboarding-state';
import { useOnbLang, STR } from '../_components/i18n';
import { prevStep, readVibeKnown } from '../_components/flow';

// Tone per layer index: layer 1 is the live default; 2 and 3 are optional.
const TONES = ['active', 'optional', 'optional'] as const;

export default function RoutingStepPage() {
  const lang = useOnbLang();
  const t = STR[lang].layers;
  const pathname = usePathname() ?? '/welcome/routing';
  const nextHref = '/welcome/models';
  const backHref = prevStep(pathname, readVibeKnown()) ?? '/welcome';

  useEffect(() => {
    patchOnboardingState({ current_step: 2 });
  }, []);

  return (
    <div className="step3">
      <header className="head">
        <Link href={backHref} className="back">
          <IArrowL size={12} /> <span>{t.back}</span>
        </Link>
        <div className="eyebrow"><span className="tick" /><span>{t.eyebrow}</span></div>
        <h1>{t.titleA} <span className="gobl-serif">{t.titleB}</span></h1>
        <p className="lead">{t.lead}</p>
      </header>

      <div className="layers">
        {t.items.map((layer, i) => {
          const tone = TONES[i];
          const n = String(i + 1);
          return (
            <div key={n} className={`layer layer-${tone}`}>
              <span className="lnum">{n}</span>
              <div className="lbody">
                <div className="lhead">
                  <span className="ltag">{layer.tag}</span>
                  <span className={`lbadge badge-${tone}`}>{layer.badge}</span>
                </div>
                <h3>{layer.title}</h3>
                <p>{layer.body}</p>
                {tone === 'active' && (
                  <Link
                    href={nextHref}
                    className="layer-cta active-cta"
                    onClick={() => patchOnboardingState({ current_step: 3 })}
                  >
                    {t.continue} <IArrowR size={13} />
                  </Link>
                )}
                {n === '2' && (
                  <Link href="/welcome/provider" className="layer-cta">
                    {t.l2cta} <IArrowR size={13} />
                  </Link>
                )}
                {n === '3' && (
                  <Link href="/welcome/provider" className="layer-cta">
                    {t.l3cta} <IArrowR size={13} />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flow">
        <span className="fstep">{t.flow.prompt}</span>
        <IArrowR size={13} />
        <span className="fstep on">{t.flow.l1}</span>
        <IArrowR size={13} />
        <span className="fstep">{t.flow.l2}</span>
        <IArrowR size={13} />
        <span className="fstep">{t.flow.l3}</span>
      </div>
      <p className="flow-cap">
        <IShield size={11} /> {t.flowCap}
      </p>

      <div className="actions">
        <Link
          href={nextHref}
          className="onb-btn-primary"
          onClick={() => patchOnboardingState({ current_step: 3 })}
        >
          {t.continue} <IArrowR size={14} />
        </Link>
        <Link
          href={nextHref}
          className="onb-btn-ghost"
          onClick={() => patchOnboardingState({ current_step: 3 })}
        >
          {t.skip}
        </Link>
      </div>

      <div className="footstrip">
        <span className="skip"><IShield size={11} />{t.footChange}</span>
        <Link href={nextHref}>{t.footNext}</Link>
      </div>

      <style jsx>{`
        .step3 { padding: 32px 60px 40px; max-width: 1080px; margin: 0 auto; }
        @media (max-width: 880px) { .step3 { padding: 22px 18px 32px; } }
        .head { margin-bottom: 26px; max-width: 760px; }
        .back {
          display: flex; width: fit-content; max-width: 100%;
          align-items: center; gap: 8px;
          font-family: var(--font-mono), monospace;
          font-size: 10.5px; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--ink-3);
          margin-bottom: 18px;
        }
        .back :global(svg) { flex-shrink: 0; }
        .back:hover { color: var(--ink-1); }
        .eyebrow {
          font-family: var(--font-mono), monospace; font-size: 10.5px;
          letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3);
          display: inline-flex; align-items: center; gap: 10px; margin-bottom: 14px;
        }
        .tick {
          width: 5px; height: 5px; background: var(--accent);
          transform: rotate(45deg); display: inline-block; flex-shrink: 0;
        }
        h1 {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: clamp(34px, 4.4vw, 56px);
          letter-spacing: -0.034em; line-height: 1.06;
          color: var(--ink-1); margin-bottom: 12px;
        }
        .lead { font-size: 16.5px; color: var(--ink-2); line-height: 1.5; max-width: 60ch; }

        .layers { display: flex; flex-direction: column; gap: 12px; margin-bottom: 22px; }
        .layer {
          display: grid;
          grid-template-columns: 44px 1fr;
          gap: 16px; align-items: start;
          background: var(--surface-elev);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 20px 22px;
        }
        .layer-active { border-color: var(--green); box-shadow: 0 0 0 1px var(--green); }
        .lnum {
          width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 700; font-size: 20px;
          background: var(--surface-2); color: var(--ink-2);
          border: 1px solid var(--line-strong);
        }
        .layer-active .lnum { background: var(--green); color: var(--bone); border-color: var(--green); }
        .lbody { min-width: 0; }
        .lhead { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
        .ltag {
          font-family: var(--font-mono), monospace; font-size: 10px;
          letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3);
        }
        .lbadge {
          font-family: var(--font-mono), monospace; font-size: 9.5px; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          padding: 3px 8px; border-radius: var(--radius-xs);
        }
        .badge-active { background: var(--ok-soft); color: var(--ok); border: 1px solid rgba(47,106,71,.32); }
        .badge-optional { background: var(--surface-2); color: var(--ink-2); border: 1px solid var(--line-strong); }
        .layer h3 {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 18px;
          letter-spacing: -0.016em; color: var(--ink-1); line-height: 1.25;
        }
        .layer p {
          font-size: 14px; color: var(--ink-2); line-height: 1.55;
          margin-top: 6px; max-width: 66ch;
        }

        :global(.layer-cta) {
          margin-top: 14px;
          display: inline-flex; align-items: center; gap: 7px;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 13px;
          color: var(--ink-1); text-decoration: none;
          padding: 9px 15px; border-radius: var(--radius);
          border: 1px solid var(--line-strong); background: var(--surface-elev);
          width: fit-content;
          transition: border-color .15s, color .15s, background .15s;
        }
        :global(.layer-cta:hover) { border-color: var(--ink-1); }
        :global(.layer-cta.active-cta) { color: var(--green); border-color: var(--green); }
        :global(.layer-cta.active-cta:hover) { background: var(--ok-soft); }

        .flow {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          padding: 14px 18px; margin-bottom: 8px;
          background: var(--surface-2); border: 1px solid var(--line);
          border-radius: var(--radius-lg);
        }
        .flow :global(svg) { color: var(--ink-3); flex-shrink: 0; }
        .fstep {
          font-family: var(--font-mono), monospace; font-size: 11px;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--ink-2); padding: 4px 8px; border-radius: var(--radius-xs);
          background: var(--surface-elev); border: 1px solid var(--line);
        }
        .fstep.on { color: var(--green); border-color: var(--green); font-weight: 600; }
        .flow-cap {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 12.5px; color: var(--ink-2); margin-bottom: 22px;
        }
        .flow-cap :global(svg) { color: var(--accent); flex-shrink: 0; }

        .actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }

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
        .footstrip .skip { display: inline-flex; align-items: center; gap: 6px; }
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
