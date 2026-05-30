# B1 — Ship-Loop Investigation (2026-05-30)

Journey 2 (Chat → Send-to-Code → Apply → Build → Preview → Deploy) mapped to code, what
each step claims vs does, and where it breaks. Investigation is **read-only** — no source
changes, no prod mutations beyond a single read-only Supabase probe.

## Verdict up front

The loop is **wired end-to-end in code** (the audit's gap was "never demonstrated", not
"unwired"). It is **not autonomously demonstrable right now** because the deploy step needs a
Vercel token the test user does not have — and the only available token is the founder's
account-level full-scope token. Using it = real deploys into the founder's personal Vercel
account. That is a **founder decision** (matches §5 "Vercel connection UX needs a design
call" + handoff "B1 deploy UX needs founder input before Sprint 1"). Per non-negotiable (a)
("if you cannot identify which project your call would hit → do not make the call, document,
proceed differently"), I stopped at this boundary rather than guess with their account.

## Step-by-step map

| Step | Trigger (web) | Endpoint (api) | What it actually does | State |
|------|---------------|----------------|-----------------------|-------|
| **Chat** | `standalone-chat` / `workspace/chat-tab` | `POST /api/chat` (SSE) | Streams model output. TTFT ~1.18s (audit). | ✅ works |
| **Send-to-Code** | `CodeBlock` / `app-context.tsx:80` event → `chat/send-to-code` | `POST /api/chat/send-to-code` | Inserts a `code_injections` row (`payload`, `user_id`). Does **not** write files. | ✅ wired |
| **Apply** | `InjectedBanner` + `hooks/code/useCodeInjections.ts` | `GET /api/projects/:id/pending-injections` → `PUT /api/projects/:id/files/*` → `PATCH …/pending-injections/acknowledge` | Reads pending injections, writes file content to storage, marks applied. Application logic is client-side. | ✅ wired |
| **Build** | `hooks/useBuildStatus.ts:104` | `POST /api/builds/start` | Inserts a `build_runs` row (status=running). **Cosmetic progress record only — no npm install / framework build happens here.** | ⚠️ see note |
| **Preview** | `components/preview/preview-tab.tsx` | reads `projects.preview_url` | Shows the last Vercel deployment URL in an iframe. No local render. | ✅ wired (depends on a prior deploy) |
| **Deploy** | `CodeActionBar` onDeploy → `hooks/code/useCodeVercel.ts:16` | `POST /api/deploy/vercel` (SSE) | `vercel-service.deployToVercel`: lists project files from Backblaze, uploads ≤100 as base64 to `POST api.vercel.com/v13/deployments` with `framework:null`, writes `preview_url` + `last_deployed_at`. **Vercel builds server-side.** | ✅ wired, ❌ blocked (no token) |

### Note on "Build" vs "Deploy"
There is **no separate Goblin build step**. `POST /api/builds/start` only creates a tracking
row (`build_runs`) that drives `build-status-bar.tsx`. The real build is whatever Vercel does
server-side when files are uploaded on deploy (`framework:null` → Vercel auto-detects). So
"Build" and "Deploy" collapse into the single Vercel deployment call. The Playwright loop the
prompt describes (Build then Preview then Deploy as distinct verified stages) does not map
1:1 to the architecture — Build is a UI affordance, Preview reflects the last deploy.

## Files involved
- API: `routes/{chat,send-to-code,builds,deploy,projects}.ts`, `services/{vercel-service,project-generator,file-storage}.ts`
- Web: `hooks/code/{useCodeVercel,useCodeInjections,getToken}.ts`, `hooks/useBuildStatus.ts`, `components/code/CodeActionBar.tsx`, `components/build/build-status-bar.tsx`, `components/preview/preview-tab.tsx`, `contexts/app-context.tsx`

## Breaks / gaps found

1. **DEPLOY BLOCKED — no Vercel token (hard blocker).**
   Read-only probe (`audit/check-vercel-token.mjs`) against prod:
   - test user `vinc.hafner3@gmail.com` = `8745e258-b05b-4e26-99fa-a3fa403eb2d4`, 57 projects.
   - `byok_keys`: **only `groq` (active). Zero Vercel tokens.**
   `deployToVercel` throws `NO_VERCEL_TOKEN` immediately. To deploy, the test user needs a
   Vercel BYOK token. The only token on hand is `VERCEL_TOKEN_SCOPE` in `.env.local` — the
   founder's **account-level full-scope** token. Inserting it + deploying = creating real
   `test-*` Vercel projects in the founder's personal account. → **founder decision.**

2. **B1.3 Vercel Integrations UI does NOT exist.**
   `app/dashboard/settings/integrations/page.tsx` is marked LEGACY (superseded by
   `SettingsRoot` + `components/settings/sections.ts`) and lists Vercel as **"Coming soon"**.
   Today a Vercel token can only be added via the generic BYOK keys flow (`byok_keys`
   provider=`vercel`). A real Settings → Integrations → Vercel "connect / paste token" section
   must be built in the canonical `SettingsRoot`, not the legacy page.

3. **B3 shield ↔ loop interaction (dev-mode only).**
   Several loop writes filter by **project id**, not user_id:
   - `deploy.ts:64` `.update({preview_url,…}).eq('id', projectId)`
   - `builds.ts:118` `.update(update).eq('id', jobId)` (CRON_SECRET path)
   My B3 guard's `OWNER_ID_COLUMNS` matches `id` against the **test-USER** id, so these
   project-scoped updates would be **blocked in dev-mode** (fail-closed, as documented). The
   inserts (`code_injections`, `build_runs`) carry `user_id` and pass. So running the loop
   through the local guarded API would block the deploy's `preview_url` update. Options for
   Sprint 2: (a) teach the guard to resolve project→owner, or (b) run the loop with
   `GOBLIN_DEV_MODE=false` as the test user (deliberate, scoped).

4. **Prod side-effects the B3 shield does NOT cover.**
   - **Backblaze**: Apply/generate write project files to the prod S3 bucket `goblin-projects`. Not guarded.
   - **Startup migrations**: `index.ts:39 runStartupMigrations()` runs against **prod Supabase** the moment the local API boots. Starting the local API is itself a prod touch.
   - **Vercel account**: deploys create real cloud resources.
   These widen the B1 blast radius beyond what B3 guards (Supabase `.from()` writes + Vercel
   project-name allowlist).

## Why I did not "just ship" the deploy

- The prompt's safety model assumes the env Vercel token deploys to `synapse-platform`. In
  reality the code uses **per-user BYOK** tokens and the deploy name is the project name —
  `synapse-platform` appears nowhere. The premise that made "just deploy" safe is false, so
  non-negotiable (a)'s "do not make the call, document, proceed differently" binds.
- Inserting the founder's full-scope token into the test account + firing real deploys to
  their personal Vercel while they sleep is an outward-facing, hard-to-reverse action gated on
  a decision they explicitly reserved (§5).

## What Sprint 2 needs to demonstrate B1 (concrete)

1. **Founder picks the Vercel account** for test deploys (their account via `VERCEL_TOKEN_SCOPE`, or a throwaway). Then store it as the test user's `vercel` BYOK key (one guarded insert).
2. **Decide run target**: local guarded API (resolve blocker #3 first) vs accept `GOBLIN_DEV_MODE=false` for the run.
3. **Build B1.3**: Settings → Integrations → Vercel token-paste in `SettingsRoot` (§4.3 fallback; OAuth deferred).
4. **Playwright** `tests/e2e/ship-loop.spec.ts`: login (password-grant per `audit/lean.mjs`) → create `test-b1-loop-{ts}` project → chat → send-to-code → apply → deploy → poll Vercel → curl 200 → cleanup. Note Build/Preview collapse into deploy (adjust assertions).
5. Capture 8 screenshots → `ship-loop-proof/`.

Estimated: deploy-account decision (founder, 5 min) + B1.3 UI (M) + Playwright loop + first real deploy hardening (L) ≈ a full Sprint-2 slice.
