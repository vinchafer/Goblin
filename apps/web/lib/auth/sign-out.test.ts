import { describe, it, expect, vi } from 'vitest';
import { createBrowserClient } from '@supabase/ssr';
import {
  performSignOut,
  authCookieNames,
  expiryWrites,
  parentCookieDomain,
  SIGNED_OUT_PATH,
  type SignOutEnvironment,
} from './sign-out';

/**
 * U2 regression suite — logout.
 *
 * Every test here runs against THIS CHECKOUT (node/vitest, the real
 * @supabase/ssr + @supabase/auth-js from the lockfile). None of it touches the
 * deployed app, which matters: the `@auth` Playwright suite drives PRODUCTION,
 * so a green E2E run is not evidence about code in this PR (PR #61's own
 * finding). These tests are.
 */

/** A `document.cookie` stand-in with the same read/write semantics. */
function cookieJar(initial: Record<string, string> = {}) {
  const jar = new Map<string, string>(Object.entries(initial));
  return {
    jar,
    read: () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '),
    write: (value: string) => {
      const [pair, ...attrs] = value.split(';');
      const name = pair!.split('=')[0]!.trim();
      const val = pair!.slice(pair!.indexOf('=') + 1);
      const expired = attrs.some((a) => /^\s*max-age\s*=\s*0\s*$/i.test(a));
      // A Domain= delete only lands if the cookie was written for that domain.
      // The jar models the common case: host-only cookies, so the host-only
      // write is the one that removes them.
      const hasDomain = attrs.some((a) => /^\s*domain\s*=/i.test(a));
      if (expired) {
        if (!hasDomain) jar.delete(name);
        return;
      }
      jar.set(name, val);
    },
  };
}

function env(over: Partial<SignOutEnvironment> = {}): SignOutEnvironment & { navigated: string[] } {
  const navigated: string[] = [];
  const c = cookieJar({ 'sb-abcdefgh-auth-token': 'base64-xyz' });
  return {
    revoke: async () => ({ error: null }),
    readCookies: c.read,
    writeCookie: c.write,
    hostname: 'www.justgoblin.com',
    navigate: (p: string) => { navigated.push(p); },
    navigated,
    ...over,
  };
}

describe('authCookieNames', () => {
  it('finds the session cookie, its chunks and the PKCE code verifier', () => {
    const names = authCookieNames(
      'goblin_onboarded=1; sb-abcdefgh-auth-token.0=a; sb-abcdefgh-auth-token.1=b; ' +
        'sb-abcdefgh-auth-token-code-verifier=c; theme=dark',
    );
    expect(names).toEqual([
      'sb-abcdefgh-auth-token.0',
      'sb-abcdefgh-auth-token.1',
      'sb-abcdefgh-auth-token-code-verifier',
    ]);
  });

  it('leaves non-auth cookies alone', () => {
    expect(authCookieNames('goblin_onboarded=1; sb-not-a-session=x; theme=dark')).toEqual([]);
  });

  it('tolerates an empty cookie string', () => {
    expect(authCookieNames('')).toEqual([]);
  });
});

describe('parentCookieDomain', () => {
  it('targets the registrable domain for the www host', () => {
    expect(parentCookieDomain('www.justgoblin.com')).toBe('.justgoblin.com');
  });
  it('targets the same domain from the apex', () => {
    expect(parentCookieDomain('justgoblin.com')).toBe('.justgoblin.com');
  });
  it('returns null where a Domain attribute is meaningless', () => {
    expect(parentCookieDomain('localhost')).toBeNull();
    expect(parentCookieDomain('127.0.0.1')).toBeNull();
  });
  it('emits both a host-only and a parent-domain delete', () => {
    expect(expiryWrites('sb-x-auth-token', 'www.justgoblin.com')).toEqual([
      'sb-x-auth-token=; Max-Age=0; Path=/; SameSite=Lax',
      'sb-x-auth-token=; Max-Age=0; Path=/; SameSite=Lax; Domain=.justgoblin.com',
    ]);
  });
});

