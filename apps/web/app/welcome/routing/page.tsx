'use client';

// Step 3 of 6 — "How Goblin works" (Sprint 10.5 A-S6).
// Reframed around the THREE-LAYER model so a user who only brought a free
// Groq key understands they DON'T need Claude+Gemini+Groq all at once, and
// learns what actually differentiates Goblin (Layer 2, Goblin-Hosted, Q1 2027).
//
// Onboarding completion still seeds the server-side default fallback chain.
// Routing can be tuned later in Settings → Routing; no in-flow detour here.

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getAuthHeaders, API_URL } from '@/lib/api';
import { IArrowL, IArrowR, ICheck, IShield } from '../_components/icons';
import { patchOnboardingState } from '../_components/onboarding-state';
import { useOnbLang, STR } from '../_components/i18n';

// Tone per layer index (0 active, 1 soon, 2 optional) — drives card styling.
// Copy itself lives in i18n.ts; speak PROVIDERS + tiers, never model versions.
const TONES = ['active', 'soon', 'optional'] as const;

function RoutingInner() {
  const lang = useOnbLang();
  const t = STR[lang].layers;
  const [waitlist, setWaitlist] = useState<'idle' | 'busy' | 'done'>('idle');
  const search = useSearchParams();
  const path = search?.get('path') === 'a' ? 'a' : 'b';
  // After the 10.7-6 swap the layer-story is Step 2 and the provider step
  // follows it. Carry the path choice forward so the provider step still
  // pre-expands the right hero card.
  const nextHref = `/welcome/provider?path=${path}`;

  useEffect(() => {
    patchOnboardingState({ current_step: 2 });
  }, []);

  async function joinWaitlist() {
    if (waitlist !== 'idle') return;
    setWaitlist('busy');
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/api/waitlist/goblin-hosted`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({}),
      });
    } catch {
      // Best-effort — still confirm to the user; founder can reconcile later.
    }
    setWaitlist('done');
  }

  return (
    <div className="step3">
      <header className="head">
        <Link href="/welcome" className="back">
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
                {n === '3' && (
                  <Link
                    href={nextHref}
                    className="layer3-link"
                    onClick={() => patchOnboardingState({ current_step: 3 })}
                  >
                    {t.l3cta} <IArrowR size={13} />
                  </Link>
                )}
                {tone === 'soon' && (
                  <button
                    type="button"
                    className={`waitlist ${waitlist === 'done' ? 'joined' : ''}`}
                    onClick={joinWaitlist}
                    disabled={waitlist !== 'idle'}
                  >
                    {waitlist === 'done'
                      ? <><ICheck size={13} /> {t.waitlistDone}</>
                      : waitlist === 'busy'
                        ? t.waitlistBusy
                        : <>{t.waitlistIdle} <IArrowR size={13} /></>}
                  </button>
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
        <span className="fstep soon">{t.flow.l2}</span>
        <IArrowR size={13} />
        <span className="fstep">{t.flow.l3}</span>
      </div>
      <p className="flow-cap">
        <IShield size={11} /> {t.flowCap}
      </p>

      <div className="actions">
        <Link
          href={nextHref}
          className="btn-primary"
          onClick={() => patchOnboardingState({ current_step: 3 })}
        >
          {t.continue} <IArrowR size={14} />
        </Link>
        <Link
          href={nextHref}
          className="btn-ghost"
          onClick={() => patchOnboardingState({ current_step: 3 })}
        >
          {t.skip}
        </Link>
      </div>

      <div className="footstrip">
        <span className="skip"><IShield size={11} />{t.footChange}</span>
        <span className="gobl-mono">/welcome/routing · {STR[lang].chrome.step} 02 {STR[lang].chrome.of} 06</span>
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
        .layer-soon {
          background:
            radial-gradient(120% 140% at 100% 0%, var(--accent-soft) 0%, transparent 55%),
            var(--surface-elev);
          border-color: var(--accent-rule);
        }
        .lnum {
          width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 700; font-size: 20px;
          background: var(--surface-2); color: var(--ink-2);
          border: 1px solid var(--line-strong);
        }
        .layer-active .lnum { background: var(--green); color: var(--bone); border-color: var(--green); }
        .layer-soon .lnum { background: var(--accent-bright); color: var(--green); border-color: var(--accent-bright); }
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
        .badge-soon { background: var(--accent-soft); color: var(--gold-deep); border: 1px solid var(--accent-rule); }
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
        .waitlist {
          margin-top: 12px;
          display: inline-flex; align-items: center; gap: 7px;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 13px;
          padding: 9px 14px; border-radius: var(--radius);
          background: var(--green); color: var(--bone);
          border: 1px solid var(--green); cursor: pointer;
        }
        .waitlist:hover { background: #081710; }
        .waitlist.joined { background: var(--ok-soft); color: var(--ok); border-color: rgba(47,106,71,.32); cursor: default; }
        .waitlist:disabled { cursor: default; }

        .layer3-link {
          margin-top: 12px;
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 13px;
          color: var(--green); text-decoration: none;
          padding: 8px 13px; border-radius: var(--radius);
          border: 1px solid var(--line-strong); background: transparent;
          width: fit-content;
          transition: border-color .15s, color .15s;
        }
        .layer3-link:hover { border-color: var(--green); }

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
        .fstep.soon { color: var(--gold-deep); border-color: var(--accent-rule); }
        .flow-cap {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 12.5px; color: var(--ink-2); margin-bottom: 22px;
        }
        .flow-cap :global(svg) { color: var(--accent); flex-shrink: 0; }

        .actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .btn-primary, .btn-ghost {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 14.5px;
          padding: 14px 22px; border-radius: var(--radius);
          border: 1px solid transparent; cursor: pointer; text-decoration: none;
        }
        .btn-primary { background: var(--green); color: var(--bone); border-color: var(--green); }
        .btn-primary:hover { background: #081710; }
        .btn-ghost { background: transparent; color: var(--ink-2); border-color: var(--line-strong); }
        .btn-ghost:hover { color: var(--ink-1); border-color: var(--ink-1); }

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

export default function RoutingStepPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }} />}>
      <RoutingInner />
    </Suspense>
  );
}
