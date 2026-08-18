// @vitest-environment jsdom
/**
 * FOUNDER-WALK-7 · U6 (D-E) — the sidebar project row did nothing from the Code tab.
 *
 * The founder, 2026-08-18: "dann links auf projekt geklickt in menu leiste -
 * passiert nichts. ich musste oben im tab auf chat, das ich auf die projektübersicht
 * komme."
 *
 * It was not a dead handler. `ProjectWorkspace` persists `goblin:wsTab:<id> = 'code'`
 * while you are in the Code tab, and the sidebar's F-W2-a smart-resume reads exactly
 * that key — so clicking the project you are IN resolved to
 * `/dashboard/project/<id>/work?tab=code`, the route already on screen, and
 * `router.push` to the current route is a no-op. Resume worked perfectly and the
 * result was nothing.
 *
 * The property under test: the row always resolves to somewhere you are not.
 *
 * FALSIFICATION: the pre-fix `resolveProjectHref` took no current path and returned
 * the resumed href unconditionally. 2/5 fail without the fix — the two that stand
 * on the resume target. The other three are the guard that resume itself is intact.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveProjectHref } from './Sidebar';

const ID = 'proj-1';
const HUB = `/dashboard/project/${ID}`;
const WORK = `${HUB}/work`;

describe('resolveProjectHref — smart resume never resolves to the current page', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('from inside the Code tab, the row goes to the project overview instead of nowhere', () => {
    sessionStorage.setItem(`goblin:wsTab:${ID}`, 'code');
    // This is the founder's exact position: the work route, code tab.
    expect(resolveProjectHref(ID, WORK)).toBe(HUB);
  });

  it('the cross-restart mirror behaves the same way', () => {
    localStorage.setItem(`goblin:lastWsTab:${ID}`, 'code');
    expect(resolveProjectHref(ID, WORK)).toBe(HUB);
  });

  it('from anywhere else, resume still deep-links into the build window (F-W2-a intact)', () => {
    sessionStorage.setItem(`goblin:wsTab:${ID}`, 'code');
    expect(resolveProjectHref(ID, '/dashboard')).toBe(`${HUB}/work?tab=code`);
    expect(resolveProjectHref(ID, `/dashboard/project/other`)).toBe(`${HUB}/work?tab=code`);
  });

  it('with no stored build state the row goes to the hub, as before', () => {
    expect(resolveProjectHref(ID, '/dashboard')).toBe(HUB);
  });

  it('called without a current path (any legacy caller) behaves exactly as before', () => {
    sessionStorage.setItem(`goblin:wsTab:${ID}`, 'code');
    expect(resolveProjectHref(ID)).toBe(`${HUB}/work?tab=code`);
  });
});
