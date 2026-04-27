'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/dashboard/settings', label: 'General', icon: '⚙' },
  { href: '/dashboard/settings/keys', label: 'API Keys', icon: '🔑' },
  { href: '/dashboard/settings/integrations', label: 'Integrations', icon: '🔗' },
  { href: '/dashboard/settings/billing', label: 'Billing', icon: '💳' },
];

export function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px', display: 'grid', gridTemplateColumns: '200px 1fr', gap: 32, alignItems: 'start' }} className="settings-grid">
      <nav style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 16, color: 'var(--moss)', fontWeight: 700 }}>Settings</div>
        </div>
        {navItems.map(item => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
              fontSize: 13, fontWeight: 500, textDecoration: 'none',
              color: active ? 'var(--moss)' : 'var(--meta)',
              background: active ? 'rgba(30,58,28,0.06)' : 'transparent',
              borderLeft: active ? '2px solid var(--moss)' : '2px solid transparent',
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div>{children}</div>
      <style>{`@media (max-width: 768px) { .settings-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
