'use client';
import Link from 'next/link';
import { Icons } from '@/components/ui/icons';

const FEATURES = [
  'Unlimited projects',
  'BYOK — all AI providers (Anthropic, OpenAI, Google, Groq + more)',
  'Chat + Code + Preview workspace',
  'GitHub push integration',
  '5 GB cloud storage',
  '[Send to Code] — one tap from chat to editor',
  'Web push notifications',
  'Build from any device, anywhere',
  'Community Discord',
];

export function PricingSection() {
  return (
    <section id="pricing" style={{ background: 'var(--cream2)', padding: '100px 40px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ochre)', marginBottom: 16, fontFamily: 'DM Sans, sans-serif' }}>
            Pricing
          </div>
          <h2 style={{
            fontFamily: 'Fraunces, serif', fontSize: 'clamp(28px, 4vw, 44px)',
            color: 'var(--moss)', lineHeight: 1.1, letterSpacing: '-1.5px', fontWeight: 700, marginBottom: 16,
          }}>
            One plan. Everything included.
          </h2>
          <p style={{ fontSize: 16, color: 'var(--meta)', maxWidth: 440, margin: '0 auto', fontWeight: 300, lineHeight: 1.6 }}>
            No tiers. No decision fatigue. No surprise bills. Cancel in one click.
          </p>
        </div>

        {/* Single plan card */}
        <div style={{
          background: 'var(--panel)', borderRadius: 20, padding: '36px 36px 32px',
          border: '2px solid var(--moss)',
          boxShadow: '0 16px 48px rgba(30,58,28,0.1)',
          maxWidth: 480, margin: '0 auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 6 }}>
            <div>
              <span style={{ fontFamily: 'Fraunces, serif', fontSize: 60, fontWeight: 300, color: 'var(--text)', lineHeight: 1, letterSpacing: '-3px' }}>
                <sup style={{ fontSize: 20, fontFamily: 'DM Sans, sans-serif', verticalAlign: 'super', fontWeight: 400 }}>$</sup>
                9
              </span>
            </div>
            <div style={{ paddingBottom: 8 }}>
              <div style={{ fontSize: 14, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>per month</div>
              <div style={{ fontSize: 11, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif', fontWeight: 300 }}>cancel anytime</div>
            </div>
          </div>

          <div style={{ fontSize: 14, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif', marginBottom: 28, fontWeight: 300, lineHeight: 1.5 }}>
            Start with a 3-day free trial. No credit card required to sign up.
          </div>

          <ul style={{ listStyle: 'none', padding: 0, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FEATURES.map(f => (
              <li key={f} style={{ fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif' }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', background: 'rgba(30,58,28,0.08)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--moss)', flexShrink: 0, marginTop: 1,
                }}>
                  <Icons.Check size={11} strokeWidth={2} />
                </span>
                {f}
              </li>
            ))}
          </ul>

          <Link
            href="/login"
            style={{
              display: 'block', width: '100%', padding: '13px', borderRadius: 10,
              fontSize: 15, fontWeight: 700, fontFamily: 'DM Sans, sans-serif',
              textDecoration: 'none', textAlign: 'center',
              background: 'var(--moss)', color: 'var(--ochre)',
              transition: 'background 0.15s', letterSpacing: '0.2px',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--moss2)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--moss)')}
          >
            Start free trial →
          </Link>
        </div>

        <p style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: 'var(--meta)', fontWeight: 300, lineHeight: 1.6 }}>
          BYOK users bring their own API keys — you pay providers directly, Goblin charges $0 extra for inference.
          <br />Secure checkout via Stripe.
        </p>
      </div>
    </section>
  );
}
