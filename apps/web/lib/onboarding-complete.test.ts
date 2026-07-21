// FOUNDER-WALK-3 U1 GATE — the post-onboarding transition can no longer hang.
//
// THE BUG (founder, prod, installed PWA): finishing onboarding did
//   `await patchOnboardingState(...)` BEFORE `router.push(...)`.
// A suspended cross-origin fetch in a backgrounded PWA never settled, so the await
// never returned, the navigation carrying ?onboarded=1 never fired, and the spinner
// hung — until a force-quit + reopen landed on the dashboard (the write had
// persisted). These probes lock the fix: the navigation ALWAYS fires within the
// mutation budget, even when the write hangs forever, and always carries the signal.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withBudget, completeOnboarding } from './onboarding-complete';
import { DASHBOARD_ONBOARDED_URL, ONBOARDING_MUTATION_BUDGET_MS } from './onboarding-gate';

describe('withBudget', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves early with the value when the promise settles first', async () => {
    const p = withBudget(Promise.resolve('done'), 1000);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe('done');
  });

  it('resolves undefined at the budget when the promise hangs forever', async () => {
    const hang = new Promise<string>(() => { /* never resolves — the suspended PWA fetch */ });
    const p = withBudget(hang, 2500);
    await vi.advanceTimersByTimeAsync(2500);
    await expect(p).resolves.toBeUndefined();
  });

  it('never rejects — a rejected promise resolves undefined, not a throw', async () => {
    const p = withBudget(Promise.reject(new Error('boom')), 1000);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
  });
});

describe('completeOnboarding — the navigation cannot be wedged by the write', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('navigates to the signal-bearing dashboard URL EVEN when the mutation hangs forever', async () => {
    const navigate = vi.fn();
    const hangForever = new Promise<void>(() => { /* the founder bug: never settles */ });

    const done = completeOnboarding({ mutation: hangForever, navigate });
    // Before the budget elapses the navigation has NOT yet fired…
    await vi.advanceTimersByTimeAsync(ONBOARDING_MUTATION_BUDGET_MS - 1);
    expect(navigate).not.toHaveBeenCalled();
    // …but at the budget it fires regardless of the still-pending write.
    await vi.advanceTimersByTimeAsync(1);
    await done;

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(DASHBOARD_ONBOARDED_URL);
    // and the URL carries the storage-independent completion signal
    expect(DASHBOARD_ONBOARDED_URL).toContain('onboarded=1');
  });

  it('navigates immediately once a healthy write resolves (no needless wait)', async () => {
    const navigate = vi.fn();
    const done = completeOnboarding({ mutation: Promise.resolve(), navigate });
    await vi.runAllTimersAsync();
    await done;
    expect(navigate).toHaveBeenCalledWith(DASHBOARD_ONBOARDED_URL);
  });

  it('still navigates when there is no mutation at all (pure guard path)', async () => {
    const navigate = vi.fn();
    const done = completeOnboarding({ navigate });
    await vi.runAllTimersAsync();
    await done;
    expect(navigate).toHaveBeenCalledWith(DASHBOARD_ONBOARDED_URL);
  });
});
