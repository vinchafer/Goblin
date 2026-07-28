/**
 * AKT 2 · PHASE 2 · U2.4 — the name claim.
 *
 * `{name}.justgoblin.app` is a public identity. Handing one out is cheap for us and
 * permanent for the person who prints it on a flyer, so this module is the one
 * place that decides whether a name may be claimed, and it is deliberately strict.
 *
 * ── Two lists, one truth ──────────────────────────────────────────────────────
 * The router Worker carries its own copy of RESERVED_NAMES (it runs on Cloudflare
 * and cannot import from here). That duplication is a real risk — a name added
 * here but not there would be claimable and then serve someone's app on an
 * operational hostname. `ops-app-names.test.ts` parses the Worker source and
 * asserts the two lists are identical, so the copies cannot drift silently.
 *
 * The router ALSO checks the list at request time, after this module has checked it
 * at claim time. That is not redundancy for its own sake: a name written by an
 * older path, by a future migration or by hand still must not resolve.
 */

/**
 * Labels that never belong to a user app.
 *
 * Wider than "what we use today": mail/smtp/imap protect future mail delivery, and
 * abuse/security/legal must stay ours because the AUP publishes them as reporting
 * paths. Taking a name back after someone has printed it is the expensive mistake;
 * refusing it up front costs one honest sentence.
 */
export const RESERVED_NAMES: readonly string[] = [
  'www', 'api', 'app', 'apps', 'admin', 'administrator', 'status', 'mail', 'smtp',
  'imap', 'pop', 'webmail', 'help', 'support', 'docs', 'doc', 'blog', 'goblin',
  'abuse', 'security', 'legal', 'privacy', 'terms', 'billing', 'pay', 'payments',
  'account', 'accounts', 'auth', 'login', 'signup', 'dashboard', 'console',
  'static', 'assets', 'cdn', 'files', 'download', 'downloads', 'test', 'staging',
  'dev', 'preview', 'demo', 'internal', 'ops', 'router', 'ns', 'ns1', 'ns2',
  'mx', 'dns', 'root', 'system', 'info', 'contact', 'news', 'shop', 'store',
];

const RESERVED_SET = new Set(RESERVED_NAMES);

/**
 * Hostname-label shape, matching migration 0099's CHECK constraints exactly: 3–63
 * characters, lowercase alphanumerics and hyphens, no leading or trailing hyphen.
 * The database and this function must agree, or a name accepted here would fail
 * the insert with an error nobody can act on.
 */
const NAME_RE = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export type NameRejection =
  | 'too_short'
  | 'too_long'
  | 'bad_shape'
  | 'punycode'
  | 'reserved'
  | 'taken'
  | 'released';

export interface NameCheck {
  ok: boolean;
  reason?: NameRejection;
  /** German, user-facing, honest about WHICH problem it is. */
  message?: string;
  /** The normalised name a caller should actually use. */
  normalized: string;
}

/**
 * Hostnames are case-insensitive, so a name is lower-cased before anything else
 * looks at it — otherwise "MeinLaden" and "meinladen" would be two rows fighting
 * over one hostname.
 */
export function normalizeName(raw: string): string {
  return (raw ?? '').trim().toLowerCase();
}

/**
 * Shape and policy only — no database, no KV. Split out so it can be checked while
 * someone is still typing, without a round-trip.
 *
 * Every rejection names ITS OWN reason. "Dieser Name geht nicht" for six different
 * problems would leave someone guessing which one they hit.
 */
export function checkNameShape(raw: string): NameCheck {
  const name = normalizeName(raw);

  if (name.length < 3) {
    return { ok: false, reason: 'too_short', normalized: name, message: 'Der Name braucht mindestens 3 Zeichen.' };
  }
  if (name.length > 63) {
    return { ok: false, reason: 'too_long', normalized: name, message: 'Der Name darf höchstens 63 Zeichen haben.' };
  }
  if (name.startsWith('xn--')) {
    // Punycode is how a homoglyph attack ships. Refused outright rather than
    // half-understood.
    return {
      ok: false,
      reason: 'punycode',
      normalized: name,
      message: 'Namen mit Sonderzeichen sind nicht möglich. Bitte nutze a–z, 0–9 und Bindestriche.',
    };
  }
  if (!NAME_RE.test(name)) {
    return {
      ok: false,
      reason: 'bad_shape',
      normalized: name,
      message:
        'Erlaubt sind Kleinbuchstaben, Zahlen und Bindestriche — und der Name darf nicht mit einem Bindestrich anfangen oder aufhören.',
    };
  }
  if (RESERVED_SET.has(name)) {
    return {
      ok: false,
      reason: 'reserved',
      normalized: name,
      message: 'Dieser Name ist für Goblin selbst reserviert. Bitte such dir einen anderen aus.',
    };
  }
  return { ok: true, normalized: name };
}

/** The two "someone else got here first" answers, kept next to their siblings. */
export const NAME_TAKEN_MESSAGE = 'Dieser Name ist vergeben. Bitte such dir einen anderen aus.';

/**
 * A name released by a rename is NOT recycled.
 *
 * Somebody's bookmark, QR code or printed flyer still points at the old address.
 * Handing that address to a different builder would silently redirect real people
 * to content the original owner never chose — which is the same failure mode as
 * the phantom redirect the router refuses to serve. The address keeps serving 410
 * and the name stays out of circulation.
 */
export const NAME_RELEASED_MESSAGE =
  'Dieser Name war schon einmal vergeben und bleibt reserviert — alte Links zeigen noch darauf. Bitte such dir einen anderen aus.';

/** The public hostname for a claimed name. The single place this is composed. */
export function appHostname(name: string, domain: string): string {
  return `${normalizeName(name)}.${domain}`;
}

/** The public URL for a claimed name. Always https — the Worker is only there. */
export function appUrl(name: string, domain: string): string {
  return `https://${appHostname(name, domain)}`;
}
