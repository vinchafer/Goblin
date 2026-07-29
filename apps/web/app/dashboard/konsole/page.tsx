/**
 * AKT 2 · PHASE 2.5 · U-C1 (client half) + U-C2 — the founder console's route.
 *
 * ── Why this is a SERVER component and the gate runs here ────────────────────
 * The requirement is that for anyone who is not the founder this route behaves
 * exactly like a page that does not exist. A client-side check cannot deliver
 * that: the HTML shell would already have been served with 200, and a curious
 * Act-1 user comparing `/dashboard/konsole` against `/dashboard/nonsense` would
 * see two different responses and learn that something is here.
 *
 * So the check happens before a byte of the console is rendered. The session's
 * access token is read from the cookie, the API is asked, and anything other than
 * a clean answer calls `notFound()` — which renders app/not-found.tsx with a real
 * 404, identical to any unrouted path under /dashboard.
 *
 * ── Why the API answers the question and not this file ───────────────────────
 * `OPS_FOUNDER_ACCOUNTS` is server-side only, and "server-side" means the API's
 * environment, not the web app's. Copying the allowlist into Vercel would create
 * a second place to get it wrong and a second place for it to leak into a bundle.
 * The web app therefore knows nothing; it asks, and it is told 404 or 200.
 *
 * ── Fail closed ──────────────────────────────────────────────────────────────
 * No session, no API URL configured, a network failure, a non-200: all of them
 * are `notFound()`. A console that renders when it could not verify who is
 * looking would be worse than one that is briefly unreachable to its one account.
 *
 * ── No nav entry anywhere ───────────────────────────────────────────────────
 * This page is reachable by typing its URL and by nothing else. Nothing links to
 * it, and Header.tsx / Sidebar.tsx are untouched — a nav item would announce the
 * console's existence to every Act-1 user whose session simply has not been
 * checked yet.
 */

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OpsConsole } from './console-client';
import './ops-console.css';

// The gate depends on the caller's cookie, so this route can never be static and
// must never be cached — a cached 200 would be served to the next visitor.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Deliberately generic: the tab title must not announce what this page is. */
export const metadata = {
  title: 'Goblin',
  robots: { index: false, follow: false },
};

function apiBase(): string | null {
  const url = process.env.NEXT_PUBLIC_API_URL;
  return url ? url.replace(/\/$/, '') : null;
}

export default async function KonsolePage() {
  const base = apiBase();
  if (!base) notFound();

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) notFound();

  let status: unknown;
  try {
    const res = await fetch(`${base}/api/ops-console/status`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    // 404 is the gate refusing. Any other non-200 is a surface we cannot verify,
    // and an unverified console does not render.
    if (!res.ok) notFound();
    status = await res.json();
  } catch (err) {
    // `notFound()` works by throwing, so it must be re-thrown rather than
    // swallowed by this catch.
    if (err && typeof err === 'object' && 'digest' in err && String((err as { digest?: unknown }).digest).startsWith('NEXT_')) {
      throw err;
    }
    notFound();
  }

  return <OpsConsole initialStatus={status as never} />;
}
