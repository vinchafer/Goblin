import { Hero } from "@/components/landing/hero";
import { TheProblem } from "@/components/landing/the-problem";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ModelRoutingExplainer } from "@/components/landing/model-routing-explainer";
import { PricingCards } from "@/components/billing/pricing-cards";
import { FAQ } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <TheProblem />
      <HowItWorks />
      <ModelRoutingExplainer />

      <section id="pricing" className="py-24 px-4 max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-semibold text-center mb-12" style={{ color: 'var(--goblin-slate)' }}>
          Pick your goblin's appetite.
        </h2>
        <PricingCards currentPlan="seed" onUpgrade={() => {}} />
        <p className="text-center mt-6 text-sm" style={{ color: 'var(--goblin-gray)' }}>
          No contracts. Cancel in one click. Keep your code.
        </p>
      </section>

      <FAQ />
      <Footer />
    </main>
  );
}