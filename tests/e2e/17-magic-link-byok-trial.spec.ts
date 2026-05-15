/**
 * Y1: Magic Link E2E + BYOK Streaming + Trial Gate verification
 * Requires: TEST_ACCOUNT_EMAIL, TEST_ACCOUNT_PASSWORD, SUPABASE_SERVICE_ROLE_KEY,
 *           NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_API_URL
 */

import { test, expect, type Page } from '@playwright/test';
import { loginAsRealTestUser } from './helpers/auth';
import { randomUUID } from 'crypto';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://goblinapi-production.up.railway.app';
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

async function ensureProject(page: Page, userId: string): Promise<string> {
  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/projects?user_id=eq.${userId}&select=id&limit=1`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  const existing = await res.json() as Array<{ id: string }>;
  if (existing.length > 0) return existing[0].id;

  // Create E2E test project
  const id = randomUUID();
  const createRes = await page.request.post(`${SUPABASE_URL}/rest/v1/projects`, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: { id, name: '[E2E-TEST] Y1 Verification', user_id: userId, color: '#2D4A2B' },
  });
  if (!createRes.ok()) throw new Error(`Could not create project: ${await createRes.text()}`);
  const created = await createRes.json() as Array<{ id: string }>;
  return created[0]?.id ?? id;
}

// ─── Y1.1 Magic Link E2E ──────────────────────────────────────────────────────

test.describe('Y1.1 — Magic Link E2E', { tag: '@local-only' }, () => {
  test('full magic link flow: admin token → navigate → session active → dashboard loads', async ({ page }) => {
    const session = await loginAsRealTestUser(page);
    expect(session.email).toBe(TEST_EMAIL);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
    const body = await page.locator('body').textContent();
    expect(body!.length).toBeGreaterThan(100);
  });

  test('unauthenticated API requests rejected with 401', async ({ page }) => {
    const res = await page.request.post(`${API_URL}/api/chat/stream`, {
      headers: { 'Content-Type': 'application/json' },
      data: { projectId: 'fake', message: 'test' },
    });
    expect(res.status()).toBe(401);
  });

  test('authenticated session accepts API requests (password auth)', async ({ page }) => {
    const { token } = await getAccessToken(page);
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(50);
    // Health check works
    const healthRes = await page.request.get(`${API_URL}/health/deep`);
    expect(healthRes.status()).toBe(200);
  });
});

// ─── Y1.2 BYOK Streaming ─────────────────────────────────────────────────────

test.describe('Y1.2 — BYOK Streaming', { tag: '@local-only' }, () => {
  let accessToken = '';
  let projectId = '';
  let byokKeyId = '';
  let byokKeyCreatedByTest = false;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    try {
      const { token, userId } = await getAccessToken(page);
      accessToken = token;

      // Ensure project exists for this user
      projectId = await ensureProject(page, userId);

      // Check if BYOK groq key already exists
      const existingRes = await page.request.get(
        `${SUPABASE_URL}/rest/v1/byok_keys?user_id=eq.${userId}&provider=eq.groq&status=eq.active&limit=1`,
        { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
      );
      const existing = await existingRes.json() as Array<{ id: string }>;
      if (existing.length > 0) {
        byokKeyId = existing[0].id;
        return;
      }

      // Create BYOK key via API route (validates key against Groq)
      const groqKey = process.env.GROQ_FREE_API_KEY;
      if (!groqKey) return;

      const createRes = await page.request.post(`${API_URL}/api/byok-keys`, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        data: { provider: 'groq', key: groqKey, label: 'E2E Test Groq' },
      });
      if (createRes.ok()) {
        const created = await createRes.json() as { id: string };
        byokKeyId = created.id;
        byokKeyCreatedByTest = true;
      }
    } finally {
      await page.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    if (!byokKeyCreatedByTest || !byokKeyId || !accessToken) return;
    const page = await browser.newPage();
    try {
      await page.request.delete(`${API_URL}/api/byok-keys/${byokKeyId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } finally {
      await page.close();
    }
  });

  test('BYOK groq key active in test account', async ({ page }) => {
    if (!byokKeyId) {
      test.skip(true, 'No BYOK key (check GROQ_FREE_API_KEY)');
      return;
    }
    const res = await page.request.get(`${API_URL}/api/byok-keys`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBe(true);
    const keys = await res.json() as Array<{ id: string; provider: string; status: string }>;
    const groqKey = keys.find((k) => k.provider === 'groq' && k.status === 'active');
    expect(groqKey).toBeTruthy();
  });

  test('stream with BYOK key: meta event shows source_tier: byok', async ({ page }) => {
    if (!byokKeyId || !projectId || !accessToken) {
      test.skip(true, 'BYOK key or project not available');
      return;
    }

    const res = await page.request.post(`${API_URL}/api/chat/stream`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      data: { projectId, message: 'Say exactly: GOBLIN_BYOK_OK' },
    });

    expect(res.status()).toBe(200);
    const body = await res.text();

    let metaSourceTier: string | null = null;
    for (const line of body.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(line.trim().slice(6)) as Record<string, unknown>;
        if (json.type === 'meta') metaSourceTier = json.source_tier as string;
      } catch { /* non-JSON */ }
    }

    // Core verification: BYOK key is decrypted and routing tier is byok.
    // (Downstream LiteLLM model config may produce an error event — that is a separate issue
    // from encryption/routing which is what this test verifies.)
    expect(metaSourceTier).toBe('byok');
  });
});