describe('performSignOut', () => {
  it('clears the session and navigates to a logged-out surface', async () => {
    const e = env();
    const result = await performSignOut(e);
    expect(result).toEqual({ ok: true, revoked: true });
    expect(authCookieNames(e.readCookies())).toEqual([]);
    expect(e.navigated).toEqual([SIGNED_OUT_PATH]);
  });

  it('THE REGRESSION: revocation fails on the network — the session is still gone', async () => {
    // The exact live-cohort condition: phone on mobile data, the call to the
    // auth server never lands. auth-js then skips `_removeSession()`, so the
    // cookie survives the library call. The old code ignored the error and
    // navigated anyway; middleware saw the live session and bounced the user
    // straight back to /dashboard — "Abmelden does nothing".
    const e = env({ revoke: async () => { throw new Error('Failed to fetch'); } });
    const result = await performSignOut(e);
    expect(result).toEqual({ ok: true, revoked: false });
    expect(authCookieNames(e.readCookies())).toEqual([]);
    expect(e.navigated).toEqual([SIGNED_OUT_PATH]);
  });

  it('a returned { error } is treated as a failed revocation, not as success', async () => {
    const e = env({ revoke: async () => ({ error: { status: 500, message: 'boom' } }) });
    const result = await performSignOut(e);
    expect(result).toEqual({ ok: true, revoked: false });
    expect(authCookieNames(e.readCookies())).toEqual([]);
  });

  it('sweeps every chunk and the code verifier, not just the base cookie', async () => {
    const c = cookieJar({
      'sb-abcdefgh-auth-token.0': 'a',
      'sb-abcdefgh-auth-token.1': 'b',
      'sb-abcdefgh-auth-token-code-verifier': 'c',
      'goblin_onboarded': '1',
    });
    const e = env({ revoke: async () => { throw new Error('offline'); }, readCookies: c.read, writeCookie: c.write });
    await performSignOut(e);
    expect([...c.jar.keys()]).toEqual(['goblin_onboarded']);
  });

  it('HONESTY: when the session cannot be cleared it does NOT navigate and reports failure', async () => {
    // A cookie the browser refuses to expire (e.g. written for a path we cannot
    // target). Showing a logged-out screen over a live session is the false
    // state Law 6 forbids — so we stay put and the caller surfaces an error.
    const stubborn = {
      read: () => 'sb-abcdefgh-auth-token=still-here',
      write: () => { /* the delete does not land */ },
    };
    const e = env({ readCookies: stubborn.read, writeCookie: stubborn.write });
    const result = await performSignOut(e);
    expect(result).toEqual({
      ok: false,
      reason: 'session_not_cleared',
      remaining: ['sb-abcdefgh-auth-token'],
    });
    expect(e.navigated).toEqual([]);
  });

  it('a signed-out visitor with no cookies still ends up on the logged-out surface', async () => {
    const c = cookieJar({});
    const e = env({ readCookies: c.read, writeCookie: c.write });
    const result = await performSignOut(e);
    expect(result).toEqual({ ok: true, revoked: true });
    expect(e.navigated).toEqual([SIGNED_OUT_PATH]);
  });
});

/**
 * The premise of the whole fix, proven against the real libraries rather than
 * asserted from reading their source: when the revocation call fails with
 * anything outside {401, 403, 404}, `@supabase/auth-js` leaves the session
 * cookie in place. Everything above is built on this being true.
 */
describe('premise · real @supabase/ssr + auth-js', () => {
  const SUPABASE_URL = 'https://abcdefgh.supabase.co';
  const ANON_KEY = 'test-anon-key';

  function session() {
    return {
      access_token: 'access-token-value',
      refresh_token: 'refresh-token-value',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: 'user-1', email: 'vinc.hafner3@gmail.com' },
    };
  }

  function encoded() {
    return 'base64-' + Buffer.from(JSON.stringify(session()), 'utf8').toString('base64url');
  }

  function client(jar: Map<string, string>, fetchImpl: typeof fetch) {
    return createBrowserClient(SUPABASE_URL, ANON_KEY, {
      global: { fetch: fetchImpl },
      cookies: {
        getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
        setAll: (toSet) => {
          for (const { name, value, options } of toSet) {
            if (options && (options as { maxAge?: number }).maxAge === 0) jar.delete(name);
            else jar.set(name, value);
          }
        },
      },
    });
  }

  it('a 500 from the auth server leaves the session cookie in place', async () => {
    const jar = new Map([['sb-abcdefgh-auth-token', encoded()]]);
    const failing = vi.fn(async () =>
      new Response(JSON.stringify({ message: 'internal' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const { error } = await client(jar, failing).auth.signOut();

    expect(error).toBeTruthy();
    // The library gave up before removing anything — this is the defect the
    // production code used to swallow.
    expect(jar.has('sb-abcdefgh-auth-token')).toBe(true);
  }, 20_000);

  it('and performSignOut removes it anyway, then navigates', async () => {
    const jar = new Map([['sb-abcdefgh-auth-token', encoded()]]);
    const failing = vi.fn(async () =>
      new Response(JSON.stringify({ message: 'internal' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
    const supabase = client(jar, failing);

    const navigated: string[] = [];
    const result = await performSignOut({
      revoke: () => supabase.auth.signOut(),
      readCookies: () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '),
      writeCookie: (value) => {
        const name = value.split('=')[0]!.trim();
        if (/max-age\s*=\s*0/i.test(value) && !/domain\s*=/i.test(value)) jar.delete(name);
      },
      hostname: 'www.justgoblin.com',
      navigate: (p) => { navigated.push(p); },
    });

    expect(result).toEqual({ ok: true, revoked: false });
    expect(jar.has('sb-abcdefgh-auth-token')).toBe(false);
    expect(navigated).toEqual([SIGNED_OUT_PATH]);

    // And the in-memory session is gone too: with the cookie removed the second
    // revoke took the offline branch (no access token → no network call).
    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();
  }, 20_000);
});
