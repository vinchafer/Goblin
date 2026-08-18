import { SectionHead } from '@/components/landing/ui/SectionHead';
import { PhoneMock } from '@/components/landing/sections/PhoneMock';
import { copy } from '@/components/landing/copy';
import type { Lang } from '@/lib/locale';

/**
 * §03 — the product section.
 *
 * This section carried a hand-built CSS mock of the chat + code panels. It was
 * corrected twice (i18n leak, then product-label fidelity) and was still wrong
 * both times, because the thing being corrected was an invention: a drawing of
 * the product made next to the product rather than from it. An expert tester's
 * verdict stood after two passes — "it looks completely different from the real
 * app" — and it shipped a "Draft · 2 files" pill that exists nowhere.
 *
 * Founder call, 2026-08-17: stop patching it. The mock is deleted and replaced
 * with the iPhone mockup from the pitch repo (vinchafer/justgoblin-pitch @
 * 92e6931, `components/mock/MockIPhonePostLogin.tsx`), which was itself built
 * read-only FROM `apps/web` — derived from the product, not imagined beside it.
 * See components/landing/sections/PhoneMock.tsx for the port, and
 * docs/WAVE_MAIL_LANDING_AUDIT.md §2.4 for the element → file:line audit.
 *
 * Every sentence below is a claim about what the screenshot shows, and each one
 * is traceable to the same code the mock is: the composer and its model pill
 * (chat/ChatInput.tsx), the projects list and "What's new"
 * (app/dashboard/page.tsx).
 *
 * U6: the third paragraph claims the mock is "the real screen, drawn from the
 * app's own code". On /de that claim only holds if the mock speaks German too —
 * so PhoneMock takes the language and quotes the app's German branch verbatim.
 */
export function SendToCode({ lang }: { lang: Lang }) {
  const c = copy(lang).product;
  return (
    <section className="stc">
      <div className="container">
        <SectionHead
          num="03"
          total="05"
          label={c.label}
          heading={
            <>
              {c.head.a} <span className="serif-italic">{c.head.i}</span>
            </>
          }
          lead={c.lead}
        />

        <div className="stc-phone">
          <PhoneMock lang={lang} />

          <div className="stc-phone-copy">
            {c.paras.map((p) => (
              <p key={p.strong}>
                <strong>{p.strong}</strong>
                {p.rest.startsWith(',') ? '' : ' '}
                {p.rest}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
