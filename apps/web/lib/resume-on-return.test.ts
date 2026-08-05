/**
 * FINAL-POLISH · U1 — the "came back after the phone locked" rule.
 *
 * The client half of the founder's walk. F-40 shipped a re-attach probe that fires on
 * MOUNT only, but iOS freezes a suspended PWA instead of unloading it: on return nothing
 * remounts, so the probe never fires and a run the server is still executing stays
 * invisible behind a dead spinner. These tests pin the rule that decides when a return
 * must force a re-attach.
 */
import { describe, it, expect } from 'vitest';
import { createResumeDetector, SUSPEND_SUSPECT_MS } from './resume-on-return';

/** A clock the test drives, so no test ever sleeps. */
function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe('resume detector — when a return means "the socket is dead"', () => {
  it('forces a re-attach after a hide long enough for iOS to suspend the app', () => {
    const clock = fakeClock();
    const d = createResumeDetector({ now: clock.now });

    d.hidden();                       // the iPhone locks
    clock.advance(45_000);            // the founder walks to the PC
    expect(d.visible().force).toBe(true);
  });

  it('leaves a healthy stream alone on a brief hide (app switcher, notification)', () => {
    const clock = fakeClock();
    const d = createResumeDetector({ now: clock.now });

    d.hidden();
    clock.advance(400);
    expect(d.visible().force).toBe(false);
  });

  it('treats the threshold itself as suspect (>= not >)', () => {
    const clock = fakeClock();
    const d = createResumeDetector({ now: clock.now });

    d.hidden();
    clock.advance(SUSPEND_SUSPECT_MS);
    expect(d.visible().force).toBe(true);
  });

  it('does not force when the page was never hidden (a spurious visibility event)', () => {
    const clock = fakeClock();
    const d = createResumeDetector({ now: clock.now });
    expect(d.visible().force).toBe(false);
  });

  it('counts a page that was ALREADY hidden at bind time', () => {
    // Mounting while backgrounded: the hidden clock starts at construction, so a long
    // stay away is still recognised on return.
    const clock = fakeClock();
    const d = createResumeDetector({ initiallyHidden: true, now: clock.now });
    clock.advance(30_000);
    expect(d.visible().force).toBe(true);
  });

  it('always forces on a bfcache restore or a regained connection', () => {
    const clock = fakeClock();
    const d = createResumeDetector({ now: clock.now });
    // No hide was ever observed — bfcache and `online` still mean the socket is gone.
    expect(d.restored().force).toBe(true);
  });

  it('re-arms: a second lock after a return is measured on its own', () => {
    const clock = fakeClock();
    const d = createResumeDetector({ now: clock.now });

    d.hidden();
    clock.advance(20_000);
    expect(d.visible().force).toBe(true);

    // Back, then a quick flick away and return — must NOT inherit the earlier long hide.
    d.hidden();
    clock.advance(200);
    expect(d.visible().force).toBe(false);
  });
});
