/**
 * Chat stream enforcement — F4-2 / HR-3 regression guard (DD §A).
 *
 * The legacy monthly REQUEST-COUNT cap (`usageLimitMiddleware`) wrongly 429'd BYOK
 * users (their own key) and goblin_hosted users (already governed by the weighted
 * allowance) on `/api/chat/stream`, and applied ONLY there (standalone chat had no
 * such cap → bypassable). It is retired. Goblin spend stays capped by the WEIGHTED
 * allowance + daily guard in model-router (`streamCompletionGuarded`), which is gated
 * on `route.layer === 'goblin_hosted'` — so BYOK/free never hit a Goblin count cap.
 *
 * This is a source-level guard so the count cap can never silently return: it asserts
 * the stream route keeps the per-minute burst guard but no longer wires the deleted
 * count middleware, and that the weighted cap remains goblin-only.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const chatSrc = readFileSync(join(__dir, 'chat.ts'), 'utf-8');
const routerSrc = readFileSync(join(__dir, '../services/model-router.ts'), 'utf-8');

describe('chat /stream — legacy request-count cap retired (F4-2)', () => {
  it('does not wire the deleted usageLimitMiddleware (BYOK no longer count-capped)', () => {
    // The import + the route-level usage is gone (a lone explanatory comment is fine).
    expect(chatSrc).not.toMatch(/import\s*\{[^}]*usageLimitMiddleware[^}]*\}\s*from/);
    expect(chatSrc).not.toMatch(/chatStreamRateLimit,\s*usageLimitMiddleware/);
  });

  it('keeps the per-minute burst guard on the stream route', () => {
    expect(chatSrc).toMatch(/chat\.post\(\s*'\/stream',\s*chatStreamRateLimit/);
  });

  it('the deleted middleware file is gone', () => {
    expect(existsSync(join(__dir, '../middleware/usage-limit.ts'))).toBe(false);
  });

  it('the weighted allowance + daily guard apply to goblin_hosted ONLY (BYOK uncapped)', () => {
    // The single enforcement site is gated on the goblin_hosted layer.
    expect(routerSrc).toMatch(/if\s*\(\s*route\.layer === 'goblin_hosted'\s*\)/);
    expect(routerSrc).toMatch(/isOverMonthlyAllowance/);
    expect(routerSrc).toMatch(/isOverDailyGuard/);
  });
});
