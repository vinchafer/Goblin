import { SectionHead } from '@/components/landing/ui/SectionHead';
import { copy } from '@/components/landing/copy';
import type { Lang } from '@/lib/locale';

export function Faq({ lang }: { lang: Lang }) {
  const c = copy(lang).faq;
  return (
    <section id="faq" className="faq">
      <div className="container">
        <SectionHead
          label={c.label}
          heading={
            <>
              {c.head.a} <span className="serif-italic">{c.head.i}</span>
            </>
          }
          style={{ marginBottom: 48 }}
        />
        <div className="faq-list">
          {c.items.map((it) => (
            <details key={it.q} className="faq-item">
              <summary className="faq-toggle">
                {it.q}
                <span className="plus" aria-hidden="true" />
              </summary>
              <div className="faq-answer">{it.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
