/**
 * AKT 2 · PHASE 2 · U2.1 — the router Worker's behaviour, proven against the
 * ACTUAL DEPLOYED BYTES.
 *
 * The suite does not re-implement the routing logic and then test the
 * re-implementation. It imports `ROUTER_WORKER_SOURCE` — the exact string the
 * deploy path uploads to Cloudflare — as an ES module and calls its `fetch`
 * handler with fake KV/R2 bindings. If the constant is stale, the drift test
 * below fails first; if the constant is current, everything the other tests prove
 * is a property of the code that actually runs at the edge.
 *
 * Cloudflare's runtime differs from Node in ways this cannot cover (real KV
 * consistency, real R2 streaming, cache behaviour). Those are the E2E's job — see
 * HONEST LIMITATIONS in the phase report. What is covered here is every routing
 * decision, every status code, and every word on every page.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ROUTER_WORKER_SOURCE, ROUTER_SCRIPT_NAME } from './worker-source.generated';

type WorkerModule = {
  default: { fetch: (request: Request, env: Record<string, unknown>) => Promise<Response> };
};

let worker: WorkerModule['default'];

beforeAll(async () => {
  const dataUrl = `data:text/javascript;base64,${Buffer.from(ROUTER_WORKER_SOURCE, 'utf8').toString('base64')}`;
  const mod = (await import(/* @vite-ignore */ dataUrl)) as WorkerModule;
  worker = mod.default;
});

// ── Fake bindings ───────────────────────────────────────────────────────────

/** A KV namespace that answers from a plain object. `null` = key absent. */
function kv(records: Record<string, unknown>) {
  return {
    get: async (key: string, opts?: { type?: string }) => {
      const value = records[key];
      if (value === undefined) return null;
      return opts?.type === 'json' ? value : JSON.stringify(value);
    },
  };
}

/** An R2 bucket that answers from a path→content map. */
function r2(objects: Record<string, string>, opts: { etag?: string } = {}) {
  return {
    get: async (key: string) => {
      const content = objects[key];
      if (content === undefined) return null;
      return {
        key,
        body: content,
        httpEtag: opts.etag ?? `"etag-${key.length}"`,
        httpMetadata: {},
      };
    },
  };
}

const SITE = 'https://justgoblin.com';

function env(extra: Record<string, unknown> = {}) {
  return {
    ROUTES: kv({}),
    APPS: r2({}),
    APPS_DOMAIN: 'justgoblin.app',
    SITE_URL: SITE,
    ...extra,
  };
}

function req(url: string, init: RequestInit = {}) {
  return new Request(url, init);
}

/** The standard "one live app" fixture: route `meinladen` → app `app-1` with an index. */
function liveApp(files: Record<string, string> = { 'apps/app-1/index.html': '<h1>Hallo</h1>' }) {
  return env({
    ROUTES: kv({ 'route:meinladen': { name: 'meinladen', appId: 'app-1', status: 'active' } }),
    APPS: r2(files),
  });
}

// ── The generated constant is the file ──────────────────────────────────────

describe('deployed-source integrity', () => {
  it('ROUTER_WORKER_SOURCE is byte-identical to worker.js', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const onDisk = readFileSync(join(here, 'worker.js'), 'utf8');
    // If this fails, worker.js was edited without running `pnpm ops:gen-router`.
    // The tests below would then be proving the behaviour of stale bytes.
    expect(ROUTER_WORKER_SOURCE).toBe(onDisk);
  });

  it('deploys under one fixed script name (the lean plane has exactly one Worker)', () => {
    expect(ROUTER_SCRIPT_NAME).toBe('goblin-apps-router');
  });
});

// ── Host resolution ─────────────────────────────────────────────────────────

describe('host resolution', () => {
  it('redirects the apex to the marketing site (302, not a cacheable 301)', async () => {
    const res = await worker.fetch(req('https://justgoblin.app/'), env());
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${SITE}/`);
  });

  it('redirects www the same way', async () => {
    const res = await worker.fetch(req('https://www.justgoblin.app/'), env());
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${SITE}/`);
  });

  it('404s a host that is not under the apps domain at all', async () => {
    const res = await worker.fetch(req('https://demo.example.com/'), liveApp());
    expect(res.status).toBe(404);
  });

  it('404s a multi-level label instead of resolving it by string coincidence', async () => {
    // `evil.meinladen.justgoblin.app` must NOT resolve to the app named `meinladen`.
    const res = await worker.fetch(req('https://evil.meinladen.justgoblin.app/'), liveApp());
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('Hier wohnt keine App');
  });
});

