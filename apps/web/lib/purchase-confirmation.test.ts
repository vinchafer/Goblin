// F-32 (FIX-WAVE 3) GATE — the purchase-confirmation moment.
//   • renders on a VERIFIED paid upgrade with correct, single-sourced plan values;
//   • NEVER renders on a failed / pending checkout (unverified state);
//   • shows once per plan.

import { describe, it, expect } from 'vitest';
import {
  shouldShowPurchaseConfirmation,
  unlockedFeatures,
  planDisplayName,
  isPaidPlan,
} from './purchase-confirmation';
import { PLAN_BUILDS } from './plan-builds';
import { STORAGE_GB } from './plan-storage';

describe('shouldShowPurchaseConfirmation — the verified-state gate', () => {
  it('shows on a fresh VERIFIED paid upgrade', () => {
    expect(shouldShowPurchaseConfirmation({ planState: 'paid', plan: 'build', lastConfirmedPlan: null }))
      .toEqual({ show: true, plan: 'build' });
    expect(shouldShowPurchaseConfirmation({ planState: 'paid', plan: 'power', lastConfirmedPlan: null }))
      .toEqual({ show: true, plan: 'power' });
  });

  it('NEVER shows on a still-pending / failed checkout (state not yet verified)', () => {
    // checkout redirect: webhook has not flipped the plan → planState still trial/undefined
    expect(shouldShowPurchaseConfirmation({ planState: 'trial', plan: 'build', lastConfirmedPlan: null }).show).toBe(false);
    expect(shouldShowPurchaseConfirmation({ planState: undefined, plan: 'build', lastConfirmedPlan: null }).show).toBe(false);
    expect(shouldShowPurchaseConfirmation({ planState: 'none', plan: null, lastConfirmedPlan: null }).show).toBe(false);
  });

  it('does not celebrate a comped account (not a purchase)', () => {
    expect(shouldShowPurchaseConfirmation({ planState: 'comped', plan: 'pro', lastConfirmedPlan: null }).show).toBe(false);
  });

  it('shows once per plan — not again once acknowledged', () => {
    expect(shouldShowPurchaseConfirmation({ planState: 'paid', plan: 'pro', lastConfirmedPlan: 'pro' }).show).toBe(false);
    // but a subsequent UPGRADE to a different paid plan celebrates again
    expect(shouldShowPurchaseConfirmation({ planState: 'paid', plan: 'power', lastConfirmedPlan: 'pro' }))
      .toEqual({ show: true, plan: 'power' });
  });

  it('ignores an unknown / non-paid plan key even when planState says paid', () => {
    expect(shouldShowPurchaseConfirmation({ planState: 'paid', plan: 'enterprise', lastConfirmedPlan: null }).show).toBe(false);
    expect(shouldShowPurchaseConfirmation({ planState: 'paid', plan: 'trial', lastConfirmedPlan: null }).show).toBe(false);
  });
});

describe('isPaidPlan', () => {
  it('recognises only the three paid plans', () => {
    expect(isPaidPlan('build')).toBe(true);
    expect(isPaidPlan('pro')).toBe(true);
    expect(isPaidPlan('power')).toBe(true);
    expect(isPaidPlan('trial')).toBe(false);
    expect(isPaidPlan('none')).toBe(false);
    expect(isPaidPlan(null)).toBe(false);
    expect(isPaidPlan(undefined)).toBe(false);
  });
});

describe('unlockedFeatures — real single-sourced numbers, DE + EN', () => {
  it('uses the exact PLAN_BUILDS + STORAGE_GB values (never hardcoded)', () => {
    const de = unlockedFeatures('pro', 'de');
    expect(de[0]).toContain(String(PLAN_BUILDS.pro)); // 200
    expect(de[1]).toContain(`${STORAGE_GB.pro} GB`);  // 40 GB
    expect(de[1]).toContain('Cloud-Speicher');

    const en = unlockedFeatures('power', 'en');
    expect(en[0]).toContain(PLAN_BUILDS.power.toLocaleString('en-US')); // 411
    expect(en[1]).toContain(`${STORAGE_GB.power} GB`); // 100 GB
    expect(en[1]).toContain('cloud storage');
  });

  it('keeps the Builds figure honest (estimate qualifier)', () => {
    expect(unlockedFeatures('build', 'de')[0]).toContain('≈');
    expect(unlockedFeatures('build', 'de')[0]).toContain('je nach Komplexität');
    expect(unlockedFeatures('build', 'en')[0]).toContain('varies by complexity');
  });
});

describe('planDisplayName', () => {
  it('capitalises the plan key for the headline', () => {
    expect(planDisplayName('build')).toBe('Build');
    expect(planDisplayName('pro')).toBe('Pro');
    expect(planDisplayName('power')).toBe('Power');
  });
});
