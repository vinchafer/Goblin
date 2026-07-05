/**
 * TRIAL-7 T2 — achievement-triggered upgrade card.
 *
 * The card is shown once per user, to active-trial users only, at their first
 * truth-gated successful publish. "Once" and "trial-only" are enforced server-side
 * (users.achievement_upgrade_card_seen_at + derived plan truth). The client renders
 * the card iff GET /api/users/me/achievement-card returns { show: true } and stamps
 * it seen via POST .../seen — so this suite asserts that server contract directly
 * (the client renders it 1:1). No live Vercel deploy is needed to prove the card
 * logic: the deploy verification itself is covered by the FEEL-1 truth-gate tests.
 *
 * REQUIRES migration 0079_achievement_upgrade_card.sql applied to the target DB.
 * Requires: TEST_ACCOUNT_EMAIL, TEST_ACCOUNT_PASSWORD, SUPABASE_SERVICE_ROLE_KEY,
 *           NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_API_URL
 */

import { test, expect, type Page } from '@playwright/test';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = process.env.TEST_ACCOUNT_EMAIL!;
const TEST_PASSWORD = process.env.TEST_ACCOUNT_PASSWORD!;

async function getAccessToken(page: Page): Promise<{ token: string; userId: string }> {
  const res = await page.request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE },
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  if (!res.ok()) throw new Error(`Password auth failed: ${await res.text()}`);
  const body = await res.json() as { access_token: string; user: { id: string } };
  return { token: body.access_token, userId: body.user.id };
}

test.describe('TRIAL-7 T2 — achievement upgrade card', { tag: '@local-only' }, () => {
  let accessToken = '';
  let userId = '';
  // Snapshot to restore — never leave the test account mutated.
  let snap: Record<string, unknown> = {};

  const SELECT = 'plan,stripe_subscription_id,cloud_trial_started_at,cloud_trial_ends_at,trial_consumed_at,is_comped,achievement_upgrade_card_seen_at';

  async function patchUser(page: Page, data: Record<string, unknown>): Promise<void> {
    await page.request.patch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      data,
    });
  }
  async function cardShow(page: Page, token = accessToken): Promise<boolean> {
    const res = await page.request.get(`${API_URL}/api/users/me/achievement-card`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    return ((await res.json()) as { show: boolean }).show;
  }
  async function markSeen(page: Page, token = accessToken): Promise<void> {
    const res = await page.request.post(`${API_URL}/api/users/me/achievement-card/seen`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  }

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    try {
      const session = await getAccessToken(page);
      accessToken = session.token;
      userId = session.userId;
      const res = await page.request.get(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=${SELECT}`,
        { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
      );
      snap = ((await res.json()) as Array<Record<string, unknown>>)[0] ?? {};
    } finally { await page.close(); }
  });

  test.afterAll(async ({ browser }) => {
    if (!userId) return;
    const page = await browser.newPage();
    try { await patchUser(page, snap); } finally { await page.close(); }
  });

  // Put the account in a fresh active-trial state with the card never shown.
  async function setActiveTrialUnseen(page: Page): Promise<void> {
    const future = new Date(Date.now() + 5 * 86400000).toISOString();
    await patchUser(page, {
      plan: 'trial', stripe_subscription_id: null, is_comped: false,
      cloud_trial_started_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      cloud_trial_ends_at: future, trial_consumed_at: null,
      achievement_upgrade_card_seen_at: null,
    });
  }

  test('active trial, never shown → card is owed (show=true)', async ({ page }) => {
    if (!accessToken) return test.skip(true, 'no creds');
    await setActiveTrialUnseen(page);
    expect(await cardShow(page)).toBe(true);
  });

  test('appears exactly once: after seen, a second publish shows nothing', async ({ page }) => {
    if (!accessToken) return test.skip(true, 'no creds');
    await setActiveTrialUnseen(page);
    expect(await cardShow(page)).toBe(true);   // first truth-gated publish
    await markSeen(page);                       // card shown → stamped
    expect(await cardShow(page)).toBe(false);   // second publish → no card
  });

  test('dismiss persists across a fresh login (re-auth)', async ({ page, browser }) => {
    if (!accessToken) return test.skip(true, 'no creds');
    await setActiveTrialUnseen(page);
    await markSeen(page);
    // Fresh session = new token, mimicking reload/login.
    const fresh = await browser.newPage();
    try {
      const s = await getAccessToken(fresh);
      expect(await cardShow(fresh, s.token)).toBe(false);
    } finally { await fresh.close(); }
  });

  test('trial-only: a paid subscriber is never shown the card', async ({ page }) => {
    if (!accessToken) return test.skip(true, 'no creds');
    await patchUser(page, {
      plan: 'build', stripe_subscription_id: 'sub_e2e_trial7', is_comped: false,
      trial_consumed_at: new Date().toISOString(),
      cloud_trial_ends_at: new Date(Date.now() + 5 * 86400000).toISOString(),
      achievement_upgrade_card_seen_at: null,   // even unseen → still no card
    });
    expect(await cardShow(page)).toBe(false);
  });
});
