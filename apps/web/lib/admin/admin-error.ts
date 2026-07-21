// FOUNDER-WALK-3 U5 — the single source of admin error copy.
//
// An empty table / silent-empty list on an auth failure is a FALSE state (the
// Feeling invariant: never claim a non-verified state). Before this, each admin
// page failed differently — Insight named the ADMIN_API_KEY cause, Costs showed a
// bare "Error: API 401", Users/Models rendered an empty list, Telemetry a generic
// "Could not load". Now every page maps the SAME status → the SAME actionable
// German message (the Insight copy, which names the env cause the founder must fix).
//
// Wiring is code-correct (verified FW3): the web proxy injects ADMIN_API_KEY as the
// `x-admin-key` header (app/api/admin/[...path]/route.ts) and the API validates the
// same header + env (apps/api/src/routes/admin.ts). A 401 is therefore an env
// VALUE mismatch between the Vercel-side and Railway-side ADMIN_API_KEY, which this
// copy states outright.

export type AdminErrorStatus = number | 'network';

export function adminErrorMessage(status: AdminErrorStatus, detail?: string): string {
  if (status === 401) {
    return '401 — Admin-API-Schlüssel stimmt nicht (ADMIN_API_KEY auf Web und API müssen übereinstimmen).';
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
