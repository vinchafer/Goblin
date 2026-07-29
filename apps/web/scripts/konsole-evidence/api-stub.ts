// AKT 2 · PHASE 2.5 · U-C6 — evidence stand-in for `@/lib/api`.
//
// The real module constructs a Supabase browser client at module scope from
// NEXT_PUBLIC_* env vars. The evidence harness has no Supabase project and no
// session, and inventing credentials to satisfy an import would be the wrong
// shape of pretending. So the bundler aliases `@/lib/api` to this file.
//
// It replaces the TRANSPORT and nothing else. The console component, its strings,
// its CSS and every rendering decision in it are the real ones — which is the
// whole point of rendering the real component instead of a hand-written mirror of
// it (the older harnesses under scripts/ mirror; this one does not).
//
// API_URL is empty so the component's `${API_URL}${path}` requests come out as
// bare paths, which the harness's fetch stub matches on.

export const API_URL = '';

export async function getAuthHeaders(): Promise<HeadersInit> {
  return { 'Content-Type': 'application/json' };
}
