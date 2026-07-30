import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Server-side sign-out. The UI does not need it — with `@supabase/ssr` the
 * session is a non-http-only cookie, so `lib/auth/sign-out.ts` clears it in the
 * browser and never depends on a round trip. This route stays as the
 * no-JavaScript escape hatch.
 *
 * U2 fix: the redirect target was built from `process.env.NEXT_PUBLIC_APP_URL`,
 * which throws `TypeError: Invalid URL` when that variable is unset on the web
 * host — turning the fallback logout into a 500. The request's own URL is always
 * present and is the correct origin anyway (the app is served on
 * www.justgoblin.com while the apex 307s to it, so a hardcoded origin can send
 * the user across a host boundary mid-logout).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(new URL('/login', request.url), { status: 302 });
}
