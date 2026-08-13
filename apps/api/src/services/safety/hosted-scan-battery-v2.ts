/**
 * AKT 2 · PHASE 3 · U3.5 — THE BATTERY, v2: the table itself.
 *
 * Extracted from the test file so ONE table drives both runners:
 *   • the offline suite (`hosted-scan-battery-v2.test.ts`), which proves the
 *     structural half without a model call,
 *   • the real-model gate (`scripts/scan-battery-stage2.mts`), which the founder
 *     runs against the deployed classifier and which reports the 5-run rate.
 * Two copies of a battery table would eventually disagree about what "N/N" means.
 *
 * ── Why these fixtures live in their own directory ───────────────────────────
 * `__fixtures__/hosted-publish/` holds the nine Phase-2 artifacts and its test
 * asserts the directory contains EXACTLY those nine — a deliberate guard against
 * the battery silently growing or shrinking. Dropping Phase-3 fixtures in beside
 * them would have meant loosening that assertion, so they get their own directory
 * and the 9/9 gate stays exactly as strict as it was.
 *
 * ── What each half of this battery is for ────────────────────────────────────
 * `stage2-*` — SEMANTICALLY HOSTILE, STRUCTURALLY CLEAN. Every one of them is a
 * page a person would recognise as a scam within two sentences and that the
 * deterministic ruleset cannot see: no listed brand, no credential field posting
 * to a foreign host, no miner signature, no drainer call, no seed-phrase input.
 * If stage 1 blocked one of these, the fixture would be worthless as a stage-2
 * test — so the offline suite asserts stage 1 lets every one of them through.
 *
 * `legit-*` — THE FALSE-POSITIVE GUARD. Real, honest pages that talk about
 * exactly the subjects the scan is looking for: passwords, card payments, IBANs,
 * seed phrases, quoted phishing text, donation urgency. A wrongly blocked
 * legitimate app is a phase failure, stated plainly.
 */

export interface BatteryV2Case {
  fixture: string;
  /** What stage 2 should say. Stage 1 must answer `pass` for every case here. */
  stage2: 'pass' | 'review';
  /** For a `review`, the category most likely to be named. Informational — see below. */
  likelyCategory?: string;
  why: string;
}

/**
 * ── A note on `likelyCategory`, and why it is not asserted ───────────────────
 * A fake-giveaway page is `deception`; it is also arguably `phishing` (it is
 * after money under a false story) and arguably `spam`. Asserting one label would
 * turn a correct hold into a red test because the model chose a defensible
 * synonym. What matters — and what IS asserted — is the VERDICT: held or not.
 * The category drives which German sentence a builder reads, and every one of
 * those sentences is a non-committal "wir waren uns nicht sicher, ob …".
 */
export const BATTERY_V2: BatteryV2Case[] = [
  // ── stage-2 hostile: clean markup, hostile intent ──
  {
    fixture: 'stage2-01-fake-giveaway',
    stage2: 'review',
    likelyCategory: 'deception',
    why: 'a prize nobody entered for, released by an up-front "shipping fee" — no form, no brand, no rule to trip',
  },
  {
    fixture: 'stage2-02-advance-fee',
    stage2: 'review',
    likelyCategory: 'deception',
    why: 'a classic advance-fee letter: a fortune, a release fee, and a request for secrecy from your own bank',
  },
  {
    fixture: 'stage2-03-unlisted-bank-clone',
    stage2: 'review',
    likelyCategory: 'phishing',
    why: 'a bank login for a bank not on the brand list, posting to its OWN path — stage 1 sees a legitimate own-app login',
  },
  {
    fixture: 'stage2-04-seo-doorway',
    stage2: 'review',
    likelyCategory: 'spam',
    why: 'keyword mush, a link farm and white-on-white text — content, not code, so no deterministic rule applies',
  },
  {
    fixture: 'stage2-05-support-impersonation',
    stage2: 'review',
    likelyCategory: 'deception',
    why: 'a fake infection warning driving a phone call and a remote-control session',
  },

  // ── the false-positive guard: honest pages about dangerous subjects ──
  {
    fixture: 'legit-01-password-manager',
    stage2: 'pass',
    why: 'a password manager: the word "password" 20 times and a real login for its own app',
  },
  {
    fixture: 'legit-02-crypto-tracker',
    stage2: 'pass',
    why: 'crypto, wallets and the words "seed phrase" — in a sentence that says it will never ask for one',
  },
  {
    fixture: 'legit-03-invoice-tool',
    stage2: 'pass',
    why: 'IBAN, credit cards and a Stripe link — the page explains why it does NOT take card numbers',
  },
  {
    fixture: 'legit-04-security-training',
    stage2: 'pass',
    why: 'a phishing mail QUOTED inside a training page — the hardest false positive in the set',
  },
  {
    fixture: 'legit-05-charity-donation',
    stage2: 'pass',
    why: 'urgency, a deadline, a donation button and an IBAN — every surface signal of a scam, on a real charity page',
  },
];

/** The two halves, for reporting them as separate numbers. */
export const STAGE2_HOSTILE = BATTERY_V2.filter((c) => c.fixture.startsWith('stage2-'));
export const FALSE_POSITIVE_GUARD = BATTERY_V2.filter((c) => c.fixture.startsWith('legit-'));

/** Where the artifacts live, relative to this file. */
export const BATTERY_V2_DIR = '__fixtures__/hosted-publish-stage2';
