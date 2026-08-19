import { SectionHead } from '@/components/landing/ui/SectionHead';
import { copy } from '@/components/landing/copy';
import type { Lang } from '@/lib/locale';

// Step 04 names connecting your own Vercel up front: the landing used to promise
// direct deploy and the app then asked for a Vercel key, which blindsided a
// tester. Connecting your own Vercel is the FEATURE (the app is yours and stays
// yours). Verified: apps/api/src/services/vercel-service.ts deploys with a
// per-user BYOK token, connected via POST /api/integrations/vercel.

export function HowItWorks({ lang }: { lang: Lang }) {
  const c = copy(lang).how;
  return (
    <section id="how" className="how">
      <div className="container">
        <SectionHead
          num="02"
          total="05"
          label={c.label}
          heading={
            <>
              {c.head.a} <span className="serif-italic">{c.head.i}</span> {c.head.b}
            </>
          }
          lead={
            <>
              {c.leadA} <span className="serif-italic">{c.leadI}</span>
            </>
          }
        />
        <div className="how-grid">
          {c.steps.map((s, i) => (
            <article key={s.title} className="how-card">
              <div className="step">
                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                <span>{c.step}</span>
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
