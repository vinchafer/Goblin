// TRUNC-1 — the honest copy for an answer the server could not finish.
//
// The server auto-continues a generation that hits the provider's output ceiling
// (services/stream-continuation.ts), but the number of continuation rounds is bounded,
// so exhausting the bound is a real state. When that happens the UI must SAY the answer
// is cut off. A truncated answer rendered like a whole one is the phantom-completeness
// class of dishonesty — and it is precisely what the first tester cohort hit: a build
// that stopped after a third of the file, with nothing on screen admitting it.
//
// Both chat surfaces read these strings, so DE and EN stay in step from one place.

export type Lang = 'de' | 'en';

/** The banner beside a cut-off answer. States the fact, no excuse, no promise. */
export function truncatedNotice(lang: Lang): string {
  return lang === 'en'
    ? 'This answer was cut off at the model’s output limit — it is not finished.'
    : 'Diese Antwort wurde am Ausgabe-Limit des Modells abgeschnitten — sie ist nicht fertig.';
}

/** The one-tap continue. It CONTINUES the existing answer; it does not regenerate it. */
export function continueLabel(lang: Lang): string {
  return lang === 'en' ? 'Continue' : 'Fortsetzen';
}

/** Shown while a continuation is streaming. */
export function continuingLabel(lang: Lang): string {
  return lang === 'en' ? 'Continuing…' : 'Setze fort…';
}

/**
 * A continuation that itself failed. Never re-labels the answer as complete — the
 * previous state stands and the user can try again.
 */
export function continueFailedNotice(lang: Lang): string {
  return lang === 'en'
    ? 'The continuation did not go through. What is above is unchanged — you can try again.'
    : 'Das Fortsetzen hat nicht geklappt. Was oben steht, bleibt unverändert — du kannst es nochmal versuchen.';
}
