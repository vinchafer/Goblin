'use client';

// LAUNCH-ASSIST U2: client helper for redeeming a promo code against the API.
// Shared by the settings/billing field and the post-signup pending-redeemer so the
// redemption call lives in exactly one place.

import { createClient } from '@/lib/supabase/client';
import type { Lang } from '@/lib/use-lang';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

// A code typed at signup (no session yet — email confirmation pending) is stashed here
// and redeemed on the first authenticated load.
export const PENDING_PROMO_KEY = 'goblin:pending-promo';

export interface RedeemResult {
  ok: boolean;
  message: string;
  status?: string;
  noSession?: boolean;
}

/** Redeem `code`. Requires an active session; returns {noSession:true} if signed out. */
export async function redeemPromoCode(code: string, lang: Lang): Promise<RedeemResult> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, message: lang === 'en' ? 'Enter a code.' : 'Bitte gib einen Code ein.' };
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return {
      ok: false, noSession: true,
      message: lang === 'en'
        ? 'Sign in to redeem your code.'
        : 'Melde dich an, um deinen Code einzulösen.',
    };
  }
  try {
    const r = await fetch(`${API_BASE}/api/promo/redeem`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: trimmed, lang }),
    });
    const d = await r.json().catch(() => ({}));
    return {
      ok: !!d.ok,
      message: d.message ?? (lang === 'en' ? 'Redemption failed.' : 'Einlösung fehlgeschlagen.'),
      status: d.status,
    };
  } catch {
    return { ok: false, message: lang === 'en' ? 'Network error.' : 'Netzwerkfehler.' };
  }
}
