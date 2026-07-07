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
  'publish', 'deploy', // deploy / deploye / deployen / deploy it
  'put it online', 'put it live', 'get it online', 'ship it',
  'when its live', 'when it is live', // "tell me when it's live"
];

// Verb + object + deploy-target — catches "stell sie live", "stelle es online",
// "mach das live", "bring die Seite online" without enumerating every pronoun.
const EXPLICIT_REGEXES: RegExp[] = [
  /\b(stell|stelle|mach|mache|setz|setze|bring|nimm|schalt|schalte)\s+(es|das|sie|ihn|die\s+seite|die\s+app|alles|die|meine\s+seite)\s+(live|online)\b/,
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
