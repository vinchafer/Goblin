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
          padding: '16px 16px 14px',
          borderBottom: '1px solid var(--div)',
          fontFamily: 'Fraunces, serif',
          fontSize: 13, color: 'var(--meta)', fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase',
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
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--moss)' : 'var(--text-2)',
                minHeight: 42,
                fontSize: 14,
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
