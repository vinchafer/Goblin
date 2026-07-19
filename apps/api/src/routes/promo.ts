// LAUNCH-ASSIST U2: promo-code redemption (authenticated user).
//
// POST /api/promo/redeem { code, lang? } → atomic single-use claim + 30-day top-tier
// grant via the redeem_promo_code() SQL function (migration 0098). The function does
// the WHOLE thing in one transaction (per-account lock → policy checks → conditional
// single-use claim → grant), so there is no race and no partial state. This route only
// normalizes input, calls the function, and maps its status to honest DE+EN copy.
//
// PRE-MIGRATION TOLERANT: before 0098 is applied the function does not exist → the rpc
// errors → we return an honest "noch nicht verfügbar" (200 with ok:false), never a 500.

import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import logger from '../lib/logger';
import {
  normalizePromoCode,
  isValidPromoCodeFormat,
  promoRedeemCopy,
  type PromoRedeemStatus,
} from '../lib/promo-code';

type Variables = { userId: string };
export const promo = new Hono<{ Variables: Variables }>();

const RedeemSchema = z.object({
  code: z.string().min(3).max(64),
  lang: z.enum(['de', 'en']).optional(),
});

// PostgREST/Postgres signals for "the function/table isn't there yet" (pre-migration).
function isMissingObjectError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = err.code ?? '';
  const msg = (err.message ?? '').toLowerCase();
  return (
    code === 'PGRST202' ||            // PostgREST: function not found in schema cache
    code === '42883' ||              // undefined_function
    code === '42P01' ||              // undefined_table
    /could not find the function|does not exist|schema cache/.test(msg)
  );
}

promo.post('/redeem', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const parsed = RedeemSchema.safeParse(body);
  const lang: 'de' | 'en' = (parsed.success && parsed.data.lang) || 'de';

  if (!parsed.success) {
    return c.json(promoRedeemCopy('invalid', lang), 400);
  }

  const code = normalizePromoCode(parsed.data.code);
  // Cheap client-side-style guard: a code that can't match the canonical shape can't
  // exist, so answer 'invalid' without a DB round-trip (and without leaking timing).
  if (!isValidPromoCodeFormat(code)) {
    return c.json(promoRedeemCopy('invalid', lang), 400);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('redeem_promo_code', {
    p_code: code,
    p_user: userId,
  });

  if (error) {
    if (isMissingObjectError(error)) {
      // Migration 0098 not applied yet — honest, not a crash.
      return c.json(promoRedeemCopy('unavailable', lang));
    }
    logger.error({ err: error.message, userId }, 'promo redeem rpc failed');
    return c.json(promoRedeemCopy('error', lang), 500);
  }

  const result = (data ?? {}) as { status?: PromoRedeemStatus; days?: number; comped_until?: string };
  const status = (result.status ?? 'error') as PromoRedeemStatus;
  const copy = promoRedeemCopy(status, lang, result.days ?? 30);
  return c.json(
    { ...copy, status, compedUntil: result.comped_until ?? null },
    copy.ok ? 200 : 400,
  );
});
