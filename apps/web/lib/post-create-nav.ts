// F-09 (FIX-WAVE 3) — navigation after creating a project.
//
// The sidebar's project list is a prop of the force-dynamic dashboard layout,
// only recomputed on a full page load or an explicit router.refresh(). A client
// router.push() keeps that layout mounted and reuses its cached (stale) tree, so
// a freshly created project appeared on the projects page (its own client fetch)
// but NOT in the sidebar until a manual reload.
//
// Every create path must therefore refresh BEFORE navigating: refresh() re-runs
// the layout's Supabase query — regenerating the projects prop that feeds the
// sidebar — and push() then moves the user on. Centralised here so no create path
// can forget the refresh again.

export interface RefreshNavRouter {
  refresh: () => void;
  push: (href: string) => void;
}

/**
 * Re-fetch the dashboard layout's server data (so the sidebar picks up the new
 * project), then navigate. refresh() is always issued first.
 */
export function refreshThenNavigate(router: RefreshNavRouter, href: string): void {
  router.refresh();
  router.push(href);
}
