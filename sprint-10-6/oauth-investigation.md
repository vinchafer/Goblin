# Sprint 10.6-1 — GitHub OAuth Investigation

Date: 2026-06-03

## Symptom (Vincent's setup-walk)
- Callback URL corrected on github.com (Connect app now points at Railway).
- Authorize flow succeeds (no redirect_uri error).
- User clicks "Authorize" → lands on Goblin **login page** (not where they came from).
- After re-login: Settings → Integrations → GitHub still shows "Connect GitHub", NOT "Connected as <username>".

## Code trace

### OAuth flow (already Strategy-A by design)
- `POST /api/github/connect` (`apps/api/src/routes/github.ts:54`) — authed. Creates a
  row in `oauth_states` `{ state, user_id, return_to? }`. `expires_at` defaults to
  `now() + 10 min` (migration `0007_oauth_states.sql`). Returns the GitHub authorize URL.
- `GET /api/github/callback` (`github.ts:83`) — public. Validates `state` against
  `oauth_states` (with `expires_at > now`), reads `user_id`, exchanges `code` for token,
  `saveGitHubConnection(user_id, token, username)`, deletes the state, redirects to
  `${NEXT_PUBLIC_APP_URL}${returnTo|/dashboard}?github=connected`.
- Server-side state→userId mapping is *stronger* than a signed JWT (brief's Strategy A
  is effectively already implemented). Persistence path is internally consistent:
  `saveGitHubConnection` writes `users.github_access_token_encrypted`, and
  `getDecryptedAccessToken` reads the same column.

### ROOT CAUSE #1 — "Settings still shows Connect GitHub" (the visible blocker)
The **active** settings UI is `apps/web/components/settings/ConnectorsPage.tsx`
(rendered as a modal panel in `SettingsRoot`). Its status check (line 29) does:

```ts
const r = await fetch(`${apiBase}/api/connectors/status`, { headers });
if (r.ok) { const data = await r.json(); if (data.github) setGithub(data.github); }
```

**`/api/connectors/status` does not exist.** It is mounted nowhere in `apps/api/src`
(only `/api/github`, `/api/integrations`, … are mounted in `index.ts`). The fetch 404s,
`r.ok` is false, and `github` stays `{ connected: false }` forever.

→ Even when the token is correctly persisted, the modern Settings → Konnektoren panel
**always** renders GitHub as "Verbinden". This is exactly the reported symptom and is
independent of token persistence.

(The *legacy* SSR page `app/dashboard/settings/integrations/page.tsx` reads
`profile.github_username` server-side and would show "Connected" correctly — but users
hit the modal, not the legacy page.)

### ROOT CAUSE #2 — double-step + wrong landing
- ConnectorsPage "Verbinden" does `window.location.href =
  '/dashboard/settings/integrations?service=github'` — bounces to the legacy page, which
  **ignores** `?service=github`. The user must click "Connect GitHub" a *second* time.
- The legacy `GitHubConnectButton.handleConnect` POSTs `/connect` with **no `returnTo`**,
  so the callback defaults to `/dashboard`. The user never returns to Settings.

### "Lands on login page" — most likely env, not code
Session is **cookie-based** (`@supabase/ssr`, `createBrowserClient`). A top-level GET
navigation from Railway → `NEXT_PUBLIC_APP_URL` carries the Lax session cookies, so
`/dashboard` should see the session **iff** `NEXT_PUBLIC_APP_URL` is the same domain the
user logged in on. If Railway's `NEXT_PUBLIC_APP_URL` points at a different Vercel domain
than where the session cookies live (e.g. `*.vercel.app` vs `justgoblin.com`), the
redirect lands on a domain with no session → middleware bounces to `/login`. **Founder
must verify `NEXT_PUBLIC_APP_URL` on Railway == the canonical login domain.**

## Fixes applied (code)
1. `ConnectorsPage.tsx`: query the real `/api/github/status` (shape `{connected, username}`)
   and `/api/integrations/vercel`; drop the dead `/api/connectors/status`.
2. `ConnectorsPage.tsx`: "Verbinden" now initiates OAuth **directly** (POST `/connect`
   with `returnTo: '/dashboard/settings/integrations'`) — one click, lands back on the
   integrations page which reflects the DB state + shows the success banner.
3. `github-connect-button.tsx` (legacy): POST `/connect` with
   `returnTo: '/dashboard/settings/integrations'` so it also returns to Settings.
4. `github.ts` callback: structured logging at each step (state valid / token exchanged /
   saved / redirect target) so the founder can diagnose the live flow from Railway logs.

## Founder live-verify checklist (after deploy)
- [ ] `NEXT_PUBLIC_APP_URL` on Railway == canonical login domain (the one holding the
      Supabase session cookies). This is the prime suspect for the login bounce.
- [ ] Disconnect existing GitHub (Settings → Konnektoren → if shown connected) or run
      the disconnect endpoint, then re-connect.
- [ ] After Authorize: should land on `/dashboard/settings/integrations?github=connected`
      with the green "GitHub connected successfully!" banner.
- [ ] Settings → Konnektoren panel shows "@username" + "Verbunden".
- [ ] Railway logs show `github_callback` lines: state_valid=true, token_exchanged=true,
      saved=true.
