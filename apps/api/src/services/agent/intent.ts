// FEEL-3b B2 — the explicit-publish-intent gate (founder decision D1, spec §5.2).
//
// "Publish requires explicit intent." Before a run starts, the orchestrator classifies
// whether the user's message ASKS to go live. Conservative by design: only a clear,
// deterministic action phrase grants publish for THIS run. Everything else → no grant,
// and the run ends as a saved draft carrying the confirmation chip ("Bereit — jetzt
// veröffentlichen?"). Uncertainty → chip, never guess (D1). The grant is per-run.
//
// Deterministic, case-/Umlaut-/diacritic-robust, DE + EN. Max's "sag mir wenn es live
// ist" IS intent — he taps nothing (D1).

export type PublishIntent = 'explicit' | 'none';

/** Lowercase, fold umlauts/ß, strip diacritics + apostrophes, collapse whitespace. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining diacritics
    .replace(/['’`]/g, '') // straight + curly apostrophes, backtick
    .replace(/\s+/g, ' ')
    .trim();
}

// Normalized substrings that each independently signal an explicit publish request.
// Every entry pairs an action with the deploy target — a bare "live"/"online" never
// matches, so weak/ambiguous mentions fall through to the chip.
const EXPLICIT_PHRASES: string[] = [
  // ─ German ─
  'live stellen', 'live schalten', 'live gehen', 'geh live', 'gehe live', 'live bringen',
  'veroffentlich', // ö-folded: veröffentliche / veröffentlichen / veröffentlicht
  'veroeffentlich', // literal "oe" spelling
  'online stellen', 'online schalten', 'online bringen', 'online nehmen',
  'wenn es live', 'wenns live', // "sag mir wenn es live ist"
  // ─ English ─
  'go live', 'make it live', 'take it live', 'push it live', 'get it live',
  'put it online', 'put it live', 'get it online', 'ship it',
  'when its live', 'when it is live', // "tell me when it's live"
];

// Verb + object + deploy-target — catches "stell sie live", "stelle es online",
// "mach das live", "bring die Seite online" without enumerating every pronoun. An
// optional adverb window (≤2 words) between object and target catches "stell die
// Seite JETZT live" / "put it online RIGHT NOW" without loosening the verb+object
// requirement. `publish`/`deploy` are word-boundaried so the concept-nouns
// "Deployment"/"publisher" (a how-does-it-work question) do NOT trip the gate.
const EXPLICIT_REGEXES: RegExp[] = [
  /\b(stell|stelle|mach|mache|setz|setze|bring|nimm|schalt|schalte)\s+(es|das|sie|ihn|die\s+seite|die\s+app|alles|die|meine\s+seite)\s+(?:\w+\s+){0,2}(live|online)\b/,
  /\bpublish\b/, // publish / publish it / publish the site (not "publisher")
  /\bdeploy(e|en)?\b/, // deploy / deploye / deployen / deploy it (not "deployment")
];

/**
 * Classify publish intent from the user's message. 'explicit' only when a clear action
 * phrase is present; otherwise 'none' (→ draft + confirmation chip). Never guesses.
 */
export function classifyPublishIntent(message: string): PublishIntent {
  const n = normalize(message);
  if (!n) return 'none';
  for (const phrase of EXPLICIT_PHRASES) {
    if (n.includes(phrase)) return 'explicit';
  }
  for (const re of EXPLICIT_REGEXES) {
    if (re.test(n)) return 'explicit';
  }
  return 'none';
}

/** Convenience: does this message grant publish for the run? */
export function grantsPublish(message: string): boolean {
  return classifyPublishIntent(message) === 'explicit';
}

// ─── FW4 U1 (F-11) — publish/build-intent ROUTING (the W10 gate) ─────────────────
//
// A DIFFERENT question from grantsPublish. grantsPublish decides whether an
// ALREADY-running agent may deploy. classifyRunIntent decides, one level up,
// whether a project-chat message should ENGAGE the agent AT ALL (server-driven
// tool loop: write files → save → optionally publish) instead of staying a
// tool-less chat completion. Founder decision D1: "explicit intent executes
// directly" — a clear build/publish request routes into an agent run with no mode
// toggle. W10 ≠ 0 traced to the walk running over the tool-less project-chat lane
// (FW1 U4): "Baue mir einen Habit-Tracker … Und stell ihn live." got manual
// instructions, never an agent publish.
//
// Conservative, same as the publish gate: a routing decision must not hijack a
// normal conversation. A bare "live"/"online" mention never routes; only an
// explicit publish action phrase OR a clear "build me a <thing>" imperative does.
// Everything else stays chat (honest FW1-U4 mode-decline still applies there).

export type RunIntent = 'agent' | 'chat';

// The honest first narrated step when a chat message routes into an agent run —
// D1: "no silent mode switch." Shown BEFORE the run engages.
export const AGENT_HANDOFF_NARRATION = 'Ich starte dafür einen Agent-Lauf …';

// Build/create imperative + a buildable object, within a short window. Verb+object
// is deliberately required (high precision): a bare "mach" or "erstelle" without a
// buildable noun does not route, so an edit-chat or a joke request stays chat.
// The buildable-noun list covers the wedge cases (Seite/App/Tracker/Shop/…); the
// window ([^.]{0,40}) keeps the verb and object in the same clause.
const BUILD_REGEXES: RegExp[] = [
  // ─ German ─ baue/erstelle/mach/programmiere/schreib/entwickle/generiere/bastel + object
  /\b(bau|baue|erstell|erstelle|programmier|programmiere|schreib|schreibe|entwickle|generier|generiere|bastel|bastle|mach|mache|leg|lege|design|designe)\b[^.!?]{0,40}\b(seite|seiten|website|webseite|homepage|landingpage|landing ?page|app|anwendung|tool|werkzeug|rechner|tracker|shop|store|formular|kontaktformular|blog|portfolio|dashboard|spiel|galerie|timer|counter|zaehler|zähler|liste|todo|to-?do|newsletter|umfrage|quiz|menue|menü|speisekarte|preisliste)\b/,
  // ─ English ─ build/create/make/write/code/develop/generate/design + object
  /\b(build|create|make|write|code|develop|generate|design|set up|put together)\b[^.!?]{0,40}\b(site|website|web ?page|page|app|application|tool|calculator|tracker|shop|store|landing ?page|form|contact form|blog|portfolio|dashboard|game|gallery|timer|counter|list|to-?do|todo|newsletter|survey|quiz|menu|price ?list)\b/,
];

/**
 * True when a message carries a clear build/create request (verb + buildable
 * object). Independent of publish intent. Normalized (case/Umlaut/diacritic-robust).
 */
export function hasBuildIntent(message: string): boolean {
  const n = normalize(message);
  if (!n) return false;
  return BUILD_REGEXES.some((re) => re.test(n));
}

/**
 * Route a project-chat message to an agent run ('agent') or keep it as a tool-less
 * chat completion ('chat'). 'agent' iff the message has explicit publish intent OR
 * clear build intent. The eligibility gate (project chat + Swift/Forge + flag) is a
 * SEPARATE, caller-applied check (agentEligibility) — this function answers only
 * "does the user's message ask to build/publish?". Never guesses on ambiguity.
 */
export function classifyRunIntent(message: string): RunIntent {
  if (classifyPublishIntent(message) === 'explicit') return 'agent';
  if (hasBuildIntent(message)) return 'agent';
  return 'chat';
}

/** Convenience: should this message route into an agent run (intent only)? */
export function shouldRouteToAgent(message: string): boolean {
  return classifyRunIntent(message) === 'agent';
}
