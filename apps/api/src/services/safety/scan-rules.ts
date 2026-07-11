// K3 (Wave-K, Layer 3) — the maintainable rule list for the publish-time scan.
//
// This file is intentionally DATA, not logic: brand tokens, miner signatures, and the
// rule definitions live here so the founder can tune the scan without touching the
// engine (publish-scan.ts). Every rule carries a stable `id` (logged on every hit),
// a `policyArea` (maps to the Nutzungsrichtlinie / AUP), and a `confidence`.
//
// D-K1 = Option A (founder decision, Wave-K): only HIGH-confidence phishing/malware
// HARD-BLOCKS a publish. LOW-confidence hits are LOGGED, never blocked — a wrongly
// blocked paying builder is our own honesty failure, so obfuscation-alone and softer
// signals inform rather than punish.
//
// False-positive discipline: the HIGH rules require a THIRD-PARTY brand or an
// unambiguous exfiltration/miner signature. A login for the user's OWN app (no foreign
// brand, posting to its own backend) matches NOTHING here — proven by the legit fixture.

export type Confidence = 'high' | 'low';

export type PolicyArea =
  | 'phishing' // Phishing / Credential-Harvesting / Marken-Imitation
  | 'payment' // Erfassung von Zahlungsdaten außerhalb zertifizierter Anbieter
  | 'malware'; // Malware / Miner

/** One deterministic finding produced by the scan. */
export interface ScanHit {
  ruleId: string;
  policyArea: PolicyArea;
  confidence: Confidence;
  /** Storage path of the file the hit was found in. */
  path: string;
  /** Short, human-readable reason (metadata only — never raw user content). */
  evidence: string;
}

/**
 * Known THIRD-PARTY brands whose login/identity a phishing clone imitates. Kept
 * specific (full brand names, not generic words) so a legitimate own-app page does not
 * trip it. Matched case-insensitively, only inside <title>/<h1>/<h2> (the impersonation
 * surface) — never anywhere in the body, where a legit "Sign in with Google" button
 * would otherwise false-positive.
 */
export const BRAND_TOKENS: string[] = [
  'paypal', 'sparkasse', 'volksbank', 'raiffeisen', 'deutsche bank', 'commerzbank',
  'postbank', 'ing-diba', 'ing diba', 'n26', 'revolut', 'klarna', 'comdirect',
  'apple id', 'appleid', 'icloud', 'microsoft 365', 'office 365', 'outlook',
  'microsoft account', 'google account', 'gmail', 'amazon', 'netflix', 'disney+',
  'dhl', 'dpd', 'hermes', 'ups', 'fedex', 'telekom', 'vodafone', 'o2',
  'facebook', 'instagram', 'whatsapp', 'linkedin', 'coinbase', 'binance', 'kraken',
  'metamask', 'bitpanda', 'wise', 'stripe login', 'steam', 'epic games',
];

/**
 * Known crypto-miner library signatures + stratum protocol markers. A match is an
 * unambiguous covert-miner tell → HIGH. (Legitimate sites do not ship these.)
 */
export const MINER_SIGNATURES: string[] = [
  'coinhive', 'coin-hive', 'coinhive.min.js', 'cryptonight', 'cryptoloot',
  'crypto-loot', 'coinimp', 'jsecoin', 'webminepool', 'minero.cc', 'deepminer',
  'webmine.cz', 'wasmminer', 'coinhive.anonymous', 'client.anonymous', 'stratum+tcp://',
  'nerohut', 'monerominer', 'projectpoi', 'authedmine',
];

/**
 * Credential-field detectors: an <input type=password> or a name/id/placeholder that
 * clearly captures a secret (password, PIN, TAN, OTP, CVV). Used by the phishing rules.
 */
export const CREDENTIAL_FIELD = /type\s*=\s*["']?password|name\s*=\s*["'][^"']*(passwort|password|pin|otp|tan)|id\s*=\s*["'][^"']*(passwort|password|pin|otp|tan)|placeholder\s*=\s*["'][^"']*(passwort|password|pin|otp|tan)/i;

/** Card-capture field detectors (own card form). */
export const CARD_FIELD = /kreditkart|card.?number|kartennummer|\bcvv\b|\bcvc\b|\biban\b|card.?cvc|cc-number|creditcard/i;

/** A form/action that exfiltrates to an email address (mailto:) — the "mail me the data" pattern. */
export const MAILTO_ACTION = /action\s*=\s*["']\s*mailto:/i;

/** An absolute http(s) URL — used to detect a form posting to a FOREIGN domain. */
export const ABSOLUTE_URL = /https?:\/\/[^\s"'<>]+/i;

/** A hidden element (display:none / visibility:hidden / hidden attr / zero-size). */
export const HIDDEN_MARKER = /display\s*:\s*none|visibility\s*:\s*hidden|\bhidden\b|width\s*=\s*["']?0|height\s*=\s*["']?0/i;

/** An auth/login URL (target of a hidden phishing iframe). */
export const AUTH_URL = /(login|signin|sign-in|auth|oauth|account)/i;

/** Obfuscated eval chains + the classic packer preamble. LOW by policy (obfuscation ≠ block). */
export const OBFUSCATED_EVAL = /eval\s*\(\s*(atob|unescape|decodeURIComponent)\s*\(|Function\s*\(\s*(atob|unescape)\s*\(|eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)/i;

/** File extensions the scan inspects (HTML + script). Everything else is skipped. */
export const SCANNABLE_EXT = new Set([
  '.html', '.htm', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
]);

/** Per-file and total byte caps so the scan stays fast + bounded (no external service). */
export const MAX_FILE_BYTES = 512 * 1024; // 512 KB per file
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // 4 MB total scanned

/** German, user-facing block message per policy area (house register, names the reason
 *  + the appeal path). Referenced by K3's block result and mirrored by the AUP page. */
export const BLOCK_MESSAGE: Record<PolicyArea, string> = {
  phishing:
    'Diese Veröffentlichung wurde gestoppt: Die Seite sieht aus wie das Abgreifen von Zugangsdaten oder das Nachbauen einer fremden Marke (Phishing) — das ist bei Goblin nicht erlaubt (Nutzungsrichtlinie). Ein Login für DEINE eigene App ist erlaubt; das Nachbauen fremder Marken nicht. Wenn das ein Fehler ist: Feedback-Knopf — ein Mensch schaut es sich an.',
  payment:
    'Diese Veröffentlichung wurde gestoppt: Die Seite sammelt Zahlungsdaten (Kartennummer/CVV/IBAN) selbst ein — das ist bei Goblin nicht erlaubt (Nutzungsrichtlinie). Der sichere Weg: binde einen zertifizierten Anbieter ein (Stripe Payment Link, PayPal-Button). Wenn das ein Fehler ist: Feedback-Knopf — ein Mensch schaut es sich an.',
  malware:
    'Diese Veröffentlichung wurde gestoppt: Die Seite enthält Muster von Schadcode oder einem versteckten Krypto-Miner — das ist bei Goblin nicht erlaubt (Nutzungsrichtlinie). Wenn das ein Fehler ist: Feedback-Knopf — ein Mensch schaut es sich an.',
};