// ── Reserved names ──────────────────────────────────────────────────────────

describe('reserved names', () => {
  const RESERVED_SAMPLE = ['www', 'api', 'app', 'admin', 'status', 'mail', 'help', 'docs', 'goblin', 'abuse', 'support'];

  for (const name of RESERVED_SAMPLE) {
    it(`never resolves "${name}" to a user app, even when KV says it should`, async () => {
      // The record exists and is active — the reserved check must win anyway,
      // because a name may have been written by an older path or by hand.
      const e = env({
        ROUTES: kv({ [`route:${name}`]: { name, appId: 'app-x', status: 'active' } }),
        APPS: r2({ 'apps/app-x/index.html': '<h1>should never be served</h1>' }),
      });
      const host = name === 'www' ? 'www.justgoblin.app' : `${name}.justgoblin.app`;
      const res = await worker.fetch(req(`https://${host}/`), e);
      // www is the apex redirect; every other reserved label is an honest 404.
      if (name === 'www') {
        expect(res.status).toBe(302);
      } else {
        expect(res.status).toBe(404);
        expect(await res.text()).not.toContain('should never be served');
      }
    });
  }
});

// ── Route statuses ──────────────────────────────────────────────────────────

describe('route status handling', () => {
  it('serves an active app from R2', async () => {
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/'), liveApp());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<h1>Hallo</h1>');
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
  });

  it('404s an unknown app with an honest page (no guessing)', async () => {
    const res = await worker.fetch(req('https://nichtda.justgoblin.app/'), liveApp());
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('Hier wohnt keine App');
    expect(html).toContain('raten hier lieber nicht');
  });

  it('serves the suspended page at 403 and links the AUP (§8.3 gap 1)', async () => {
    const e = env({ ROUTES: kv({ 'route:meinladen': { name: 'meinladen', appId: 'app-1', status: 'suspended' } }) });
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/'), e);
    expect(res.status).toBe(403);
    const html = await res.text();
    expect(html).toContain('Diese App wurde vorübergehend gesperrt');
    expect(html).toContain(`${SITE}/acceptable-use`);
    // Reversibility is stated — a suspension is not a deletion.
    expect(html).toContain('umkehrbar');
  });

  it('never serves app content for a suspended app', async () => {
    const e = env({
      ROUTES: kv({ 'route:meinladen': { name: 'meinladen', appId: 'app-1', status: 'suspended' } }),
      APPS: r2({ 'apps/app-1/index.html': 'SECRET-CONTENT' }),
    });
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/index.html'), e);
    expect(await res.text()).not.toContain('SECRET-CONTENT');
  });

  it('serves 410 for a released (renamed-away) address and does NOT redirect', async () => {
    const e = env({ ROUTES: kv({ 'route:alt': { name: 'alt', appId: 'app-1', status: 'released' } }) });
    const res = await worker.fetch(req('https://alt.justgoblin.app/'), e);
    expect(res.status).toBe(410);
    expect(res.headers.get('location')).toBeNull(); // no phantom redirect
    const html = await res.text();
    expect(html).toContain('Diese Adresse gibt es nicht mehr');
    expect(html).toContain('leiten dich absichtlich nicht weiter');
  });

  it('fails closed on an unknown status — 503 UNKNOWN, not a 404 claim', async () => {
    const e = env({ ROUTES: kv({ 'route:meinladen': { name: 'meinladen', appId: 'app-1', status: 'weird' } }) });
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/'), e);
    expect(res.status).toBe(503);
    expect(await res.text()).toContain('können gerade nicht nachsehen');
  });

  it('treats a record without an appId as absent', async () => {
    const e = env({ ROUTES: kv({ 'route:meinladen': { name: 'meinladen', status: 'active' } }) });
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/'), e);
    expect(res.status).toBe(404);
  });
});

// ── Static serving ──────────────────────────────────────────────────────────

