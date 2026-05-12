import type { Metadata, Viewport } from 'next'
import { Fraunces, DM_Sans, JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/lib/theme'
import { PostHogInit } from '@/components/analytics/PostHogInit'
import { OfflineBanner } from '@/components/mobile/offline-banner'
import './globals.css'

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: 'var(--moss)',
}

export const metadata: Metadata = {
  title: 'Goblin — The Cloud Workshop for Builders',
  description: 'Build from anywhere. No laptop required.',
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
    'msapplication-TileColor': 'var(--moss)',
    'format-detection': 'telephone=no',
  },
  icons: {
    apple: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
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
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="mask-icon" href="/icons/icon-512.png" color="#2D4A2B" />
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
              border: '1px solid #2D4A2B',
              color: 'var(--cream)',
              fontFamily: 'DM Sans, sans-serif',
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
