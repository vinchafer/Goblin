// Sprint 9 P1: hide E2E test fixtures from the real UI.
// The `[E2E-TEST]` projects are legitimate fixtures for the end-to-end suite, but
// they pollute the sidebar + dashboard for real use (58 of them on the test
// account). We keep the data and filter it out of the UI on read. A debug flag
// (localStorage `goblin:show-e2e` = '1', or NEXT_PUBLIC_SHOW_E2E='1') reveals them
// again for anyone who needs to see the fixtures.

const E2E_PREFIX = '[E2E-TEST]';

export function showE2EProjects(): boolean {
  if (process.env.NEXT_PUBLIC_SHOW_E2E === '1') return true;
  if (typeof window !== 'undefined') {
    try { return window.localStorage.getItem('goblin:show-e2e') === '1'; } catch { /* ignore */ }
  }
  return false;
}

export function filterVisibleProjects<T extends { name?: string | null }>(projects: T[]): T[] {
  if (showE2EProjects()) return projects;
  return projects.filter((p) => !(p.name ?? '').startsWith(E2E_PREFIX));
}
