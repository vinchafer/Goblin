import { Nav } from '@/components/landing-v2/sections/Nav';
import { Hero } from '@/components/landing-v2/sections/Hero';
import { TrustedBy } from '@/components/landing-v2/sections/TrustedBy';
import { Problem } from '@/components/landing-v2/sections/Problem';
import { HowItWorks } from '@/components/landing-v2/sections/HowItWorks';
import { SendToCode } from '@/components/landing-v2/sections/SendToCode';
import { IslandFlow } from '@/components/landing-v2/sections/IslandFlow';

export default function LandingV2Page() {
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <Nav />
      <main id="main">
        <Hero />
        <TrustedBy />
        <Problem />
        <HowItWorks />
        <SendToCode />
        <IslandFlow />
      </main>
    </>
  );
}
