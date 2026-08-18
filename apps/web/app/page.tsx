import { Manrope, JetBrains_Mono, Instrument_Serif } from 'next/font/google';
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
import '@/styles/landing.css';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--lp2-font-sans',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--lp2-font-mono',
  display: 'swap',
});
const serif = Instrument_Serif({
  subsets: ['latin'],
  style: ['italic', 'normal'],
  weight: '400',
  variable: '--lp2-font-serif',
  display: 'swap',
});

const PRE_PAINT_SCRIPT = `(function(){
  try {
    var t = localStorage.getItem('goblin-theme');
    if (t === 'dark') document.documentElement.classList.add('lp2-dark');
    else if (t === 'light') document.documentElement.classList.add('lp2-light');
  } catch(e) {}
})();`;

export const metadata = {
  title: 'Goblin — The cloud workshop for builders',
  description:
    "Everything runs on our servers — the models too. No keys, no setup, no token counter. Tell it what you want, it ships. The cloud workshop for builders who don't wait for a laptop.",
};

export default function Home() {
  const rootClassName = `landing-root ${manrope.variable} ${mono.variable} ${serif.variable}`;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
      <div
        className={rootClassName}
        data-theme="light"
        data-accent="restrained"
        data-density="compact"
      >
        <GoblinMarkSprite />
        <a href="#main" className="skip-link">Skip to content</a>
        <Nav />
        <main id="main">
          <Hero />
          {/* LANDING-MESSAGING v2 §4.1 — the execution model is stated once, in
              full, at the position where the question forms: directly under the
              hero and BEFORE the install card, so "install" is read as "adds an
              icon" rather than "downloads a model". Absorbs the old
              AiLocationNote, which said the right thing too quietly and too
              late. */}
          <Runtime />
          <InstallAppBlock lang="en" />
          <Problem />
          <HowItWorks />
          <SendToCode />
          <AgentFlow />
          <IslandFlow />
          <Proof />
          <Pricing />
          {/* LANDING-MESSAGING v2 §4.2 / D-2 — the provider strip used to sit in
              the upper third, directly under the answer to "where does the AI
              run". Seven vendor names are visually louder than body copy, so the
              strongest signal on the upper page said "you bring keys" and
              contradicted the hero. Moved verbatim to here: BYOK is an advanced
              add-on, and it now reads directly after Pricing's own BYOK line
              ("BYOK users bring their own API keys · Goblin charges $0 extra for
              inference"). Layer 1 first and loud, Layer 3 later and quiet. */}
          <TrustedBy />
          <Faq />
          <Outro />
        </main>
        <Footer />
      </div>
    </>
  );
}
