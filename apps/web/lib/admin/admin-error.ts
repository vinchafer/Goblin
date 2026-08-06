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
    // FOUNDER-WALK-4 · U2 — this branch used to assert a CAUSE it had not observed.
    //
    // "Konfigurationsfehler" is true for exactly ONE of the two 500s that reach an admin
    // page: the web proxy's own `admin_key_unconfigured`. The other — the API failing a
    // read behind the proxy — is not a configuration problem at all, and calling it one
    // sends the founder back to the env vars they had already verified. Same mistake as the
    // retracted 401 verdict, one surface further down.
    //
    // And the detail was usually absent anyway: the page read `detail`, while the API's 500
    // body carried `error`. The server's own words were being dropped and replaced with a
    // guess. `readAdminErrorDetail` now reads both keys; this copy states the status, hands
    // over whatever the server said verbatim, and names no cause of its own.
    return detail
      ? `Fehler 500 — der Server meldet: ${detail}`
      : 'Fehler 500 — der Server hat keinen Grund mitgeliefert. Serverlog prüfen.';
  }
  if (status === 'network') {
    return 'Konnte Admin-Daten nicht laden — Netzwerk oder API nicht erreichbar.';
  }
  return detail ? `Fehler ${status} — ${detail}` : `Fehler ${status}`;
}

/**
 * FOUNDER-WALK-4 · U2 — read the reason out of a failed admin response, whichever shape it
 * has, so no page has to know which layer answered.
 *
 * There are two error bodies in this chain and they use different keys:
 *   · the web proxy (app/api/admin/[...path]/route.ts) → `{ error, detail }`
 *   · the API      (apps/api/src/routes/admin.ts)      → `{ error }` (now also `detail`)
 *
 * /admin/insight read only `detail`, only on 500, so an API-side failure arrived as a
 * generic line while the actual message sat unread in the body. Every other admin page read
 * NOTHING at all — some did not even show that a request had failed. One reader, used
 * everywhere, ends both.
 */
export async function readAdminErrorDetail(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.clone().json()) as { detail?: unknown; error?: unknown } | null;
    for (const v of [body?.detail, body?.error]) {
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  } catch {
    /* not JSON (an HTML error page, an empty body) — the status alone has to speak */
  }
  return undefined;
}
