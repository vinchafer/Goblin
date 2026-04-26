'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      padding: '0 40px', height: 64,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: scrolled ? 'rgba(245,240,232,0.95)' : 'rgba(245,240,232,0.8)',
      backdropFilter: 'blur(12px)',
      borderBottom: scrolled ? '1px solid rgba(0,0,0,0.08)' : '1px solid transparent',
      transition: 'all 0.2s ease',
    }}>
      <div style={{ fontFamily: 'Fraunces, serif', fontSize: 26, color: 'var(--moss)', fontWeight: 700, letterSpacing: '-0.5px' }}>
        Goblin<span style={{ color: 'var(--ochre)' }}>.</span>
      </div>
      <div style={{ display: 'flex', gap: 32 }}>
        {[['Why Goblin','#why-goblin'],['How it works','#how-it-works'],['Pricing','#pricing']].map(([l,h]) => (
          <a key={l} href={h} style={{ fontSize: 14, color: 'var(--meta)', textDecoration: 'none', fontWeight: 400, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.target as HTMLElement).style.color = 'var(--text)'}
            onMouseLeave={e => (e.target as HTMLElement).style.color = 'var(--meta)'}>{l}</a>
        ))}
      </div>
      <Link href="/login" style={{
        background: 'var(--moss)', color: '#fff', padding: '9px 20px',
        borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none',
      }}>Start building →</Link>
    </nav>
  );
}
