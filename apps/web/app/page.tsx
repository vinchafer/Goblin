import { Nav } from '@/components/landing/nav';
import { Hero } from '@/components/landing/hero';
import { TheProblem } from '@/components/landing/the-problem';
import { HowItWorks } from '@/components/landing/how-it-works';
import { SendToCodeDemo } from '@/components/landing/send-to-code-demo';
import { IslandFlow } from '@/components/landing/island-flow';
import { PricingSection } from '@/components/landing/pricing-section';
import { LandingFaq } from '@/components/landing/faq';
import { Footer } from '@/components/landing/footer';

export default function Home() {
  return (
    <div style={{ background: 'var(--cream)' }}>
      <Nav />
      <Hero />
      <TheProblem />
      <HowItWorks />
      <SendToCodeDemo />
      <IslandFlow />
      <PricingSection />
      <LandingFaq />
      <Footer />
    </div>
  );
}
