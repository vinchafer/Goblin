import { SectionHead } from '@/components/landing/ui/SectionHead';
import { PhoneMock } from '@/components/landing/sections/PhoneMock';

/**
 * §03 — the product section.
 *
 * ── THIRD PASS, AND THE LAST ONE THAT PATCHES ───────────────────────────────
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
 * See components/landing/sections/PhoneMock.tsx for the port and the four
 * drifts corrected during it, and docs/WAVE_MAIL_LANDING_AUDIT.md §2.4 for the
 * element → file:line → kept/removed audit of every visible affordance.
 *
 * ── WHY THE HEADING CHANGED TOO ─────────────────────────────────────────────
 * The old heading ("One tap. Code lands in your editor.") described the old
 * picture. The ported mock shows the phone dashboard — the composer, the
 * projects, what's new — so leaving that heading above it would have recreated
 * exactly the defect this section is being fixed for: words promising one thing
 * while the picture shows another. The Send-to-Code claim is not dropped from
 * the site; it keeps its own places (Problem P·03, HowItWorks step 03,
 * IslandFlow step 03) where the words stand alone and no picture contradicts
 * them. Flagged for the founder at PR review — this is copy, and revertible.
 *
 * Every sentence below is a claim about what the screenshot shows, and each one
 * is traceable to the same code the mock is: the composer and its model pill
 * (chat/ChatInput.tsx), the projects list and "What's new"
 * (app/dashboard/page.tsx).
 */
export function SendToCode() {
  return (
    <section className="stc">
      <div className="container">
        <SectionHead
          num="03"
          total="05"
          label="The product"
          heading={
            <>
              This is Goblin <span className="serif-italic">on your phone.</span>
            </>
          }
          lead="Not a companion app, not a remote desktop. The whole workshop, on the screen you already have with you."
        />

        <div className="stc-phone">
          <PhoneMock />

          <div className="stc-phone-copy">
            <p>
              <strong>You start by saying what you want.</strong> The composer is the
              same one the desktop uses — pick a model, attach a file, or just type.
              No prompt engineering, no setup screen first.
            </p>
            <p>
              <strong>Your projects live here.</strong> Every one of them opens into
              chat, code and publishing from this list — the phone is not a viewer for
              work you did somewhere else.
            </p>
            <p>
              <strong>This is the real screen</strong>, drawn from the app&apos;s own
              code rather than staged for the page. What you see is what loads after
              you sign in.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