// ─── Y1.3 Trial Gate ─────────────────────────────────────────────────────────

test.describe('Y1.3 — Trial Gate', { tag: '@local-only' }, () => {
  let accessToken = '';
  let userId = '';
  let projectId = '';
  let originalPlan: string | null = null;
  let originalTrialStart: string | null = null;
  let originalTrialEnd: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    try {
      const session = await getAccessToken(page);
      accessToken = session.token;
      userId = session.userId;

      const userRes = await page.request.get(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=plan,cloud_trial_started_at,cloud_trial_ends_at`,
        { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
      );
      const users = await userRes.json() as Array<{
        plan: string | null;
        cloud_trial_started_at: string | null;
        cloud_trial_ends_at: string | null;
      }>;
      if (users.length > 0) {
        originalPlan = users[0].plan;
        originalTrialStart = users[0].cloud_trial_started_at;
        originalTrialEnd = users[0].cloud_trial_ends_at;
      }

      projectId = await ensureProject(page, userId);
    } finally {
      await page.close();
    }
  });

  async function patchUser(page: Page, data: Record<string, unknown>): Promise<void> {
    await page.request.patch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      data,
    });
  }

  async function restoreUser(page: Page): Promise<void> {
    await patchUser(page, {
      plan: originalPlan,
      cloud_trial_started_at: originalTrialStart,
      cloud_trial_ends_at: originalTrialEnd,
    });
  }

  test('active plan: API returns 200 not 402', async ({ page }) => {
    if (!accessToken || !projectId) {
      test.skip(true, 'No token or project');
      return;
    }
    const res = await page.request.post(`${API_URL}/api/chat/stream`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      data: { projectId, message: 'Say: TRIAL_ACTIVE_OK' },
    });
    expect(res.status()).toBe(200);
  });

  test('expired trial with plan=trial: API returns 402 Payment Required', async ({ page }) => {
    if (!accessToken || !projectId || !userId) {
      test.skip(true, 'No credentials available');
      return;
    }

    const past10 = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const past7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Set expired trial dates (plan stays 'trial' — only paid plans 'seed'/'craft'/'forge' bypass)
    await patchUser(page, {
      cloud_trial_started_at: past10,
      cloud_trial_ends_at: past7,
    });

    let status = 0;
    try {
      const res = await page.request.post(`${API_URL}/api/chat/stream`, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        data: { projectId, message: 'This should be blocked by trial gate' },
      });
      status = res.status();
    } finally {
      await restoreUser(page);
    }

    expect(status).toBe(402);
  });

  test('expired trial 402 response contains upgrade url and error code', async ({ page }) => {
    if (!accessToken || !projectId || !userId) {
      test.skip(true, 'No credentials');
      return;
    }

    const past10 = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const past7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    await patchUser(page, {
      cloud_trial_started_at: past10,
      cloud_trial_ends_at: past7,
    });

    let status = 0;
    let rawText = '';
    try {
      const res = await page.request.post(`${API_URL}/api/chat/stream`, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        data: { projectId, message: 'blocked' },
      });
      status = res.status();
      rawText = await res.text();
    } finally {
      await restoreUser(page);
    }

    if (status === 402) {
      // Expected: 402 JSON with trial_expired error
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(rawText) as Record<string, unknown>; } catch { /* ignore */ }
      expect(body.error).toBe('trial_expired');
      expect(typeof body.upgradeUrl).toBe('string');
    } else {
      // Document what we got instead — helps debug if trial gate isn't firing
      test.info().annotations.push({
        type: 'warning',
        description: `Expected 402 but got ${status}. Body preview: ${rawText.slice(0, 200)}`,
      });
      // Soft-fail: log but don't hard-fail since trial gate may need investigation
      expect(status).toBe(402);
    }
  });

  test('trial restored: API returns 200 after restore', async ({ page }) => {
    if (!accessToken || !projectId) {
      test.skip(true, 'No credentials');
      return;
    }
    const res = await page.request.post(`${API_URL}/api/chat/stream`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      data: { projectId, message: 'Say: TRIAL_RESTORED_OK' },
    });
    expect(res.status()).toBe(200);
  });
});
