# Sprint 1 — Status: **PARTIAL**

B3 (Dev-Safety Shield) shipped and gate-verified. B1 (Ship-Loop) investigated end-to-end and
found **wired but not autonomously demonstrable** — blocked on a founder decision (which Vercel
account to deploy test projects into) plus prod side-effects outside the shield. I stopped at
that boundary rather than fire real deploys into the founder's personal Vercel account while
they slept. Details below.

---

## 1. Headline
- **B3: COMPLETE & SHIPPED** — commit `b9fb66e`. typecheck + build + 65 tests PASS.
- **B1: PARTIAL / BLOCKED** — investigated, mapped, blockers identified. No source changes, no
  prod mutations (one read-only probe only). See `B1_INVESTIGATION_2026-05-30.md`.

## 2. B3 — Dev-Safety Shield (SHIPPED)
**Commit `b9fb66e`** (local, not pushed). Gate: `tsc --noEmit` PASS · `tsup` build PASS (292 KB) ·
65/65 vitest PASS incl. 20 new shield tests.

Delivered (adapted to the real architecture — shield lives in `apps/api`, not `apps/web`, because
all prod mutations go through the Hono API, not the Next app):
- `apps/api/src/lib/env.ts` — `IS_DEV_MODE` / `TEST_USER_EMAIL` / `VERCEL_ALLOWED_PROJECT`,
  `validateDevShield()`, `assertStripeKeyMode()`. Keys off `GOBLIN_DEV_MODE` (NOT `NODE_ENV`,
  which `.env.local` forces to `production`).
- `apps/api/src/lib/supabase-guard.ts` + `supabase.ts` — `getSupabaseAdmin()` returns a guarded
  client in dev that blocks INSERT/UPDATE/UPSERT/DELETE not scoped to the test user. Wired at the
  single chokepoint (chosen over codemod find/replace — impossible to miss a call site).
- `apps/api/src/lib/vercel-guard.ts` + `vercel-service.ts` — deploy refused unless the name is
  `synapse-platform` or `test-*`.
- Stripe — startup `assertStripeKeyMode()` throws on `sk_live_` in dev. Repo grep: **0 real live
  keys** (only masked UI mockups + the guard literal + DE help copy).
- `apps/api/src/load-env.ts` — first import in `index.ts`; loads `.env`/`.env.local` before any
  env-reading module evaluates (ESM-ordering fix; also lets the local API start at all).
- `docs/DEV_SAFETY.md` — full docs incl. the routing caveat below.

**Mental trace (gate step 4), all test-backed:** test-user insert → allowed; foreign insert →
`[DEV-GUARD] Blocked`; deploy to `other-project` → `[VERCEL-GUARD] Blocked`. ✓

### ⚠️ B3's one open blocker (NOT in the commit, needs founder)
The shield lives in the API, but `pnpm dev` web calls `NEXT_PUBLIC_API_URL` = **Railway PROD**
(`apps/web/lib/api.ts:getApiUrl`). So by default `pnpm dev` → prod API → prod Supabase and the
local shield never runs. The shield is built and tested but **dormant** until you point web at
the local guarded API:
```diff
# .env.local
- NEXT_PUBLIC_API_URL=https://goblinapi-production.up.railway.app
+ NEXT_PUBLIC_API_URL=http://localhost:3001
```
I did not silently flip this — it lives in untracked `.env.local`, isn't committable, and would
break your running session mid-sleep. It is the one manual step to arm the shield.

## 3. B1 — Ship-Loop (INVESTIGATED, BLOCKED)
**Playwright test: not built (would fail at deploy). No deployment URL.** No commit (no source
change).

The loop is **wired end-to-end**: Chat → Send-to-Code (`code_injections`) → Apply
(`pending-injections` → `PUT /files/*`) → Build (`build_runs`, cosmetic) → Deploy
(`vercel-service` uploads files, Vercel builds server-side) → Preview (`projects.preview_url`).
Verified end-to-end which steps live where, what they claim vs do — full table in
`B1_INVESTIGATION_2026-05-30.md`.

