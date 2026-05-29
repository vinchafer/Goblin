'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// Handles Supabase magic link hash-fragment auth for test automation.
// Security: tokens are Supabase-signed JWTs — cannot be forged without the project secret.
// Does NOT require NEXT_PUBLIC_ENABLE_TEST_AUTH.
export default function MagicCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Supabase browser client auto-parses #access_token from URL hash on getSession()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard');
        return;
      }

      // Fallback: parse hash manually and set session
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ error }) => {
            router.replace(error ? '/login?error=Authentication+failed' : '/dashboard');
          });
      } else {
        router.replace('/login?error=No+token+found');
      }
    });
  }, [router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--paper)' }}>
      <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--meta)', fontSize: 14 }}>Signing in…</p>
    </div>
  );
}
