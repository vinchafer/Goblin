import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { ONBOARDED_COOKIE, shouldPromoteOnboardedCookie } from '@/lib/onboarding-gate';

export async function middleware(request: NextRequest) {
  // Bypass auth for demo routes (Sprint 7 — pitch iframe embedding). These render
  // pre-seeded, read-only product surfaces with no user data; the frame-ancestors
  // override for them lives in next.config.ts.
  if (request.nextUrl.pathname.startsWith('/demo-')) {
    return NextResponse.next();
  }

  // F-05 · standalone hardening (Founder-Walk-1, U1). Promote the storage-independent
  // `?onboarded=1` completion signal into the durable, server-set `goblin_onboarded`
  // cookie so a just-finished user carries an authoritative "already onboarded"
  // signal into the dashboard back-leg guard even when the client `document.cookie`
  // write did not survive standalone WebKit (the installed-PWA loop). Seed the
  // FORWARDED request now so the dashboard layout reads it THIS pass; the matching
  // response write happens after Supabase (below) so we don't clobber a session
  // refresh. See lib/onboarding-gate.ts for the full diagnosis.
  const promoteOnboarded = shouldPromoteOnboardedCookie({
    searchParams: request.nextUrl.searchParams,
    cookieAlreadySet:
      request.cookies.get(ONBOARDED_COOKIE.name)?.value === ONBOARDED_COOKIE.value,
  });
  if (promoteOnboarded) {
    request.cookies.set(ONBOARDED_COOKIE.name, ONBOARDED_COOKIE.value);
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/register' ||
    pathname === '/status' ||
    pathname === '/badge' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/imprint') ||
    pathname.startsWith('/help') ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/about') ||
    pathname.startsWith('/manifesto') ||
    pathname.startsWith('/changelog') ||
    pathname.startsWith('/models') ||
    pathname.startsWith('/cancel-deletion') ||
    pathname.startsWith('/deletion-pending') ||
    pathname.startsWith('/shared/') ||
    pathname.startsWith('/brand/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/');

  // Unauthenticated → protected route: redirect to login
  if (!user && !isPublic) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Authenticated → login page: redirect to dashboard
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Persist the promoted completion cookie on the final response (after any
  // Supabase session-refresh writes above), so it survives beyond this request.
  if (promoteOnboarded) {
    response.cookies.set(ONBOARDED_COOKIE.name, ONBOARDED_COOKIE.value, {
      path: '/',
      maxAge: ONBOARDED_COOKIE.maxAgeSeconds,
      sameSite: 'lax',
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
