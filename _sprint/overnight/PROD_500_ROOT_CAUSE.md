# Production-wide 500 — root cause, reproduction, fix

Incident window: seen by the founder 2026-07-30, deployment
`dpl_3YMRPM8gXyazxrtqizkQmWrhqMEQ`, branch `master` (`bf7d784`).
Diagnosed and fixed in the overnight session of the same day.

---

## 1. The one-line answer

`NEXT_PUBLIC_API_URL` on Vercel had been set to the **Supabase mail-hook URL,
with a trailing newline**. That newline was interpolated into the
`Content-Security-Policy` header that `next.config.ts` emits for every route.
Node refuses to write a header value containing a control character
(`ERR_INVALID_CHAR`), so every server-rendered response died at the moment it
tried to send its headers — before any I/O, which is why the founder saw
`FUNCTION_INVOCATION_FAILED` at 5 ms with "No outgoing requests".

**File:line of the kill:** `apps/web/next.config.ts:8` reads the raw value;
`apps/web/next.config.ts:28` interpolates it into `connect-src`;
`apps/web/next.config.ts:78-88` attaches that header to `/((?!demo-).*)`, i.e.
every route.

Statically prerendered pages (`○`) are served from the Vercel CDN, where the
edge percent-encodes the newline to `%0A` instead of refusing it. Dynamic routes
(`ƒ`) are rendered by the Node lambda, which refuses. That is the exact split
the founder observed: marketing pages fine, signed-in app and every API route
dead.

## 2. Evidence — from production, before any change

Two independent artefacts, both fetched live from `www.justgoblin.com`.

**(a) The value, inlined in the deployed client bundle**
(`/_next/static/chunks/0e6cc6jh3p5g2.js`) — this is `API_URL` from `lib/api.ts`:

```js
let r = "https://goblinapi-production.up.railway.app/api/auth/email-hook\n";
try { let e = await fetch(`${r}/api/auth/lockout-check?email=…`)
```

**(b) The same value in the deployed CSP header**, newline percent-encoded by
Vercel's edge:

```
content-security-policy: … connect-src 'self' https://ogrkollxnoawfdkzdmtn.supabase.co
  wss://ogrkollxnoawfdkzdmtn.supabase.co
  https://goblinapi-production.up.railway.app/api/auth/email-hook%0A
  https://api.anthropic.com …
```

**Supporting observations, all live:**

| Probe | Result | What it shows |
|---|---|---|
| `GET /api/version` | 500, `x-matched-path: /500` | dynamic route dead |
| `GET /status` | 500, `x-matched-path: /500` | dynamic *page* dead too — not an API-only fault |
| `GET /` , `/pricing`, `/login` | 200, `x-nextjs-prerender: 1` | static routes unaffected |
| `GET /sitemap.xml`, `/robots.txt`, `/manifest.json` | 200 | build-time output unaffected |
| `GET /dashboard` (signed out) | 307 → `/login` | middleware (edge runtime) unaffected |
| `GET /api/health` | 404 **with `x-railway-*` headers** | the rewrite reaches Railway at `…/email-hook\n/api/health` |
| `GET https://goblinapi-production.up.railway.app/api/health` | 200 | the API itself was never down |

## 3. Reproduction — the crash, locally, before the fix

Built this checkout at `bf7d784` with that exact value and started it:

```
NEXT_PUBLIC_API_URL="https://goblinapi-production.up.railway.app/api/auth/email-hook\n"
```

```
  /api/version 500
  /status      500
  /pricing     500
  /login       500

TypeError: Invalid character in header content ["Content-Security-Policy"]
    at ignore-listed frames { code: 'ERR_INVALID_CHAR' }
```

(Locally *every* route fails, static included, because `next start` writes the
header from Node for static files too. On Vercel the CDN serves those, which is
the only reason the marketing site stayed up.)

### Hypotheses eliminated along the way

- **A module-scope env read that throws.** `apps/web/lib/api.ts:3` did call
  `createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, …)` at module
  scope, and `@supabase/ssr` throws there when either argument is falsy — a real
  latent fault, hardened below. But it is not this outage: `/api/version`'s
  lambda does not import `lib/api.ts` (checked against the build's
  `route.js.nft.json` and its two eagerly-loaded root chunks), and it 500'd all
  the same.