describe('static file serving', () => {
  const FILES = {
    'apps/app-1/index.html': '<h1>Start</h1>',
    'apps/app-1/about/index.html': '<h1>Über</h1>',
    'apps/app-1/assets/index-DiwrgTda.js': 'console.log(1)',
    'apps/app-1/style.css': 'body{}',
  };

  it('maps / to index.html', async () => {
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/'), liveApp(FILES));
    expect(await res.text()).toBe('<h1>Start</h1>');
  });

  it('maps a directory path to its index.html', async () => {
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/about/'), liveApp(FILES));
    expect(await res.text()).toBe('<h1>Über</h1>');
  });

  it('derives the content type from the extension', async () => {
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/style.css'), liveApp(FILES));
    expect(res.headers.get('content-type')).toBe('text/css; charset=utf-8');
  });

  it('falls back to index.html for an extensionless (client-routed) path', async () => {
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/dashboard/settings'), liveApp(FILES));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<h1>Start</h1>');
  });

  it('does NOT fall back for a missing asset — a broken build must look broken', async () => {
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/assets/missing.js'), liveApp(FILES));
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await res.text()).toContain('Diese Unterseite gibt es nicht');
  });

  it('caches hashed assets immutably and HTML not at all', async () => {
    const asset = await worker.fetch(req('https://meinladen.justgoblin.app/assets/index-DiwrgTda.js'), liveApp(FILES));
    expect(asset.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    const html = await worker.fetch(req('https://meinladen.justgoblin.app/'), liveApp(FILES));
    expect(html.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
  });

  it('answers 304 when the ETag matches', async () => {
    const e = liveApp(FILES);
    const first = await worker.fetch(req('https://meinladen.justgoblin.app/style.css'), e);
    const etag = first.headers.get('etag')!;
    expect(etag).toBeTruthy();
    const second = await worker.fetch(
      req('https://meinladen.justgoblin.app/style.css', { headers: { 'if-none-match': etag } }),
      e,
    );
    expect(second.status).toBe(304);
    expect(await second.text()).toBe('');
  });

  it('cannot be walked out of its own app prefix', async () => {
    // Two layers, and it matters which one does the work. The URL parser resolves
    // dot segments (encoded or not) BEFORE the Worker sees the path, so `..` never
    // arrives as a segment — measured, not assumed. What is proven here is the
    // property that actually matters: no request shape reaches another app's files.
    const twoApps = env({
      ROUTES: kv({ 'route:meinladen': { name: 'meinladen', appId: 'app-1', status: 'active' } }),
      APPS: r2({ ...FILES, 'apps/app-2/geheim.txt': 'NACHBAR-APP' }),
    });
    for (const path of [
      '/%2e%2e/%2e%2e/app-2/geheim.txt',
      '/../../app-2/geheim.txt',
      '/a/b/../../../app-2/geheim.txt',
      '/%252e%252e/app-2/geheim.txt', // double-encoded: survives the parser
    ]) {
      const res = await worker.fetch(req(`https://meinladen.justgoblin.app${path}`), twoApps);
      expect(await res.text()).not.toContain('NACHBAR-APP');
    }
  });

  it('rejects a path the URL parser does NOT sanitise (the guard`s own job)', async () => {
    // A NUL byte survives URL parsing and would otherwise be composed into an R2
    // key. objectPathFor rejects it — this is the layer the parser does not cover.
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/style%00.css'), liveApp(FILES));
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('Diese Unterseite gibt es nicht');
  });

  it('sets nosniff on served content', async () => {
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/'), liveApp(FILES));
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

// ── Methods, HEAD, misconfiguration ─────────────────────────────────────────

describe('methods and failure modes', () => {
  it('refuses non-GET/HEAD with 405 and an Allow header', async () => {
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/', { method: 'POST' }), liveApp());
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET, HEAD');
  });

  it('answers HEAD with the same status and no body', async () => {
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/', { method: 'HEAD' }), liveApp());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('answers HEAD on a refusal with the refusal status and no body', async () => {
    const res = await worker.fetch(req('https://nichtda.justgoblin.app/', { method: 'HEAD' }), liveApp());
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('');
  });

  it('says UNKNOWN (503), not "no such app", when a binding is missing', async () => {
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/'), env({ ROUTES: undefined }));
    expect(res.status).toBe(503);
    const html = await res.text();
    expect(html).toContain('nicht vollständig eingerichtet');
    expect(html).not.toContain('Hier wohnt keine App');
  });

  it('says UNKNOWN (503) when the KV read throws', async () => {
    const e = env({ ROUTES: { get: async () => { throw new Error('kv down'); } } });
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/'), e);
    expect(res.status).toBe(503);
  });

  it('never leaks an upstream error message onto a page', async () => {
    const e = env({ ROUTES: { get: async () => { throw new Error('SECRET-TOKEN-abc123'); } } });
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/'), e);
    expect(await res.text()).not.toContain('SECRET-TOKEN');
  });

  it('never caches a refusal — a status flip must be visible', async () => {
    const e = env({ ROUTES: kv({ 'route:meinladen': { name: 'meinladen', appId: 'app-1', status: 'suspended' } }) });
    const res = await worker.fetch(req('https://meinladen.justgoblin.app/'), e);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

// ── Language ────────────────────────────────────────────────────────────────

describe('DE/EN pages', () => {
  const KINDS: Array<{ label: string; e: Record<string, unknown>; url: string; de: string; en: string }> = [
    {
      label: '404 unknown app',
      e: env(),
      url: 'https://nichtda.justgoblin.app/',
      de: 'Hier wohnt keine App.',
      en: 'No app lives here.',
    },
    {
      label: 'suspended',
      e: env({ ROUTES: kv({ 'route:meinladen': { name: 'meinladen', appId: 'app-1', status: 'suspended' } }) }),
      url: 'https://meinladen.justgoblin.app/',
      de: 'Diese App wurde vorübergehend gesperrt.',
      en: 'This app has been temporarily suspended.',
    },
    {
      label: '410 released',
      e: env({ ROUTES: kv({ 'route:alt': { name: 'alt', appId: 'app-1', status: 'released' } }) }),
      url: 'https://alt.justgoblin.app/',
      de: 'Diese Adresse gibt es nicht mehr.',
      en: 'This address is gone.',
    },
    {
      label: '404 unknown path',
      e: liveApp(),
      url: 'https://meinladen.justgoblin.app/assets/missing.js',
      de: 'Diese Unterseite gibt es nicht.',
      en: 'This page does not exist.',
    },
  ];

  for (const k of KINDS) {
    it(`${k.label}: German by default, and no English leaks into it`, async () => {
      const res = await worker.fetch(req(k.url), k.e);
      const html = await res.text();
      expect(html).toContain(k.de);
      expect(html).not.toContain(k.en);
      expect(html).toContain('<html lang="de"');
    });

    it(`${k.label}: English for an English-first browser, and no German leaks into it`, async () => {
      const res = await worker.fetch(req(k.url, { headers: { 'accept-language': 'en-GB,en;q=0.9' } }), k.e);
      const html = await res.text();
      expect(html).toContain(k.en);
      expect(html).not.toContain(k.de);
      expect(html).toContain('<html lang="en"');
    });

    it(`${k.label}: German wins when the browser prefers German`, async () => {
      const res = await worker.fetch(req(k.url, { headers: { 'accept-language': 'de-CH,de;q=0.9,en;q=0.8' } }), k.e);
      expect(await res.text()).toContain(k.de);
    });

    it(`${k.label}: an unknown language falls back to German, not to a guess`, async () => {
      const res = await worker.fetch(req(k.url, { headers: { 'accept-language': 'xx-YY' } }), k.e);
      expect(await res.text()).toContain(k.de);
    });

    it(`${k.label}: varies on Accept-Language so a cache cannot serve the wrong one`, async () => {
      const res = await worker.fetch(req(k.url), k.e);
      expect(res.headers.get('vary')).toBe('Accept-Language');
    });
  }
});

// ── Design system ───────────────────────────────────────────────────────────

describe('design-system quality', () => {
  it('uses the locked brand tokens, not ad-hoc colours', async () => {
    const res = await worker.fetch(req('https://nichtda.justgoblin.app/'), env());
    const html = await res.text();
    // The five values copied from styles/design-tokens.css. Pinned here so that a
    // token change in the web app shows up as a failing test rather than as two
    // Goblins that quietly stopped looking alike.
    expect(html).toContain('#FBF7EC'); // --paper
    expect(html).toContain('#F4ECD8'); // --bone
    expect(html).toContain('#0F2B1E'); // --ink-deep
    expect(html).toContain('#1A3A2A'); // --brand-green
    expect(html).toContain('#D4A737'); // --brand-gold
  });

  it('is a complete, responsive, self-contained document', async () => {
    const res = await worker.fetch(req('https://nichtda.justgoblin.app/'), env());
    const html = await res.text();
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('name="viewport"');
    expect(html).toContain('Manrope');
    expect(html).toContain('prefers-color-scheme:dark');
    // Self-contained: no external stylesheet, script or font request.
    expect(html).not.toContain('<script');
    expect(html).not.toContain('rel="stylesheet"');
  });

  it('keeps refusal pages out of search results', async () => {
    const res = await worker.fetch(req('https://nichtda.justgoblin.app/'), env());
    expect(await res.text()).toContain('name="robots" content="noindex"');
  });

  it('escapes interpolated values so a page cannot be turned into an injection', async () => {
    const e = env({ SITE_URL: 'https://x.test/"><script>alert(1)</script>' });
    const res = await worker.fetch(
      req('https://meinladen.justgoblin.app/'),
      { ...e, ROUTES: kv({ 'route:meinladen': { name: 'meinladen', appId: 'app-1', status: 'suspended' } }) },
    );
    const html = await res.text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
