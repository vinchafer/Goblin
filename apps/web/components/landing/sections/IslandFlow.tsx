import { SectionHead } from '@/components/landing/ui/SectionHead';
import { copy } from '@/components/landing/copy';
import type { Lang } from '@/lib/locale';
import type { ReactNode } from 'react';

// TESTER-FEEDBACK (2026-08-17): step 08 was "Preview — See your live site the
// moment it ships". Preview is being removed from the product, and a landing
// page must not promise a surface that is on its way out — so the step is gone
// and the flow is seven steps, not eight. The live URL is still the endpoint of
// the story; it arrives in step 07 as a notification, which is what actually
// happens.
//
// U6: titles and bodies come from components/landing/copy.ts (both languages).
// The icons stay here — they are marks, not copy, and are identical in every
// language. Order is the contract: ICONS[i] belongs to copy.island.steps[i], and
// the parity test keeps that array at seven entries in both languages.
const ICONS: ReactNode[] = [
  (
      <svg key="01" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <line x1="11" y1="18" x2="13" y2="18" />
      </svg>
  ),
  (
      <svg key="02" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
  ),
  (
      <svg key="03" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
  ),
  (
      <svg key="04" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
  ),
  (
      <svg key="05" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="18" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
  ),
  (
      <svg key="06" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <polygon points="12 2 22 20 2 20 12 2" />
      </svg>
  ),
  (
      <svg key="07" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
  ),
];

export function IslandFlow({ lang }: { lang: Lang }) {
  const c = copy(lang).island;
  return (
    <section className="island">
      <div className="island-inner">
        <SectionHead
          num="04"
          total="05"
          label={c.label}
          heading={
            <>
              {c.head.a} <span className="serif-italic">{c.head.i}</span>
            </>
          }
          lead={c.lead}
        />

        <div className="island-steps">
          {c.steps.map((s, i) => (
            <div className="island-step" key={s.title}>
              <div className="ring">{ICONS[i]}</div>
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h4>{s.title}</h4>
                <p>{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="island-foot">
          <span className="rule" aria-hidden="true" />
          <span className="dot" aria-hidden="true" />
          {c.foot}
          <span className="dot" aria-hidden="true" />
          <span className="rule" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
