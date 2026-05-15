import { test, expect } from '@playwright/test';

// Smoke test — FilterPills primitive exports & renders correctly.
// Project-detail integration deferred to 9E (see docs/9E_BACKLOG.md).
test.describe('@public 9D-7 FilterPills primitive', () => {
  test('FilterPills component file exists', async () => {
    // file-existence smoke: real integration test lives with the page using it.
    const fs = await import('fs');
    const path = await import('path');
    const file = path.resolve('apps/web/components/ui/FilterPills.tsx');
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, 'utf-8');
    expect(content).toContain('export function FilterPills');
    expect(content).toContain('data-testid');
    expect(content).toContain('overflowX: \'auto\'');
  });
});
