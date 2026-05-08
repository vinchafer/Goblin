'use client';
import Link from 'next/link';
import { Icons } from '@/components/ui/icons';

const PLANS = [
  {
    id: 'seed',
    name: 'Seed',
    price: 9,
    description: 'For weekend builders and experimenters.',
    features: [
      '200 requests / month',
      'Unlimited projects',
      'BYOK — all 8 providers',
      'GitHub push integration',
      '5 GB Hetzner storage',
      'Community Discord',
    ],
    featured: false,
    cta: 'Get started',
  },
  {
    id: 'craft',
    name: 'Craft',
    price: 19,
    description: 'For builders who ship every week.',
    features: [
      '800 requests / month',
      'Unlimited projects',
      'BYOK + priority routing',
      'GitHub + Vercel deploy',
      '20 GB storage',
      'Email support',
    ],
    featured: true,
    cta: 'Start with Craft →',
  },
  {
    id: 'forge',
    name: 'Forge',
    price: 39,
    description: 'For teams and power builders.',
    features: [
      '3,000 requests / month',
      'Unlimited projects',
      'All routing layers',
      'All deploy targets',
      '100 GB storage',
      'Priority 24 h support',
    ],
    featured: false,
    cta: 'Go Forge',
  },
];

export function PricingSection() {
  return (
    <section id="pricing" style={{ background: 'var(--cream2)', padding: '100px 40px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--ochre)', marginBottom: 16, fontFamily: 'DM Sans, sans-serif' }}>Pricing</div>
          <h2 style={{
            fontFamily: 'Fraunces, serif', fontSize: 'clamp(28px, 4vw, 44px)',
            color: 'var(--moss)', lineHeight: 1.1, letterSpacing: '-1.5px', fontWeight: 700, marginBottom: 16,
          }}>
            Pick your goblin&apos;s <em style={{ fontStyle: 'italic', color: 'var(--ochre)' }}>appetite.</em>
          </h2>
          <p style={{ fontSize: 16, color: 'var(--meta)', maxWidth: 440, margin: '0 auto', fontWeight: 300, lineHeight: 1.6 }}>
            No contracts. Cancel in one click. Keep your code forever.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 20 }}>
          {PLANS.map(p => (
            <div key={p.id} style={{
              background: 'var(--panel)', borderRadius: 16, padding: '32px 28px',
              position: 'relative', display: 'flex', flexDirection: 'column',
              border: p.featured ? '2px solid var(--moss)' : '1px solid var(--border)',
              boxShadow: p.featured ? '0 16px 48px rgba(30,58,28,0.12)' : 'none',
            }}>
              {p.featured && (
                <div style={{
                  position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--moss)', color: 'var(--ochre)',
                  fontSize: 10, fontWeight: 700, padding: '4px 14px', borderRadius: 100,
                  letterSpacing: 1, textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
                  fontFamily: 'DM Sans, sans-serif',
                }}>
                  Most popular
                </div>
              )}

              <div style={{ marginBottom: 4 }}>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, color: 'var(--moss)', fontWeight: 700 }}>{p.name}</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--meta)', fontWeight: 300, marginBottom: 20 }}>{p.description}</div>

              <div style={{ marginBottom: 28 }}>
                <span style={{ fontFamily: 'Fraunces, serif', fontSize: 48, fontWeight: 300, color: 'var(--text)', lineHeight: 1, letterSpacing: '-2px' }}>
                  <sup style={{ fontSize: 18, fontFamily: 'DM Sans, sans-serif', verticalAlign: 'super', fontWeight: 400 }}>$</sup>
                  {p.price}
                </span>
                <span style={{ fontSize: 13, color: 'var(--meta)', marginLeft: 4 }}>per month</span>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {p.features.map(f => (
                  <li key={f} style={{ fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif' }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%', background: 'rgba(30,58,28,0.08)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--moss)', flexShrink: 0, marginTop: 1,
                    }}><Icons.Check size={11} strokeWidth={2} /></span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={`/login?plan=${p.id}`}
                style={{
                  width: '100%', padding: '11px', borderRadius: 9, fontSize: 14, fontWeight: 500,
                  fontFamily: 'DM Sans, sans-serif', textDecoration: 'none', textAlign: 'center',
                  display: 'block', transition: 'all 0.15s',
                  background: p.featured ? 'var(--moss)' : 'transparent',
                  color: p.featured ? '#fff' : 'var(--text)',
                  border: p.featured ? 'none' : '1px solid rgba(0,0,0,0.12)',
                }}
                onMouseEnter={e => {
                  if (p.featured) (e.currentTarget as HTMLElement).style.background = 'var(--moss2)';
                  else (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)';
                }}
                onMouseLeave={e => {
                  if (p.featured) (e.currentTarget as HTMLElement).style.background = 'var(--moss)';
                  else (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: 36, fontSize: 13, color: 'var(--meta)', fontWeight: 300 }}>
          All plans include BYOK support. Use your own API keys and pay even less.
        </p>
      </div>
    </section>
  );
}
