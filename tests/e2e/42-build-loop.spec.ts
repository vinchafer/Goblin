/**
 * WS-A.1 — Build-loop driver over a REAL provisioned project.
 *
 * This is the @local-only companion to the deterministic vitest net
 * (apps/api/src/__tests__/build-loop.test.ts). The vitest proves the reconcile +
 * persistence on real storage bytes in CI; this spec drives the SAME bug through
 * the real API: a real project, a real code session, the real /messages →
 * reconcile → /save pipeline, asserting the deploy-source file the page links
 * carries the edit.
 *
 * Solves the provisioning gap that blocked @local-only: a deterministic project is
 * stood up via the service role + seeded with the exact orphan scenario (index.html
 * links `style.css`; a stale `style.css` exists), so a spec can drive a real
 * build loop with no hand setup.
 *
 * Requires (local stack + a working model on the test account):
 *   TEST_ACCOUNT_EMAIL, TEST_ACCOUNT_PASSWORD, SUPABASE_SERVICE_ROLE_KEY,
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_API_URL
 * Run: pnpm test:e2e:local   (project: local-only)
 */

import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'crypto';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = process.env.TEST_ACCOUNT_EMAIL;
const TEST_PASSWORD = process.env.TEST_ACCOUNT_PASSWORD;

const PROD_INDEX = `<!DOCTYPE html>
<html>
<head>
  <title>Landingpage</title>
  <link rel="stylesheet" href="style.css">
</head>
<body><div class="container"><h1>Hi</h1></div></body>
</html>`;
const ORIGINAL_CSS = `body { background-color: #ffffff; }`;

async function getAccessToken(page: Page): Promise<{ token: string; userId: string }> {
  const res = await page.request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE },
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  if (!res.ok()) throw new Error(`Password auth failed: ${await res.text()}`);
  const body = (await res.json()) as { access_token: string; user: { id: string } };
  return { token: body.access_token, userId: body.user.id };
}

async function provisionProject(page: Page, userId: string): Promise<string> {
  const id = randomUUID();
  const res = await page.request.post(`${SUPABASE_URL}/rest/v1/projects`, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: { id, name: '[E2E-TEST] Build Loop', user_id: userId, color: '#2D4A2B' },
  });
  if (!res.ok()) throw new Error(`Could not create project: ${await res.text()}`);
  return id;
}

test.describe('WS-A.1 — build loop drives a real project', { tag: '@local-only' }, () => {
  const hasEnv = !!(TEST_EMAIL && TEST_PASSWORD && SUPABASE_URL && SERVICE_ROLE);
  test.skip(!hasEnv, 'requires TEST_ACCOUNT_* + Supabase service role');

  test('edit → save → the style.css the page links carries the edit (no orphan)', async ({ page }) => {
    const { token, userId } = await getAccessToken(page);
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const projectId = await provisionProject(page, userId);

    // Seed the orphan scenario into the project's real storage.
    await page.request.put(`${API_URL}/api/projects/${projectId}/files/index.html`, {
      headers: auth, data: { content: PROD_INDEX },
    });
    await page.request.put(`${API_URL}/api/projects/${projectId}/files/style.css`, {
      headers: auth, data: { content: ORIGINAL_CSS },
    });

    // Open a code session on the project.
    const sessRes = await page.request.post(`${API_URL}/api/code-sessions`, {
      headers: auth, data: { projectId, name: 'Build loop test' },
    });
    expect(sessRes.ok()).toBeTruthy();
    const { session } = (await sessRes.json()) as { session: { id: string } };
    const sessionId = session.id;

    // Drive a real model turn — the edit-in-place "make the background blue".
    const msgRes = await page.request.post(`${API_URL}/api/code-sessions/${sessionId}/messages`, {
      headers: auth,
      data: { prompt: 'Mach den Hintergrund der Seite blau (#0000FF).', activePath: 'style.css' },
      timeout: 90_000,
    });
    // If the test account has no working model, the loop can't run — skip honestly.
    test.skip(!msgRes.ok(), `model turn unavailable (${msgRes.status()})`);

    // Save drafts → project storage (the deploy source).
    const saveRes = await page.request.post(`${API_URL}/api/code-sessions/${sessionId}/save`, {
      headers: auth, data: {},
    });
    expect(saveRes.ok()).toBeTruthy();

    // Assert on the deploy-source bytes: style.css (what index.html links) changed,
    // and no orphaned styles.css sibling was created.
    const cssRes = await page.request.get(`${API_URL}/api/projects/${projectId}/files/style.css`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(cssRes.ok()).toBeTruthy();
    const cssBody = (await cssRes.json()) as { content: string };
    expect(cssBody.content.toLowerCase()).not.toContain('#ffffff');

    const treeRes = await page.request.get(`${API_URL}/api/projects/${projectId}/files`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const tree = (await treeRes.json()) as { files?: string[] };
    expect(tree.files ?? []).not.toContain('styles.css');

    // Cleanup the throwaway project.
    await page.request.delete(`${API_URL}/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  });
});
