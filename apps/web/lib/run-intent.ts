// FW4 U1 (F-11) — client mirror of the server's publish/build-intent ROUTING gate.
//
// Mirrors apps/api/src/services/agent/intent.ts (classifyRunIntent). The web uses
// it to decide, BEFORE sending, whether a project-chat message should hand off to
// an agent run instead of a tool-less chat completion — founder decision D1,
// "explicit intent executes directly." The authoritative grant still lives
// server-side (the agent route's grantsPublish); this only decides routing, so a
// drift here can never over-publish — worst case a message stays a chat (the FW1-U4
// honest mode-decline covers that). Kept in lockstep with the server via
// run-intent.test.ts (the same verbatim W10 walk prompt + guardrail cases).

/** Lowercase, fold umlauts/ß, strip diacritics + apostrophes, collapse whitespace. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PUBLISH_PHRASES: string[] = [
  'live stellen', 'live schalten', 'live gehen', 'geh live', 'gehe live', 'live bringen',
  'veroffentlich', 'veroeffentlich',
  'online stellen', 'online schalten', 'online bringen', 'online nehmen',
  'wenn es live', 'wenns live',
  'go live', 'make it live', 'take it live', 'push it live', 'get it live',
  'put it online', 'put it live', 'get it online', 'ship it',
  'when its live', 'when it is live',
];

const PUBLISH_REGEXES: RegExp[] = [
  /\b(stell|stelle|mach|mache|setz|setze|bring|nimm|schalt|schalte)\s+(es|das|sie|ihn|die\s+seite|die\s+app|alles|die|meine\s+seite)\s+(?:\w+\s+){0,2}(live|online)\b/,
  /\bpublish\b/,
  /\bdeploy(e|en)?\b/,
];

const BUILD_REGEXES: RegExp[] = [
  /\b(bau|baue|erstell|erstelle|programmier|programmiere|schreib|schreibe|entwickle|generier|generiere|bastel|bastle|mach|mache|leg|lege|design|designe)\b[^.!?]{0,40}\b(seite|seiten|website|webseite|homepage|landingpage|landing ?page|app|anwendung|tool|werkzeug|rechner|tracker|shop|store|formular|kontaktformular|blog|portfolio|dashboard|spiel|galerie|timer|counter|zaehler|zähler|liste|todo|to-?do|newsletter|umfrage|quiz|menue|menü|speisekarte|preisliste)\b/,
  /\b(build|create|make|write|code|develop|generate|design|set up|put together)\b[^.!?]{0,40}\b(site|website|web ?page|page|app|application|tool|calculator|tracker|shop|store|landing ?page|form|contact form|blog|portfolio|dashboard|game|gallery|timer|counter|list|to-?do|todo|newsletter|survey|quiz|menu|price ?list)\b/,
];

function hasPublishIntent(message: string): boolean {
  const n = normalize(message);
  if (!n) return false;
  return PUBLISH_PHRASES.some((p) => n.includes(p)) || PUBLISH_REGEXES.some((re) => re.test(n));
}

function hasBuildIntent(message: string): boolean {
  const n = normalize(message);
  if (!n) return false;
  return BUILD_REGEXES.some((re) => re.test(n));
}

/**
 * Should this project-chat message route into an agent run? True iff it carries a
 * clear publish action OR a clear build request. Conservative: a bare "live"/"online"
 * mention never routes. The eligibility gate (project + Swift/Forge model) is applied
 * separately by the caller.
 */
export function shouldRouteToAgent(message: string): boolean {
  return hasPublishIntent(message) || hasBuildIntent(message);
}

// D1: the honest first step shown when a chat message hands off to an agent run —
// no silent mode switch.
export const AGENT_HANDOFF_NARRATION = 'Ich starte dafür einen Agent-Lauf …';
