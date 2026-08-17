import { SectionHead } from '@/components/landing/ui/SectionHead';

const STEPS = [
  {
    num: '01',
    title: 'Log in from any device',
    body: "Your workshop is always ready. Phone, laptop, tablet — it doesn't matter.",
  },
  {
    num: '02',
    title: 'Tell your goblin what to build',
    body: 'Plain English works best. No prompt engineering required.',
  },
  {
    num: '03',
    title: 'Send to Code with one tap',
    body: 'AI output lands directly in your editor. No clipboard, no tab juggling.',
  },
  {
    // TESTER-FEEDBACK (2026-08-17): the landing promised direct deploy, then the
    // app asked for a Vercel key and the tester was blindsided. He is right that
    // the fix belongs here, not in the product — connecting your own Vercel is
    // the FEATURE (the app is yours and stays yours), so it is named up front.
    // Verified: apps/api/src/services/vercel-service.ts deploys with a per-user
    // BYOK token, connected via POST /api/integrations/vercel.
    num: '04',
    title: 'Push to GitHub and go live',
    body: 'One click publishes to your own Vercel account — you connect it once, and it stays yours.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="how">
      <div className="container">
        <SectionHead
          num="02"
          total="05"
          label="How it works"
          heading={
            <>
              Ship in <span className="serif-italic">four</span> steps.
            </>
          }
          lead={
            <>
              Describe what you want and the agent takes it from there — building, verifying, and
              shipping while you watch. Prefer hands-on?{' '}
              <span className="serif-italic">Take control at any step.</span>
            </>
          }
        />
        <div className="how-grid">
          {STEPS.map((s) => (
            <article key={s.num} className="how-card">
              <div className="step">
                <span className="num">{s.num}</span>
                <span>Step</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
