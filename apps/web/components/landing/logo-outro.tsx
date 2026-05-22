'use client';
import Link from 'next/link';
import { GoblinLogo } from '@/components/brand/GoblinLogo';

export function LogoOutro() {
  return (
    <section
      style={{
        background: 'var(--cream)',
        padding: '140px 32px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(45,74,43,0.06) 0%, transparent 65%)',
        }}
      />

      <div
        style={{
          maxWidth: 720, margin: '0 auto',
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32,
        }}
      >
        <GoblinLogo wordmark="light" wordmarkHeight={72} loading="lazy" aria-label="Goblin" />

        <p
          style={{
            fontFamily: 'Fraunces, serif',
            fontSize: 'clamp(24px, 2.8vw, 32px)',
            color: '#1a2e18',
            fontStyle: 'italic',
            margin: 0,
            letterSpacing: '-0.015em',
            lineHeight: 1.3,
            fontWeight: 500,
          }}
        >
          Build anywhere.{' '}
          <span style={{ color: '#7A5A12' }}>Code anything.</span>
        </p>

        <Link
          href="/login?action=signup"
          style={{
            background: '#1f3a1d', color: '#fff',
            padding: '15px 32px', borderRadius: 10,
            fontSize: 15, fontWeight: 600, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: 'DM Sans, sans-serif',
            boxShadow:
              '0 1px 0 rgba(255,255,255,0.10) inset, 0 8px 26px rgba(45,74,43,0.25)',
            marginTop: 8,
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow =
              '0 1px 0 rgba(255,255,255,0.10) inset, 0 12px 32px rgba(45,74,43,0.30)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow =
              '0 1px 0 rgba(255,255,255,0.10) inset, 0 8px 26px rgba(45,74,43,0.25)';
          }}
        >
          Start building free <span aria-hidden="true" style={{ opacity: 0.85 }}>→</span>
        </Link>
      </div>
    </section>
  );
}
