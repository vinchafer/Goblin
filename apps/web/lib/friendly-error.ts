// Sprint 9 P1: turn raw backend/model errors into plain German for users.
// The model layer surfaces developer strings like "Model not found in LiteLLM"
// and "LLM Provider NOT provided" straight to the UI — fatal for non-dev users
// (Max). This maps known failure shapes to calm, jargon-free copy and scrubs any
// internal component names from anything that slips through.

const RULES: Array<{ test: RegExp; msg: string }> = [
  // model unavailable / misconfigured (LiteLLM "model not found", wrong provider prefix, etc.)
  { test: /litellm|model not found|provider not provided|no such model|unknown model|invalid model/i,
    msg: 'Dieses KI-Modell ist gerade nicht verfügbar. Wähle oben ein anderes Modell (z. B. Llama 3.3 70B) und versuch es nochmal.' },
  // missing / invalid key
  { test: /api key|missing key|invalid key|unauthorized provider|no key/i,
    msg: 'Für dieses Modell fehlt ein gültiger KI-Schlüssel. Füg in den Einstellungen einen Schlüssel hinzu oder wähle ein anderes Modell.' },
  // rate limit / quota
  { test: /rate limit|429|quota|too many requests|exhausted/i,
    msg: 'Zu viele Anfragen gerade. Kurz warten und nochmal versuchen.' },
  // auth / session
  { test: /401|403|jwt|token expired|not authenticated|unauthor/i,
    msg: 'Deine Sitzung ist abgelaufen. Bitte melde dich neu an.' },
  // network
  { test: /failed to fetch|network|econn|timeout|fetch failed|503|502|gateway/i,
    msg: 'Keine Verbindung zum Server. Bitte erneut versuchen.' },
];

// Tokens that should never reach a user; if a leftover message contains one,
// fall back to a generic line instead of showing internals.
const JARGON = /litellm|byok|endpoint|provider|traceback|stack|undefined|null|\bSQL\b|supabase|railway|hono/i;

export function friendlyError(raw: unknown, fallback = 'Etwas ist schiefgelaufen — bitte nochmal versuchen.'): string {
  const text = raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : '';
  if (!text) return fallback;
  for (const rule of RULES) if (rule.test.test(text)) return rule.msg;
  // No rule matched: only surface the raw text if it's clean of internal jargon.
  return JARGON.test(text) ? fallback : text;
}
