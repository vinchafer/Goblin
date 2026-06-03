import type { ReactNode } from 'react';
import type { Viewport } from 'next';

// App routes (B-S9): lock zoom on auth screens (login + 2FA) so mobile can't
// pinch-zoom into a broken layout. Marketing routes keep zoom (root layout).
// The login page itself is a client component, so the viewport lives here.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1A3A2A',
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
