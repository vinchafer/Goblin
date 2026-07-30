# U1 — Deployed-API probe: where the Send-Email hook actually lives

Run 2026-07-30T07:47Z from the CI container against the DEPLOYED production API.
No secrets used — existence is provable from status codes alone.

```
METHOD URL                                                              STATUS
GET    https://goblinapi-production.up.railway.app/api/version          200
POST   https://goblinapi-production.up.railway.app/api/auth/email-hook  401
POST   https://goblinapi-production.up.railway.app/api/auth/email-hook/ 404
GET    https://goblinapi-production.up.railway.app/api/auth/email-hook  404
POST   https://goblinapi-production.up.railway.app/auth/email-hook      404
GET    https://goblinapi-production.up.railway.app/api/health           200
POST   https://www.justgoblin.com/api/auth/email-hook                   404
POST   https://justgoblin.com/api/auth/email-hook                       307
GET    https://www.justgoblin.com/api/health                            404
```

`/api/version` at the time of the probe:

```json
{"version":"0.2.0","gitCommit":"bf7d78487923747138bc854459191d7e78e8bd03",
 "buildTime":"2026-07-30T07:23:11.076Z","env":"production","apiReady":true}
```

## Reading the codes

- **401 = healthy.** `POST …/api/auth/email-hook` returns 401 `{"error":{"http_code":401,
  "message":"missing signature headers"}}`. The route is mounted and reachable, and it
  rejected an unsigned request exactly as designed
  (`apps/api/src/routes/auth-email-hook.ts:139`).
- **401 also proves the secret is set.** The handler checks
  `SUPABASE_AUTH_HOOK_SECRET` *first* and answers **500** when it is missing
  (`auth-email-hook.ts:126-133`). We got 401, not 500 — so the founder's env var
  landed on the Railway host.
- **404 = nothing at that path.** Hono answers 404 for an unknown path *and* for a
  known path called with the wrong method — `GET /api/auth/email-hook` → 404 and
  `POST /api/health` → 404 both demonstrate this. Supabase always POSTs, so a 404
  from Supabase means the *path* was wrong, not the method.
- **Trailing slash is fatal.** `…/api/auth/email-hook/` → 404. Hono does not treat
  `/x` and `/x/` as the same route.

## Root cause

Not (a) doc≠code, not (b) unmounted, not (c) missing from the build. The route is
registered at `apps/api/src/index.ts:270`
(`app.route('/api/auth/email-hook', authEmailHook)`, before the broader
`/api/auth` mount on line 271), it is exempted from the rate limiter at
`index.ts:184`, and the deployed build answers it.

**(d) The URL configured in the Supabase dashboard is not the Railway API
origin.** Every natural wrong choice reproduces the founder's
`Unexpected status code returned from hook: 404`:

| What might have been pasted | Result | Why |
|---|---|---|
| `https://www.justgoblin.com/api/auth/email-hook` | **404** | the web origin — see the rewrite finding below |
| `https://justgoblin.com/api/auth/email-hook` | 307 → www | apex redirects; hook clients do not follow redirects |
| `https://api.justgoblin.com/api/auth/email-hook` | no such host | no A record |
| `…up.railway.app/api/auth/email-hook/` | **404** | trailing slash |

The `www.justgoblin.com` variant is the likeliest of the four: the founder had
just set `NEXT_PUBLIC_APP_URL=https://www.justgoblin.com`, and that is the origin
in front of mind.

## The one literal URL to paste into Supabase

```
https://goblinapi-production.up.railway.app/api/auth/email-hook
```

No trailing slash. Verified above: returns 401, which is the correct shape for a
request without a valid signature.

## Secondary finding — the web origin's `/api/*` rewrite is broken in production

`apps/web/next.config.ts:81-88` declares a rewrite of `/api/:path*` to the Railway
API, and `apps/api/src/index.ts:229-236` relies on it (the F-35 comment says
`/api/health` is "reachable on the PRIMARY domain"). It is not:

```
GET https://goblinapi-production.up.railway.app/api/health  -> 200
GET https://www.justgoblin.com/api/health                   -> 404
```

The 404 is **Hono's**, not Vercel's: the body is the plain text `404 Not Found` and
the response carries an `x-request-id`, which is minted by the API's own middleware
(`index.ts:194-196`). So the request does reach Railway — at a path Hono does not
have. Both malformed values of `NEXT_PUBLIC_API_URL` on Vercel produce exactly this,
and both are confirmed 404 against the live API:

```
GET https://goblinapi-production.up.railway.app//api/health     -> 404   (trailing slash in the env var)
GET https://goblinapi-production.up.railway.app/api/api/health  -> 404   (trailing /api in the env var)
```

Why this stayed invisible: `apps/web/lib/api.ts:13` normalises the same variable
(`url.replace(/\/$/, '')`) before the browser uses it, so every user-facing API call
kept working while the rewrite did not. `next.config.ts` did no such normalisation —
fixed in this unit. The Vercel env value itself cannot be read from the repo, so
whether it is the trailing slash or the trailing `/api` is **UNVERIFIED**; the
normalisation closes the first and the founder-action list covers the second.
