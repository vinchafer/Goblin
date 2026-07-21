import { GeoPricingSection } from '@/components/billing/geo-pricing-section';
import { FAQ } from '@/components/landing/faq';
import Link from 'next/link';

export default function PricingPage() {
  return (
    <div style={{ background: 'var(--paper)', minHeight: '100dvh' }}>
      {/* Minimal nav — FOUNDER-WALK-3 U2: reserve the top inset (+ landscape L/R)
          so the wordmark/CTA clear the iOS status bar when pricing is opened in a
          standalone PWA. */}
      <nav style={{ padding: '20px 40px', paddingTop: 'max(20px, env(safe-area-inset-top))', paddingLeft: 'max(40px, env(safe-area-inset-left))', paddingRight: 'max(40px, env(safe-area-inset-right))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <Link href="/" style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 700, color: 'var(--brand-gold)', textDecoration: 'none', letterSpacing: '-0.3px' }}>
          Goblin<span style={{ opacity: 0.6 }}>.</span>
        </Link>
        <Link href="/login" style={{
          padding: '8px 18px', background: 'var(--brand-green)', color: '#fff',
          borderRadius: 8, fontSize: 13, fontWeight: 600,
          fontFamily: 'var(--font-sans)', textDecoration: 'none',
        }}>
          Get started
        </Link>
      </nav>

      <GeoPricingSection />
      <FAQ />
    </div>
  );
}
