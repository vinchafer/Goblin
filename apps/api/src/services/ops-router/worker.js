/**
 * AKT 2 · PHASE 2 · U2.1 — THE ROUTER WORKER (the one thing that serves user apps).
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * THIS FILE IS THE DEPLOYED ARTIFACT. It runs on Cloudflare, not in Node. It is
 * plain ESM with no imports, because it is uploaded verbatim as a single module.
 *
 * It is ALSO the single source of truth: `worker-source.generated.ts` carries a
 * byte-identical copy as a string constant (that is what the deploy path ships,
 * because a bundled API cannot read a loose .js file off disk), and a test asserts
 * the two never drift. Change this file, then run `pnpm ops:gen-router`.
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * ── What it does ──────────────────────────────────────────────────────────────
 * ONE Worker serves the whole fleet on the lean plane (Workers FREE, no Workers
 * for Platforms, no per-app Workers):
 *
 *   {name}.justgoblin.app/{path}
 *     → reserved name?            → honest 404 page (never resolves to a user app)
 *     → KV `route:{name}`
 *         → absent                → honest 404 page
 *         → status 'suspended'    → honest suspended page (403) + link to the AUP
 *         → status 'released'     → honest 410 page (a renamed app's old address;
 *                                   NEVER a redirect — a phantom redirect would
 *                                   send a visitor to content the old owner of the
 *                                   link never pointed at)
 *         → status 'active'       → stream the file from R2 `apps/{appId}/…`
 *   justgoblin.app / www.justgoblin.app → 302 to the marketing site
 *
 * ── Why the status lives in KV and not only in Postgres ───────────────────────
 * The router must be able to refuse a suspended app WITHOUT a database round-trip
 * from the edge — and, more importantly, the emergency stop has to work when the
 * API is down. KV is the router's only source of truth; the API writes it. This is
 * the closure of ABUSE_RESPONSE §8.3 gap 1 ("der Router respektiert `suspended`
 * noch nicht").
 *
 * ── Honesty rules this file obeys ─────────────────────────────────────────────
 * • Every refusal is a designed, bilingual page — never a raw stack trace, never a
 *   bare framework error, never a white screen.
 * • The pages state what is true and nothing more. The 404 page does not guess
 *   that the visitor mistyped; the suspended page does not say "wird geprüft" when
 *   nobody may be looking yet.
 * • A misconfigured Worker (missing binding) says so as UNKNOWN (503) rather than
 *   pretending the app does not exist — an operator must be able to tell those
 *   apart.
 * • No user content is logged here. The Worker sees every visitor of every app; it
 *   deliberately keeps no record of them.
 */

/**
 * Labels that never resolve to a user app, whatever KV says. The check runs BEFORE
 * the KV lookup so a name that slipped past an older publish path (or was written
 * by hand) still cannot take over an operational hostname.
 *
 * Kept deliberately wider than "what we use today": mail/smtp/imap protect future
 * mail delivery, and the abuse/security/legal set must stay ours for the reporting
 * paths the AUP publishes.
 */
const RESERVED = new Set([
  'www', 'api', 'app', 'apps', 'admin', 'administrator', 'status', 'mail', 'smtp',
  'imap', 'pop', 'webmail', 'help', 'support', 'docs', 'doc', 'blog', 'goblin',
  'abuse', 'security', 'legal', 'privacy', 'terms', 'billing', 'pay', 'payments',
  'account', 'accounts', 'auth', 'login', 'signup', 'dashboard', 'console',
  'static', 'assets', 'cdn', 'files', 'download', 'downloads', 'test', 'staging',
  'dev', 'preview', 'demo', 'internal', 'ops', 'router', 'ns', 'ns1', 'ns2',
  'mx', 'dns', 'root', 'system', 'info', 'contact', 'news', 'shop', 'store',
]);

/** Content types by extension. Mirrors the adapter's table (cf-deploy.ts). */
const CONTENT_TYPES = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  pdf: 'application/pdf',
  xml: 'application/xml; charset=utf-8',
  webmanifest: 'application/manifest+json',
  map: 'application/json; charset=utf-8',
};

