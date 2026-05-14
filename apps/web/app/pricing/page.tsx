import { GeoPricingSection } from '@/components/billing/geo-pricing-section';
import { FAQ } from '@/components/landing/faq';
import Link from 'next/link';

export default function PricingPage() {
  return (
    <div style={{ background: 'var(--cream)', minHeight: '100dvh' }}>
      {/* Minimal nav */}
      <nav style={{ padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <Link href="/" style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 700, color: 'var(--ochre)', textDecoration: 'none', letterSpacing: '-0.3px' }}>
          Goblin<span style={{ opacity: 0.6 }}>.</span>
        </Link>
        <Link href="/login" style={{
          padding: '8px 18px', background: 'var(--moss)', color: '#fff',
          borderRadius: 8, fontSize: 13, fontWeight: 600,
          fontFamily: 'DM Sans, sans-serif', textDecoration: 'none',
        }}>
          Get started
        </Link>
      </nav>

      <GeoPricingSection />
      <FAQ />
    </div>
  );
}
