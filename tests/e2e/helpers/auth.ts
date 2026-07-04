import { type Page, type Locator, type BrowserContext } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_AUTH_TOKEN || 'goblin-playwright-test-token-2026';

export interface RealTestSession {
  email: string;
}

/**
 * Login with the real Goblin test account.
 * Uses Supabase Admin API to generate a magic link, then navigates to it.
 * This sets proper server-side cookies (works on local + production).
 * Account has free-pool access — can test streaming, routing, etc.
 * Do NOT delete this account after tests.
 */
export async function loginAsRealTestUser(page: Page): Promise<RealTestSession> {
  const email = process.env.TEST_ACCOUNT_EMAIL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email) throw new Error('TEST_ACCOUNT_EMAIL must be set in .env');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  }

  // /auth/magic-callback handles the hash-fragment tokens (works on local + production)
  const redirectTo = `${BASE_URL}/auth/magic-callback`;

  // Use Supabase Admin API to generate a magic link for the real test account
  const res = await page.request.post(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    data: { type: 'magiclink', email, options: { redirectTo } },
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Magic link generation failed (${res.status()}): ${body}`);
  }

  const data = await res.json() as { action_link?: string; properties?: { action_link?: string } };
  const link = data.action_link || data.properties?.action_link;

  if (!link) throw new Error(`No action_link in response: ${JSON.stringify(data)}`);

  // Navigate through the magic link → /auth/magic-callback → /dashboard
  await page.goto(link);
  await page.waitForLoadState('domcontentloaded');

  // Supabase may redirect to site root if redirectTo is not in allowlist.
  // Detect this and manually navigate to magic-callback with the hash preserved.
  // IMPORTANT: use the CURRENT origin (after redirect) to avoid 307 non-www→www redirect
  // which drops the hash fragment.
  const currentUrl = page.url();
  const parsed = new URL(currentUrl);
  const hash = parsed.hash;
  if (hash.includes('access_token') && !currentUrl.includes('/auth/')) {
    // Use the current origin to stay on the same domain (avoids redirect loop that drops hash)
    const sameOriginCallbackUrl = `${parsed.origin}/auth/magic-callback${hash}`;
    await page.goto(sameOriginCallbackUrl);
  }

  await page.waitForURL(/\/dashboard/, { timeout: 35000 });

  // Ensure the test account stays comped so trial/quota walls don't block @auth
  // tests (idempotent — no-op if already comped). The real test account is a
  // long-lived shared fixture; without this, trial-gate flips it back to
  // trial_expired a few days after creation and every @auth flow that hits
  // create-project / streaming starts failing in CI.
  await ensureTestAccountComped(page, email);

  return { email };
}

/**
 * Login via the /auth/test-callback route (requires NEXT_PUBLIC_ENABLE_TEST_AUTH=true
 * on the web dev server). More reliable on non-3000 local ports than the implicit
 * magic-callback, which needs the port in Supabase's redirect allowlist. Mints a
 * session admin-side (generate_link → verify OTP) and hands the tokens to
 * test-callback, which calls setSession client-side → writes the @supabase/ssr
 * cookies → /dashboard. See memory `goblin-local-e2e-browser`.
 */
export async function loginAsTestCallback(page: Page): Promise<RealTestSession> {
  const email = process.env.TEST_ACCOUNT_EMAIL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!email) throw new Error('TEST_ACCOUNT_EMAIL must be set');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
  }

  // 1. Admin-generate a magiclink to obtain the email OTP.
  const gen = await page.request.post(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    headers: { 'Content-Type': 'application/json', apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    data: { type: 'magiclink', email },
  });
  if (!gen.ok()) throw new Error(`generate_link failed (${gen.status()}): ${await gen.text()}`);
  const gj = (await gen.json()) as { email_otp?: string; properties?: { email_otp?: string } };
  const otp = gj.email_otp || gj.properties?.email_otp;
  if (!otp) throw new Error(`no email_otp in generate_link response: ${JSON.stringify(gj)}`);

  // 2. Verify the OTP (anon) → session tokens.
  const ver = await page.request.post(`${supabaseUrl}/auth/v1/verify`, {
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    data: { type: 'magiclink', email, token: otp },
  });
  if (!ver.ok()) throw new Error(`verify failed (${ver.status()}): ${await ver.text()}`);
  const vj = (await ver.json()) as { access_token?: string; refresh_token?: string };
  if (!vj.access_token || !vj.refresh_token) throw new Error(`no tokens from verify: ${JSON.stringify(vj)}`);

  // 3. Hand tokens to test-callback → setSession → cookies → /dashboard.
  await page.goto(`${BASE_URL}/auth/test-callback#access_token=${vj.access_token}&refresh_token=${vj.refresh_token}`);
  await page.waitForURL(/\/dashboard/, { timeout: 35000 });
  await ensureTestAccountComped(page, email);
  return { email };
}

