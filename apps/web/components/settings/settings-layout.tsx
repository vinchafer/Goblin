'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { User, Key, GitBranch, CreditCard } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard/settings',              label: 'Account',      icon: User, size: 16 },
  { href: '/dashboard/settings/keys',         label: 'API Keys',     icon: Key, size: 16 },
  { href: '/dashboard/settings/integrations', label: 'Integrations', icon: GitBranch, size: 16 },
  { href: '/dashboard/settings/billing',      label: 'Billing',      icon: CreditCard, size: 16 },
];

export function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      style={{
        maxWidth: 920, margin: '0 auto',
        padding: '32px 24px 64px',
        display: 'grid',
        gridTemplateColumns: '200px 1fr',
        gap: 28,
        alignItems: 'start',
      }}
      className="settings-grid"
    >
      {/* Sidebar nav */}
      <nav
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
          position: 'sticky', top: 16,
        }}
      >
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 15, color: 'var(--moss)', fontWeight: 700 }}>
            Settings
          </div>
        </div>

        {NAV_ITEMS.map(item => {
          const active = pathname === item.href;
          const IconComponent = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', fontSize: 13, fontWeight: 500,
                textDecoration: 'none', transition: 'all 0.12s',
                color: active ? 'var(--moss)' : 'var(--meta)',
                background: active ? 'rgba(30,58,28,0.06)' : 'transparent',
                borderLeft: active ? '2px solid var(--moss)' : '2px solid transparent',
                minHeight: 40,
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.03)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--meta)'; } }}
            >
              <IconComponent size={item.size} style={{ opacity: active ? 1 : 0.6 }} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Content */}
      <div>{children}</div>

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
