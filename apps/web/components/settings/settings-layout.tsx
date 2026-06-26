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
  Robot,
  Sliders,
  Bell,
  Palette,
} from '@phosphor-icons/react';
import { useAdvancedMode } from '@/hooks/use-advanced-mode';

interface NavGroup {
  label: string;
  items: { href: string; label: string; Icon: React.ElementType; advanced?: boolean }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Account',
    items: [
      { href: '/dashboard/settings',              label: 'Profile',      Icon: User },
      { href: '/dashboard/settings/appearance',   label: 'Appearance',   Icon: Palette },
      { href: '/dashboard/settings/notifications', label: 'Notifications', Icon: Bell },
    ],
  },
  {
    label: 'AI',
    items: [
      { href: '/dashboard/settings/keys',   label: 'API Keys',   Icon: Key },
      { href: '/dashboard/settings/hosted', label: 'Hosted AI',  Icon: Robot },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard/settings/integrations', label: 'Integrations', Icon: LinkIcon },
    ],
  },
  {
    label: 'Billing',
    items: [
      { href: '/dashboard/settings/billing', label: 'Plan & Billing', Icon: CreditCard },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { href: '/dashboard/settings/local',   label: 'Local Mode',      Icon: Desktop,  advanced: true },
      { href: '/dashboard/settings?tab=developer', label: 'Developer Tools', Icon: Sliders, advanced: true },
    ],
  },
];

function NavItem({ href, label, Icon, active }: { href: string; label: string; Icon: React.ElementType; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 14px',
        borderLeft: active ? '2px solid var(--brand-gold)' : '2px solid transparent',
        background: active ? 'rgba(212,169,74,0.07)' : 'transparent',
        color: active ? 'var(--brand-green)' : 'var(--text-2)',
        fontWeight: active ? 600 : 400,
        fontSize: 13, fontFamily: 'var(--font-sans)',
        textDecoration: 'none',
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--subtle)'; e.currentTarget.style.color = 'var(--text)'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; } }}
    >
      <Icon size={14} weight={active ? 'bold' : 'regular'} style={{ flexShrink: 0, opacity: active ? 1 : 0.55 }} />
      {label}
    </Link>
  );
}

export function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isAdvancedMode } = useAdvancedMode();

  return (
    <div className="settings-grid" style={{
      maxWidth: 980, margin: '0 auto',
      padding: 'var(--space-8) var(--space-6) 64px',
      display: 'grid',
      gridTemplateColumns: '210px 1fr',
      gap: 32,
      alignItems: 'start',
    }}>
      {/* Sidebar nav */}
      <nav className="card card-sm" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 20 }}>
        <div style={{
          padding: '13px 16px 11px',
          borderBottom: '1px solid var(--div)',
          fontSize: 11, color: 'var(--text)', fontWeight: 700,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          fontFamily: 'var(--font-sans)',
        }}>
          Settings
        </div>

        <div style={{ padding: '6px 0 8px' }}>
          {NAV_GROUPS.map(group => {
            const visibleItems = group.items.filter(item => !item.advanced || isAdvancedMode);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label} style={{ marginBottom: 4 }}>
                <div style={{
                  padding: '8px 16px 3px',
                  fontSize: 10, color: 'var(--disabled)', fontWeight: 700,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {group.label}
                </div>
                {visibleItems.map(({ href, label, Icon }) => {
                  const hrefPath = href.split('?')[0];
                  const active = hrefPath === '/dashboard/settings'
                    ? pathname === '/dashboard/settings'
                    : (pathname === hrefPath || pathname.startsWith(hrefPath + '/'));
                  return <NavItem key={href} href={href} label={label} Icon={Icon} active={active} />;
                })}
              </div>
            );
          })}
        </div>
      </nav>

      <div style={{ minWidth: 0 }}>{children}</div>

      <style>{`
        @media (max-width: 768px) {
          .settings-grid { grid-template-columns: 1fr !important; }
          .settings-grid > nav { position: static !important; }
        }
      `}</style>
    </div>
  );
}