/**
 * Resolve a project id for the test account WITHOUT depending on dashboard DOM
 * (the `.project-row` selector openFirstProject uses is stale after the 9C/9D
 * shell redesign — projects now live in the sidebar). Returns the first existing
 * project, or creates one with the required NOT-NULL fields. Service-role REST.
 */
export async function resolveTestProjectId(page: Page): Promise<string> {
  const email = process.env.TEST_ACCOUNT_EMAIL;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email || !url || !sr) throw new Error('resolveTestProjectId env missing');
  const h = { apikey: sr, Authorization: `Bearer ${sr}` };

  const u = await page.request.get(`${url}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id`, { headers: h });
  const uid = ((await u.json()) as Array<{ id: string }>)[0]?.id;
  if (!uid) throw new Error('test user not found');

  const p = await page.request.get(`${url}/rest/v1/projects?user_id=eq.${uid}&select=id&limit=1`, { headers: h });
  const rows = (await p.json()) as Array<{ id: string }>;
  if (rows[0]) return rows[0].id;

  const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`);
  await page.request.post(`${url}/rest/v1/projects`, {
    headers: { ...h, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    data: { id, name: '[E2E-TEST] chat-io', user_id: uid, intent: 'web_app', color: '#2D4A2B' },
  });
  return id;
}

/**
 * Create a project-bound chat session (service-role) and return its id. The chat
 * composer (ChatInput) lives at /dashboard/chat/[sessionId] (StandaloneChat) — the
 * project overview page has no live composer. Project-bound → hasProject=true so
 * the per-card "Ins Projekt übernehmen" (C3) resolves a known target.
 */
export async function createProjectChatSession(page: Page, projectId: string): Promise<string> {
  const email = process.env.TEST_ACCOUNT_EMAIL;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email || !url || !sr) throw new Error('createProjectChatSession env missing');
  const h = { apikey: sr, Authorization: `Bearer ${sr}` };

  const u = await page.request.get(`${url}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id`, { headers: h });
  const uid = ((await u.json()) as Array<{ id: string }>)[0]?.id;
  if (!uid) throw new Error('test user not found');

  const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`);
  const res = await page.request.post(`${url}/rest/v1/chat_sessions`, {
    headers: { ...h, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    data: { id, user_id: uid, project_id: projectId, title: '[E2E-TEST] chat-io' },
  });
  if (!res.ok()) throw new Error(`create chat_session failed (${res.status()}): ${await res.text()}`);
  return id;
}

/** Mint a real user access token (generate_link → verify) for authed API calls. */
export async function mintUserToken(page: Page): Promise<string> {
  const email = process.env.TEST_ACCOUNT_EMAIL;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!email || !url || !sr || !anon) throw new Error('mintUserToken env missing');
  const gen = await page.request.post(`${url}/auth/v1/admin/generate_link`, {
    headers: { 'Content-Type': 'application/json', apikey: sr, Authorization: `Bearer ${sr}` },
    data: { type: 'magiclink', email },
  });
  const otp = ((await gen.json()) as { email_otp?: string }).email_otp;
  if (!otp) throw new Error('no email_otp');
  const ver = await page.request.post(`${url}/auth/v1/verify`, {
    headers: { 'Content-Type': 'application/json', apikey: anon },
    data: { type: 'magiclink', email, token: otp },
  });
  const at = ((await ver.json()) as { access_token?: string }).access_token;
  if (!at) throw new Error('no access_token');
  return at;
}

/** Seed a text file into a project's storage (authed) so e.g. the ZIP export is non-empty. */
export async function seedProjectFile(page: Page, projectId: string, filePath: string, content: string): Promise<void> {
  const token = await mintUserToken(page);
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const res = await page.request.post(`${apiBase}/api/projects/${projectId}/files`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { path: filePath, content },
  });
  if (!res.ok()) throw new Error(`seedProjectFile failed (${res.status()}): ${await res.text()}`);
}

