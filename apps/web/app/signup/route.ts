// FINAL-POLISH · U7.1 — /signup was whitelisted, but no route ever existed.
//
// `middleware.ts` lists `/signup` in `isPublic`, so the auth wall lets it through and
// Next then 404s it: the worst of both worlds, and invisible in testing because nothing
// links there. People type it anyway, and so do password managers and old bookmarks.
//
// Signup is not a separate page here — it is the login screen in signup mode, which is
// exactly what `?mode=signup` selects (`app/(auth)/login/page.tsx`: `searchParams.get('mode')`).
// So the honest route is a redirect, which also makes the existing whitelist entry mean
// something. `/register` is left alone: it has a real page.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return NextResponse.redirect(new URL('/login?mode=signup', request.url));
}
