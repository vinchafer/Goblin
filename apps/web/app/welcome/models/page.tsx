'use client';

// Models + consumption (Sprint 11 — new step).
// Two-level model names ONLY (Goblin Swift / Goblin Forge) — never a raw
// provider model id. Honest consumption: one monthly build budget; Swift builds
// count simply, Forge draws more. Real Builds figures come from plan-builds.ts
// (trial 33 · build 116 · pro 200 · power 411), the single derived source.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { IArrowL, IArrowR, IShield } from '../_components/icons';
import { patchOnboardingState } from '../_components/onboarding-state';
import { useOnbLang, STR } from '../_components/i18n';
import { PLAN_BUILDS } from '@/lib/plan-builds';

export default function ModelsStepPage() {
  const lang = useOnbLang();
  const t = STR[lang].models;
  const pathname = usePathname() ?? '/welcome/models';
  const nextHref = '/welcome/build';
  const buildsWord = lang === 'en' ? 'Builds' : 'Builds';

  useEffect(() => { patchOnboardingState({ current_step: 3 }); }, []);

  const trialNote = t.trialNote.replace('{trial}', `${PLAN_BUILDS.trial} ${buildsWord}`);
  const plansNote = t.plansNote
    .replace('{build}', `Build ${PLAN_BUILDS.build}`)
    .replace('{pro}', `Pro ${PLAN_BUILDS.pro}`)
    .replace('{power}', `Power ${PLAN_BUILDS.power}`);

  return (
    <div className="models">
      <header className="head">
        <Link href="/welcome/routing" className="back"><IArrowL size={12} /> <span>{t.back}</span></Link>
        <div className="eyebrow"><span className="tick" /><span>{t.eyebrow}</span></div>
        <h1>{t.titleA} <span className="gobl-serif">{t.titleB}</span></h1>
        <p className="lead">{t.lead}</p>
      </header>

      <div className="cards">
        <div className="mcard mcard-default">
          <div className="mhead">
            <span className="mname">{t.swiftName}</span>
            <span className="mbadge badge-default">{t.swiftBadge}</span>
          </div>
          <p>{t.swiftDesc}</p>
          <div className="weight">
            <span className="wlabel">1×</span>
            <span className="wbar"><span className="wfill" style={{ width: '20%' }} /></span>
          </div>
        </div>
        <div className="mcard">
          <div className="mhead">
            <span className="mname">{t.forgeName}</span>
            <span className="mbadge badge-power">{t.forgeBadge}</span>
          </div>
          <p>{t.forgeDesc}</p>
          <div className="weight">
            <span className="wlabel">~4.4×</span>
            <span className="wbar"><span className="wfill wfill-power" style={{ width: '88%' }} /></span>
          </div>
        </div>
      </div>

      <div className="budget">
        <div className="bhead"><IShield size={13} /><span>{t.budgetTitle}</span></div>
        <p>{t.budgetBody}</p>
        <div className="notes">
          <span className="note note-trial">{trialNote}</span>
          <span className="note">{plansNote}</span>
        </div>
      </div>

      {/* D2: frame free (Layer 2) + frontier/BYOK (Layer 3) as exciting choices. */}
      <div className="more">
        <div className="mtitle">{t.moreTitle}</div>
        <Link href="/welcome/provider#free" className="more-row">
          <span className="mr-dot mr-free" />
          <span>{t.moreFree}</span>
          <IArrowR size={13} />
        </Link>
        <Link href="/welcome/provider#frontier" className="more-row">
          <span className="mr-dot mr-frontier" />
          <span>{t.moreFrontier}</span>
          <IArrowR size={13} />
        </Link>
      </div>

      <div className="actions">
        <Link
          href={nextHref}
          className="onb-btn-primary"
          onClick={() => patchOnboardingState({ current_step: 4 })}
        >
          {t.continue} <IArrowR size={14} />
        </Link>
      </div>

      <div className="footstrip">
        <span className="skip"><IShield size={11} />{t.footChange}</span>
        <Link href={nextHref}>{t.footNext}</Link>
      </div>

      <style jsx>{`
        .models { padding: 32px 60px 40px; max-width: 1000px; margin: 0 auto; }
        @media (max-width: 880px) { .models { padding: 22px 18px 32px; } }
        .head { margin-bottom: 24px; max-width: 760px; }
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
        .tick { width: 5px; height: 5px; background: var(--accent); transform: rotate(45deg); display: inline-block; }
        h1 {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: clamp(32px, 4.2vw, 50px);
          letter-spacing: -0.034em; line-height: 1.06; color: var(--ink-1); margin-bottom: 12px;
        }
        .lead { font-size: 16px; color: var(--ink-2); line-height: 1.5; max-width: 60ch; }

        .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
        @media (max-width: 680px) { .cards { grid-template-columns: 1fr; } }
        .mcard {
          background: var(--surface-elev); border: 1px solid var(--line);
          border-radius: var(--radius-lg); padding: 20px 22px;
        }
        .mcard-default { border-color: var(--green); box-shadow: 0 0 0 1px var(--green); }
        .mhead { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
        .mname {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 700; font-size: 18px; letter-spacing: -0.01em; color: var(--ink-1);
        }
        .mbadge {
          font-family: var(--font-mono), monospace; font-size: 9.5px; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; border-radius: var(--radius-xs);
        }
        .badge-default { background: var(--ok-soft); color: var(--ok); border: 1px solid rgba(47,106,71,.32); }
        .badge-power { background: var(--accent-soft); color: var(--gold-deep); border: 1px solid var(--accent-rule); }
        .mcard p { font-size: 14px; color: var(--ink-2); line-height: 1.55; margin: 0 0 14px; }
        .weight { display: flex; align-items: center; gap: 10px; }
        .wlabel {
          font-family: var(--font-mono), monospace; font-size: 12px; font-weight: 600;
          color: var(--ink-2); min-width: 32px;
        }
        .wbar { flex: 1; height: 8px; background: var(--surface-2); border-radius: 4px; overflow: hidden; border: 1px solid var(--line); }
        .wfill { display: block; height: 100%; background: var(--green); border-radius: 4px; }
        .wfill-power { background: var(--accent-bright); }

        .budget {
          background: var(--surface-2); border: 1px solid var(--line);
          border-radius: var(--radius-lg); padding: 18px 20px; margin-bottom: 22px;
        }
        .bhead {
          display: inline-flex; align-items: center; gap: 8px; margin-bottom: 8px;
          font-family: var(--font-onb-display), Manrope, sans-serif; font-weight: 600; font-size: 15px; color: var(--ink-1);
        }
        .bhead :global(svg) { color: var(--accent); }
        .budget p { font-size: 14px; color: var(--ink-2); line-height: 1.55; margin: 0 0 12px; max-width: 70ch; }
        .notes { display: flex; gap: 10px; flex-wrap: wrap; }
        .note {
          font-family: var(--font-mono), monospace; font-size: 11px;
          letter-spacing: 0.04em; color: var(--ink-2);
          padding: 6px 10px; border-radius: var(--radius-xs);
          background: var(--surface-elev); border: 1px solid var(--line);
        }
        .note-trial { color: var(--ok); border-color: rgba(47,106,71,.32); background: var(--ok-soft); }

        .more {
          background: var(--surface-elev); border: 1px solid var(--line);
          border-radius: var(--radius-lg); padding: 16px 18px; margin-bottom: 22px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .mtitle {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 15px; color: var(--ink-1); margin-bottom: 2px;
        }
        .more-row {
          display: flex; align-items: center; gap: 10px;
          font-size: 13.5px; color: var(--ink-2); line-height: 1.45;
          padding: 8px 10px; border-radius: var(--radius);
          border: 1px solid var(--line); background: var(--surface-2);
          transition: border-color .15s, color .15s;
        }
        .more-row:hover { border-color: var(--ink-1); color: var(--ink-1); }
        .more-row span:nth-child(2) { flex: 1; }
        .more-row :global(svg) { color: var(--ink-3); flex-shrink: 0; }
        .mr-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .mr-free { background: var(--ok); }
        .mr-frontier { background: var(--accent-bright); }

        .actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .footstrip {
          margin-top: 24px; border-top: 1px solid var(--line); padding: 14px 0;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          font-family: var(--font-mono), monospace; font-size: 11px; letter-spacing: 0.10em;
          text-transform: uppercase; color: var(--ink-3);
        }
        .footstrip .skip { display: inline-flex; align-items: center; gap: 6px; }
        .footstrip .skip :global(svg) { color: var(--accent); }
        .footstrip a { color: var(--ink-2); }
        .footstrip a:hover { color: var(--ink-1); }
        @media (max-width: 600px) { .footstrip { flex-wrap: wrap; gap: 8px; font-size: 10px; } }
      `}</style>
    </div>
  );
}
