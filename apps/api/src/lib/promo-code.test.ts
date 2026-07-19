// LAUNCH-ASSIST U2 gate: promo-code generation, format, normalization, and the
// honest DE+EN redemption copy. Pure logic (no DB), deterministic.
import { describe, it, expect } from 'vitest';
import {
  PROMO_CHARSET,
  generatePromoCode,
  generatePromoCodes,
  isValidPromoCodeFormat,
  normalizePromoCode,
  promoRedeemCopy,
} from './promo-code';

describe('generatePromoCode — shape + unambiguous charset', () => {
  it('matches GOBLIN-XXXX-XXXX', () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePromoCode()).toMatch(/^GOBLIN-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    }
  });
  it('never emits the ambiguous chars 0 O 1 I L', () => {
    const body = generatePromoCodes(300).map((c) => c.slice('GOBLIN-'.length).replace(/-/g, '')).join('');
    expect(body).not.toMatch(/[01OIL]/);
    for (const ch of body) expect(PROMO_CHARSET).toContain(ch);
  });
  it('generatePromoCodes returns N distinct codes', () => {
    const codes = generatePromoCodes(50);
    expect(codes).toHaveLength(50);
    expect(new Set(codes).size).toBe(50);
  });
});

describe('isValidPromoCodeFormat', () => {
  it('accepts canonical codes', () => {
    expect(isValidPromoCodeFormat('GOBLIN-VB3D-F2MK')).toBe(true);
  });
  it('rejects wrong prefix, ambiguous chars, bad grouping, lowercase', () => {
    expect(isValidPromoCodeFormat('GOBLIN-VB3D-F2M0')).toBe(false); // 0 not in charset
    expect(isValidPromoCodeFormat('GOBLIN-VB3D-F2MI')).toBe(false); // I not in charset
    expect(isValidPromoCodeFormat('OTHER-VB3D-F2MK')).toBe(false);
    expect(isValidPromoCodeFormat('GOBLIN-VB3D')).toBe(false);
    expect(isValidPromoCodeFormat('goblin-vb3d-f2mk')).toBe(false); // must be normalized first
  });
});

describe('normalizePromoCode', () => {
  it('trims, uppercases, strips whitespace', () => {
    expect(normalizePromoCode('  goblin-vb3d-f2mk ')).toBe('GOBLIN-VB3D-F2MK');
    expect(normalizePromoCode('goblin- vb3d -f2mk')).toBe('GOBLIN-VB3D-F2MK');
  });
});

describe('promoRedeemCopy — honest DE+EN per status', () => {
  it('ok carries the day count and is ok:true, DE + EN', () => {
    expect(promoRedeemCopy('ok', 'de', 30)).toEqual({ ok: true, message: expect.stringContaining('30 Tage') });
    expect(promoRedeemCopy('ok', 'en', 30)).toEqual({ ok: true, message: expect.stringContaining('30 days') });
  });
  it('every failure status is ok:false with a non-empty message in both languages', () => {
    const statuses = ['invalid', 'revoked', 'already_redeemed', 'already_redeemed_account',
      'already_paying', 'already_comped', 'user_not_found', 'unavailable', 'error'] as const;
    for (const s of statuses) {
      for (const lang of ['de', 'en'] as const) {
        const r = promoRedeemCopy(s, lang);
        expect(r.ok).toBe(false);
        expect(r.message.length).toBeGreaterThan(0);
      }
    }
  });
  it('already_paying is honest about being an active plan (no false claim)', () => {
    expect(promoRedeemCopy('already_paying', 'de').message).toMatch(/Abo/);
    expect(promoRedeemCopy('already_paying', 'en').message).toMatch(/plan/i);
  });
  it('unavailable (pre-migration) never claims success', () => {
    expect(promoRedeemCopy('unavailable', 'de').ok).toBe(false);
    expect(promoRedeemCopy('unavailable', 'en').message).toMatch(/available/i);
  });
});
