'use client';

/**
 * FINAL-POLISH · U5 — the account side of the language preference.
 *
 * `lib/locale.ts` owns the precedence and stays pure (storage + a rule, no network). This
 * module is the thin bridge to `users.preferred_lang` (migration 0059), which is the
 * DURABLE form of precedence 2 — the thing that makes a language choice follow the user
 * to a second device rather than living in one browser's localStorage.
 *
 * Both directions are best-effort by design: a language preference must never block a
 * render or surface an error. If the network is down the session simply keeps resolving
 * from local storage, exactly as it did before.
 */

import { hydrateAccountLang, type Lang } from '@/lib/locale';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

async function authHeader(): Promise<Record<string, string> | null> {
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const { data: { session } } = await createClient().auth.getSession();
    if (!session) return null;
    return { Authorization: `Bearer ${session.access_token}` };
  } catch {
    return null;
  }
}

/**
 * Read `users.preferred_lang` and fold it into the precedence. Called once on an
 * authenticated load. No-ops when signed out (the public surfaces must not inherit an
 * account-scoped answer) or when the column is null (an account from before 0059, or one
 * that never answered Step 0 — leave whatever is local alone).
 */
export async function hydrateLangFromAccount(signal?: AbortSignal): Promise<Lang | null> {
  const headers = await authHeader();
  if (!headers) return null;
  try {
    const res = await fetch(`${API_BASE}/api/users/me`, { headers, signal, cache: 'no-store' });
    if (!res.ok) return null;
    const d = (await res.json()) as { preferred_lang?: unknown };
    const lang = d.preferred_lang;
    if (lang !== 'de' && lang !== 'en') return null;
    hydrateAccountLang(lang);
    return lang;
  } catch {
    return null; // offline / aborted — local resolution stands
  }
}

/**
 * Mirror an explicit choice to the account, so the next device inherits it. Fire-and-
 * forget: the local choice has already been applied by `setLangChoice`, and a failed
 * mirror must not undo it or interrupt the user.
 */
export async function persistLangToAccount(lang: Lang): Promise<boolean> {
  const headers = await authHeader();
  if (!headers) return false; // signed out (e.g. the landing switcher) — nothing to mirror
  try {
    const res = await fetch(`${API_BASE}/api/users/me`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferred_lang: lang }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
