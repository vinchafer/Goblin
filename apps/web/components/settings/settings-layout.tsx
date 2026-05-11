'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard/settings',              label: 'Account' },
  { href: '/dashboard/settings/keys',         label: 'API Keys' },
  { href: '/dashboard/settings/integrations', label: 'Integrations' },
  { href: '/dashboard/settings/billing',      label: 'Billing' },
  { href: '/dashboard/settings/local',        label: 'Local Mode' },
  { href: '/dashboard/settings/routing',      label: 'Routing' },
];

export function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="settings-grid" style={{
      maxWidth: 920, margin: '0 auto',
      padding: 'var(--space-8) var(--space-6) 64px',
      display: 'grid',
      gridTemplateColumns: '200px 1fr',
      gap: 28,
      alignItems: 'start',
    }}>
      {/* Sidebar nav */}
      <nav className="card card-sm" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 16 }}>
        <div style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--div)',
          fontFamily: 'Fraunces, serif',
          fontSize: 15, color: 'var(--moss)', fontWeight: 700,
        }}>
          Settings
        </div>

        {NAV_ITEMS.map(item => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item${active ? ' active' : ''}`}
              style={{
                borderRadius: 0,
                borderLeft: active ? '3px solid var(--ochre)' : '3px solid transparent',
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--moss)' : undefined,
                minHeight: 40,
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>

      <style>{`
        @media (max-width: 768px) {
          .settings-grid { grid-template-columns: 1fr !important; }
          .settings-grid > nav { position: static !important; }
        }
      `}</style>
    </div>
  );
}
