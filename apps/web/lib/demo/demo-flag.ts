// Demo-mode flag. Set synchronously by <DemoProviders> on render/mount so the
// very first createClient() inside the demo tree resolves to the demo client.
// The pathname fallback covers the brief window before the provider runs and any
// stray module-level client construction on a /demo-* route.
//
// Client-only. On the server this returns false (demo routes render their data
// through client presentational components with seed props — see
// docs/DEMO_MODE_ARCHITECTURE.md §0).

let active = false;

export function setDemoActive(value: boolean): void {
  // Client-only: never mutate the module flag during SSR, where it is a singleton
  // shared across concurrent requests. The server has no consumer of this flag
  // (server components use lib/supabase/server), and the /demo- pathname fallback
  // below covers the brief pre-mount window on the client anyway.
  if (typeof window === "undefined") return;
  active = value;
}

export function isDemoActive(): boolean {
  if (active) return true;
  if (typeof window !== "undefined") {
    return window.location.pathname.startsWith("/demo-");
  }
  return false;
}
