import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { TheProblem } from "@/components/landing/the-problem";
import { SendToCodeDemo } from "@/components/landing/send-to-code-demo";
import { IslandFlow } from "@/components/landing/island-flow";
import { ModelRoutingExplainer } from "@/components/landing/model-routing-explainer";
import { PricingCards } from "@/components/billing/pricing-cards";
import { FAQ } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <main>
      <Nav />
      <Hero />
      <TheProblem />
      <SendToCodeDemo />
      <IslandFlow />
      <ModelRoutingExplainer />

      <section
        id="pricing"
        className="py-24 px-4"
        style={{ backgroundColor: "var(--goblin-cream2)" }}
      >
        <div className="max-w-5xl mx-auto">
          <h2
            className="font-fraunces font-bold text-center mb-4"
            style={{
              fontSize: "clamp(24px, 4vw, 40px)",
              color: "var(--goblin-bark)"
            }}
          >
            Pick your goblin&apos;s appetite.
          </h2>
          <p
            className="text-center mb-12 text-sm"
            style={{
              color: "var(--goblin-meta)",
              fontFamily: "var(--font-dm-sans)"
            }}
          >
            No contracts. Cancel in one click. Keep your code.
          </p>
          <PricingCards currentPlan={undefined} showUpgrade={false} />
        </div>
      </section>

      <FAQ />
      <Footer />
    </main>
  );
}
