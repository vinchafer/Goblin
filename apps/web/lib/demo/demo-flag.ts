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
  active = value;
}

export function isDemoActive(): boolean {
  if (active) return true;
  if (typeof window !== "undefined") {
    return window.location.pathname.startsWith("/demo-");
  }
  return false;
}