**Why blocked (hard):**
1. **No Vercel token.** Read-only prod probe: test user (`8745e258-…b2d4`, 57 projects) has only a
   `groq` BYOK key — **zero Vercel tokens**. `deployToVercel` throws `NO_VERCEL_TOKEN`. The only
   token available is the founder's account-level full-scope `VERCEL_TOKEN_SCOPE`; using it =
   real `test-*` deploys into the founder's personal Vercel account. → **founder decision** (§5).
2. **Prompt premise is false.** Deploys use **per-user BYOK** tokens; `synapse-platform` appears
   nowhere in code; deploy name = project name. Non-negotiable (a) ("if you can't identify which
   project your call hits → don't make the call, document, proceed differently") binds → stop.
3. **B1.3 UI doesn't exist.** Settings → Integrations Vercel = "Coming soon" in a LEGACY page;
   canonical settings (`SettingsRoot`) have no Vercel section.
4. **Side-effects outside the shield**: Backblaze file writes, prod startup-migrations on local
   API boot, real Vercel resources.

## 4. Trivial fixes applied
**1** — `apps/api/src/routes/billing.ts:145` type-narrowing defect (`formatted[len-1].id` →
`formatted.at(-1)?.id ?? null`) blocking `tsc --noEmit`. Pre-existing (apps/api has no
`typecheck` script and tsup/esbuild skips type errors, so it was never caught). Logged in
`TRIVIAL_FIXES_2026-05-30.md`.

## 5. Open blockers needing founder input
1. **B1 deploy account** — which Vercel account/token for test deploys? (your full-scope token,
   or a throwaway?) Until answered, the ship loop cannot be demonstrated.
2. **B3 routing** — flip `.env.local` `NEXT_PUBLIC_API_URL` → `localhost:3001` to arm the shield
   for `pnpm dev`.
3. **Local-API-on-prod risk** — `runStartupMigrations()` runs against prod DB on boot; decide
   before routing dev through the local API.
4. **B3 guard ↔ project-scoped writes** — deploy/build updates filter by project id, not user_id;
   guard fails them closed in dev. Teach guard project→owner resolution, or run loop with
   `GOBLIN_DEV_MODE=false`.

## 6. Estimated state for next prompt
- **Sprint 2 can start** with **B1 execution** once blocker #1 is answered (5-min founder call):
  store test-user Vercel token → build B1.3 token-paste UI in `SettingsRoot` (M) → Playwright
  loop + first-deploy hardening (L). Note Build/Preview collapse into the Vercel deploy — adjust
  the prompt's stage-by-stage assertions.
- **Also ready now** (no founder input): B7 (`/settings` hang redirect), B8 (real 404 for bad
  project UUID), B2 (signup path) — the items in `TRIVIAL_FIXES` candidates + audit P0/P1.
- **Needs founder UX decisions first:** B1 deploy UX, dev/prod staging mechanism.

## 7. Honest self-assessment (Bartlett-pass)
I'd sign off on **B3**: it's correct, tested, documented, and I surfaced the uncomfortable truth
that it's dormant until the env is repointed rather than claiming "dev is now safe." On **B1**,
Dario would rightly ask "where's the working loop?" — and the honest answer is the loop is wired
but the deploy needs a Vercel account you haven't designated, and I wasn't willing to fire real
deploys into your personal Vercel account or insert your full-scope token while you slept. That's
a 5-minute decision from you, then it's a clean Sprint-2 build.

---
*Run artifacts: `SPRINT_1_WIP_2026-05-30.md` (log), `B1_INVESTIGATION_2026-05-30.md`,
`audit/check-vercel-token.mjs` (read-only probe), `docs/DEV_SAFETY.md`. B3 = commit `b9fb66e`.*
