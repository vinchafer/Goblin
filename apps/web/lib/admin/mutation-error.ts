// FOUNDER-WALK-2 U5.1 — honest error surfaces for admin mutations.
//
// The admin pages fired mutations (suspend/plan/delete, model save, incident
// save, promo label) with `await fetch(...)` and NEVER checked the response —
// a failed request silently closed the modal and reloaded as if it worked, or
// (promo) flashed "Label gespeichert" without saving. That violates the Feeling
// invariant: never claim an action that did not happen. It also must never dump
// a raw stack at the user (anti-pattern: "rohe Stack-Traces an User").
//
// This pure helper turns a failed Response (status + parsed JSON body) into ONE
// short, honest, localised line. It is the tested unit; the pages call it and
// render the string in a visible error surface. Returns null when the response
// was ok (nothing to show).

export type AdminLang = 'de' | 'en';

export interface MutationErrorInput {
  ok: boolean;
  status: number;
  /** Parsed JSON body from the /api/admin proxy, if any: { error, detail }. */
  body?: { error?: string; detail?: string } | null;
}

// `satisfies` keeps the concrete literal type (so dot access is known-defined
// under noUncheckedIndexedAccess) while validating the shape.
const MSG = {
  admin_key_unconfigured: {
    de: 'Admin-Schlüssel ist auf dem Web-Service nicht gesetzt.',
    en: 'Admin key is not configured on the web service.',
  },
  forbidden: {
    de: 'Nicht berechtigt — bitte erneut anmelden.',
    en: 'Not authorized — please sign in again.',
  },
  unavailable: {
    de: 'Admin-API nicht erreichbar — bitte erneut versuchen.',
    en: 'Admin API unavailable — please try again.',
  },
} satisfies Record<string, { de: string; en: string }>;

// Keep a server detail string short and single-line so a stack/HTML body can
// never flood the UI.
function tidyDetail(detail: string): string {
  return detail.replace(/\s+/g, ' ').trim().slice(0, 160);
}

/**
 * @returns an honest one-line error message, or null if the response was ok.
 */
export function describeMutationError(input: MutationErrorInput, lang: AdminLang = 'en'): string | null {
  if (input.ok) return null;

  const code = input.body?.error;
  const detail = input.body?.detail;

  if (code === 'admin_key_unconfigured') return MSG.admin_key_unconfigured[lang];
  if (input.status === 403) return MSG.forbidden[lang];
  if (input.status === 502) return MSG.unavailable[lang];

  // A known error code with a safe detail → surface both, honestly.
  const base = lang === 'de'
    ? `Aktion fehlgeschlagen (HTTP ${input.status})`
    : `Action failed (HTTP ${input.status})`;
  if (detail) return `${base}: ${tidyDetail(detail)}`;
  if (code) return `${base}: ${tidyDetail(code)}`;
  return base;
}

/** Convenience for the fetch sites: read the body defensively, then describe. */
export async function readMutationError(res: Response, lang: AdminLang = 'en'): Promise<string | null> {
  if (res.ok) return null;
  let body: { error?: string; detail?: string } | null = null;
  try { body = await res.json(); } catch { body = null; }
  return describeMutationError({ ok: res.ok, status: res.status, body }, lang);
}
