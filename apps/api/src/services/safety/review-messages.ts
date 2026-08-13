/**
 * AKT 2 · PHASE 3 · U3.2 — what a builder reads when their publish is HELD.
 *
 * ── Why this is a table of fixed strings and not a generated sentence ────────
 * The sentence a held builder reads must be identical for the same category every
 * time, must be written by a human, and must survive a model that was fed a page
 * containing instructions addressed to it. Every string here is authored; the only
 * thing the classifier contributes is which key is looked up.
 *
 * ── The three rules these strings obey (Feeling invariants, Phase-3 §6) ──────
 * 1. NAME THE CATEGORY, NEVER THE MECHANISM. Not which rule fired, not which
 *    stage, not a fixture code, not a confidence number. Someone whose publish was
 *    held must not be able to read the message and work out what to change in
 *    order to slip past it next time.
 * 2. NO INVENTED TIMELINE. ABUSE_RESPONSE commits to a triage TARGET for incoming
 *    abuse REPORTS (§8.1, 24 hours, explicitly "ein Ziel, keine Zusicherung"). It
 *    commits to nothing at all for a publish held at the gate, and §8.3 does not
 *    name a duration. So these strings name none either. "Sobald ein Mensch
 *    daraufgesehen hat" is the true thing; "innerhalb von 24 Stunden" would be a
 *    promise nobody made.
 * 3. SAY WHAT HAPPENED TO THE FILES. "Nichts wurde hochgeladen" is the fact that
 *    makes the hold bearable, and it is verifiable — see the KV/R2 read-back in
 *    ops-publish.test.ts. A held builder should not have to wonder whether a
 *    half-published version of their app is on the internet.
 */

import type { AupCategory } from './abuse-classifier';

/** The invariant part. Every held publish reads this, whatever the category. */
export const REVIEW_LEAD =
  'Diese Veröffentlichung wartet auf einen kurzen Blick durch einen Menschen. Hochgeladen wurde nichts — deine App ist nicht online, und deine Dateien liegen unverändert in deinem Projekt.';

/**
 * The closing. Names the one thing that is certain (a human decides), the one
 * thing that is not (when), and the way out.
 */
export const REVIEW_TAIL =
  'Sobald jemand daraufgesehen hat, geht es entweder automatisch live oder du bekommst gesagt, woran es lag. Eine feste Frist gibt es dafür nicht — Goblin wird von einer Einzelperson betrieben, und eine Zusage, die wir nicht halten können, wäre schlimmer als keine. Wenn du glaubst, das ist ein Missverständnis: Feedback-Knopf.';

/**
 * The middle clause, per AUP category. Each one describes what the check thought
 * it might be seeing — in the policy's own vocabulary, in the subjunctive, because
 * nothing has been decided yet and the string must not read like a verdict.
 */
const REVIEW_BECAUSE: Record<AupCategory, string> = {
  phishing:
    'Die automatische Prüfung war sich nicht sicher, ob diese Seite Zugangsdaten abfragt oder einer fremden Marke nachempfunden ist.',
  malware:
    'Die automatische Prüfung war sich nicht sicher, ob diese Seite Code ausführt, den Besucher nicht erwarten.',
  deception:
    'Die automatische Prüfung war sich nicht sicher, ob diese Seite ihren Besuchern etwas anderes verspricht, als sie tut.',
  illegal:
    'Die automatische Prüfung war sich nicht sicher, ob der Inhalt dieser Seite rechtlich zulässig ist.',
  payment_data:
    'Die automatische Prüfung war sich nicht sicher, ob diese Seite Zahlungsdaten selbst einsammelt, statt sie an einen zertifizierten Anbieter zu geben.',
  harassment:
    'Die automatische Prüfung war sich nicht sicher, ob sich diese Seite gegen eine bestimmte Person oder Gruppe richtet.',
  circumvention:
    'Die automatische Prüfung war sich nicht sicher, ob diese Seite darauf angelegt ist, die Prüfungen oder Limits der Plattform zu umgehen.',
  wallet:
    'Die automatische Prüfung war sich nicht sicher, ob diese Seite auf Krypto-Wallets ihrer Besucher zugreift.',
  spam: 'Die automatische Prüfung war sich nicht sicher, ob diese Seite dem Sammeln von Adressen oder dem Manipulieren von Suchmaschinen dient.',
  copyright:
    'Die automatische Prüfung war sich nicht sicher, ob die Inhalte dieser Seite fremdes Material ohne Berechtigung verbreiten.',
  resource_abuse:
    'Die automatische Prüfung war sich nicht sicher, ob diese Seite Rechenleistung oder Netzwerk-Ressourcen für etwas anderes nutzt als für sich selbst.',
  unlawful_data:
    'Die automatische Prüfung war sich nicht sicher, ob diese Seite personenbezogene Daten verarbeitet, für die eine Berechtigung fehlen könnte.',
};

/**
 * The clause used when there is NO category — the check could not be completed at
 * all (budget, provider, unreadable answer). It says exactly that, and deliberately
 * does not dress it up as a suspicion about the app: the app did nothing; the
 * check did not finish. Blaming the artifact for our outage would be a small lie
 * with a real cost — a builder rewriting a page that was never the problem.
 */
export const REVIEW_BECAUSE_INCOMPLETE =
  'Die automatische Prüfung konnte diesmal nicht vollständig durchlaufen. Das sagt nichts über deine App aus — nur darüber, dass wir sie noch nicht abschließend prüfen konnten, und wir stellen nichts online, das wir nicht geprüft haben.';

/**
 * The tail used when the hold could NOT be recorded — the review queue is absent
 * (pre-0102) or the insert failed.
 *
 * The publish is held either way, and nothing was uploaded either way. What changes
 * is the promise: `REVIEW_TAIL` says a human will look, and with no queue row there
 * is nothing for any human to look at. Saying it anyway would be the exact shape of
 * lie this codebase does not tell — a reassurance that resolves itself into
 * silence. So this one asks for a retry instead, and names the fact that the
 * problem is on our side.
 */
export const REVIEW_TAIL_NOT_QUEUED =
  'Diese Anfrage konnten wir gerade nicht zur Prüfung vormerken — das liegt an uns, nicht an deiner App. Bitte versuch es später noch einmal. Es wartet aktuell niemand auf diesen Vorgang, deshalb sagen wir es dir direkt, statt dich warten zu lassen.';

/**
 * The whole message. `categories` may be empty; the first one governs the wording
 * (a page held for two reasons is still one page held, and listing them reads like
 * a charge sheet).
 */
export function reviewMessage(categories: AupCategory[], complete = true, queued = true): string {
  const because = categories.length > 0 && complete
    ? REVIEW_BECAUSE[categories[0]!]
    : REVIEW_BECAUSE_INCOMPLETE;
  return `${REVIEW_LEAD} ${because} ${queued ? REVIEW_TAIL : REVIEW_TAIL_NOT_QUEUED}`;
}
