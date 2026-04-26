import { Nav } from '@/components/landing/nav';
import { Hero } from '@/components/landing/hero';
import { TheProblem } from '@/components/landing/the-problem';
import { SendToCodeDemo } from '@/components/landing/send-to-code-demo';
import { IslandFlow } from '@/components/landing/island-flow';
import { PricingSection } from '@/components/landing/pricing-section';
import { Footer } from '@/components/landing/footer';

export default function Home() {
  return (
    <>
      <Nav />
      <Hero />
      <TheProblem />
      <SendToCodeDemo />
      <IslandFlow />
      <PricingSection />
      <Footer />
    </>
  );
}
