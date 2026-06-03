'use client';

// Step 0 of 6 — language selection (Sprint 10.5 A-S1).
// App strings stay DE-hardcoded for now; this records the preference
// (migration 0059 users.preferred_lang) and sets the expectation that
// full translations land in a later update.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IArrowR, ICheck } from '../_components/icons';
import { setPreferredLang, type PreferredLang } from '../_components/onboarding-state';

export default function WelcomeStep0Language() {
  const router = useRouter();
  const [lang, setLang] = useState<PreferredLang>('de');
  const [busy, setBusy] = useState(false);

  async function go(choice: PreferredLang | null) {
    if (busy) return;
    setBusy(true);
    await setPreferredLang(choice ?? 'de');
    router.push('/welcome');
  }

  return (
    <div className="step0">
      <div className="lead-col">
        <div className="eyebrow"><span className="tick" />Welcome to Goblin</div>
        <h1>
          Pick your <span className="gold-rule" />{' '}
          <span className="gobl-serif">language.</span>
        </h1>
        <p className="lead">
          Goblin remembers your choice. Full translations are coming in a future
          update — for now the app itself is in German. Marketing pages already
          support both.
        </p>
        <div className="small-print">
          <span className="line"><span className="ic"><ICheck size={10} /></span>Saved to your account</span>
          <span className="line"><span className="ic"><ICheck size={10} /></span>Change it any time in Settings</span>
        </div>
      </div>

      <div className="cards">
        <button
          type="button"
          className={`lang-card ${lang === 'de' ? 'active' : ''}`}
          onClick={() => setLang('de')}
          aria-pressed={lang === 'de'}
        >
          <span className="flag" aria-hidden>🇩🇪</span>
          <span className="body">
            <span className="name">Deutsch</span>
            <span className="note">Empfohlen — die App ist aktuell auf Deutsch.</span>
          </span>
          <span className="radio" aria-hidden>{lang === 'de' ? <ICheck size={13} /> : null}</span>
        </button>

        <button
          type="button"
          className={`lang-card ${lang === 'en' ? 'active' : ''}`}
          onClick={() => setLang('en')}
          aria-pressed={lang === 'en'}
        >
          <span className="flag" aria-hidden>🇬🇧</span>
          <span className="body">
            <span className="name">English</span>
            <span className="note">Marketing is in English; app strings follow soon.</span>
          </span>
          <span className="radio" aria-hidden>{lang === 'en' ? <ICheck size={13} /> : null}</span>
        </button>

        <button type="button" className="cta" onClick={() => go(lang)} disabled={busy}>
          Continue — set up workshop <IArrowR size={15} />
        </button>

        <button type="button" className="skip" onClick={() => go('de')} disabled={busy}>
          Skip — defaults to German
        </button>
      </div>

      <style jsx>{`
        .step0 {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 72px;
          align-items: center;
          padding: 32px 80px 64px;
        }
        @media (max-width: 880px) {
          .step0 { grid-template-columns: 1fr; gap: 24px; padding: 20px 20px 24px; }
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

        .cards { display: flex; flex-direction: column; gap: 12px; }
        .lang-card {
          display: flex; align-items: center; gap: 16px;
          width: 100%; text-align: left;
          background: var(--surface-elev);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 20px 22px;
          cursor: pointer;
          transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease;
          min-height: 44px;
        }
        .lang-card:hover {
          transform: translateY(-1px);
          border-color: var(--line-strong);
          box-shadow: var(--shadow-card);
        }
        .lang-card.active {
          border-color: var(--green);
          box-shadow: 0 0 0 1px var(--green);
        }
        .flag { font-size: 30px; line-height: 1; }
        .lang-card .body { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .lang-card .name {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 20px;
          letter-spacing: -0.02em; color: var(--ink-1);
        }
        .lang-card .note { font-size: 13.5px; color: var(--ink-2); line-height: 1.45; }
        .lang-card .radio {
          width: 24px; height: 24px; flex: none;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 50%;
          border: 1.5px solid var(--line-strong);
          color: var(--bone); background: transparent;
        }
        .lang-card.active .radio {
          background: var(--green); border-color: var(--green);
        }

        .cta {
          margin-top: 6px;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          background: var(--green); color: var(--bone);
          border: 1px solid var(--green);
          border-radius: var(--radius-lg);
          padding: 16px 22px;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 15px;
          cursor: pointer;
          transition: transform .15s ease, opacity .15s ease;
          min-height: 44px;
        }
        .cta:hover { transform: translateY(-1px); }
        .cta:disabled { opacity: .6; cursor: default; transform: none; }
        .skip {
          background: none; border: none; cursor: pointer;
          align-self: center;
          font-size: 13px; color: var(--ink-3); padding: 8px 4px;
        }
        .skip:hover { color: var(--ink-1); }
        .skip:disabled { opacity: .6; cursor: default; }
      `}</style>
    </div>
  );
}
