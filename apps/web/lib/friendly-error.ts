// Sprint 9 P1: turn raw backend/model errors into plain, jargon-free copy.
// The model layer surfaces developer strings like "Model not found in LiteLLM"
// and "LLM Provider NOT provided" straight to the UI — fatal for non-dev users
// (Max). This maps known failure shapes to calm copy and scrubs any internal
// component names from anything that slips through.
//
// D-4 (launch): the built-in copy is bilingual (DE+EN) via readLang() so an EN
// user gets English guidance, not German — the same source of truth the rest of
// the app uses. It also white-labels the model-unavailable line: it no longer
// names a raw upstream model to the user, it points them back to the picker.

import { readLang } from './use-lang';

const RULES: Array<{ test: RegExp; de: string; en: string }> = [
  // model unavailable / misconfigured (LiteLLM "model not found", wrong provider prefix, etc.)
  { test: /litellm|model not found|provider not provided|no such model|unknown model|invalid model/i,
    de: 'Dieses KI-Modell ist gerade nicht verfügbar. Wähle oben ein anderes Modell und versuch es nochmal.',
    en: "This AI model isn't available right now. Pick another model above and try again." },
  // missing / invalid key
  { test: /api key|missing key|invalid key|unauthorized provider|no key/i,
    de: 'Für dieses Modell fehlt ein gültiger KI-Schlüssel. Füg in den Einstellungen einen Schlüssel hinzu oder wähle ein anderes Modell.',
    en: 'This model needs a valid AI key. Add one in Settings, or pick another model.' },
  // rate limit / quota
  { test: /rate limit|429|quota|too many requests|exhausted/i,
    de: 'Zu viele Anfragen gerade. Kurz warten und nochmal versuchen.',
    en: 'Too many requests right now. Wait a moment and try again.' },
  // auth / session
  { test: /401|403|jwt|token expired|not authenticated|unauthor/i,
    de: 'Deine Sitzung ist abgelaufen. Bitte melde dich neu an.',
    en: 'Your session has expired. Please sign in again.' },
  // network
  { test: /failed to fetch|network|econn|timeout|fetch failed|503|502|gateway/i,
    de: 'Keine Verbindung zum Server. Bitte erneut versuchen.',
    en: "Can't reach the server. Please try again." },
];

const DEFAULT_FALLBACK = {
  de: 'Etwas ist schiefgelaufen — bitte nochmal versuchen.',
  en: 'Something went wrong — please try again.',
};

// Tokens that should never reach a user; if a leftover message contains one,
// fall back to a generic line instead of showing internals.
const JARGON = /litellm|byok|endpoint|provider|traceback|stack|undefined|null|\bSQL\b|supabase|railway|hono/i;

export function friendlyError(raw: unknown, fallback?: string): string {
  const lang = readLang();
  const fb = fallback ?? (lang === 'en' ? DEFAULT_FALLBACK.en : DEFAULT_FALLBACK.de);
  const text = raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : '';
  if (!text) return fb;
  for (const rule of RULES) if (rule.test.test(text)) return lang === 'en' ? rule.en : rule.de;
  // No rule matched: only surface the raw text if it's clean of internal jargon.
  return JARGON.test(text) ? fb : text;
}

// ─── P0.4 (feel-sprint-1): connection-class failures, honestly diagnosed ─────
// "Failed to fetch" tells the user nothing. Distinguish the two realities:
// their own connection is down (navigator.onLine / no network at all) vs. our
// server not answering (network fine, health ping fails). Reused by project
// creation and chat sends.

// D-4 honesty + i18n: these three lines were German-only while the rest of this file
// was already bilingual, so an EN user hit a German wall on exactly the failure where
// clarity matters most. Each now resolves through the same readLang() source of truth.
const OFFLINE = {
  de: 'Deine Internetverbindung ist unterbrochen — bitte prüfe dein Netzwerk und versuch es erneut.',
  en: 'Your internet connection is down — please check your network and try again.',
};
const SERVER_DOWN = {
  de: 'Unser Server antwortet gerade nicht. Deine Eingabe ist nicht verloren — bitte versuch es gleich nochmal.',
  en: "Our server isn't responding right now. Your input is not lost — please try again in a moment.",
};
const BLIPPED = {
  de: 'Die Verbindung hat kurz gehakt — bitte versuch es erneut.',
  en: 'The connection hiccuped — please try again.',
};

/** @deprecated Prefer `offlineMessage()`; kept so existing German call sites keep working. */
export const OFFLINE_MSG = OFFLINE.de;
/** @deprecated Prefer `serverDownMessage()`; kept so existing German call sites keep working. */
export const SERVER_DOWN_MSG = SERVER_DOWN.de;

export function offlineMessage(): string {
  return readLang() === 'en' ? OFFLINE.en : OFFLINE.de;
}
export function serverDownMessage(): string {
  return readLang() === 'en' ? SERVER_DOWN.en : SERVER_DOWN.de;
}

/** Is this error a connection-class failure (as opposed to an app error)? */
export function isConnectionError(raw: unknown): boolean {
  const text = raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : '';
  return /failed to fetch|network|econn|timeout|fetch failed|load failed|abgebrochen|503|502|gateway/i.test(text);
}

/**
 * German copy for a connection-class failure. Fast: navigator.onLine answers
 * "offline" immediately; otherwise a 3s health ping decides between "server
 * down" and (ping ok ⇒ transient blip) "try again".
 */
export async function connectionErrorMessage(): Promise<string> {
  const lang = readLang();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return offlineMessage();
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(3000), cache: 'no-store' });
    if (res.ok) return lang === 'en' ? BLIPPED.en : BLIPPED.de;
    return serverDownMessage();
  } catch {
    // Health ping also failed: without onLine=false we can't be sure whose
    // side it is — server-down copy is the honest default (their network
    // reached us for the page itself).
    return serverDownMessage();
  }
}
