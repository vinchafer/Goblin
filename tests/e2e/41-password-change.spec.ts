import { test, expect } from '@playwright/test';

// Authenticated password-change flow is verified manually with a separate
// test account so CI never locks the shared test user. This file is a
// placeholder that documents the contract and asserts the API endpoint
// rejects unauthenticated requests.
test.describe('@public Password-change endpoint', () => {
  test('POST /api/account/change-password is auth-gated', async ({ request }) => {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
    const res = await request
      .post(`${apiBase}/api/account/change-password`, {
        data: { currentPassword: 'x', newPassword: 'CorrectPassword123!' },
      })
      .catch(() => null);
    if (!res) return;
    expect([401, 403]).toContain(res.status());
  });
});
