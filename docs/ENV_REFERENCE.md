# Environment reference — the single source of truth

Written after the 2026-07-30 production outage, whose entire cause was one
environment variable holding the wrong string. The point of this file is that
nobody should ever again have to guess which variable goes on which platform, or
what happens when one is wrong.

**Two platforms.** `apps/web` runs on **Vercel**. `apps/api` runs on **Railway**.
A variable set on the wrong one is simply absent as far as the app is concerned.

**Never paste a value into more than one field.** The 2026-07-30 outage was the
Supabase mail-hook URL pasted into Vercel's `NEXT_PUBLIC_API_URL`.

---

## How to read the columns

- **Secret** — `yes` means it must never appear in a browser bundle, a log, a
  screenshot or a support message. Anything named `NEXT_PUBLIC_*` is the
  opposite: it is compiled into the JavaScript every visitor downloads, so it
  can only ever hold public values.
- **Shape** — what a correct value looks like. Where it says *bare origin*, that
  means protocol + host and **nothing else**: no path, no trailing slash, no
  trailing newline. `apps/web/lib/env/origin.ts` enforces this.
- **What breaks without it** — ✔ marks behaviour measured directly; everything
  else is read from the code path named beside it.

---

## Web — Vercel

### Required

| Variable | Secret | Shape | What breaks without it |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | no | bare origin, `https://<ref>.supabase.co` | ✔ **the build fails** — static export throws while prerendering (`@supabase/ssr` refuses a falsy URL). No deployment is produced. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no (public by design) | JWT-shaped string | ✔ same as above — build fails. |
| `NEXT_PUBLIC_API_URL` | no | **bare origin** — `https://goblinapi-production.up.railway.app` | Falls back to that same origin in production (`lib/env/origin.ts`), so the app still works, but `/api/version` reports `healthy:false`. ✔ A *malformed* value used to take the whole site down; it is now refused instead. |
| `NEXT_PUBLIC_APP_URL` | no | bare origin — `https://www.justgoblin.com` | Auth redirects and OG tags lose their absolute base. `app/(auth)/logout/route.ts` builds a redirect from it. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | no (publishable) | `pk_live_…` / `pk_test_…` | `CheckoutPanel` renders with an empty key: Stripe.js never initialises, the subscribe button stays disabled. |

### Server-only (Vercel, not in the browser bundle)

| Variable | Secret | Shape | What breaks without it |
|---|---|---|---|
| `ADMIN_API_KEY` | **yes** | opaque string | `/api/admin/*` proxies to the API without the shared key; admin data calls are rejected. Must match Railway's value. |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | JWT-shaped | Server-side admin reads fail. Never expose to the browser. |
| `ADMIN_EMAIL` | no | email address | Admin gate falls back to the `users.is_admin` flag only. |

### Optional

| Variable | Secret | Notes |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | no | Web-push subscription. Absent → push silently unavailable. Pairs with the API's `VAPID_PRIVATE_KEY`. |
| `NEXT_PUBLIC_SENTRY_DSN` | no | Browser error reporting. Absent → Sentry disabled, no error thrown. |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | token **yes** | Build-time source-map upload only. Absent → `withSentryConfig` is skipped entirely (`next.config.ts`), build stays green. |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | no | Product analytics. |
| `NEXT_PUBLIC_IMPRINT_*` | no | Imprint page overrides; each has a literal default. |
| `NEXT_PUBLIC_ENABLE_WEBSEARCH`, `NEXT_PUBLIC_FREE_POOL_ENABLED`, `NEXT_PUBLIC_GOBLIN_HOSTED_API`, `NEXT_PUBLIC_ONBOARDING_TOOLS_STEP` | no | Feature flags. Compared to the literal `'true'`; anything else is off. |
| `ENABLE_TEST_AUTH`, `TEST_AUTH_TOKEN` | token **yes** | E2E test-auth route. **Must stay unset in production.** |

---

## API — Railway

### Required — the process refuses to start without these

`apps/api/src/index.ts:7-31` fails fast and exits with the list of what is
missing. That is the API's version of what `lib/env/origin.ts` does for web:
be loud immediately rather than half-broken later.

| Variable | Secret | Shape | What breaks without it |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | no | bare origin | Startup guard exits. |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | JWT-shaped | Startup guard exits. |
| `ENCRYPTION_KEY` | **yes** | 32-byte hex (64 chars) | Startup guard exits; also throws in `services/encryption.ts:7`. Rotating it makes every stored BYOK key undecryptable. |
| `STRIPE_PRICE_BUILD_TIER1` | no | `price_…` | Startup guard exits. |
| `STRIPE_PRICE_PRO_TIER1` | no | `price_…` | Startup guard exits. |
| `STRIPE_PRICE_POWER_TIER1` | no | `price_…` | Startup guard exits. |

