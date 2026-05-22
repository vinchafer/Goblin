import { Nav } from '@/components/landing-v2/sections/Nav';
import { Hero } from '@/components/landing-v2/sections/Hero';

export default function LandingV2Page() {
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <Nav />
      <main id="main">
        <Hero />
      </main>
    </>
  );
}
