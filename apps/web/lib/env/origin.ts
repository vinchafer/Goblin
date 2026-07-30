/**
 * One place that turns a raw environment string into a usable HTTP origin.
 *
 * Why this exists — the 2026-07-30 production incident:
 * `NEXT_PUBLIC_API_URL` on Vercel had been set to the Supabase mail-hook URL
 * *including a trailing newline*:
 *
 *     https://goblinapi-production.up.railway.app/api/auth/email-hook\n
 *
 * That single value reached three places unvalidated:
 *   1. `next.config.ts` CSP `connect-src`   → a response header containing 0x0A
 *   2. `next.config.ts` rewrites destination → `…/email-hook\n/api/:path*`
 *   3. `lib/api.ts` `API_URL`                → every browser call to a 404 path
 *
 * (1) is what killed the site: Node refuses to write a header value containing a
 * control character (`ERR_INVALID_CHAR`), so every dynamic route died at the
 * moment it tried to send its response — before any I/O. Statically prerendered
 * pages were served straight from the CDN and looked fine, which is exactly why
 * the outage read as "signed-in users are down, the marketing site is up".
 *
 * The rule this module enforces: a malformed env value must never be able to
 * reach a header, a URL, or a fetch base. It degrades to a known-good fallback
 * and says so out loud — it never throws, because a throw at module scope takes
 * the whole runtime with it.
 */

/** Why a raw value could not be used as-is. */
export type OriginProblem =
  | 'missing'
  | 'control-characters'
  | 'not-a-url'
  | 'unsupported-protocol'
  | 'not-an-origin';

export interface NormalizedOrigin {
  /** Always safe to embed in a header value or concatenate a path onto. */
  origin: string;
  /** True when the configured value was used verbatim (after trimming). */
  ok: boolean;
  /** Present only when `ok` is false. */
  problem?: OriginProblem;
  /** True when `origin` came from the fallback rather than the env value. */
  usedFallback: boolean;
}

/** C0 controls plus DEL. Whitespace inside a value is never legitimate here. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/**
 * Trim the wrappers a value picks up from a copy/paste into a dashboard field:
 * surrounding whitespace (newlines included) and a stray pair of quotes.
 */
function unwrap(raw: string): string {
  let v = raw.trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

/**
 * Normalise a configured origin, falling back to `fallback` whenever the value
 * cannot be used. `fallback` is trusted (it is a literal in our own source) and
 * is returned as given.
 *
 * A value carrying a path is rejected rather than silently truncated to its
 * origin — with one exception: a lone trailing `/api`, which is the mistake the
 * documentation has always warned about, is stripped. Everything else with a
 * path is a different variable's value pasted into this one, and the honest
 * answer is to refuse it and report `not-an-origin`.
 */
export function normalizeOrigin(raw: string | undefined | null, fallback: string): NormalizedOrigin {
  const fail = (problem: OriginProblem): NormalizedOrigin => ({
    origin: fallback,
    ok: false,
    problem,
    usedFallback: true,
  });

  if (raw === undefined || raw === null) return fail('missing');

  const value = unwrap(raw);
  if (value === '') return fail('missing');
  if (CONTROL_CHARS.test(value)) return fail('control-characters');

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail('not-a-url');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return fail('unsupported-protocol');
  if (url.search !== '' || url.hash !== '') return fail('not-an-origin');

  // '' | '/' | '/api' | '/api/' are all "no meaningful path".
  const path = url.pathname.replace(/\/+$/, '');
  if (path !== '' && path !== '/api') return fail('not-an-origin');

  // url.origin is protocol + host + port — never a path, never a control char.
  return { origin: url.origin, ok: true, usedFallback: false };
}

/** A one-line, value-free explanation suitable for a log line or a status card. */
export function describeOriginProblem(name: string, problem: OriginProblem): string {
  switch (problem) {
    case 'missing':
      return `${name} is not set — falling back to the built-in default.`;
    case 'control-characters':
      return `${name} contains a line break or control character (a paste artefact) — falling back to the built-in default.`;
    case 'not-a-url':
      return `${name} is not a parseable absolute URL — falling back to the built-in default.`;
    case 'unsupported-protocol':
      return `${name} does not use http:// or https:// — falling back to the built-in default.`;
    case 'not-an-origin':
      return `${name} carries a path, query or fragment; it must be a bare origin such as https://host.example — falling back to the built-in default.`;
  }
}

/**
 * Last line of defence for anything about to become an HTTP header value.
 * A header carrying a control character is not a bad header, it is a fatal one:
 * Node throws `ERR_INVALID_CHAR` and the request dies with no response at all.
 */
export function headerSafe(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ');
}
