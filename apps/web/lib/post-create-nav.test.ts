// F-09 (FIX-WAVE 3) GATE — a created project must reach the sidebar without reload.
//
// The sidebar renders from the force-dynamic dashboard layout's server prop, which
// only updates on a full load or router.refresh(). This locks the contract that
// every create path refreshes that prop BEFORE navigating, so the new project is
// in the layout's re-fetched list by the time the user lands — no manual reload.

import { describe, it, expect, vi } from 'vitest';
import { refreshThenNavigate } from './post-create-nav';

describe('refreshThenNavigate', () => {
  it('refreshes the dashboard layout BEFORE navigating (so the sidebar re-fetches)', () => {
    const calls: string[] = [];
    const router = {
      refresh: vi.fn(() => { calls.push('refresh'); }),
      push: vi.fn((href: string) => { calls.push(`push:${href}`); }),
    };

    refreshThenNavigate(router, '/dashboard/project/abc');

    // refresh must happen, and must precede the navigation.
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/dashboard/project/abc');
    expect(calls).toEqual(['refresh', 'push:/dashboard/project/abc']);
  });

  it('always issues exactly one refresh per navigation', () => {
    const router = { refresh: vi.fn(), push: vi.fn() };
    refreshThenNavigate(router, '/dashboard/chat/xyz');
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledTimes(1);
  });
});