async function ensureTestAccountComped(page: Page, email: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  try {
    const lookup = await page.request.get(
      `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,is_comped`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
    );
    if (!lookup.ok()) return;
    const rows = (await lookup.json()) as Array<{ id: string; is_comped: boolean }>;
    const user = rows[0];
    if (!user || user.is_comped) return;

    await page.request.patch(
      `${supabaseUrl}/rest/v1/users?id=eq.${user.id}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        data: { is_comped: true, comp_reason: 'E2E test account — permanent comp' },
      }
    );
  } catch {
    // Best-effort; if comp enforcement fails, downstream tests will surface
    // the real error instead of failing silently here.
  }
}

/**
 * Login via actual password UI — use this to test the password login page itself.
 * Use loginAsRealTestUser() for all other tests that just need to be authenticated.
 */
export async function loginViaPasswordUI(page: Page): Promise<void> {
  const email = process.env.TEST_ACCOUNT_EMAIL;
  const password = process.env.TEST_ACCOUNT_PASSWORD;

  if (!email || !password) {
    throw new Error('TEST_ACCOUNT_EMAIL and TEST_ACCOUNT_PASSWORD must be set in .env');
  }

  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  // Switch to Password tab
  const pwTab = page.locator('button').filter({ hasText: /Password/ }).last();
  await pwTab.waitFor({ state: 'visible', timeout: 10000 });
  await pwTab.click();

  await page.getByPlaceholder('your@email.com').fill(email);
  // Target password input by type, scoped to visible form
  await page.locator('input[type="password"]').fill(password);
  // Submit via keyboard — avoids ambiguous button text
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
}

/**
 * Cleanup only test-created projects (prefix [E2E-TEST]).
 * Never deletes the real test account.
 */
export async function cleanupTestProjects(page: Page): Promise<void> {
  await page.request.delete(`${BASE_URL}/api/test-auth/projects`, {
    headers: {
      'X-Test-Auth-Token': TEST_TOKEN,
      'Content-Type': 'application/json',
    },
    data: { namePrefix: '[E2E-TEST]' },
  }).catch(() => { /* ignore — endpoint may not exist yet */ });
}

export interface TestSession {
  email: string;
  userId: string;
  projectId: string | null;
}

// Track created users for cleanup
const createdUsers: string[] = [];

export async function loginAsTestUser(
  page: Page,
  options: { email?: string; plan?: string; createProject?: boolean } = {}
): Promise<TestSession> {
  const res = await page.request.post(`${BASE_URL}/api/test-auth`, {
    headers: {
      'X-Test-Auth-Token': TEST_TOKEN,
      'Content-Type': 'application/json',
    },
    data: {
      email: options.email,
      plan: options.plan || 'seed',
      createProject: options.createProject !== false, // default true
      redirectTo: `${BASE_URL}/auth/test-callback`,
    },
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Test auth failed (${res.status()}): ${body}`);
  }

  const { email, userId, projectId, magicLink } = await res.json();
  if (!createdUsers.includes(userId)) createdUsers.push(userId);

  // Navigate through magic link → sets auth cookies
  await page.goto(magicLink);

  // Wait for redirect to dashboard (or onboarding for new users)
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20000 });

  return { email, userId, projectId };
}

