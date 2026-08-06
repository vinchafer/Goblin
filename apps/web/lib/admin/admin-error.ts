// FOUNDER-WALK-3 U5 — the single source of admin error copy.
//
// An empty table / silent-empty list on an auth failure is a FALSE state (the
// Feeling invariant: never claim a non-verified state). Before this, each admin
// page failed differently — Insight named the ADMIN_API_KEY cause, Costs showed a
// bare "Error: API 401", Users/Models rendered an empty list, Telemetry a generic
// "Could not load". Now every page maps the SAME status → the SAME actionable
// German message (the Insight copy, which names the env cause the founder must fix).
//
// The 401 copy used to assert a single cause: "the ADMIN_API_KEY values on Vercel
// and Railway differ." That was an inference, not an observation — FW3 verified
// both ENDS of the chain (same env var, same `x-admin-key` header on each side) and
// concluded the only remaining variable was the value. It never checked whether the
// middle of the chain was reachable, and it wasn't: the `/api/:path*` rewrite sat in
// Next's `afterFiles` phase, which is checked BEFORE dynamic routes, so it shadowed
// the dynamic proxy at app/api/admin/[...path]/route.ts. The request went straight
// to Railway with no key at all. The founder spent days aligning two env values that
// had been identical the whole time, because this string told them to.
//
// The rewrite is fixed (lib/env/api-rewrites.ts). The copy is now honest about what
// a 401 actually proves — the API rejected the key — and names BOTH ways that
// happens, plus the one-command test that tells them apart. Never re-narrow this to
// a single cause unless the code can actually distinguish them at runtime.

export type AdminErrorStatus = number | 'network';

export function adminErrorMessage(status: AdminErrorStatus, detail?: string): string {
  if (status === 401) {
    return (
      '401 — die API hat den Admin-Schlüssel abgelehnt. Zwei mögliche Ursachen: ' +
      'der x-admin-key erreicht die API gar nicht (die Anfrage lief am Web-Proxy vorbei), ' +
      'oder die ADMIN_API_KEY-Werte auf Web und API unterscheiden sich. ' +
      'Unterscheiden: ausgeloggt `curl -i <domain>/api/admin/telemetry` — ' +
      'kommt 403 „Forbidden“, läuft der Proxy (dann die Werte prüfen); ' +
      'kommt 401 „Unauthorized“, wurde der Proxy übersprungen.'
    );
  }
  if (status === 403) {
    return '403 — dieses Konto hat keinen Admin-Zugriff.';
  }
  if (status === 500) {
    return detail ? `Konfigurationsfehler — ${detail}` : 'Fehler 500 — Admin-Konfiguration prüfen.';
  }
  if (status === 'network') {
    return 'Konnte Admin-Daten nicht laden — Netzwerk oder API nicht erreichbar.';
  }
  return `Fehler ${status}`;
}
