import { Manrope, JetBrains_Mono, Instrument_Serif } from 'next/font/google';
import { GoblinMarkSprite } from '@/components/landing/brand/GoblinMarkSprite';
import { Nav } from '@/components/landing/sections/Nav';
import { Hero } from '@/components/landing/sections/Hero';
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
    "The AI is built in — no keys, no setup, no token counter. Tell it what you want, it ships. The cloud workshop for builders who don't wait for a laptop.",
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
          <TrustedBy />
          <Problem />
          <HowItWorks />
          <SendToCode />
          <AgentFlow />
          <IslandFlow />
          <Proof />
          <Pricing />
          <Faq />
          <Outro />
        </main>
        <Footer />
      </div>
    </>
  );
}