function contentTypeFor(path) {
  const i = path.lastIndexOf('.');
  const ext = i >= 0 ? path.slice(i + 1).toLowerCase() : '';
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

/**
 * A build-hashed filename — safe to cache forever because a content change changes
 * the name. Covers the two conventions Goblin's builds produce: Vite/Rollup
 * (`index-DiwrgTda.js`) and webpack/esbuild (`app.4f3a9c21.css`).
 */
function isImmutableAsset(path) {
  return /[.-][A-Za-z0-9_-]{8,}\.(js|mjs|css|woff2?|png|jpe?g|gif|webp|avif|svg)$/.test(path);
}

// ── Language ────────────────────────────────────────────────────────────────

/**
 * DE is the product's default and its fallback. English is served only when the
 * visitor's FIRST preference is English — a browser that lists de before en gets
 * German, and an absent/garbled header gets German rather than a guess.
 */
function pickLang(request) {
  const header = request.headers.get('accept-language') || '';
  const first = header.split(',')[0].trim().toLowerCase();
  return first.startsWith('en') ? 'en' : 'de';
}

// ── The pages ───────────────────────────────────────────────────────────────

/**
 * Design-system values, inlined.
 *
 * These pages are served by Cloudflare, not by Next.js, so they cannot import
 * `styles/design-tokens.css`. The five values below are copied from it and are the
 * only ones used — bone/paper/ink-deep/brand-green/brand-gold. A token change in
 * the web app must be mirrored here; the page test pins them so the copy is
 * visible rather than forgotten.
 */
const T = {
  paper: '#FBF7EC',
  bone: '#F4ECD8',
  ink: '#0F2B1E',
  green: '#1A3A2A',
  gold: '#D4A737',
  muted: '#5E8973',
  line: 'rgba(15,43,30,.12)',
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * One designed page, in one language. Every refusal in this Worker renders through
 * here, so they are consistent by construction rather than by discipline.
 */
function page({ lang, title, headline, body, hint, link }) {
  const linkHtml = link
    ? `<a class="lnk" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`
    : '';
  const hintHtml = hint ? `<p class="hint">${escapeHtml(hint)}</p>` : '';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{
    min-height:100vh;display:flex;align-items:center;justify-content:center;
    padding:24px;
    background:${T.bone};
    color:${T.ink};
    font-family:'Manrope',system-ui,-apple-system,'Segoe UI',sans-serif;
    line-height:1.6;
    -webkit-font-smoothing:antialiased;
  }
  .card{
    width:100%;max-width:34rem;background:${T.paper};
    border:1px solid ${T.line};border-radius:14px;
    padding:40px 32px;
    box-shadow:0 1px 0 rgba(15,43,30,.03),0 14px 32px -22px rgba(15,43,30,.20);
  }
  .mark{
    display:inline-block;width:34px;height:34px;border-radius:9px;
    background:${T.green};position:relative;margin-bottom:24px;
  }
  .mark::after{
    content:"";position:absolute;left:9px;top:9px;width:16px;height:16px;
    border-radius:4px;background:${T.gold};
  }
  h1{margin:0 0 12px;font-size:1.5rem;line-height:1.3;font-weight:600;color:${T.green}}
  p{margin:0 0 14px;font-size:1rem;color:${T.ink}}
  .hint{font-size:.875rem;color:${T.muted}}
  .lnk{
    display:inline-block;margin-top:10px;font-size:.9375rem;font-weight:600;
    color:${T.green};text-decoration:underline;text-underline-offset:3px;
  }
  .lnk:hover{color:${T.gold}}
  .foot{
    margin-top:28px;padding-top:18px;border-top:1px solid ${T.line};
    font-size:.8125rem;color:${T.muted};
  }
  .foot a{color:${T.muted};text-decoration:underline;text-underline-offset:2px}
  @media (prefers-color-scheme:dark){
    body{background:${T.ink};color:${T.paper}}
    .card{background:#133224;border-color:rgba(247,247,236,.12);
          box-shadow:0 1px 0 rgba(0,0,0,.30),0 14px 32px -22px rgba(0,0,0,.55)}
    h1{color:${T.paper}}
    p{color:#D9E5DE}
    .hint,.foot,.foot a{color:#87A998}
    .lnk{color:${T.gold}}
  }
</style>
</head>
<body>
  <main class="card">
    <span class="mark" aria-hidden="true"></span>
    <h1>${escapeHtml(headline)}</h1>
    ${body.map((t) => `<p>${escapeHtml(t)}</p>`).join('\n    ')}
    ${hintHtml}
    ${linkHtml}
    <p class="foot">${lang === 'de' ? 'Gehostet von' : 'Hosted by'} <a href="https://justgoblin.com">Goblin</a></p>
  </main>
</body>
</html>`;
}

/**
 * The copy for every refusal, both languages, in one place so DE and EN cannot
 * drift apart. `siteUrl` is threaded in so the AUP link points at the real site
 * rather than a hardcoded guess.
 */
function copy(kind, lang, siteUrl) {
  const aup = `${siteUrl}/acceptable-use`;
  const de = {
    unknown_app: {
      title: 'Keine App unter dieser Adresse · Goblin',
      headline: 'Hier wohnt keine App.',
      body: [
        'Unter dieser Adresse ist bei Goblin nichts veröffentlicht.',
        'Vielleicht ist die Adresse falsch geschrieben, vielleicht wurde die App nie veröffentlicht.',
      ],
      hint: 'Wir wissen nicht, wonach du gesucht hast — und raten hier lieber nicht.',
      link: { href: 'https://justgoblin.com', label: 'Zu Goblin' },
    },
    unknown_path: {
      title: 'Seite nicht gefunden · Goblin',
      headline: 'Diese Unterseite gibt es nicht.',
      body: [
        'Die App gibt es — diese Seite darin nicht.',
        'Wenn du hierher verlinkt wurdest, ist der Link vermutlich veraltet.',
      ],
      hint: null,
      link: { href: '/', label: 'Zur Startseite der App' },
    },
    suspended: {
      title: 'App gesperrt · Goblin',
      headline: 'Diese App wurde vorübergehend gesperrt.',
      body: [
        'Goblin hat diese App gesperrt. Sie ist im Moment nicht erreichbar.',
        'Das ist umkehrbar: Wenn die Sperre ausgeräumt ist, ist die App wieder da.',
      ],
      hint: 'Wenn dir die App gehört: Du bekommst eine Nachricht mit dem Grund und dem Weg zum Widerspruch.',
      link: { href: aup, label: 'Nutzungsrichtlinie lesen' },
    },
    gone: {
      title: 'Adresse nicht mehr vergeben · Goblin',
      headline: 'Diese Adresse gibt es nicht mehr.',
      body: [
        'Die App, die hier lag, wurde umbenannt oder entfernt.',
        'Wir leiten dich absichtlich nicht weiter: Wir wissen nicht, ob die neue App noch das ist, worauf dein Link zeigen sollte.',
      ],
      hint: 'Frag die Person, die dir den Link geschickt hat, nach der neuen Adresse.',
      link: { href: 'https://justgoblin.com', label: 'Zu Goblin' },
    },
    over_budget: {
      title: 'Tageslimit erreicht · Goblin',
      headline: 'Diese App hat ihr Tageslimit erreicht.',
      body: [
        'Die App wurde heute so oft aufgerufen, dass sie ihr Tageskontingent aufgebraucht hat.',
        'Morgen ist sie wieder erreichbar — das Limit wird täglich zurückgesetzt.',
      ],
      hint: 'Goblin hostet in der Beta auf einem kostenlosen Kontingent. Das Limit ist echt, keine Verkaufsmasche.',
      link: { href: 'https://justgoblin.com', label: 'Zu Goblin' },
    },
    bad_method: {
      title: 'Nicht möglich · Goblin',
      headline: 'Das geht hier nicht.',
      body: ['Von Goblin gehostete Apps liefern nur Seiten aus. Sie nehmen nichts entgegen.'],
      hint: null,
      link: null,
    },
    misconfigured: {
      title: 'Vorübergehend nicht erreichbar · Goblin',
      headline: 'Wir können gerade nicht nachsehen.',
      body: [
        'Der Router ist nicht vollständig eingerichtet, deshalb können wir nicht sagen, ob es diese App gibt.',
        'Das ist unser Fehler, nicht deiner.',
      ],
      hint: 'Wir sagen bewusst nicht „gibt es nicht" — wir wissen es in diesem Moment schlicht nicht.',
      link: null,
    },
  };
  const en = {
    unknown_app: {
      title: 'No app at this address · Goblin',
      headline: 'No app lives here.',
      body: [
        'Nothing is published at this address on Goblin.',
        'The address may be misspelled, or the app may never have been published.',
      ],
      hint: 'We do not know what you were looking for — and we would rather not guess.',
      link: { href: 'https://justgoblin.com', label: 'Go to Goblin' },
    },
    unknown_path: {
      title: 'Page not found · Goblin',
      headline: 'This page does not exist.',
      body: [
        'The app exists — this page inside it does not.',
        'If you followed a link here, it is probably out of date.',
      ],
      hint: null,
      link: { href: '/', label: 'Go to the app’s start page' },
    },
    suspended: {
      title: 'App suspended · Goblin',
      headline: 'This app has been temporarily suspended.',
      body: [
        'Goblin has suspended this app. It cannot be reached right now.',
        'This is reversible: once the issue is resolved, the app comes back.',
      ],
      hint: 'If this is your app: you will get a message with the reason and how to appeal.',
      link: { href: aup, label: 'Read the Acceptable-Use Policy' },
    },
    gone: {
      title: 'Address no longer in use · Goblin',
      headline: 'This address is gone.',
      body: [
        'The app that lived here was renamed or removed.',
        'We deliberately do not redirect you: we cannot know whether the new app is still what your link was meant to point at.',
      ],
      hint: 'Ask whoever sent you the link for the new address.',
      link: { href: 'https://justgoblin.com', label: 'Go to Goblin' },
    },
    over_budget: {
      title: 'Daily limit reached · Goblin',
      headline: 'This app has reached its daily limit.',
      body: [
        'The app was requested often enough today to use up its daily allowance.',
        'It will be reachable again tomorrow — the limit resets daily.',
      ],
      hint: 'Goblin hosts on a free allowance during the beta. The limit is real, not a sales tactic.',
      link: { href: 'https://justgoblin.com', label: 'Go to Goblin' },
    },
    bad_method: {
      title: 'Not possible · Goblin',
      headline: 'That does not work here.',
      body: ['Goblin-hosted apps only serve pages. They do not accept submissions.'],
      hint: null,
      link: null,
    },
    misconfigured: {
      title: 'Temporarily unavailable · Goblin',
      headline: 'We cannot look this up right now.',
      body: [
        'The router is not fully configured, so we cannot tell you whether this app exists.',
        'That is our fault, not yours.',
      ],
      hint: 'We deliberately do not say “does not exist” — right now we simply do not know.',
      link: null,
    },
  };
  return (lang === 'en' ? en : de)[kind];
}

/** Render a refusal as a full Response. Never cached — a status flip must be seen. */
function refuse(request, siteUrl, kind, status, extraHeaders) {
  const lang = pickLang(request);
  const html = page({ lang, ...copy(kind, lang, siteUrl) });
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    vary: 'Accept-Language',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    ...(extraHeaders || {}),
  };
  // HEAD must not carry a body, but must carry the same status and headers.
  return new Response(request.method === 'HEAD' ? null : html, { status, headers });
}

// ── R2 serving ──────────────────────────────────────────────────────────────

/**
 * Turn a request path into the app-relative object path.
 * `/` → `index.html` · `/about/` → `about/index.html` · `/a/b.css` → `a/b.css`.
 * Returns null for anything that tries to escape the app prefix.
 */
function objectPathFor(pathname) {
  let p = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (p === '' || p.endsWith('/')) p += 'index.html';
  if (p.includes('\\') || p.includes('\0')) return null;
  const segments = p.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..')) return null;
  if (p.length > 1024) return null;
  return p;
}

function cacheControlFor(path) {
  if (isImmutableAsset(path)) return 'public, max-age=31536000, immutable';
  if (/\.html?$/.test(path)) return 'public, max-age=0, must-revalidate';
  return 'public, max-age=3600';
}

export default {
  async fetch(request, env) {
    const siteUrl = (env.SITE_URL || 'https://justgoblin.com').replace(/\/$/, '');
    const appsDomain = (env.APPS_DOMAIN || 'justgoblin.app').toLowerCase();

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return refuse(request, siteUrl, 'bad_method', 405, { allow: 'GET, HEAD' });
    }

    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();

    // Root and www → the marketing site. 302, not 301: a permanent redirect is
    // cached by browsers forever and we do not want to be unable to take it back.
    if (host === appsDomain || host === `www.${appsDomain}`) {
      return Response.redirect(siteUrl, 302);
    }

    if (!host.endsWith(`.${appsDomain}`)) {
      return refuse(request, siteUrl, 'unknown_app', 404);
    }

    const label = host.slice(0, host.length - appsDomain.length - 1);
    // Multi-level labels (`a.b.justgoblin.app`) are not apps. They are never issued
    // and must not be resolvable by string coincidence.
    if (label === '' || label.includes('.') || RESERVED.has(label)) {
      return refuse(request, siteUrl, 'unknown_app', 404);
    }

    if (!env.ROUTES || !env.APPS) {
      return refuse(request, siteUrl, 'misconfigured', 503);
    }

    let record = null;
    try {
      // cacheTtl 60 is KV's floor. It means a status flip can take up to a minute
      // to be seen in a given colo — stated honestly in the runbook rather than
      // pretended away. It is not a correctness problem for suspension (the app
      // stops within the minute) and it is what keeps the read off the origin.
      record = await env.ROUTES.get(`route:${label}`, { type: 'json', cacheTtl: 60 });
    } catch {
      return refuse(request, siteUrl, 'misconfigured', 503);
    }

    if (!record || typeof record.appId !== 'string' || record.appId === '') {
      return refuse(request, siteUrl, 'unknown_app', 404);
    }
    if (record.status === 'suspended') {
      return refuse(request, siteUrl, 'suspended', 403);
    }
    if (record.status === 'released') {
      return refuse(request, siteUrl, 'gone', 410);
    }
    if (record.status !== 'active') {
      // An unknown status is not an invitation to serve. Fail closed, and say we
      // do not know rather than claiming the app is gone.
      return refuse(request, siteUrl, 'misconfigured', 503);
    }

    const path = objectPathFor(url.pathname);
    if (path === null) return refuse(request, siteUrl, 'unknown_path', 404);

    const prefix = `apps/${record.appId}/`;
    let object = null;
    try {
      object = await env.APPS.get(`${prefix}${path}`);
      // SPA fallback: a path with no file extension is a client-side route, so the
      // app's entry document answers it. A missing *asset* (.js/.css/.png) must
      // stay a 404 — serving HTML in its place is how a broken build looks fine
      // and behaves insanely.
      if (object === null && !path.includes('.')) {
        object = await env.APPS.get(`${prefix}index.html`);
      }
    } catch {
      return refuse(request, siteUrl, 'misconfigured', 503);
    }

    if (object === null) return refuse(request, siteUrl, 'unknown_path', 404);

    const servedPath = object.key.slice(prefix.length);
    const etag = object.httpEtag;
    const headers = {
      'content-type': object.httpMetadata?.contentType || contentTypeFor(servedPath),
      'cache-control': cacheControlFor(servedPath),
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      ...(etag ? { etag } : {}),
    };

    if (etag && request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers });
    }

    return new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
  },
};
