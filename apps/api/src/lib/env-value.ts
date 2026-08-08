/**
 * One place that turns a raw environment string into a value safe to COMPARE.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Every switch in this API is a Railway dashboard field, and a dashboard field is
 * filled by pasting. A paste brings wrappers with it: a newline, a leading space,
 * and — the one nothing here handled — a stray pair of quotes, because the value
 * was copied out of a `.env` file, a shell command, a chat message or a doc code
 * block where it was legitimately quoted.
 *
 * The web app already learned this the hard way. `apps/web/lib/env/origin.ts`
 * carries an `unwrap()` that strips exactly "surrounding whitespace and a stray
 * pair of quotes", written after the 2026-07-30 outage in which a pasted
 * `NEXT_PUBLIC_API_URL` took the whole signed-in site down. The API never got the
 * same hardening, so on this side the identical paste produced a silent refusal
 * instead of a loud crash:
 *
 *     OPS_FOUNDER_ACCOUNTS="vinc.hafner2@gmail.com"
 *
 * `.trim().toLowerCase()` leaves the quotes on. The list becomes the single entry
 * `"vinc.hafner2@gmail.com"` (quotes included), which matches no email that will
 * ever sign in, so the founder console 404s for the one account it was armed for
 * and says nothing about why. A fail-closed gate plus an unforgiving parser turns
 * a typo into an outage with no error message.
 *
 * ── What this module guarantees ─────────────────────────────────────────────
 * Every env read that feeds a COMPARISON goes through here: the boolean flags,
 * the comma-separated allowlists, and the single-address identities. The rule is
 * the web's rule, deliberately identical so the two sides cannot drift:
 *
 *   1. trim surrounding whitespace (newlines and NBSP included — `String.trim()`
 *      covers the whole Unicode whitespace class)
 *   2. strip ONE matching pair of surrounding quotes, single or double
 *   3. trim again, because `" value "` leaves whitespace behind after step 2
 *
 * ONE pair, not a loop. `""x""` is not a paste artefact, it is a different
 * mistake, and silently unwrapping arbitrarily many layers would hide it.
 *
 * ── What this module deliberately does NOT do ───────────────────────────────
 * It does not validate. It does not repair an address, guess at a missing value,
 * or coerce a non-`true` flag into `true`. Fail-closed stays fail-closed: an
 * unset or malformed flag is still false, and an unset allowlist is still empty
 * and still admits nobody. The only thing that changes is that a value which the
 * founder plainly MEANT to set is now read the way it was meant.
 *
 * ── Read at call time ───────────────────────────────────────────────────────
 * Nothing here caches. Callers keep their existing per-request read semantics, so
 * a Railway change still takes effect on the next request after the restart.
 */

/**
 * Strip the wrappers a value picks up from a copy/paste into a dashboard field.
 *
 * Mirrors `unwrap()` in `apps/web/lib/env/origin.ts`. Kept as its own exported
 * function so a test can pin the behaviour directly and so the next env reader
 * has an obvious thing to call.
 */
export function unwrapEnv(raw: string | undefined | null): string {
  if (raw === undefined || raw === null) return '';
  let v = raw.trim();
  if (
    v.length >= 2 &&
    ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

/** A single env value, unwrapped. `''` when unset — never `undefined`. */
export function envString(name: string): string {
  return unwrapEnv(process.env[name]);
}

/**
 * A boolean switch. True only for a literal `true`, case-insensitively, after
 * unwrapping. Everything else — unset, empty, `TRUE`, `"true"`, `yes`, `1`,
 * garbage — resolves as it did before EXCEPT that the quoted forms now work.
 *
 * Note `'1'` and `'yes'` remain false. That is not an oversight: every flag in
 * this codebase is documented as `X=true`, and quietly widening the accepted
 * vocabulary would mean a variable set to `1` starts behaving differently after
 * a deploy that changed no configuration.
 */
export function envFlag(name: string): boolean {
  return envString(name).toLowerCase() === 'true';
}

/** Does this entry still carry a quote at either edge — i.e. did unwrapping miss? */
function hasEdgeQuote(entry: string): boolean {
  return /^["']/.test(entry) || /["']$/.test(entry);
}

/** Lower-case and drop blanks. The last step of every list parse. */
function finish(entries: string[]): string[] {
  return entries.map((e) => e.toLowerCase()).filter((e) => e.length > 0);
}

/**
 * A comma-separated env list, normalized: split, unwrapped, lower-cased, blanks
 * dropped.
 *
 * ── Why this is not simply "unwrap, then split, then unwrap" ────────────────
 * There are two different quoted pastes and they need opposite orders:
 *
 *     OPS_BETA_ACCOUNTS="a@x.com,b@y.com"     ← the whole value quoted (.env paste)
 *     OPS_BETA_ACCOUNTS="a@x.com","b@y.com"   ← each entry quoted (array-literal paste)
 *
 * Unwrapping the whole value FIRST breaks the second: it removes the opening
 * quote of the first entry and the closing quote of the last, leaving `a@x.com"`
 * and `"b@y.com` — two entries with stranded, now-unmatched quotes that match
 * nobody. Splitting first breaks the first case in the mirror-image way.
 *
 * So: split first, and fall back to the whole-value unwrap only when splitting
 * first left a quote stranded at an entry edge. A value with no quotes at all
 * takes the first path and is untouched by any of this — the common case pays
 * nothing for the rescue of the uncommon one.
 *
 * A leading or trailing comma is already harmless either way: it yields an empty
 * entry, which is dropped.
 */
export function envList(name: string): string[] {
  return splitEnvList(unwrapEnvPreservingList(process.env[name]));
}

/** The raw value with only its whitespace removed — quotes are the list parser's business. */
function unwrapEnvPreservingList(raw: string | undefined | null): string {
  return (raw ?? '').trim();
}

/**
 * The same normalization applied to an already-assembled string rather than a
 * variable name. Exists for the one caller that folds several variables together
 * before splitting (`services/insight.ts`), so that caller does not have to
 * re-implement the split to keep its behaviour.
 */
export function splitEnvList(raw: string): string[] {
  const perEntry = raw.split(',').map((entry) => unwrapEnv(entry));
  if (!perEntry.some(hasEdgeQuote)) return finish(perEntry);

  // Splitting first stranded a quote, so this was the whole-value-quoted shape.
  const wholeValue = unwrapEnv(raw).split(',').map((entry) => unwrapEnv(entry));
  return finish(wholeValue);
}
