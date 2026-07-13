import { SectionHead } from '@/components/landing/ui/SectionHead';
import type { ReactNode } from 'react';

type Step = { num: string; title: string; body: string; icon: ReactNode };

const STEPS: Step[] = [
  {
    num: '01',
    title: 'Open Goblin',
    body: 'On your phone, tablet, or laptop',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <line x1="11" y1="18" x2="13" y2="18" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'Chat with AI',
    body: 'Describe what you want to build',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'Send to Code',
    body: 'One tap. No copy-paste.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    num: '04',
    title: 'Build',
    body: 'You decide what runs and when',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  },
  {
    num: '05',
    title: 'Push to GitHub',
    body: 'Automatic, with commit messages',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="18" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    ),
  },
  {
    num: '06',
    title: 'Deploy to Vercel',
    body: 'Live in seconds',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <polygon points="12 2 22 20 2 20 12 2" />
      </svg>
    ),
  },
  {
    num: '07',
    title: 'Live notification',
    body: 'Pushed to your phone when it ships',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    num: '08',
    title: 'Preview',
    body: 'See your live site the moment it ships',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
];

export function IslandFlow() {
  return (
    <section className="island">
      <div className="island-inner">
        <SectionHead
          num="04"
          total="05"
          label="The island flow"
          heading={
            <>
              From phone to <span className="serif-italic">production.</span>
            </>
          }
          lead="Eight steps from input to a live URL. Whatever device, wherever you are."
        />

        <div className="island-steps">
          {STEPS.map((s) => (
            <div className="island-step" key={s.num}>
              <div className="ring">{s.icon}</div>
              <span className="num">{s.num}</span>
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
          Works on any device, from anywhere
          <span className="dot" aria-hidden="true" />
          <span className="rule" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
