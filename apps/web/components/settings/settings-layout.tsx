'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  User,
  Key,
  Link as LinkIcon,
  CreditCard,
  Desktop,
  Shuffle,
  Robot,
} from '@phosphor-icons/react';

const NAV_ITEMS = [
  { href: '/dashboard/settings',              label: 'Account',      Icon: User },
  { href: '/dashboard/settings/keys',         label: 'API Keys',     Icon: Key },
  { href: '/dashboard/settings/integrations', label: 'Integrations', Icon: LinkIcon },
  { href: '/dashboard/settings/billing',      label: 'Billing',      Icon: CreditCard },
  { href: '/dashboard/settings/local',        label: 'Local Mode',   Icon: Desktop },
  { href: '/dashboard/settings/routing',      label: 'Routing',      Icon: Shuffle },
  { href: '/dashboard/settings/hosted',       label: 'Hosted AI',    Icon: Robot },
];

export function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="settings-grid" style={{
      maxWidth: 960, margin: '0 auto',
      padding: 'var(--space-8) var(--space-6) 64px',
      display: 'grid',
      gridTemplateColumns: '210px 1fr',
      gap: 32,
      alignItems: 'start',
    }}>
      {/* Sidebar nav */}
      <nav className="card card-sm" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 20 }}>
        <div style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--div)',
          fontSize: 11, color: 'var(--meta)', fontWeight: 600,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          fontFamily: 'DM Sans, sans-serif',
        }}>
          Settings
        </div>

        <div style={{ padding: '4px 0 8px' }}>
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== '/dashboard/settings' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 16px',
                  borderLeft: active ? '2px solid var(--ochre)' : '2px solid transparent',
                  background: active ? 'rgba(212,169,74,0.07)' : 'transparent',
                  color: active ? 'var(--moss)' : 'var(--text-2)',
                  fontWeight: active ? 600 : 400,
                  fontSize: 13.5,
                  fontFamily: 'DM Sans, sans-serif',
                  textDecoration: 'none',
                  transition: 'background 0.12s, color 0.12s',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'var(--subtle)';
                    e.currentTarget.style.color = 'var(--text)';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-2)';
                  }
                }}
              >
                <Icon size={15} weight={active ? 'bold' : 'regular'} style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div style={{ minWidth: 0 }}>{children}</div>

      <style>{`
        @media (max-width: 768px) {
          .settings-grid {
            grid-template-columns: 1fr !important;
          }
          .settings-grid > nav {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}
