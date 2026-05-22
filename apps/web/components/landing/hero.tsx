'use client';
import Link from 'next/link';
import { GoblinLogo } from '@/components/brand/GoblinLogo';

export function Hero() {
  return (
    <section
      style={{
        position: 'relative',
        minHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        padding: '160px 24px 96px',
        background: 'var(--cream)',
        overflow: 'hidden',
      }}
    >
      {/* Subtle moss watermark — pushed slightly higher contrast for sunlight legibility */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 0,
        }}
      >
        <div
          style={{
            width: 'min(78vmin, 760px)',
            height: 'min(78vmin, 760px)',
            opacity: 0.06,
            color: '#1f3a1d',
          }}
        >
          <GoblinLogo variant="moss" size={760} aria-label="" />
        </div>
      </div>

      {/* Top vignette */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(45,74,43,0.06) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      <div
        style={{
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          maxWidth: 880,
        }}
      >
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#1F3A1D',
            borderRadius: 100, padding: '7px 16px',
            fontSize: 11, fontWeight: 700,
            color: '#F0CF8A',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            fontFamily: 'DM Sans, sans-serif',
            marginBottom: 32,
            boxShadow: '0 6px 18px -6px rgba(31,58,29,0.40)',
          }}
        >
          <span
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#F0CF8A',
              boxShadow: '0 0 0 3px rgba(240,207,138,0.30)',
            }}
          />
          Now in beta
        </div>

        <h1
          style={{
            fontFamily: 'Fraunces, serif',
            fontSize: 'clamp(44px, 6.5vw, 84px)',
            lineHeight: 1.02,
            fontWeight: 700,
            color: '#0F2A0D',
            letterSpacing: '-0.035em',
            margin: '0 0 26px',
          }}
        >
          Code from anywhere.<br />
          <em style={{ fontStyle: 'italic', color: '#7A5A12', fontWeight: 700 }}>
            Ship from your phone.
          </em>
        </h1>

        <p
          style={{
            fontSize: 'clamp(18px, 1.4vw, 21px)',
            color: '#1F3A1D',
            maxWidth: 600,
            lineHeight: 1.55,
            margin: '0 auto 40px',
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 500,
          }}
        >
          The cloud workshop for builders who don&apos;t want to wait for a laptop.
          Bring your own AI keys. Push to GitHub. Deploy to Vercel.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link
            href="/login?action=signup"
            style={{
              background: '#1f3a1d', color: '#fff',
              padding: '15px 28px', borderRadius: 10,
              fontSize: 15, fontWeight: 600, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: 'DM Sans, sans-serif',
              boxShadow:
                '0 1px 0 rgba(255,255,255,0.12) inset, 0 8px 24px rgba(45,74,43,0.28)',
              transition: 'transform 0.15s, box-shadow 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.background = '#0f2a0d';
              e.currentTarget.style.boxShadow =
                '0 1px 0 rgba(255,255,255,0.12) inset, 0 12px 30px rgba(45,74,43,0.34)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.background = '#1f3a1d';
              e.currentTarget.style.boxShadow =
                '0 1px 0 rgba(255,255,255,0.12) inset, 0 8px 24px rgba(45,74,43,0.28)';
            }}
          >
            Start building free
            <span aria-hidden="true" style={{ opacity: 0.85 }}>→</span>
          </Link>
          <a
            href="#how-it-works"
            style={{
              background: '#fff', color: '#1f3a1d',
              padding: '15px 24px', borderRadius: 10,
              fontSize: 15, fontWeight: 600, textDecoration: 'none',
              border: '1px solid rgba(45,74,43,0.20)',
              fontFamily: 'DM Sans, sans-serif',
              transition: 'background 0.15s, border-color 0.15s, transform 0.15s',
              boxShadow: '0 2px 6px -2px rgba(45,74,43,0.10)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(45,74,43,0.04)';
              e.currentTarget.style.borderColor = 'rgba(45,74,43,0.32)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.borderColor = 'rgba(45,74,43,0.20)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            See how it works
          </a>
        </div>

        <p
          style={{
            marginTop: 28,
            fontSize: 13, color: '#1F3A1D',
            fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
          }}
        >
          Free 3-day trial · No credit card required
        </p>
      </div>
    </section>
  );
}
