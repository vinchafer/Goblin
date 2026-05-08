"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin/health', label: 'Health',        icon: '♥' },
  { href: '/admin/users',  label: 'Users',         icon: 'U' },
  { href: '/admin/models', label: 'Models',        icon: 'M' },
  { href: '/admin/builds', label: 'Builds',        icon: 'B' },
  { href: '/admin/status', label: 'Status',        icon: 'S' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', height: '100dvh', background: 'var(--cream)', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: 220, flexShrink: 0,
        background: 'var(--moss)', color: '#fff',
        display: 'flex', flexDirection: 'column',
        padding: '24px 0',
        overflowY: 'auto',
      }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 700, color: 'var(--ochre)' }}>
            👺 Admin
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Goblin Control Panel</div>
        </div>

        <nav style={{ padding: '12px 8px', flex: 1 }}>
          {NAV.map(item => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8, marginBottom: 2,
                  fontSize: 14, fontFamily: 'DM Sans, sans-serif',
                  color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                  textDecoration: 'none', fontWeight: active ? 600 : 400,
                  transition: 'all 0.1s',
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '12px 12px 0', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <Link
            href="/dashboard"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, color: 'rgba(255,255,255,0.5)',
              textDecoration: 'none', padding: '8px 8px',
            }}
          >
            ← Back to App
          </Link>
        </div>
      </div>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 32px' }}>
        {children}
      </main>
    </div>
  );
}