### Required in practice — the process starts, a feature is dead

| Variable | Secret | Shape | What breaks without it |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | **yes** | `sk_live_…` / `sk_test_…` | All billing. Key mode is asserted at startup (`assertStripeKeyMode`). |
| `STRIPE_WEBHOOK_SECRET` | **yes** | `whsec_…` | Subscription state stops tracking Stripe: no upgrades, no cancellations. |
| `SUPABASE_AUTH_HOOK_SECRET` | **yes** | Supabase-generated | `POST /api/auth/email-hook` answers **500** and refuses every call (`auth-email-hook.ts:126-133`). Unset is the deliberate kill switch: Supabase keeps sending its own templates. ✔ Production currently answers **401** to an unsigned call, which proves it *is* set. |
| `RESEND_API_KEY` | **yes** | `re_…` | Auth mail and support mail are never sent. The hook returns 500 rather than a 200 that would leave a user waiting for mail that never comes. |
| `NEXT_PUBLIC_APP_URL` | no | bare origin | Mail links and `redirect_to` handling lose their base. Must match the web value. |
| `STORAGE_ENDPOINT`, `STORAGE_KEY`, `STORAGE_SECRET`, `STORAGE_BUCKET` | key/secret **yes** | S3-compatible | Project file storage silently falls back to the in-memory backend — fine in CI, data loss in production. |
| `ADMIN_API_KEY` | **yes** | opaque | `/api/admin/*` rejects the web proxy. Must match Vercel's value. |
| `CRON_SECRET` | **yes** | opaque | Internal server-to-server calls (build status updates) are rejected. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT` | private key **yes** | web-push keypair | Push notifications cannot be sent. Public key must match web's. |
| `PORT` | no | `3001` | Railway supplies this; only matters locally. |

### Optional, grouped

The long tail — Layer-2 hosted models (`GOBLIN_HOSTED_API`, `DEEPINFRA_API_KEY`,
`GOBLIN_HOSTED_MODEL_*`), LiteLLM (`LITELLM_*`), agent concurrency and runtime knobs
(`AGENT_*`, plus `CHAT_MAX_RUNTIME_MS` — the chat twin of `AGENT_MAX_RUNTIME_MS`, which
bounds a turn whose reader disconnected), rate-limit caps (`SEARCH_DAILY_CAP`, `PUBLISHES_PER_HOUR`,
`ATTACHMENT_BYTES_PER_DAY`), eval runner (`EVAL_*`), digests
(`FOUNDER_DIGEST_EMAIL`, `FEEDBACK_EMAIL`), ops/Act-2 (`OPS_*`, `CF_*`) and
observability (`SENTRY_DSN`, `LOG_LEVEL`, `BETTERSTACK_HEARTBEAT_URL`) — is
documented inline, with defaults and links, in **`apps/api/.env.example`**. Each
one is off or defaulted when unset; none of them can stop the process from
starting. Treat that file as this section's detail view rather than duplicating
it here, because a duplicated list is a list that goes stale.

---

## Supabase dashboard — not an environment variable

Set in **Supabase → Authentication → Hooks → Send Email → URL**, by hand:

```
https://goblinapi-production.up.railway.app/api/auth/email-hook
```

✔ Verified live: that exact string answers **401** (signature required, which is
healthy). A trailing slash, a `GET`, or either `justgoblin.com` host answers 404
or 307 instead. This value belongs **only** here — putting it in
`NEXT_PUBLIC_API_URL` is what caused the 2026-07-30 outage.

---

## Checking the current state without reading any secret

```
curl -s https://www.justgoblin.com/api/version | jq .config
```

Returns which required web variables are present or absent **by name**, plus a
plain sentence for anything malformed. It never returns a value, so the output
is safe to paste anywhere. `"healthy": true` means every required web variable is
present and well-formed.

For the API:

```
curl -s https://goblinapi-production.up.railway.app/api/health
```

---

## The rules that keep this from recurring

1. **A bare origin is a bare origin.** No path, no trailing slash, no newline.
   `lib/env/origin.ts` refuses anything else and falls back rather than
   propagating it — but the refusal is a safety net, not a licence to be sloppy.
2. **Nothing that reads an environment variable may throw at module scope.** A
   throw there takes the entire runtime with it, and the resulting error tells
   you nothing about which variable was at fault.
3. **A value must never reach an HTTP header unsanitised.** One control character
   is the difference between a wrong header and no response at all.
4. **Diagnosis endpoints must survive the failure they diagnose.**
   `/api/version` cannot 500 — there is a regression test for it.
5. **When a value is refused, say so by name and never by value.** Silent
   fallback is how a misconfiguration survives for weeks.