- **A missing Supabase variable at build time.** Building with those unset does
  not produce a broken deployment — it produces **no** deployment: the build
  fails during static export (`Export encountered an error on /demo-code/page`).
- **A runtime env change breaking an existing build.** Ruled out by experiment:
  unsetting each of the four `NEXT_PUBLIC_*` variables at runtime against a
  good build changed nothing (200/200/200 each time). `NEXT_PUBLIC_*` values are
  substituted into the bundle at build time; the runtime environment is not
  consulted. The bad value therefore entered at **build** time — the founder's
  edit triggered a redeploy that baked it in.

## 4. The fix

New module **`apps/web/lib/env/origin.ts`** — one place that turns a raw env
string into a usable origin. It never throws (a throw at module scope takes the
runtime with it), and it never returns something that could poison a header:

- trims whitespace and stray quotes — the artefacts a dashboard paste collects;
- rejects control characters, unparseable values and non-http(s) protocols;
- rejects a value carrying a path, query or fragment, because this variable is
  documented as a bare origin — with the one documented exception of a trailing
  `/api`, which is stripped;
- on any rejection, returns a known-good fallback plus a machine-readable
  `problem`, so the failure is *reported* rather than *silent*.

Applied at all three sites the bad value reached:

| Site | Before | After |
|---|---|---|
| `next.config.ts` CSP `connect-src` | raw interpolation | normalised, then `headerSafe()` as a last-resort strip |
| `next.config.ts` `rewrites()` destination | raw interpolation | same normalised origin |
| `lib/api.ts` `API_URL` | `url.replace(/\/$/, '')` only | same normaliser, shared |

`next.config.ts`'s `new URL(NEXT_PUBLIC_SUPABASE_URL)` was also unguarded and
would have thrown the build away on a malformed value; it goes through the same
normaliser now.

`lib/api.ts`'s module-scope `createBrowserClient` is now lazy — a missing
Supabase variable can no longer take down every module that imports the file.

`app/api/version/route.ts` is now assembled inside a `try/catch` and answers 200
even when it cannot describe itself, plus a `config` block listing which required
variables are present or absent **by name only, never by value**, and a plain
sentence for each problem found.

## 5. Proof the fix holds

Same checkout, same poisoned value, same build pipeline:

```
  /api/version 200
  /status      200
  /pricing     200
  /login       200
ERR_INVALID_CHAR occurrences in the server log: 0
```

`/api/version` under the poisoned value:

```json
{ "apiUrl": "https://goblinapi-production.up.railway.app",
  "webReady": true,
  "config": { "present": ["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY",
                          "NEXT_PUBLIC_API_URL","NEXT_PUBLIC_APP_URL"],
              "absent": [],
              "problems": ["NEXT_PUBLIC_API_URL carries a path, query or fragment; it must be a bare origin such as https://host.example — falling back to the built-in default."],
              "healthy": false } }
```

The app is up, it is using the correct API origin, and it says out loud that the
configured value was refused and why.

**No behaviour change when the configuration is correct.** Rebuilt with a valid
`NEXT_PUBLIC_API_URL` and diffed the emitted CSP header against the pre-fix
build's: **byte-identical**, and `/api/version` reports `"healthy": true`.

`normalizeOrigin`, `describeOriginProblem` and `headerSafe` carry 11 unit tests
(`lib/env/origin.test.ts`), including the exact production value as a pinned
regression case and a property check that no input — including a
`\r\nX-Injected: 1` header-injection attempt — can produce an origin containing a
control character.

## 6. What this means for the founder's Vercel settings

The fix restores production **on its own**: the bad value is refused and the
correct Railway origin is used instead. The paste below is therefore *hygiene*,
not a prerequisite — but until it is done, `/api/version` will keep reporting
`healthy: false`, which is the honest state.

| Variable | Platform | Correct value |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Vercel | `https://goblinapi-production.up.railway.app` |

No trailing slash, no trailing `/api`, no trailing newline. The mail-hook URL
(`…/api/auth/email-hook`) belongs in the **Supabase dashboard**, not here.
