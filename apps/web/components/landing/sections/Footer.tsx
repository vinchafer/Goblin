import { Lockup } from '@/components/landing/brand/Lockup';
import type { ReactNode } from 'react';

type Device = { name: string; icon: ReactNode };

const DEVICES: Device[] = [
  {
    name: 'macOS',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.6 13.4c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.6-1.9-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.3-.8-1.7 0-3.3 1-4.1 2.5-1.8 3-.5 7.6 1.2 10 .9 1.2 1.9 2.5 3.2 2.5 1.3 0 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.2 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1.1-2.7-4.2zM15.1 6.2c.7-.8 1.1-2 1-3.2-1 .1-2.2.7-2.9 1.5-.7.7-1.2 1.9-1.1 3 1.1.1 2.3-.6 3-1.3z" />
      </svg>
    ),
  },
  {
    name: 'Windows',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M3 5.5L11 4.3v7.4H3V5.5zm0 13l8 1.2v-7.3H3v6.1zm9-13.3l9-1.3v8.8h-9V5.2zm0 14.8l9 1.3v-8.7h-9V20z" />
      </svg>
    ),
  },
  {
    name: 'Linux',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M12 2c-2.5 0-4 2.2-4 5 0 1.4.3 2.5.7 3.5-1.5 1.4-2.7 3-3.4 4.5-.8 1.6-1 3-1 4-.1 1 .4 1.5 1.2 1.7.7.2 1.6.1 2.3-.2.7-.3 1.3-.7 1.7-1.2.4-.4.5-.7.5-.9 0 0 .5.3 1.5.3s1.6-.3 2-.5c.4-.2.5-.3.5-.3v.5c0 .4.2.7.5 1 .4.4 1 .7 1.7 1 .8.2 1.7.3 2.3.1.7-.2 1.2-.7 1.2-1.7 0-1-.2-2.4-1-4-.7-1.5-1.9-3.1-3.4-4.5.4-1 .7-2.1.7-3.5 0-2.8-1.5-5-4-5z" />
        <circle cx="10" cy="8" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="14" cy="8" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: 'iPhone',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="7" y="2" width="10" height="20" rx="2.5" />
        <line x1="11" y1="18.5" x2="13" y2="18.5" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: 'iPad',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <line x1="11" y1="18.5" x2="13" y2="18.5" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: 'Android',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M5.7 9.4c-.8 0-1.4.6-1.4 1.4v5.4c0 .8.6 1.4 1.4 1.4s1.4-.6 1.4-1.4v-5.4c0-.8-.6-1.4-1.4-1.4zm12.6 0c-.8 0-1.4.6-1.4 1.4v5.4c0 .8.6 1.4 1.4 1.4s1.4-.6 1.4-1.4v-5.4c0-.8-.6-1.4-1.4-1.4zM7.8 18.4c0 .7.6 1.3 1.3 1.3h.8v3c0 .8.6 1.4 1.4 1.4s1.4-.6 1.4-1.4v-3h1.4v3c0 .8.6 1.4 1.4 1.4s1.4-.6 1.4-1.4v-3h.8c.7 0 1.3-.6 1.3-1.3V9.6H7.8v8.8zM16.2 4.5l1.1-1.6c.1-.2 0-.3-.1-.4-.2-.1-.3 0-.4.1l-1.1 1.7c-.9-.4-1.9-.6-2.9-.6s-2 .2-2.9.6L8.7 2.6c-.1-.1-.2-.2-.4-.1-.2.1-.2.2-.1.4l1.1 1.6C7.3 5.5 6 7.4 6 9.6h12c0-2.2-1.3-4.1-3.4-5.1zM10.4 7.5c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5zm3.7 0c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5z" />
      </svg>
    ),
  },
];

export function Footer() {
  return (
    <footer className="lp-footer">
      <div className="container" style={{ padding: 0 }}>
        <div className="footer-devices">
          <div className="footer-devices-head">
            <span className="rule" aria-hidden="true" />
            On every device you build on
            <span className="rule" aria-hidden="true" />
          </div>
          <div className="footer-devices-row">
            {DEVICES.map((d) => (
              <div key={d.name} className="device" title={d.name}>
                {d.icon}
                <span>{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="footer-grid">
          <div className="footer-brand">
            <Lockup size="md" onDeep ariaLabel="Goblin" />
            <div className="footer-socials">
              <a href="https://github.com/vinchafer/Goblin" target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
          </div>

          <div className="footer-col">
            <div className="header">Product</div>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <a href="/changelog">Changelog</a>
          </div>
          <div className="footer-col">
            <div className="header">Company</div>
            <a href="/about">About</a>
            <a href="/manifesto">Manifesto</a>
          </div>
          <div className="footer-col">
            <div className="header">Legal</div>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/imprint">Imprint</a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 · Goblin Inc. · Made in Switzerland</span>
          <span className="end">
            <span className="dot" aria-hidden="true" /> Build anywhere · Code anything
          </span>
        </div>
      </div>
    </footer>
  );
}
