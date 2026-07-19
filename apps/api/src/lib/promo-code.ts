// LAUNCH-ASSIST U2: human-friendly, crypto-random promo codes.
//
// Format: GOBLIN-XXXX-XXXX — a fixed prefix plus two groups of four from an
// UNAMBIGUOUS charset (no 0/O, no 1/I/L) so a code read off a phone screen and
// typed into WhatsApp/Notes can't be mis-keyed. Randomness comes from Node's
// crypto (rejection-sampled to avoid modulo bias), never Math.random.

import { randomInt } from 'crypto';

/** Unambiguous charset: digits 2-9 + A-Z minus I, L, O (and no 0/1). 31 symbols. */
export const PROMO_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const PROMO_PREFIX = 'GOBLIN';
const GROUP_LEN = 4;
const GROUPS = 2;

/** One random symbol from PROMO_CHARSET, unbiased (randomInt is rejection-sampled). */
function randomSymbol(): string {
  return PROMO_CHARSET.charAt(randomInt(0, PROMO_CHARSET.length));
}

/** Generate a single code, e.g. "GOBLIN-7K4M-QP9X". Crypto-random. */
export function generatePromoCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let s = '';
    for (let i = 0; i < GROUP_LEN; i++) s += randomSymbol();
    groups.push(s);
  }
  return `${PROMO_PREFIX}-${groups.join('-')}`;
}

const CODE_RE = new RegExp(
  `^${PROMO_PREFIX}-[${PROMO_CHARSET}]{${GROUP_LEN}}-[${PROMO_CHARSET}]{${GROUP_LEN}}$`,
);

/** True if `code` matches the canonical GOBLIN-XXXX-XXXX shape and charset. */
export function isValidPromoCodeFormat(code: string): boolean {
  return CODE_RE.test(code);
}

/**
 * Normalize user input before lookup: trim, uppercase, and map the few glyphs a
 * human is likely to substitute from the excluded set (O→0 is NOT in our charset,
 * so O must map to the visually-nearest allowed symbol Q? no — safer to map the
 * ambiguous typed chars to their intended members). We only fold case/space here;
 * the excluded chars simply won't match, yielding an honest "invalid" rather than a
 * wrong grant.
 */
export function normalizePromoCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

/** Generate `n` distinct codes (collision-checked in-process; DB unique is the real guard). */
export function generatePromoCodes(n: number): string[] {
  const out = new Set<string>();
  while (out.size < n) out.add(generatePromoCode());
  return [...out];
}

// ── Redemption result → honest DE+EN copy ───────────────────────────────────────────
// The redeem_promo_code() function (migration 0098) returns one of these statuses.
// 'unavailable' is the API's own pre-migration status (function absent). Every string
// is honest: it names exactly what happened, never claims an un-happened state.
export type PromoRedeemStatus =
  | 'ok'
  | 'invalid'
  | 'revoked'
  | 'already_redeemed'
  | 'already_redeemed_account'
  | 'already_paying'
  | 'already_comped'
  | 'user_not_found'
  | 'unavailable'
  | 'error';

export interface PromoRedeemCopy { ok: boolean; message: string; }

/** Map a redemption status to user-facing copy in the user's language. Pure/testable. */
export function promoRedeemCopy(status: PromoRedeemStatus, lang: 'de' | 'en', days = 30): PromoRedeemCopy {
  const de = lang === 'de';
  switch (status) {
    case 'ok':
      return { ok: true, message: de
        ? `Code eingelöst — du hast jetzt ${days} Tage die beste Version. Viel Spaß!`
        : `Code redeemed — you now have ${days} days of the top plan. Enjoy!` };
    case 'invalid':
      return { ok: false, message: de ? 'Diesen Code gibt es nicht. Bitte prüfe die Schreibweise.' : 'That code doesn’t exist. Please check the spelling.' };
    case 'revoked':
      return { ok: false, message: de ? 'Dieser Code wurde deaktiviert.' : 'This code has been deactivated.' };
    case 'already_redeemed':
      return { ok: false, message: de ? 'Dieser Code wurde bereits eingelöst.' : 'This code has already been redeemed.' };
    case 'already_redeemed_account':
      return { ok: false, message: de ? 'Du hast bereits einen Code eingelöst.' : 'You’ve already redeemed a code.' };
    case 'already_paying':
      return { ok: false, message: de
        ? 'Du hast bereits ein aktives Abo — der Code ist für Konten ohne Abo gedacht. Heb ihn dir auf.'
        : 'You already have an active plan — the code is for accounts without a plan. Keep it for later.' };
    case 'already_comped':
      return { ok: false, message: de ? 'Dein Konto hat bereits Vollzugriff.' : 'Your account already has full access.' };
    case 'user_not_found':
      return { ok: false, message: de ? 'Konto nicht gefunden. Bitte melde dich neu an.' : 'Account not found. Please sign in again.' };
    case 'unavailable':
      return { ok: false, message: de ? 'Code-Einlösung ist noch nicht verfügbar. Bitte versuche es später.' : 'Code redemption isn’t available yet. Please try again later.' };
    default:
      return { ok: false, message: de ? 'Einlösung fehlgeschlagen. Bitte versuche es erneut.' : 'Redemption failed. Please try again.' };
  }
}
