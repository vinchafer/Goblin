# Goblin Full-Stack — Apps mit Datenbank & Login (WAVE-B)

Goblin can build apps with **real persistence and login**, not just static/localStorage pages.
This doc is the honest map of **what Goblin provisions vs. what the user owns**, and the
architecture's extension point. Decisions: `_sprint/wave-b/SPIKE_DECISION_TABLE.md`
(D-B1 = **Supabase, user-connected**; D-B2 = **2 backends/trial**).

## What this is
When a build needs to store data or log users in (a todo app where each user sees only their
own tasks, a booking page that keeps bookings), the agent calls **`provision_backend`**. Goblin
creates a real Postgres database + auth **inside the user's own Supabase account**, generates a
client-side app that talks to it via `supabase-js`, and publishes it on the existing Vercel path.
Per-user isolation is enforced by **Row-Level Security** — generated automatically on every table.

## What Goblin provisions vs. what the user owns

| | Provisioned/managed by Goblin | Owned by the user |
|---|---|---|
| **Supabase account** | — | The user's own (connected once via OAuth). Their billing, their data, their control. |
| **Database + auth** | Created programmatically (Management API) inside the user's account; tables + RLS policies generated | Lives in the user's project; the user can open it in the Supabase dashboard anytime |
| **Keys** | anon key (public) wired into the generated client; **service_role key sealed server-side** (Vault KEK), never in generated code/logs/reports | The user's project keys are theirs; they can rotate them in Supabase |
| **Generated app** | Real code (HTML + `supabase-js`), published to the user's Vercel | The user owns the code and the deployment |
| **Cost** | **$0 to Goblin** — the backend runs on the user's own Supabase free/paid tier | The user's free tier (2 active projects) or their paid plan |

This mirrors the **own-Vercel model** exactly: Goblin does the work, the user owns the account,
the data, and the cost. Goblin never owns user application data.

## Honest limits (v1)
- **Client-side apps only.** The generated app uses the anon key + RLS in the browser. No custom
  server functions, cron jobs, file-upload storage, or payments *inside the generated app* yet —
  each is a named v2 candidate, not a promise.
- **Trial cap:** up to **2** database-backed apps during the trial (D-B2), enforced from the first
  commit. In the user-connected shape this costs Goblin $0; the cap is an abuse/complexity guard.
- **Free-tier idle-pause:** a Supabase free-tier project **pauses after 7 days without a visit** —
  one visit wakes it. Surfaced honestly to the user (connectors page + agent copy), never hidden.
- **Isolation = RLS, not client filtering.** "Each user sees only their own data" is true because
  every table has owner-scoped RLS policies (`auth.uid() = user_id`), not because the client filters.
- **Provisioning latency is measured, never invented** (`supabase_backends.provision_latency_ms`).

## How it fits together (files)
- `apps/api/src/services/fullstack/` — the provider-agnostic core:
  - `types.ts` — the `BackendProvider` interface + provisioning types.
  - `schema-sql.ts` — the **RLS-always** SQL generator (every table gets enable-RLS + four
    owner policies; the model never writes raw SQL).
  - `supabase-provider.ts` — the Supabase implementation (Management API; attested; idempotent teardown).
  - `supabase-oauth.ts` + `apps/api/src/routes/supabase-oauth.ts` — the OAuth connector (`/api/supabase`).
  - `backend-store.ts` — the `supabase_backends` registry (feature-detect; seals service_role; trial-cap count).
  - `provision-tool.ts` — the `provision_backend` agent tool (never throws; attested; JIT; trial cap).
  - `config.ts` — env-only config (opt-in flag, OAuth creds, default region).
- Capability map + few-shots: `apps/api/src/prompts/goblin-chat-system.ts` (`PROVISION_BLOCK`).
- Teardown (GDPR): wired into the FW6 blocking purge in `services/account-deletion.ts`.
- Migration: `supabase/migrations/0096_fullstack_supabase_backends.sql` (authored, founder-applied).
- Ledger: `docs/GOBLIN_CONSUMPTION_LEDGER.md` → **M15**.
- Connectors UI: `apps/web/components/settings/ConnectorsPage.tsx` (Supabase row).
- Proof: `evidence/wave-b/` (reference app, adversarial RLS probe, runtime smoke, PROOF.md).

## Opt-in / rollout
The whole feature is behind **`GOBLIN_FULLSTACK_ENABLED`** (default off). While off, `provision_backend`
is not advertised to any run and the capability prompt block is absent, so existing static and
framework runs are **byte-identical** — the feature is strictly additive/opt-in for live users.
The founder enables it after registering the Supabase OAuth app, setting the Railway env vars,
and applying migration 0096.

## v2 extension point — a second backend provider (provider-agnostic BY DESIGN)
v1 ships **Supabase only** (founder-ratified: the spike proved Neon/Turso/Firebase need
fundamentally different models — server runtime, no RLS, or proprietary). But the provisioning
layer is **provider-agnostic**: the tool, the store, and the teardown wiring talk only to the
`BackendProvider` interface (`fullstack/types.ts`). Adding a second provider in a future wave is:
1. Implement `BackendProvider` for the new provider (its own `*-provider.ts`).
2. Add its connection provider + OAuth/route (mirroring `supabase-oauth.ts`).
3. Widen the `supabase_backends.provider` CHECK (or introduce a provider column mapping) and route
   the tool to the chosen provider.

No rewrite of the tool, schema generator, trial cap, or teardown is needed. **Never ship a
half-built second provider** — a new provider is its own wave, fully built and adversarially
tested, exactly as Supabase was here.
