import type { Metadata, Viewport } from 'next'
import { Manrope, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/lib/theme'
import { PostHogInit } from '@/components/analytics/PostHogInit'
import { OfflineBanner } from '@/components/mobile/offline-banner'
import './globals.css'
import '../styles/design-tokens.css'

// v1.1 brand fonts. --font-sans resolves to Manrope, --font-serif to
// Instrument Serif (italic accent), --font-mono to JetBrains Mono.
// Weights pared to those actually used in CSS/components (400/500/600/700);
// 800 was declared but unused — dropping it removes one preloaded font file.
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap', weight: ['400', '500', '600', '700'] })
const instrumentSerif = Instrument_Serif({ subsets: ['latin'], variable: '--font-instrument-serif', display: 'swap', weight: '400', style: ['normal', 'italic'] })
// Mono is only used on code surfaces (editor/preview), never above the fold on
// marketing/auth — skip preload so it doesn't compete for bandwidth on first paint.
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap', preload: false })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1A3A2A',
}

export const metadata: Metadata = {
  title: 'Goblin — The Cloud Workshop for Builders',
  description: 'An invisible, loyal AI ally — built to ship products, automations, and ideas faster than you thought possible.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Goblin',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Goblin',
    'msapplication-TileColor': '#1A3A2A',
    'format-detection': 'telephone=no',
  },
  icons: {
    icon: [
      { url: '/brand/icons/goblin-favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/icons/goblin-icon-32.svg', sizes: '32x32', type: 'image/svg+xml' },
      { url: '/brand/icons/goblin-icon-16.svg', sizes: '16x16', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/brand/icons/goblin-icon-256.svg', sizes: '256x256', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Goblin — The Cloud Workshop for Builders',
    description: 'An invisible, loyal AI ally — built to ship.',
    url: 'https://justgoblin.com',
    siteName: 'Goblin',
    images: [
      {
        url: '/brand/social/goblin-og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Goblin — The Cloud Workshop for Builders',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Goblin — The Cloud Workshop for Builders',
    description: 'An invisible, loyal AI ally — built to ship.',
    images: ['/brand/social/goblin-og-image.svg'],
  },
}

export function reportWebVitals(metric: { name: string; value: number; rating: string }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  if (!apiUrl) return;
  fetch(`${apiUrl}/api/analytics/vitals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: metric.name, value: Math.round(metric.value), rating: metric.rating }),
    keepalive: true,
  }).catch(() => {});
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {/* No Google Fonts preconnect: next/font self-hosts fonts under /_next/static/media,
            so connections to fonts.googleapis.com / fonts.gstatic.com are never made at runtime. */}
        <link rel="mask-icon" href="/icons/icon-512.png" color="#1A3A2A" />
        {/* no-flash theme init — must run before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var t = localStorage.getItem('goblin_theme') || 'system';
              var d = t === 'system'
                ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
                : t;
              document.documentElement.setAttribute('data-theme', d);
            } catch(e){}
          })();
        `}} />
      </head>
      <body>
        <ThemeProvider>
          <PostHogInit />
          <OfflineBanner />
          {children}
        </ThemeProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1a1a18',
              border: '1px solid #1A3A2A',
              color: 'var(--paper)',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
            },
            classNames: {
              success: 'goblin-toast-success',
              error: 'goblin-toast-error',
            },
          }}
        />
      </body>
    </html>
  )
}
