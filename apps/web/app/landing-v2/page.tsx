import { Nav } from '@/components/landing-v2/sections/Nav';

export default function LandingV2Page() {
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <Nav />
      <main id="main">
        <div style={{ padding: '160px 32px', textAlign: 'center' }}>
          <h1 className="h1">landing-v2 — sections wiring</h1>
        </div>
      </main>
    </>
  );
}
