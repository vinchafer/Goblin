import { Nav } from '@/components/landing/nav';
import { Hero } from '@/components/landing/hero';
import { TrustedBy } from '@/components/landing/trusted-by';
import { TheProblem } from '@/components/landing/the-problem';
import { HowItWorks } from '@/components/landing/how-it-works';
import { SendToCodeDemo } from '@/components/landing/send-to-code-demo';
import { IslandFlow } from '@/components/landing/island-flow';
import { GeoPricingSection } from '@/components/billing/geo-pricing-section';
import { LandingFaq } from '@/components/landing/faq';
import { LogoOutro } from '@/components/landing/logo-outro';
import { Footer } from '@/components/landing/footer';

export default function Home() {
  return (
    <div style={{ background: 'var(--cream)' }}>
      <Nav />
      <Hero />
      <TrustedBy />
      <TheProblem />
      <HowItWorks />
      <SendToCodeDemo />
      <IslandFlow />
      <GeoPricingSection />
      <LandingFaq />
      <LogoOutro />
      <Footer />
    </div>
  );
}
