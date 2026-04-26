'use client';
import { useRouter } from 'next/navigation';

export function PricingSection() {
  const router = useRouter();
  const plans = [
    { name: 'Seed', price: 9, features: ['200 requests / month','Unlimited projects','BYOK — all 8 providers','GitHub push','5GB Hetzner storage','Community Discord'], featured: false, cta: 'Get started' },
    { name: 'Craft', price: 19, features: ['800 requests / month','Unlimited projects','BYOK + priority routing','GitHub + Vercel deploy','20GB storage','Email support'], featured: true, cta: 'Start with Craft →' },
    { name: 'Forge', price: 39, features: ['3,000 requests / month','Unlimited projects','All routing layers','All deploy targets','100GB storage','Priority 24h support'], featured: false, cta: 'Go Forge' },
  ];
  return (
    <section id="pricing" style={{ background: 'var(--cream2)', padding: '100px 40px' }}>
      <div style={{ textAlign: 'center', marginBottom: 64 }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' as const, color: 'var(--ochre)', marginBottom: 16 }}>Pricing</div>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 'clamp(36px,5vw,56px)', color: 'var(--moss)', lineHeight: 1.05, letterSpacing: '-2px', fontWeight: 900, marginBottom: 16 }}>
          Pick your goblin&apos;s <em style={{ fontStyle: 'italic', color: 'var(--ochre)' }}>appetite.</em>
        </h2>
        <p style={{ fontSize: 16, color: 'var(--meta)', maxWidth: 440, margin: '0 auto', fontWeight: 300 }}>No contracts. Cancel in one click. Keep your code forever.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, maxWidth: 920, margin: '0 auto' }}>
        {plans.map(p => (
          <div key={p.name} style={{
            background: '#fff', borderRadius: 14, padding: 32, position: 'relative',
            border: p.featured ? '2px solid var(--moss)' : '1px solid rgba(0,0,0,0.08)',
            boxShadow: p.featured ? '0 8px 32px rgba(30,58,28,0.12)' : 'none',
          }}>
            {p.featured && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--moss)', color: 'var(--ochre)', fontSize: 10, fontWeight: 600, padding: '4px 14px', borderRadius: 100, letterSpacing: 1, textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const }}>Most popular</div>}
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, color: 'var(--moss)', fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 48, fontWeight: 300, color: 'var(--text)', lineHeight: 1, margin: '12px 0 4px' }}>
              <sup style={{ fontSize: 18, fontFamily: 'DM Sans, sans-serif', verticalAlign: 'super' }}>$</sup>{p.price}
            </div>
            <div style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 24 }}>per month</div>
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {p.features.map(f => (
                <li key={f} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(30,58,28,0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--moss)', flexShrink: 0 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button onClick={() => router.push('/login')} style={{
              width: '100%', padding: 11, borderRadius: 9, fontSize: 14, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              background: p.featured ? 'var(--moss)' : 'transparent',
              color: p.featured ? '#fff' : 'var(--text)',
              border: p.featured ? 'none' : '1px solid rgba(0,0,0,0.12)',
            }}>{p.cta}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
