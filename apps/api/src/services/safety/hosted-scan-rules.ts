/**
 * AKT 2 · PHASE 2 · U2.3 — the rules the HOSTED publish path adds on top of K3.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS AT ALL, AND WHY IT IS SMALL.
 *
 * The Nutzungsrichtlinie promises, publicly, "automatische Prüfungen vor dem
 * Veröffentlichen". ABUSE_RESPONSE §8.3 gap 4 records that the K3 scan was wired
 * only into the Vercel path — so the first app published to justgoblin.app would
 * have made that public promise false. This closes it.
 *
 * The scan is the SAME K3 ruleset (scan-rules.ts / publish-scan.ts), reused rather
 * than reimplemented: two divergent scanners would mean two different answers to
 * "is this allowed", and the promise is about one policy, not two. What is added
 * here is only what is genuinely different when GOBLIN is the hoster:
 *
 *   1. Wallet drainers. Not a Vercel-path concern in the same way; on our own
 *      domain a drainer is our infrastructure taking someone's funds.
 *   2. Credential exfiltration to a foreign domain, upgraded from log-only to
 *      BLOCKING. On the user's own Vercel this is their call. On justgoblin.app it
 *      is Goblin's domain, Goblin's TLS certificate and Goblin's liability.
 *   3. Artifact sanity — what a static host may serve at all.
 *
 * DELIBERATELY NOT HERE: a model call. This scan is deterministic and costs $0
 * (ledger M-H1). The Swift classifier, the review verdict and the admin review
 * queue are Phase 3; the AUP claim is satisfied from the first hosted publish
 * onward by the deterministic layer alone, and Phase 3 deepens it rather than
 * making it true for the first time.
 *
 * FALSE-POSITIVE DISCIPLINE (Wave-K hard rule, unchanged): a wrongly blocked
 * builder is our own honesty failure. Every blocking rule below ships with a
 * legitimate-case fixture proving it does NOT block honest use — the drainer rule
 * against a page that EXPLAINS seed phrases, the foreign-post rule against a
 * newsletter form posting to Mailchimp.
 * ════════════════════════════════════════════════════════════════════════════════
 */

import type { PolicyArea } from './scan-rules';

/** The policy areas the hosted path can block on: K3's three, plus two of its own. */
export type HostedPolicyArea = PolicyArea | 'wallet' | 'artifact';

/**
 * Known wallet-drainer markers.
 *
 * Written as CODE SHAPES (function calls, script filenames, kit names), never as
 * prose words. "Drainer" or "Seed Phrase" appearing in a sentence must not block —
 * a page warning people about drainers is exactly the kind of honest content this
 * platform should host, and `benign-06` in the fixture battery proves it does.
 */
export const DRAINER_SIGNATURES: string[] = [
  'inferno drainer', 'monkeydrainer', 'angeldrainer', 'venomdrainer', 'pinkdrainer',
  'seaport-drainer', 'wallet-drainer.js', 'drainer.min.js', 'sweeper.min.js',
  'drainwallet(', 'drainallassets(', 'transferallassets(', 'stealnft(', 'sweepwallet(',
  'connectanddrain(', 'autodrain(',
];

/**
 * A field that harvests a wallet's recovery secret. Applied ONLY to <input> and
 * <textarea> tags, never to page text: the difference between a drainer and a
 * security guide is whether it asks you to TYPE the phrase.
 *
 * No legitimate web app asks for a seed phrase. Not one. That is what makes this a
 * HIGH-confidence rule rather than a signal.
 */
export const SEED_FIELD =
  /(name|id|placeholder|aria-label)\s*=\s*["'][^"']*(seed[\s_-]?phrase|seedphrase|recovery[\s_-]?phrase|mnemonic|secret[\s_-]?recovery|private[\s_-]?key|privatekey|wallet[\s_-]?passphrase)/i;

/** Input-ish tags, so SEED_FIELD is never matched against prose. */
export const INPUT_TAG = /<(input|textarea)\b[^>]*>/gi;

/**
 * What a static host may serve. An allowlist, not a blocklist: the set of things a
 * browser can usefully render is small and known, while the set of dangerous
 * extensions is open-ended and grows without us.
 *
 * Server-side languages (.php, .jsp, .py …) are absent on purpose — R2 serves
 * bytes, so uploading one cannot execute it, but it CAN leak source that the
 * builder believed was server-side. Refusing it is the honest outcome.
 */
export const ALLOWED_EXTENSIONS = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.json', '.map', '.txt', '.xml',
  '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.mp4', '.webm', '.mp3', '.ogg', '.wav',
  '.webmanifest', '.wasm', '.csv', '.md',
]);

/** Artifact ceilings for a Free-plane static host. Generous, but finite and stated. */
export const HOSTED_MAX_FILES = 2_000;
export const HOSTED_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const HOSTED_MAX_TOTAL_BYTES = 60 * 1024 * 1024; // 60 MB

/**
 * German block messages. They name the CATEGORY and the appeal path, never the
 * rule that fired: telling someone which pattern to avoid is telling the next
 * attacker how to pass. The three K3 areas keep K3's wording verbatim (imported at
 * use time) so a blocked builder reads the same sentence on both publish paths.
 */
export const HOSTED_BLOCK_MESSAGE: Record<'wallet' | 'artifact', string> = {
  wallet:
    'Diese Veröffentlichung wurde gestoppt: Die Seite fragt nach der Wiederherstellungs-Phrase oder dem privaten Schlüssel einer Krypto-Wallet, oder enthält Muster bekannter Wallet-Diebstahl-Werkzeuge — das ist bei Goblin nicht erlaubt (Nutzungsrichtlinie). Eine Seite, die ÜBER Wallets informiert, ist erlaubt; eine, die danach fragt, nicht. Wenn das ein Fehler ist: Feedback-Knopf — ein Mensch schaut es sich an.',
  artifact:
    'Diese Veröffentlichung wurde gestoppt: Die App enthält Dateien, die Goblin nicht ausliefern kann, oder sie ist zu groß für das gehostete Kontingent. Goblin hostet ausschließlich statische Seiten — HTML, CSS, JavaScript, Bilder, Schriften. Wenn das ein Fehler ist: Feedback-Knopf — ein Mensch schaut es sich an.',
};
