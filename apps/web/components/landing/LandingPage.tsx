import { GoblinMarkSprite } from '@/components/landing/brand/GoblinMarkSprite';
import { Nav } from '@/components/landing/sections/Nav';
import { Hero } from '@/components/landing/sections/Hero';
import { Runtime } from '@/components/landing/sections/Runtime';
import { InstallAppBlock } from '@/components/landing/sections/InstallAppBlock';
import { TrustedBy } from '@/components/landing/sections/TrustedBy';
import { Problem } from '@/components/landing/sections/Problem';
import { HowItWorks } from '@/components/landing/sections/HowItWorks';
import { SendToCode } from '@/components/landing/sections/SendToCode';
import { AgentFlow } from '@/components/landing/sections/AgentFlow';
import { IslandFlow } from '@/components/landing/sections/IslandFlow';
import { Proof } from '@/components/landing/sections/Proof';
import { Pricing } from '@/components/landing/sections/Pricing';
import { Faq } from '@/components/landing/sections/Faq';
import { Outro } from '@/components/landing/sections/Outro';
import { Footer } from '@/components/landing/sections/Footer';
import type { Lang } from '@/lib/locale';
import '@/styles/landing.css';

/**
 * U6 — the landing body, once, for both routes.
 *
 * `/` and `/de` are the same document in two languages, so the section ORDER
 * lives here rather than being duplicated per route. That is not only tidiness:
 * the order IS the fix this whole strand is about (LANDING_MESSAGING_FIX_v2 §4),
 * and two copies of it would drift — the German page would quietly stop matching
 * the English one section move at a time.
 */
export function LandingPage({ lang }: { lang: Lang }) {
  return (
    <>
      <GoblinMarkSprite />
      <a href="#main" className="skip-link">Skip to content</a>
      <Nav lang={lang} />
      <main id="main">
        <Hero lang={lang} />
        {/* LANDING-MESSAGING v2 §4.1 — the execution model is stated once, in
            full, at the position where the question forms: directly under the
            hero and BEFORE the install card, so "install" is read as "adds an
            icon" rather than "downloads a model". */}
        <Runtime lang={lang} />
        <InstallAppBlock lang={lang} />
        <Problem lang={lang} />
        <HowItWorks lang={lang} />
        <SendToCode lang={lang} />
        <AgentFlow lang={lang} />
        <IslandFlow lang={lang} />
        <Proof lang={lang} />
        <Pricing lang={lang} />
        {/* LANDING-MESSAGING v2 §4.2 / D-2 — the provider strip used to sit in
            the upper third, directly under the answer to "where does the AI
            run". Seven vendor names are visually louder than body copy, so the
            strongest signal on the upper page said "you bring keys" and
            contradicted the hero. It reads here directly after Pricing's own
            BYOK line: Layer 1 first and loud, Layer 3 later and quiet. */}
        <TrustedBy lang={lang} />
        <Faq lang={lang} />
        <Outro lang={lang} />
      </main>
      <Footer lang={lang} />
    </>
  );
}
