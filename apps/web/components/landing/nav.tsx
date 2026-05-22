'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { GoblinLogo } from '@/components/brand/GoblinLogo';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const links = [
    ['Why Goblin', '#why-goblin'],
    ['How it works', '#how-it-works'],
    ['Pricing', '#pricing'],
  ];

  return (
    <>
      <nav
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          padding: '0 32px', height: 68,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(247,244,237,0.96)',
          backdropFilter: 'blur(14px) saturate(180%)',
          WebkitBackdropFilter: 'blur(14px) saturate(180%)',
          borderBottom: '1px solid rgba(45,74,43,0.10)',
          boxShadow: scrolled ? '0 4px 18px -10px rgba(45,74,43,0.18)' : 'none',
          transition: 'box-shadow 0.25s ease',
        }}
      >
        <Link href="/" aria-label="Goblin home" style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0 }}>
          <GoblinLogo wordmark="light" wordmarkHeight={28} aria-label="Goblin" />
        </Link>

        <div className="nav-desktop-links" style={{ display: 'flex', gap: 32 }}>
          {links.map(([l, h]) => (
            <a
              key={l}
              href={h}
              style={{
                fontSize: 14, color: '#1f3a1d', textDecoration: 'none',
                fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
                transition: 'color 0.15s',
                letterSpacing: '-0.005em',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#8B6F1F')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#1f3a1d')}
            >
              {l}
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link
            href="/login"
            className="nav-cta-secondary"
            style={{
              padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              textDecoration: 'none', color: '#1f3a1d', background: 'transparent',
              fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s',
              display: 'inline-flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(45,74,43,0.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Sign in
          </Link>

          <Link
            href="/login?action=signup"
            className="nav-cta-primary"
            style={{
              background: '#1f3a1d', color: '#fff', padding: '10px 18px',
              borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: 'DM Sans, sans-serif',
              transition: 'background 0.15s',
              boxShadow: '0 1px 0 rgba(255,255,255,0.08) inset, 0 2px 8px rgba(45,74,43,0.25)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#0f2a0d'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#1f3a1d'; }}
          >
            Start building
            <span aria-hidden="true" style={{ opacity: 0.85 }}>→</span>
          </Link>

          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
            className="nav-hamburger"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#1f3a1d', padding: 12, display: 'none',
              marginLeft: 4, minWidth: 44, minHeight: 44,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {mobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="16" y2="16"/><line x1="16" y1="4" x2="4" y2="16"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="17" y2="6"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="14" x2="17" y2="14"/></svg>
            )}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div
          className="nav-mobile-menu"
          style={{
            position: 'fixed', top: 68, left: 0, right: 0, zIndex: 99,
            background: 'rgba(247,244,237,0.98)',
            backdropFilter: 'blur(14px)',
            borderBottom: '1px solid rgba(45,74,43,0.12)',
            padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
            boxShadow: '0 12px 28px -16px rgba(45,74,43,0.30)',
          }}
        >
          {links.map(([l, h]) => (
            <a
              key={l}
              href={h}
              onClick={() => setMobileOpen(false)}
              style={{
                fontSize: 16, color: '#1f3a1d', textDecoration: 'none',
                fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
                padding: '12px 0', minHeight: 44,
                display: 'flex', alignItems: 'center',
              }}
            >
              {l}
            </a>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: 8,
                fontSize: 14, fontWeight: 600, textDecoration: 'none',
                textAlign: 'center', fontFamily: 'DM Sans, sans-serif',
                background: 'transparent', color: '#1f3a1d',
                border: '1px solid rgba(45,74,43,0.20)',
              }}
            >
              Sign in
            </Link>
            <Link
              href="/login?action=signup"
              onClick={() => setMobileOpen(false)}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: 8,
                fontSize: 14, fontWeight: 600, textDecoration: 'none',
                textAlign: 'center', fontFamily: 'DM Sans, sans-serif',
                background: '#1f3a1d', color: '#fff',
              }}
            >
              Start building →
            </Link>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 960px) {
          .nav-desktop-links { display: none !important; }
        }
        @media (max-width: 640px) {
          .nav-cta-secondary,
          .nav-cta-primary { display: none !important; }
          .nav-hamburger { display: inline-flex !important; }
        }
      `}</style>
    </>
  );
}
