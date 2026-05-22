'use client';

import { GoblinLogo } from '@/components/brand/GoblinLogo';

const COLS = [
  {
    title: 'Product',
    links: [
      { label: 'Pricing', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
      { label: 'Changelog', href: '#' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Discord', href: 'https://discord.gg/goblin' },
      { label: 'Twitter / X', href: 'https://twitter.com/justgoblin' },
      { label: 'GitHub', href: 'https://github.com/justgoblin' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Imprint', href: '/imprint' },
    ],
  },
];

const SOCIALS = [
  { label: 'Discord', href: 'https://discord.gg/goblin' },
  { label: 'Twitter', href: 'https://twitter.com/justgoblin' },
  { label: 'GitHub', href: 'https://github.com/justgoblin' },
];

export function Footer() {
  const linkStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'rgba(247,244,237,0.92)',
    textDecoration: 'none',
    transition: 'color 0.15s',
    fontFamily: 'DM Sans, sans-serif',
  };

  return (
    <footer
      style={{
        background: '#1f3a1d',
        color: 'var(--cream)',
        padding: '80px 32px 36px',
        borderTop: '1px solid rgba(212,167,55,0.20)',
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div
          className="footer-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
            gap: 56,
            alignItems: 'flex-start',
            marginBottom: 56,
          }}
        >
          <div style={{ maxWidth: 320 }}>
            <div style={{ marginBottom: 16 }}>
              <GoblinLogo wordmark="dark" wordmarkHeight={36} loading="lazy" aria-label="Goblin" />
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'rgba(247,244,237,0.92)',
                lineHeight: 1.6,
                fontFamily: 'DM Sans, sans-serif',
                marginBottom: 20,
              }}
            >
              The cloud workshop for builders who ship from anywhere.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '6px 12px', borderRadius: 8,
                    border: '1px solid rgba(212,167,55,0.28)',
                    background: 'transparent',
                    display: 'inline-flex', alignItems: 'center',
                    fontSize: 12, color: 'var(--cream)',
                    textDecoration: 'none',
                    fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--ochre)';
                    e.currentTarget.style.borderColor = 'var(--ochre)';
                    e.currentTarget.style.color = '#1a2018';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(212,167,55,0.28)';
                    e.currentTarget.style.color = 'var(--cream)';
                  }}
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.title} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  fontSize: 11, color: '#F0CF8A',
                  letterSpacing: '0.16em', textTransform: 'uppercase',
                  fontWeight: 700, marginBottom: 4,
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {col.title}
              </div>
              {col.links.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  style={linkStyle}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cream)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(247,244,237,0.92)')}
                >
                  {l.label}
                </a>
              ))}
            </div>
          ))}
        </div>

        <div
          style={{
            borderTop: '1px solid rgba(247,244,237,0.10)',
            paddingTop: 22,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: 12,
            color: 'rgba(247,244,237,0.45)',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          <span>© 2026 Goblin · Made in Switzerland</span>
          <span style={{ color: 'rgba(247,244,237,0.45)', fontFamily: 'Fraunces, serif', fontStyle: 'italic' }}>
            Build anywhere. Code anything.
          </span>
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 36px !important;
          }
        }
        @media (max-width: 560px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}
