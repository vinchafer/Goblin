'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// Client-side callback for Playwright test auth
// Supabase magic links redirect with hash fragments (#access_token=...)
// which server-side routes cannot read — so we handle them here
export default function TestCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH !== 'true') {
      router.replace('/login');
      return;
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Supabase browser client automatically parses #access_token from the URL
    // and creates a session from it when getSession() is called
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard');
      } else {
        // Fallback: try to exchange hash tokens manually
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
            .then(({ error }) => {
              if (error) router.replace('/login?error=Authentication+failed');
              else router.replace('/dashboard');
            });
        } else {
          router.replace('/login?error=Authentication+failed');
        }
      }
    });
  }, [router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--meta)' }}>Authenticating...</p>
    </div>
  );
}
