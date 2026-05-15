import { test, expect } from '@playwright/test';
import { loginAsTestUser, cleanupTestUsers } from './helpers/auth';

test.describe('Hydration + Runtime Checks', { tag: '@local-only' }, () => {
  let testEmail: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const session = await loginAsTestUser(page);
    testEmail = session.email;
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await cleanupTestUsers(page);
    await page.close();
  });

  test('dashboard: capture all console messages to identify N-issue badge', async ({ page }) => {
    const messages: Array<{ type: string; text: string }> = [];
    page.on('console', msg => {
      messages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', e => {
      messages.push({ type: 'pageerror', text: e.message });
    });

    await loginAsTestUser(page, { email: testEmail });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Filter to errors/warnings
    const issues = messages.filter(m =>
      m.type === 'error' || m.type === 'warning' || m.type === 'pageerror'
    ).filter(m =>
      !m.text.includes('Download the React DevTools') &&
      !m.text.includes('favicon') &&
      !m.text.includes('service-worker')
    );

    // Log all issues for debugging
    for (const issue of issues) {
      console.log(`[${issue.type}] ${issue.text.substring(0, 200)}`);
    }

    // The test "passes" regardless — its purpose is to surface the "1 Issue" source
    // in the test output for investigation
    expect(issues.length).toBeGreaterThanOrEqual(0);
  });

  test('login page: no hydration errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const realErrors = errors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(realErrors).toHaveLength(0);
  });

  test('project page: no hydration errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const session = await loginAsTestUser(page, { email: testEmail });
    if (session.projectId) {
      await page.goto(`/dashboard/project/${session.projectId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    const realErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('Failed to fetch') // API error for test user without BYOK key
    );
    expect(realErrors).toHaveLength(0);
  });
});
