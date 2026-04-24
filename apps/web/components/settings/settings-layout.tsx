"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

const tabs = [
  { id: 'profile', label: 'Profile', href: '/dashboard/settings/profile' },
  { id: 'keys', label: 'BYOK Keys', href: '/dashboard/settings/keys' },
  { id: 'billing', label: 'Billing', href: '/dashboard/settings/billing' },
  { id: 'usage', label: 'Usage', href: '/dashboard/settings/usage' }
];

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="h-full flex">
      <div className="w-52 shrink-0 border-r p-4" style={{ borderColor: 'var(--goblin-light)' }}>
        <nav className="space-y-1">
          {tabs.map(tab => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${pathname === tab.href ? '' : 'hover:bg-gray-100'}`}
              style={{
                backgroundColor: pathname === tab.href ? 'rgba(45, 74, 43, 0.1)' : 'transparent',
                color: pathname === tab.href ? 'var(--goblin-moss)' : 'var(--goblin-gray)'
              }}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}