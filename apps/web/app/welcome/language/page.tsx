'use client';

// Step 0 of 6 — language selection (Sprint 10.5 A-S1, minimized 10.7-5).
// Records users.preferred_lang (migration 0059). No flags, no apology copy:
// EN and DE are presented as equal first-class choices. Compact single column.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IArrowR, ICheck } from '../_components/icons';
import { setPreferredLang, type PreferredLang } from '../_components/onboarding-state';
import { STR } from '../_components/i18n';

export default function WelcomeStep0Language() {
  const router = useRouter();
  const [lang, setLang] = useState<PreferredLang>('de');
  const [busy, setBusy] = useState(false);
  const t = STR[lang].lang;

  async function go(choice: PreferredLang) {
    if (busy) return;
    setBusy(true);
    await setPreferredLang(choice);
    router.push('/welcome');
  }

  const OPTIONS: { id: PreferredLang; label: string }[] = [
    { id: 'en', label: 'English' },
    { id: 'de', label: 'Deutsch' },
  ];

  return (
    <div className="step0">
      <div className="panel">
        <div className="eyebrow"><span className="tick" />{t.eyebrow}</div>
        <h1>{t.title}</h1>

        <div className="rows" role="radiogroup" aria-label="Language">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={lang === o.id}
              className={`row ${lang === o.id ? 'active' : ''}`}
              onClick={() => setLang(o.id)}
            >
              <span className="dot" aria-hidden>{lang === o.id ? <ICheck size={12} /> : null}</span>
              <span className="name">{o.label}</span>
            </button>
          ))}
        </div>

        <p className="hint">{t.hint}</p>

        <button type="button" className="cta" onClick={() => go(lang)} disabled={busy}>
          {t.cta} <IArrowR size={15} />
        </button>
      </div>

      <style jsx>{`
        .step0 {
          display: flex; justify-content: center; align-items: flex-start;
          padding: 48px 20px 64px;
        }
        .panel { width: 100%; max-width: 420px; }
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
          font-size: clamp(26px, 4vw, 34px);
          letter-spacing: -0.03em; line-height: 1.1;
          color: var(--ink-1); margin: 0 0 24px;
        }
        .rows { display: flex; flex-direction: column; gap: 10px; }
        .row {
          display: flex; align-items: center; gap: 14px;
          width: 100%; text-align: left;
          background: var(--surface-elev);
          border: 1px solid var(--line);
          border-radius: var(--radius-md, 12px);
          padding: 14px 16px;
          cursor: pointer; min-height: 44px;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .row:hover { border-color: var(--line-strong); }
        .row.active { border-color: var(--green); box-shadow: 0 0 0 1px var(--green); }
        .row .dot {
          width: 22px; height: 22px; flex: none;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 50%;
          border: 1.5px solid var(--line-strong);
          color: var(--bone); background: transparent;
        }
        .row.active .dot { background: var(--green); border-color: var(--green); }
        .row .name {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 16px;
          letter-spacing: -0.01em; color: var(--ink-1);
        }
        .hint { font-size: 12.5px; color: var(--ink-3); margin: 14px 0 20px; }
        .cta {
          width: 100%;
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
