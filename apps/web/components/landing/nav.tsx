'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { GoblinWordmark } from '@/components/ui/goblin-mark';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
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
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 40px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(245,240,232,0.96)' : 'rgba(245,240,232,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.08)' : '1px solid transparent',
        transition: 'all 0.2s ease',
      }}>
        <GoblinWordmark size="md" />


        {/* Desktop links */}
        <div style={{ display: 'flex', gap: 32 }} className="nav-desktop-links">
          {links.map(([l, h]) => (
            <a key={l} href={h} style={{ fontSize: 14, color: 'var(--meta)', textDecoration: 'none', fontWeight: 400, transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--meta)')}>{l}</a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/login" style={{
            background: 'var(--moss)', color: '#fff', padding: '9px 20px',
            borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'background 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--moss2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--moss)')}
          >Start building →</Link>
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 20, padding: 4, display: 'none' }}
            className="nav-hamburger"
          >{mobileOpen
            ? <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><line x1="4" y1="4" x2="16" y2="16"/><line x1="16" y1="4" x2="4" y2="16"/></svg>
            : <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><line x1="3" y1="6" x2="17" y2="6"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="14" x2="17" y2="14"/></svg>
          }</button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{
          position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99,
          background: 'var(--cream)', borderBottom: '1px solid var(--border)',
          padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        }} className="nav-mobile-menu">
          {links.map(([l, h]) => (
            <a key={l} href={h} onClick={() => setMobileOpen(false)} style={{ fontSize: 16, color: 'var(--text)', textDecoration: 'none', fontWeight: 500 }}>{l}</a>
          ))}
          <Link href="/login" onClick={() => setMobileOpen(false)} style={{
            background: 'var(--moss)', color: '#fff', padding: '12px 20px', borderRadius: 8,
            fontSize: 14, fontWeight: 500, textDecoration: 'none', textAlign: 'center',
          }}>Start building →</Link>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .nav-desktop-links { display: none !important; }
          .nav-hamburger { display: block !important; }
        }
      `}</style>
    </>
  );
}
