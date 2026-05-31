# Dev-Safety Shield

> Added 2026-05-30 (Sprint 1, B3). Stops a **local dev process** from mutating **production**
> data, because Goblin has no staging backend — `pnpm dev` runs against prod Supabase /
> Stripe / Vercel.

## TL;DR

Set `GOBLIN_DEV_MODE=true` in `.env.local` (already set). The API then:

- **Supabase** — refuses any `INSERT/UPDATE/UPSERT/DELETE` that is not scoped to the test
  user (`TEST_ACCOUNT_EMAIL`). Reads pass through.
- **Stripe** — refuses to start if `STRIPE_SECRET_KEY` is a live key (`sk_live_`).
- **Vercel** — refuses to create/touch any project except the test-account placeholder
  `project-kiy64` or `test-*` (Sprint 2: token now targets the dedicated test account).

Disable for explicit prod testing: `GOBLIN_DEV_MODE=false`.

## ⚠️ Critical: the shield only bites if dev routes through the LOCAL API

The shield lives in the **API** (`apps/api`). The web app calls the backend via
`NEXT_PUBLIC_API_URL`. **Sprint 2 update** (`apps/web/lib/api.ts`): if `NEXT_PUBLIC_API_URL`
is **unset**, the web app now auto-defaults to `http://localhost:3001` in dev (and the Railway
URL in prod). But an explicit `NEXT_PUBLIC_API_URL` always wins — and `.env.local` currently
sets it to **Railway production**, so until you change it, `pnpm dev` web → prod API → prod
Supabase and the local shield never runs.

**To actually protect `pnpm dev`, point web at the local guarded API (or remove the var):**

```diff
# .env.local
- NEXT_PUBLIC_API_URL=https://goblinapi-production.up.railway.app
+ NEXT_PUBLIC_API_URL=http://localhost:3001
```

Then `pnpm dev` starts both `apps/web` (3000) and `apps/api` (3001); web → local API →
shield active → prod Supabase but writes gated to the test user. Same prod DB (no staging),
but mutations restricted. Revert the line for the rare case you must hit Railway directly.

> This env change is **not** committed (it lives in untracked `.env.local`). It is the one
> manual step required to arm the shield. Until done, the shield is built but dormant.

## What is guarded

| Layer | File | Behaviour in dev |
|-------|------|------------------|
| Env flags | `apps/api/src/lib/env.ts` | `IS_DEV_MODE`, `TEST_USER_EMAIL`, `VERCEL_ALLOWED_PROJECT`; `validateDevShield()` throws if dev-mode on with no test user; `assertStripeKeyMode()` throws on a live Stripe key. |
| Supabase | `apps/api/src/lib/supabase-guard.ts` + `supabase.ts` | `getSupabaseAdmin()` returns a guarded client in dev. Writes allowed only when scoped to the test user; else `[DEV-GUARD] Blocked …`. |
| Vercel | `apps/api/src/lib/vercel-guard.ts` + `services/vercel-service.ts` | `guardVercelCall()` before deploy creation. Allows `project-kiy64` (test-account placeholder) / `test-*`; else `[VERCEL-GUARD] Blocked …`. |
| Env load | `apps/api/src/load-env.ts` | First import in `index.ts`; loads `.env` then `.env.local` before any env-reading module evaluates. Prod-safe (no-op when files absent). |

## How Supabase ownership is decided

A write is allowed when it is demonstrably the test user's:

- **INSERT / UPSERT** — payload row has `user_id` / `owner_id` / `created_by` / `id` equal to
  the resolved test-user UUID, **or** an `email` column equal to `TEST_ACCOUNT_EMAIL`. Arrays
  must have **every** row scoped to the test user.
- **UPDATE / DELETE** — the filter chain includes `eq('user_id'|'owner_id'|'created_by'|'id', <test-id>)`,
  `eq('email', <test-email>)`, or a matching `match({...})`.
- **UPDATE / DELETE scoped by project** (Sprint 2) — if the filter is `eq('project_id', X)` or
  `eq('id', X)` and not user-scoped, the guard resolves the row's owner via a single cached
  read (`resolveOwnerIsTestUser`) and allows it iff the owner is the test user. This fixes the
  deploy/build UPDATEs (`projects.update().eq('id', projectId)`,
  `build_runs.update().eq('id', jobId)`) that previously failed closed.
- Tables in `DEV_SAFE_TABLES` (`schema_migrations`, `_migrations`, `migrations`) are always
  allowed.

### Honest limitations (fails CLOSED)

- A legitimate write that scopes ownership by a column **not** in the list above (and not
  resolvable via `id`/`project_id`) will be **blocked**. Fix: scope by a known column, add the
  table to `DEV_SAFE_TABLES`, or set `GOBLIN_DEV_MODE=false`.
- `.rpc()`, `auth.admin.*` (createUser/deleteUser), and `storage.*` bypass the `.from()`
  interception and are **not** guarded. They are a much narrower surface; treat them with
  care in dev.
- Test-user UUID is resolved best-effort at startup (`auth.admin.listUsers`, first 1000). If
  resolution fails, only email-scoped writes are allowed (still fails closed).

## Design choice: chokepoint over codemod

Rather than find/replace every `getSupabaseAdmin` import with a guarded variant (easy to miss
a call site), `getSupabaseAdmin()` itself returns the guarded client in dev and the raw client
in prod. One chokepoint, zero call-site churn, impossible to bypass by importing the wrong
symbol. The unguarded client is still available as `getSupabaseAdminRaw()` for internal use
(e.g. test-user resolution).

## Note on NODE_ENV

`.env.local` sets `NODE_ENV=production` even for local dev, so any `NODE_ENV !== 'production'`
check is useless for dev/prod detection. **The shield keys off `GOBLIN_DEV_MODE` only.**

## Tests

`apps/api/src/__tests__/dev-guard.test.ts` (vitest) — 20 tests covering Supabase
block/allow (insert/upsert/update/delete, arrays, safe tables, prod passthrough), Stripe
live-key detection, `validateDevShield`, and the Vercel allowlist.

```bash
pnpm --filter @goblin/api test src/__tests__/dev-guard.test.ts
```