export async function logoutTestUser(page: Page): Promise<void> {
  const pill = page.locator('[data-testid="user-pill"]');
  if (await pill.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pill.click();
    const logoutBtn = page.locator('button, a').filter({ hasText: /Abmelden|Logout|Sign out/i }).first();
    await logoutBtn.click().catch(() => {});
  }
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/`);
}

// ─── Device-aware account-menu / settings helpers ──────────────────────────────
// The 9D shell intentionally renders two shapes per surface
// (AvatarMenu.tsx, settings-sheet.tsx, SettingsModal.tsx):
//   • avatar menu : desktop → [data-testid="avatar-menu-popover"], mobile → [data-testid="avatar-menu-sheet"]
//   • settings    : desktop → [data-testid="settings-modal"]       , mobile → [data-testid="settings-sheet"]
// These helpers open whichever the viewport produces, so specs assert the
// *behaviour* ("menu opens", "settings opens", "section reachable") and survive
// the next copy/layout redesign. The menu BODY (avatar-menu-settings, the
// "Hilfe" row, etc.) and the section pages (ProfilePage, ModelsPage) are shared
// components, so post-open assertions are identical across both shells.

/** Desktop = the 9D anchored popover / two-pane modal (≥768px, matchMedia in the shell). */
export function isDesktopViewport(page: Page): boolean {
  const vp = page.viewportSize();
  return !!vp && vp.width >= 768;
}

/** Open the account (avatar) menu. Resolves once the popover OR the sheet is visible. */
export async function openAvatarMenu(page: Page): Promise<Locator> {
  const avatar = page.locator('[data-testid="header-avatar"]');
  await avatar.waitFor({ state: 'visible', timeout: 10000 });
  await avatar.click();
  const menu = page.locator('[data-testid="avatar-menu-popover"], [data-testid="avatar-menu-sheet"]').first();
  await menu.waitFor({ state: 'visible', timeout: 5000 });
  return menu;
}

/** Open Settings via the avatar menu. Resolves to the settings surface
 *  (desktop modal or mobile sheet), whichever the viewport renders. */
export async function openSettings(page: Page): Promise<Locator> {
  await openAvatarMenu(page);
  await page.click('[data-testid="avatar-menu-settings"]');
  const surface = page.locator('[data-testid="settings-modal"], [data-testid="settings-sheet"]').first();
  await surface.waitFor({ state: 'visible', timeout: 5000 });
  return surface;
}

/** Open a named settings section. Mobile uses the SettingsRoot row test-id;
 *  desktop uses the left-nav button label (same German label in both). */
export async function openSettingsSection(page: Page, rowTestId: string, label: string): Promise<Locator> {
  const surface = await openSettings(page);
  if (isDesktopViewport(page)) {
    await surface.getByRole('button', { name: label, exact: true }).first().click();
  } else {
    await page.locator(`[data-testid="${rowTestId}"]`).click();
  }
  return surface;
}

// Dismiss FirstRunTour if present
export async function dismissTour(page: Page): Promise<void> {
  const skipBtn = page.locator('button:has-text("Skip tour"), button:has-text("Skip")').first();
  if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(300);
  }
}

export async function cleanupTestUsers(page: Page): Promise<void> {
  if (createdUsers.length === 0) return;

  await page.request.delete(`${BASE_URL}/api/test-auth`, {
    headers: {
      'X-Test-Auth-Token': TEST_TOKEN,
      'Content-Type': 'application/json',
    },
    data: { userIds: [...createdUsers] },
  });

  createdUsers.length = 0;
}

// Save auth state to file for reuse across tests in the same project
export async function saveAuthState(context: BrowserContext, path: string): Promise<void> {
  await context.storageState({ path });
}

/**
 * Navigate to dashboard and click the first project.
 * If no projects exist, creates one via Supabase Admin API.
 * Returns projectId from URL.
 */
export async function openFirstProject(page: Page): Promise<string> {
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForLoadState('networkidle');

  const row = page.locator('.project-row').first();
  const rowExists = await row.isVisible({ timeout: 8000 }).catch(() => false);

  if (!rowExists) {
    // No projects — create one via Supabase Admin so the test can proceed
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const email = process.env.TEST_ACCOUNT_EMAIL;

    if (supabaseUrl && serviceRoleKey && email) {
      // Find user ID
      const usersRes = await page.request.get(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=100`, {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      });
      const usersData = await usersRes.json() as { users: Array<{ id: string; email: string }> };
      const user = usersData.users?.find((u) => u.email === email);

      if (user) {
        const projectId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
        await page.request.post(`${supabaseUrl}/rest/v1/projects`, {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          data: {
            id: projectId,
            name: '[E2E-TEST] Auto-created Test Project',
            description: 'Created automatically by Playwright for testing',
            user_id: user.id,
            color: '#2D4A2B',
          },
        });

        // Reload dashboard
        await page.reload();
        await page.waitForLoadState('networkidle');

        const newRow = page.locator('.project-row').first();
        const newRowExists = await newRow.isVisible({ timeout: 5000 }).catch(() => false);
        if (!newRowExists) {
          throw new Error('Could not create or find test project');
        }
      }
    }
  }

  const firstRow = page.locator('.project-row').first();
  await firstRow.waitFor({ state: 'visible', timeout: 8000 });
  await firstRow.click();
  await page.waitForURL(/\/dashboard\/project\//, { timeout: 15000 });

  const url = page.url();
  const match = url.match(/\/dashboard\/project\/([^/?]+)/);
  if (!match) throw new Error(`Could not parse projectId from URL: ${url}`);
  return match[1];
}
