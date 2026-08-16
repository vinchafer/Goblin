# LiteLLM Dependency Audit

**Date:** 2026-08-16
**Scope:** vinchafer/Goblin, full repo, HEAD of `claude/litellm-dependency-audit-eprafi` (branched from `master` @ `2b95fc7`)
**Question:** Is any live, production-reachable code path in this repo dependent on the Railway "litellm" service (`ghcr.io/berriai/litellm:main-latest`)? Is it safe to put that service to sleep?
**Method:** Literal-string grep sweep (`LITELLM`, `litellm`, `LiteLLM`, `LITELLM_BASE_URL`, `LITELLM_MASTER_KEY`, `litellm-production-6ba8`) across the entire repo, then full-file reads of every code path that surfaced. No Railway access was used or attempted. All line numbers are current as of this commit; they will drift on future edits.

---

## VERDICT

```
GREEN — no live dependency. LITELLM_BASE_URL confirmed ABSENT in
the Railway @goblin/api service by the founder on 2026-08-16,
closing Honest Limitation #1. Service decommissioned same day.
```

**One-sentence basis:** every code path that can reach the litellm host is gated by `if (process.env.LITELLM_BASE_URL)` / `if (litellmUrl)`, that variable is not set anywhere in this repo's tracked config (it appears only as a commented-out example and in a founder checklist instructing it be left unset), and even in the hypothetical worst case where it *were* set in Railway (unverifiable by this audit — see Honest Limitations), the code that calls it treats connection failure as a soft error and falls through to direct provider APIs rather than failing the request. No `package.json` in the monorepo depends on the `litellm` npm/pip package. No CI workflow, Dockerfile, or cron references the litellm host.

---

## 1–2. Full grep sweep + classification

**Total literal hits: 149**, across 35 files (excluding `node_modules/`, `.git/`, `dist/`, `build/`, `pnpm-lock.yaml`). `LITELLM_MASTER_KEY` and `litellm-production-6ba8` hits are included in this count (they match the case-insensitive `litellm` pattern). Zero hits in `.github/workflows/`, zero in any `Dockerfile`, zero in `scripts/`.

Classification key:
- **(a) LIVE** — code that executes in production on every relevant request, regardless of `LITELLM_BASE_URL`.
- **(b) DEAD/GUARDED** — code that only executes, or only has an effect, when `LITELLM_BASE_URL` (or another unset condition) is truthy; unreachable in the current default configuration.
- **(c) DOCS/COMMENT** — markdown, `.env.example`, or in-code comments; no runtime effect.
- **(d) TEST/DEV** — test files or dev-only tooling.

### apps/api/src/services/model-router.ts (26 hits) — the router itself

| Line | Class | Justification |
|---|---|---|
| 23 | (b) | `import { GoblinError, isGoblinError, litellmStream } from './litellm-client'` — `litellmStream` is only invoked at line 594, inside the `if (litellmBase)` block. |
| 50–51, 64–65 | (b) | `litellmModel` field declarations on `RouteResult`/`FreePoolEntry`. Confirmed by grep (`grep -rn "\.litellmModel\b"`) that `route.litellmModel` has exactly one reader in the whole repo: line 594, inside the guarded block. Computed on every request but consumed by nothing outside the dead branch. |
| 180–189 | (a) | `FREE_SLUG_TO_LITELLM` map + `resolveFreeSlug()`. **Not litellm-service-dependent** — reused by `slugToProvider()` (line 194, called unconditionally at line 350) to resolve `free/*` tier slugs to a provider for BYOK routing. It's a naming convention borrowed from litellm's `provider/model` slug format, not a call to the litellm host. |
| 211–212 | (a) | `slugToModelId()` — same reasoning as above; used in the direct-SDK path too. |
| 237 | (b) | `litellmModel: `openai/${providerModel}`` inside `buildGoblinRoute()` — dead per the `.litellmModel` reader check above; the `goblin_hosted` layer explicitly bypasses litellm anyway (line 591: `route.layer === 'goblin_hosted' ? undefined : ...`). |
| 382, 384, 393, 408 | (b) | Same `litellmModel` field computation for the `byok` and `free_api` routes — dead per the reader check. |
| 517 | (c) | Comment. |
| 588–589 | (c) | Comment. |
| **591–592** | **(b) — THE GUARD** | `const litellmBase = route.layer === 'goblin_hosted' ? undefined : process.env.LITELLM_BASE_URL; if (litellmBase) {` — this is the single condition that gates the entire proxy branch (lines 592–641). |
| 594 | (b) | `litellmStream(...)` call — inside the guard. |
| 648 | (c) | Comment. |

**Guarding condition, quoted verbatim (model-router.ts:591):**
```
const litellmBase = route.layer === 'goblin_hosted' ? undefined : process.env.LITELLM_BASE_URL;
```

### apps/api/src/services/litellm-client.ts (17 hits) — the proxy client itself

| Line(s) | Class | Justification |
|---|---|---|
| 1–2 | (c) | Header comment. |
| 15–19 | (b) | `getLiteLLMBase()`: `const raw = process.env.LITELLM_BASE_URL; if (!raw) return null;` — every function below short-circuits on this. |
| 25 | (b) | Error-message string, only constructed inside `mapError()`, only called from the guarded `litellmStream`. |
| 42–52 | (b) | `litellmStream()` — line 51–52: `const base = getLiteLLMBase(); if (!base) return;` (immediate return, no-op, when unset). Its only caller is model-router.ts:594, itself guarded. |
| 59–61 | (b) | `LITELLM_MASTER_KEY` read — inside `litellmStream`, unreachable when base URL unset. |
| 76, 86 | (b) | Same function, same guard. |
| 130–133 | (b) — **fully dead** | `validateKeyViaLiteLLM()`. Grep for callers (`grep -rn "validateKeyViaLiteLLM"` across the whole repo) returns **zero call sites** anywhere outside its own definition. This function is not reachable from any route, guarded or not. |

### apps/api/src/routes/health.ts (9 hits) — the health-check ping (Task 5)

| Line(s) | Class | Justification |
|---|---|---|
| 88 | (c) | Comment. |
| 89–92 | (a) | `litellmRaw`/`litellmUrl` computed on every `/health/deep` call — cheap string work, no network. |
| **93** | **(b) — THE GUARD** | `if (litellmUrl) {` |
| 94–102 | (b) | The actual `fetch(`${litellmUrl}/health/readiness`, ...)` — only runs inside the guard. |
| 104 | (a) | `else { checks.litellm = { status: 'skip' }; }` — **this is the branch that executes today** given `LITELLM_BASE_URL` is not set anywhere in tracked config (see Task 5 below). |

### apps/web/app/status/page.tsx, ChatInput.tsx, friendly-error.ts (6 hits) — web app

| File:Line | Class | Justification |
|---|---|---|
| status/page.tsx:103 | (a) | `litellm: 'AI Proxy (LiteLLM)'` — a display-label lookup table entry, rendered live on `/status`. Purely cosmetic string mapping; makes no network call itself, just relabels whatever `health.checks.litellm.status` the API returned (see health.ts row above — currently `'skip'` → renders "Not configured"). |
| ChatInput.tsx:429 | (c) | Comment only. |
| friendly-error.ts:2, 15 | (c) | Comments. |
| friendly-error.ts:16 | (a) | `RULES` regex `/litellm\|model not found\|.../i` — runs live on every error string shown to a user, to translate raw errors into friendly copy. No network call; string matching only. |
| friendly-error.ts:44 | (a) | `JARGON` regex, same nature — scrubs the literal word "litellm" out of any leftover raw error text before display. |

### apps/api/src/config/providers.ts (14 hits) — provider metadata

| Line(s) | Class | Justification |
|---|---|---|
| 6 | (c) | Comment. |
| 43 | (a) | `litellmPrefix: string;` type field. |
| 57, 72, 89, 103, 117, 132, 146, 160, 174, 187, 198 | (a) | Per-provider `litellmPrefix` values (e.g. `'anthropic/'`, `'gemini/'`). Live static metadata, read by `catalog.ts` to derive a provider id from a model slug prefix. **No network dependency** — this is a naming-convention string, not a call to the litellm host. |
| 217 | (c) | Comment: "OpenAI-compatible base URLs for direct API calls (no LiteLLM)". |

### apps/api/src/services/catalog.ts (14 hits) — model catalog

| Line(s) | Class | Justification |
|---|---|---|
| 1, 5, 6, 18, 29, 73, 106, 306 | (c) | Comments — several explicitly state the architecture decision ("no `litellm` npm dependency and no functioning proxy service", line 5). |
| 34–35 | (a) | `.filter(p => p.litellmPrefix)` / `.map(...)` — builds `PREFIX_TO_PROVIDER`, static metadata only. |
| 98 | (b) | `source: 'litellm' | 'skipped' | 'error' | 'provider-discovery'` type union. Verified dead: grepped every writer of `catalog_sync_log.source` in the repo (`catalog-refresh.ts:211`) — it only ever writes `'manual'` or `'provider-discovery'`. `'litellm'` is a type option no code path produces. |
| 113–121 | (b) | `export async function syncFromLiteLLM(...)` — read in full; its entire body is: `return { ok: true, source: 'skipped', discovered: 0, upserted: 0, disabled: 0, reason: 'retired in 10.9-A1 — no LiteLLM proxy in this architecture...' }`. A hard-coded no-op, kept only so its callers keep compiling. |
| 230 | (a) | `${p.litellmPrefix}${id}` — string building, no network call. |

### apps/api/src/services/provider-discovery.ts, byok-service.ts, goblin-hosted.ts, goblin-hosted.test.ts, digest.ts, index.ts

| File:Line | Class | Justification |
|---|---|---|
| provider-discovery.ts:7 | (c) | Comment describing a hypothetical fallback that "(none currently)" exists. |
| byok-service.ts:380 | (c) | Comment. |
| goblin-hosted.ts:36 | (a) | `import { GoblinError } from './litellm-client'` — imports a shared error **class**, not the proxy client. Confirmed by reading the file header (lines 1–33): "routed through the OpenAI SDK as a library (no proxy deployed)." No functional dependency. |
| goblin-hosted.test.ts:31, 111 | (d) | Test file: imports the same error class; line 111 `delete process.env.LITELLM_BASE_URL` in `afterEach` cleanup, to guarantee test isolation from this exact variable. |
| digest.ts:5 | (c) | Comment. |
| digest.ts:101 | (a) | `lines.push('**Katalog-Quelle:** per-user Provider-Discovery (kein LiteLLM-Proxy...)')` — a static string pushed into the weekly founder digest. Confirmed live: `.github/workflows/catalog-cron.yml` fires `POST /api/admin/digest/send` every Monday 09:00 UTC. No network call to litellm; it just reports that none is used. |
| index.ts:351–352 | (c) | Comments above a dynamic `import('./services/catalog.js')` boot-time call — that import triggers only the retired no-op described above. |

### apps/api/src/routes/admin.ts, models.ts, lib/scrub-secrets.ts

| File:Line | Class | Justification |
|---|---|---|
| admin.ts:534 | (c) | Comment. |
| admin.ts:577 | (a) | `label: 'per-user provider-discovery (no LiteLLM proxy)'` — returned by `GET /admin/catalog`, an authenticated admin-only endpoint. Static string, no network call. |
| models.ts:33 | (c) | Comment. |
| scrub-secrets.ts:53 | (a) | `'LITELLM_MASTER_KEY'` — one entry in a list of env-var names that get redacted from any logged error output. Runs live on every scrub call, regardless of whether the var is set; purely defensive redaction, not a litellm call. |

### infra/litellm/config.yaml (8 hits) — NOT Goblin API code

This file is a LiteLLM proxy **config**, i.e. artifact for the separate "litellm" Railway service itself (the thing being considered for sleep), not code the `@goblin/api` service loads or executes. It defines a `model_list` (four `free/*` virtual models backed by Groq/Cerebras/Gemini/OpenRouter keys) and `general_settings.master_key: os.environ/LITELLM_MASTER_KEY`. **This directly contradicts the June 2026 probe finding** (`sprint-10-9/PHASE_0_GATE.md:51-53`, quoted below) that the live proxy served `{"data":[],"object":"list"}` with "no model_list loaded" — meaning either this config file was never actually deployed to that Railway service, or it was deployed after a config change without a matching model refresh, or it's stale/aspirational. This repo audit cannot determine which — see Honest Limitations. Regardless, nothing in `apps/api` reads this file; it is orthogonal to the Goblin API's routing.

### supabase/migrations/0061_dynamic_catalog.sql, 0062_catalog_sync_log.sql (3 hits)

| Line | Class | Justification |
|---|---|---|
| 0061:6, 0061:19 | (b) | `discovered_via` column DEFAULT/CHECK constraint permits `'litellm'` as a legal value. Verified dead: grepped every write site of `discovered_via` in `apps/api/src` — **zero writers found**. The column is never populated at all by current code, let alone with `'litellm'`. |
| 0062:7 | (b) | Comment listing `'litellm'` as a documented-but-legal `source` value. Verified dead per the `catalog.ts:98` row above — never actually written. |

### tests/, docs/, other markdown (remaining ~40 hits)

All remaining hits are (c) docs/comments or (d) test/dev-only:

- `tests/e2e/17-magic-link-byok-trial.spec.ts:180` (d) — comment in a test.
- `tests/security/chat-secret-isolation.mjs:33` (d) — includes `litellm-client.ts` in a list of files the secret-isolation test statically scans for secret-handling patterns.
- `BUG_REGISTRY.md:141`, `PRODUCTION_CHECKLIST.md:52`, `README.md:13,30`, `docs/ENV_REFERENCE.md:100`, `docs/AKT2_PHASE5_REPORT.md:280`, `docs/ACT2_CARRY_FORWARD.md:159`, `docs/NAV_MAP_L2_PIVOT.md:28,89`, `docs/L2_PIVOT_SESSION1_REPORT.md:31`, `_sprint/feel-1/SPRINT_REPORT.md:40`, `_sprint/mobile-1/I0_REPORT.md:14`, `_sprint/webhook/UPTIMEROBOT_SETUP.md:5`, `evidence/webhook-hardening/UPTIMEROBOT_SETUP.md:5`, `apps/api/.env.example:67-71` — all (c), no runtime effect. Two are operationally significant and quoted in full below:
  - `_sprint/launch/GO_LIVE_CHECKLIST.md:31`: `` - ☐ `FREE_*_API_KEY` / `LITELLM_*` — leave unset unless deliberately enabling `` — a founder-facing pre-launch checklist item instructing these vars be left unset in production.
  - `_sprint/webhook/UPTIMEROBOT_SETUP.md:5`: `` (the DB/storage/LiteLLM checks live on `/health/deep`, which can 503 — do NOT point the `` [uptime monitor at `/deep`, only at the root `/health`] — confirms the external uptime monitor is deliberately wired to the shallow `/health` endpoint, which never touches litellm at all (see Task 5).
- `sprint-10-9/PHASE_0_GATE.md` (17 hits) — the prior verification report itself, (c) docs; its findings are treated as evidence-of-a-past-state below, not re-verified live (this repo audit independently re-derived the same conclusions from current code, see Task 3).

**Full grep context (every hit, 3 lines of surrounding context, verbatim) is in Appendix A at the bottom of this document.**

---

## 3. `apps/api/src/services/model-router.ts` — full read

Read in full (867 lines). Key structure:

- `resolveModel()` (lines 341–426) picks a route: Goblin-hosted tier (line 361) → BYOK key (line 375) → free-API pool (line 398, currently `FREE_API_POOL = []` at line 71, so always empty) → Goblin-hosted default (line 416) → throw. **No proxy involved in route resolution at all** — litellm is never consulted to pick a model or provider.
- `streamCompletion()` (lines 494–750) is where the guard lives:

```ts
// line 591-592
const litellmBase = route.layer === 'goblin_hosted' ? undefined : process.env.LITELLM_BASE_URL;
if (litellmBase) {
  ...
}
```

**When `LITELLM_BASE_URL` is unset** (the documented/checked-list-instructed production state), `litellmBase` evaluates to `undefined`, the `if` block (lines 592–641) is skipped entirely, and execution falls straight through to the block explicitly commented (line 643-644):

```ts
// Direct SDK fallback — the real routing path (OPTION B; see
// sprint-10-9/PHASE_0_GATE.md).
```

This is the Anthropic SDK / OpenAI SDK direct-to-provider code (lines 654–707) — no litellm host contacted.

**Can ANY code path still reach the proxy URL?** Yes, exactly one: if `LITELLM_BASE_URL` were set AND `route.layer !== 'goblin_hosted'` (i.e. the request routed to `byok` or `free_api`), line 594 calls `litellmStream(route.litellmModel, ...)`, which does a real `fetch()` to `${base}/chat/completions` (litellm-client.ts:65). **But this branch degrades softly, not hard:**

```ts
// lines 633-640
} catch (err) {
  recordOutcome(route.provider, false, { slug: route.modelSlug, modelNotFound: isModelNotFound(err) });
  if (!isGoblinError(err) || (err.code !== 'rate_limit' && err.code !== 'provider_down')) {
    throw err; // Hard error (invalid key, etc.) — propagate
  }
  // Soft error (rate limit / down) — fall through to direct API
  yield JSON.stringify({ type: 'fallback_notice', reason: err.message });
}
```

A connection failure to a sleeping/removed host (`fetch` throwing, caught at litellm-client.ts:81-87) is mapped to `GoblinError('provider_down', 'Failed to reach LiteLLM')` — which is exactly the soft-error case above. It falls through to the direct-SDK block (line 643+) and the user's request still completes, with only an internal `fallback_notice` event emitted. **Even in the worst-case hypothetical where `LITELLM_BASE_URL` is set in Railway production, sleeping the litellm service does not hard-fail a chat request** — it degrades to the same direct-SDK path OPTION B already uses by default.

---

## 4. `package.json` dependency check

| Package | `litellm` present? |
|---|---|
| `./package.json` (root) | Absent |
| `apps/api/package.json` | Absent — has `@anthropic-ai/sdk` and `openai` instead |
| `apps/web/package.json` | Absent |
| `packages/shared/package.json` | Absent |
| `evidence/wave-e/proof-app-src/package.json` | Absent |

Command run: `grep -rn "litellm" --include="package.json" -i .` (excluding `node_modules/`) → zero matches across all 5 `package.json` files in the monorepo.

---

## 5. Health check / cron / admin panel / startup probe pinging the litellm host

**One and only one** such probe exists: `apps/api/src/routes/health.ts:88-105`, on the `GET /health/deep` route (quoted in full above). It is guarded by `if (litellmUrl)` where `litellmUrl` derives from `process.env.LITELLM_BASE_URL`.

**When it gets a timeout (hypothetical, only if the env var were set):** `catch { checks.litellm = { status: 'fail', ... }; if (overallStatus === 'ok') overallStatus = 'degraded'; }` (health.ts:99-101) — **soft degrade**, not a hard fail. It can never push `overallStatus` to `'down'` (only the Supabase check can, at line 47) and the route never returns a non-200 because of this check alone — the 503 status (line 131: `overallStatus === 'down' ? 503 : 200`) is reserved for Supabase failure.

**When `LITELLM_BASE_URL` is unset (the current/expected state):** `checks.litellm = { status: 'skip' }` (health.ts:104) — no network call is attempted at all; this is a **silent skip**, not a degrade.

**External uptime monitoring does not use this check.** `_sprint/webhook/UPTIMEROBOT_SETUP.md:3-6` explicitly instructs: `` GET /health` returns 200 ... the DB/storage/LiteLLM checks live on `/health/deep`, which can 503 — do NOT point the uptime monitor at `/deep`, only at the root `/health` ``. The external monitor is deliberately kept blind to this check.

No cron job pings the litellm host: `.github/workflows/catalog-cron.yml` (the only cron touching the catalog system) calls `POST /api/admin/catalog/refresh` and `POST /api/admin/digest/send` — both of which, per Task 2 above, run OPTION B's per-user provider-discovery / static-digest paths, not litellm. No admin panel route (`admin.ts`) makes an outbound call to the litellm host either — `admin.ts:577`'s only litellm reference is a static descriptive string.

---

## Honest Limitations

1. **Railway production env var state was not directly verified.** Per the hard rules of this audit, Railway was not touched and no Railway secrets were read. The claim that `LITELLM_BASE_URL` is unset in the live `@goblin/api` Railway service rests on: (a) it is absent from every tracked file in this repo (`.env.example` has it commented out, line 70-71), (b) `_sprint/launch/GO_LIVE_CHECKLIST.md:31` instructs the founder to leave it unset, and (c) the prior audit (`sprint-10-9/PHASE_0_GATE.md:44-45`, dated 2026-06-04) found it only in `.env.local` — a gitignored, local-only file, not committed, and not evidence of a Railway service variable. **This is UNVERIFIED, not confirmed-absent.** However, as shown in Task 3, this gap does not change the verdict: even if the variable is set, the code path it enables degrades to a soft fallback on connection failure rather than a hard error, so sleeping the litellm host cannot cause a user-visible chat failure either way.
   **CLOSED 2026-08-16:** the founder checked the Railway `@goblin/api` service's variables tab directly and confirmed `LITELLM_BASE_URL` is absent. This is now confirmed-absent, not inferred. The Railway "litellm" service's deployment and public domain were removed the same day; the service shell and its variables remain (redeployable from the Deployments tab). A production chat turn completed successfully after the removal, confirming direct-SDK routing (OPTION B) works without the proxy present. Honest Limitations #2–#5 below are unaffected by this and remain open.
2. **`infra/litellm/config.yaml` conflicts with the June 2026 live-probe finding.** The config file in this repo defines four working `free/*` model routes, but the June probe of the actual deployed proxy (`sprint-10-9/PHASE_0_GATE.md:47-54`) found `GET /model/info` returning `"LLM Model List not loaded in. Make sure you passed models in your config.yaml"` and every completion 400ing. This audit cannot determine why the deployed service doesn't reflect this repo's config file (never redeployed after a config edit, deployed from a different source, manually reconfigured in the Railway dashboard, or the config file predates a since-reverted architecture change) — that would require Railway access, which this audit was not permitted to use. Named here rather than silently assumed either way.
3. **No fresh live probe of the litellm host was performed by this audit.** The June 2026 probe results are cited as historical evidence (they are the only first-party proof that the proxy is/was non-functional even when reachable), not re-verified today. It is possible the proxy's state has changed in either direction since June 4 (over 10 weeks ago) — e.g. someone could have loaded a working `model_list` in the interim, which the discovered `infra/litellm/config.yaml` might reflect an attempt at. This does not change the verdict, because — per Task 3 — the code path that would call it degrades softly regardless of the proxy's health.
4. **This audit trusts its own grep completeness.** The sweep covered git-tracked files only (`grep -rn` over the working tree minus `node_modules/`, `.git/`, `dist/`, `build/`, `pnpm-lock.yaml`); it would miss a reference inside an untracked or `.gitignore`d file (e.g. a local `.env.local`, which is confirmed present in `.gitignore:9` but was not and could not be read as part of this audit — it is local machine state, not repo state, and reading it would exceed "grep the entire repo").
5. **No dynamic/behavioral test was run.** This is a static-analysis audit (grep + full-file reads), per the READ-ONLY hard rule. No code was executed, no request was sent to either Railway service, and no test suite was run to empirically confirm the fallback behavior described in Task 3 — the soft-degrade conclusion is derived from reading the `try/catch` logic in `model-router.ts` and `litellm-client.ts`, not from observing it happen.

---

## Founder Actions

1. **Safe to put the "litellm" Railway service to sleep.** No code path in this repo has a live, unguarded dependency on it; the one guarded path degrades gracefully even in the worst case.
2. **Before or after sleeping it, confirm (outside this audit, since Railway access is out of scope here) that `LITELLM_BASE_URL` is in fact unset on the `@goblin/api` Railway service's variables tab.** This closes Honest Limitation #1 with certainty rather than inference. If it turns out to be set, either unset it (per the `.env.example` and GO_LIVE_CHECKLIST guidance) or leave it — Task 3's analysis shows it is safe either way, but unsetting it removes the now-pointless outbound `fetch()` attempt and its ~3s timeout window in `/health/deep`.
3. **Optional cleanup, not blocking the sleep decision:** delete `apps/api/src/services/litellm-client.ts`'s unused `validateKeyViaLiteLLM()` export (zero callers repo-wide) and the now-provably-dead `discovered_via = 'litellm'` / `catalog_sync_log.source = 'litellm'` type options — these are pure dead code, unrelated to whether the service is asleep or awake.
4. **`infra/litellm/config.yaml`'s mismatch with the June probe (Honest Limitation #2) is worth a five-minute look** before decommissioning — if that config was in fact loaded into the live service at some point after June 4, the "empty proxy" finding may be stale, though this does not change today's verdict (nothing calls it).
5. **`README.md:13`, `PRODUCTION_CHECKLIST.md:52`, and `docs/L2_PIVOT_SESSION1_REPORT.md:31`** describe LiteLLM as if it were a load-bearing part of the architecture ("AI | LiteLLM proxy, BYOK..."). These are stale relative to the OPTION B decision recorded in `sprint-10-9/PHASE_0_GATE.md` and could mislead a future engineer; consider a docs pass once the service is confirmed asleep.

---

## Appendix A — Full grep context (every hit, verbatim)

The complete `grep -B3 -A3` output for every one of the 149 hits, grouped by file, is reproduced below exactly as returned by ripgrep against the working tree at the commit noted at the top of this document.

### ./BUG_REGISTRY.md
```
138-
139-- [FEAT-026] Sentry edge config + Next.js withSentryConfig wrapper (fallback when no auth token)
140-- [FEAT-027] `lib/heartbeat.ts` Better-Stack ping (reused `/health/deep` for dependency status)
141:- [FEAT-028] `completion_costs` table + `trackCompletion` hook in both streaming paths (LiteLLM + direct SDK)
142-- [FEAT-029] `/api/admin/cost-summary` + `/admin/costs` page (30-day per-provider aggregate)
143-- [FEAT-030] Eval framework: `eval_tasks` + `eval_results` schema, 5 seed tasks, 4 providers (Anthropic Sonnet 4.6, OpenAI gpt-4o-mini, Gemini 2.5 Flash, Groq Llama 3.3)
144-- [FEAT-031] Daily eval cron 04:00 UTC + manual trigger `POST /api/internal/eval/run` + `pnpm eval:run`
```

### ./PRODUCTION_CHECKLIST.md
```
49-| Item | Status | Notes |
50-|------|--------|-------|
51-| Health check: GET /health | ✅ Done | Returns `{ status, timestamp, version }` |
52:| Deep health check: GET /health/deep | ✅ Done | Checks Supabase, Storage, LiteLLM |
53-| Error page (500) | ✅ Done | `app/error.tsx` |
54-| 404 page | ✅ Done | `app/not-found.tsx` |
55-| Sentry frontend | ⚠️ Pending | Install `@sentry/nextjs`, add `sentry.client.config.ts` |
```

### ./README.md
```
10-|-------|------|
11-| Frontend | Next.js 15 (App Router), Tailwind CSS v4, TypeScript |
12-| Backend | Hono (Node.js), Supabase (Postgres + Auth + Storage) |
13:| AI | LiteLLM proxy, BYOK (Anthropic/OpenAI/Gemini/Groq/+8 more), Free-API pool |
14-| Payments | Stripe (subscriptions, usage-based limits) |
15-| Deploy | Vercel (via API), GitHub (OAuth + repo push) |
16-| Monitoring | Sentry, PostHog, structured logging (pino) |
--
27-# 3. Environment
28-cp .env.example .env
29-# Fill in NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
30:# ENCRYPTION_KEY (32 chars), STRIPE_* keys, LITELLM_BASE_URL
31-
32-# 4. Supabase setup
33-# Run supabase/migrations/*.sql in order via Supabase SQL editor
```

### ./_sprint/feel-1/SPRINT_REPORT.md
```
37-| **P0.4** Idempotent create + honest errors | `cb991bc`, `5324c03` | Client-supplied UUID as project id; server dedupes on PK conflict → returns existing row (200), never a duplicate. Both create modals send the id. Connection errors render honest German (offline vs server-down via `navigator.onLine` + 3s health ping). | **E2E live:** double create same id ⇒ 1 row; offline ⇒ "Deine Internetverbindung ist unterbrochen…"; server-down ⇒ "Unser Server antwortet gerade nicht…"; retry after restore ⇒ exactly 1 project. Evidence: `reverify/P0.4_*`. | **Done** |
38-| **P0.5** Chat-send resilience | `c2f485d`, `9ff2455` | Optional `clientMessageId` (UUID) on both chat routes; duplicate replay never re-inserted, model never sees a send twice. Client: failed send stays in `wartet auf Verbindung — erneut senden` state, retry reuses the id (no double-submit). Pre-migration tolerant. | Server tolerance verified live (send with id, column absent ⇒ delta+done). Full offline queue deferred → **issue #13**. | **Done** (minimal, as scoped) |
39-| **P0.6** Tickets | — | GitHub issues filed, not fixed. | **#8** magic-link/dashboard, **#9** logout token, **#10** preview iframe/Vercel protection, **#11** reload "Noch keine Dateien", **#12** observability (bonus, from D1). | **Done** |
40:| **F1.1** System prompt + project context | `c2f485d`, `31f2274` | `goblin-chat-system.ts`: Goblin identity, capability map that routes users INTO the Send-to-Code→Sichern→Veröffentlichen pipeline, honest not-yet list (web/images/self-deploy), register + project-scope guidance, per-request project block (name, file list w/ sizes, last deploy URL/date). Wired through Anthropic/OpenAI/Goblin-hosted/LiteLLM paths for both chat routes. | **4 scripted probes** (`reverify/F1.1_probe*`): W10 compound ⇒ routes into pipeline, cites real URL, **no capability denial** (was: "kann keine Webanwendungen bauen"); "kannst du im Web suchen?" ⇒ honest No + redirect; architecture Q ⇒ localStorage-scale answer; "wer bist du + was liegt im Projekt?" ⇒ "Ich bin Goblin… Projekt 'Habit Tracker Walk'… index.html/script.js/script-1.js… letzte Veröffentlichung https://…". | **Done** |
41-| **F1.2** Honest indicator | `ee71d9e` | `WorkingIndicator` in `Message.tsx`: elapsed-time "Goblin arbeitet… 12s" from send-accept to first token; truthful, no fake steps. | **E2E live:** indicator visible in the previously-dead 0–12s window ("Goblin arbeitet… 3s"→"6s"). Evidence: `reverify/W1_08`, `W10_02`. | **Done** |
42-| **F1.3** File-cards | `ee71d9e` | Fenced file blocks → collapsed cards (filename, language, live line count, expand/copy); prose stays prose; Send-to-Code parser untouched. | **E2E live:** W1 genesis ⇒ intro + 3 collapsed cards (`index.html html·19 Zeilen`, `style.css`, `script.js`) + summary, no raw wall; expand works; STC picks the card files. Evidence: `reverify/W1_10`–`W1_13`. | **Done** |
43-| **F1.4** Remove phantom affordances | `48ea43e` | `Recherche`/`Websuche` composer items feature-flagged off (`NEXT_PUBLIC_ENABLE_WEBSEARCH`), code retained. | Code + build. | **Done** |
```

### ./_sprint/launch/GO_LIVE_CHECKLIST.md
```
28-- ☐ `ADMIN_API_KEY` 🔑 / `ADMIN_USER_IDS` (for `/admin/*`), `CRON_SECRET` 🔑
29-- ☐ `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT=production`
30-- ☐ `BETTERSTACK_HEARTBEAT_URL` (eval-suite heartbeat)
31:- ☐ `FREE_*_API_KEY` / `LITELLM_*` — leave unset unless deliberately enabling
32-- ☐ `NEXT_PUBLIC_FREE_POOL_ENABLED` — leave unset; enabling turns on `SoftLimitBanner` trial/quota copy (verify that copy before flipping)
33-
34-## B. Migrations (authored here; **applied by founder** — OS Law 4)
```

### ./_sprint/mobile-1/I0_REPORT.md
```
11-current master (anchors drifted; the interface/destructure/call-sites all moved but by symbol
12-were unambiguous) and applied via edits, not `git apply`:
13-- `model-router.ts`: `StreamCompletionParams.chatSessionId`, destructured, forwarded to **both**
14:  `trackCompletion` call sites (LiteLLM + direct-SDK branches).
15-- `chat-sessions.ts`: `POST /:id/stream` passes `chatSessionId: sessionId`.
16-- `track-completion.ts` already had the `chatSessionId` param + write (no change needed there).
17-
```

### ./_sprint/webhook/UPTIMEROBOT_SETUP.md
```
2-
3-`GET /health` returns **200** (verified — `apps/api/src/routes/health.ts:9`, runtime-checked
4-in this sprint). It is a cheap liveness probe: no auth, no DB dependency on the root path
5:(the DB/storage/LiteLLM checks live on `/health/deep`, which can 503 — do NOT point the
6-uptime monitor at `/deep`, only at the root `/health`).
7-
8-## Canonical health URLs (FW2 F-35 — verified 2026-07-13)
```

### ./apps/api/.env.example
```
64-# CEREBRAS_FREE_API_KEY=csk-...        # https://cloud.cerebras.ai
65-# OPENROUTER_FREE_API_KEY=sk-or-...    # https://openrouter.ai/keys
66-
67:# ─── Optional: LiteLLM Proxy ────────────────────────────────────────────────
68:# When set, Goblin routes all chat completions through LiteLLM first.
69:# Falls back to direct provider APIs if LiteLLM is not reachable.
70:# LITELLM_BASE_URL=http://localhost:4000     # e.g. http://litellm.your-domain.com
71:# LITELLM_API_KEY=sk-your-litellm-master-key
72-
73-# ─── Supabase auth-mail hook (AKT 1 · U3) ────────────────────────────────────
74-# Secret generated by Supabase Dashboard → Authentication → Hooks → Send Email.
```

### ./apps/api/src/config/providers.ts
```
3-// 10.9-A2 — HAND-MAINTAINED DISPLAY LIST (OPTION B; see sprint-10-9/PHASE_0_GATE.md).
4-//
5-// Two distinct things live here:
6://  1. Provider METADATA (baseURL, keyEnvVar, litellmPrefix, docs/credits URLs) —
7-//     routing infrastructure. Stable; edit only when a provider changes its API.
8-//  2. The `models: [...]` arrays — a small, curated, hand-maintained DISPLAY list.
9-//     Their JOB is the not-connected onboarding view ("here's what you can
--
40-export interface ProviderConfig {
41-  id: ProviderId;
42-  displayName: string;
43:  litellmPrefix: string;
44-  baseURL: string;
45-  keyEnvVar: string;
46-  keyHint: string;
--
54-  anthropic: {
55-    id: 'anthropic',
56-    displayName: 'Anthropic',
57:    litellmPrefix: 'anthropic/',
58-    baseURL: 'https://api.anthropic.com/v1',
59-    keyEnvVar: 'ANTHROPIC_API_KEY',
60-    keyHint: 'sk-ant-...',
--
69-  openai: {
70-    id: 'openai',
71-    displayName: 'OpenAI',
72:    litellmPrefix: 'openai/',
73-    baseURL: 'https://api.openai.com/v1',
74-    keyEnvVar: 'OPENAI_API_KEY',
75-    keyHint: 'sk-...',
--
86-  google: {
87-    id: 'google',
88-    displayName: 'Google AI Studio',
89:    litellmPrefix: 'gemini/',
90-    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
91-    keyEnvVar: 'GOOGLE_API_KEY',
92-    keyHint: 'AIza...',
--
100-  groq: {
101-    id: 'groq',
102-    displayName: 'Groq',
103:    litellmPrefix: 'groq/',
104-    baseURL: 'https://api.groq.com/openai/v1',
105-    keyEnvVar: 'GROQ_API_KEY',
106-    keyHint: 'gsk_...',
--
114-  mistral: {
115-    id: 'mistral',
116-    displayName: 'Mistral AI',
117:    litellmPrefix: 'mistral/',
118-    baseURL: 'https://api.mistral.ai/v1',
119-    keyEnvVar: 'MISTRAL_API_KEY',
120-    keyHint: '...',
--
129-  xai: {
130-    id: 'xai',
131-    displayName: 'xAI',
132:    litellmPrefix: 'xai/',
133-    baseURL: 'https://api.x.ai/v1',
134-    keyEnvVar: 'XAI_API_KEY',
135-    keyHint: 'xai-...',
--
143-  deepseek: {
144-    id: 'deepseek',
145-    displayName: 'DeepSeek',
146:    litellmPrefix: 'deepseek/',
147-    baseURL: 'https://api.deepseek.com/v1',
148-    keyEnvVar: 'DEEPSEEK_API_KEY',
149-    keyHint: 'sk-...',
--
157-  together: {
158-    id: 'together',
159-    displayName: 'Together AI',
160:    litellmPrefix: 'together_ai/',
161-    baseURL: 'https://api.together.xyz/v1',
162-    keyEnvVar: 'TOGETHER_API_KEY',
163-    keyHint: '...',
--
171-  fireworks: {
172-    id: 'fireworks',
173-    displayName: 'Fireworks AI',
174:    litellmPrefix: 'fireworks_ai/',
175-    baseURL: 'https://api.fireworks.ai/inference/v1',
176-    keyEnvVar: 'FIREWORKS_API_KEY',
177-    keyHint: 'fw-...',
--
184-  openrouter: {
185-    id: 'openrouter',
186-    displayName: 'OpenRouter',
187:    litellmPrefix: 'openrouter/',
188-    baseURL: 'https://openrouter.ai/api/v1',
189-    keyEnvVar: 'OPENROUTER_API_KEY',
190-    keyHint: 'sk-or-...',
--
195-  custom: {
196-    id: 'custom',
197-    displayName: 'Custom Endpoint',
198:    litellmPrefix: '',
199-    baseURL: '',
200-    keyEnvVar: 'CUSTOM_API_KEY',
201-    keyHint: '...',
--
214-  { id: 'llama-3.3-70b-free', name: 'Llama 3.3 70B', slug: 'free/llama-70b', provider: 'groq', layer: 'free_api', description: 'Extremely fast inference. Free tier available.', tags: ['fast', 'free', 'coding'], requires_key: false, available: true, phase: 1 },
215-];
216-
217:// OpenAI-compatible base URLs for direct API calls (no LiteLLM)
218-export const PROVIDER_BASE_URLS: Partial<Record<ProviderId, string>> = Object.fromEntries(
219-  Object.entries(PROVIDERS).map(([id, p]) => [id, p.baseURL])
220-) as Partial<Record<ProviderId, string>>;
```

### ./apps/api/src/index.ts
```
348-  .then(({ logResendStatus }) => logResendStatus())
349-  .catch((e) => console.warn('[support-email] status log failed:', e));
350-
351:// Sprint 10.8 — refresh the model catalog from LiteLLM on boot (fire-and-forget;
352:// no-op if LITELLM_BASE_URL is unset). Keeps the `models` cache aligned with what
353-// the proxy actually serves; Sprint 10.9 adds a cron on top of the same path.
354-import('./services/catalog.js')
355-  .then(({ scheduleBootSync }) => scheduleBootSync())
```

### ./apps/api/src/lib/scrub-secrets.ts
```
50-  'SUPABASE_SERVICE_ROLE_KEY',
51-  'SUPABASE_ANON_KEY',
52-  'ENCRYPTION_KEY',
53:  'LITELLM_MASTER_KEY',
54-  'RESEND_API_KEY',
55-  'CRON_SECRET',
56-  'ADMIN_API_KEY',
```

### ./apps/api/src/routes/admin.ts
```
531-});
532-
533-// Sprint 10.9-2 — manual + cron catalog refresh (OPTION B: per-user
534:// provider-discovery; the LiteLLM /v1/models sync was retired in 10.9-A1).
535-// The daily cron (04:00 UTC) posts here; see .github/workflows/catalog-cron.yml.
536-admin.post('/catalog/refresh', async (c) => {
537-  const { refreshAllUserDiscovery } = await import('../services/catalog-refresh.js');
--
574-  const log = (syncLog.data ?? []) as Array<Record<string, unknown>>;
575-
576-  return c.json({
577:    source: { mode: 'OPTION B', label: 'per-user provider-discovery (no LiteLLM proxy)' },
578-    lastSyncAt: (log[0] as { synced_at?: string } | undefined)?.synced_at ?? null,
579-    stats: {
580-      models: models.length,
```

### ./apps/api/src/routes/health.ts
```
85-    }
86-  }
87-
88:  // LiteLLM
89:  const litellmRaw = process.env.LITELLM_BASE_URL;
90:  const litellmUrl = litellmRaw
91:    ? (litellmRaw.startsWith('http') ? litellmRaw.replace(/\/$/, '') : `https://${litellmRaw.replace(/\/$/, '')}`)
92-    : null;
93:  if (litellmUrl) {
94-    const t = Date.now();
95-    try {
96:      const res = await fetch(`${litellmUrl}/health/readiness`, { signal: AbortSignal.timeout(3000) });
97:      checks.litellm = { status: res.ok ? 'ok' : 'fail', latencyMs: Date.now() - t };
98-      if (!res.ok && overallStatus === 'ok') overallStatus = 'degraded';
99-    } catch {
100:      checks.litellm = { status: 'fail', latencyMs: Date.now() - t };
101-      if (overallStatus === 'ok') overallStatus = 'degraded';
102-    }
103-  } else {
104:    checks.litellm = { status: 'skip' };
105-  }
106-
107-  // Stripe (just check env var presence)
```

### ./apps/api/src/routes/models.ts
```
30-  }
31-
32-  // 10.8-3: catalog read path lives in services/catalog.ts. The models table is
33:  // a cache (synced from LiteLLM) intersected with each user's discovered BYOK
34-  // models; static providers.ts is the last-resort fallback inside getCatalogForUser.
35-  const annotated = await getCatalogForUser(userId);
36-
```

### ./apps/api/src/services/byok-service.ts
```
377-/**
378- * 10.8-2/3: per-user map of provider → discovered model ids. Tolerant of the
379- * column not existing yet (migration 0061 unapplied) — returns {} in that case
380: * so the read path falls back to the LiteLLM/static catalog.
381- */
382-export async function getDiscoveredModelsByProvider(userId: string): Promise<Record<string, string[]>> {
383-  const supabase = getSupabaseAdmin();
```

### ./apps/api/src/services/catalog.ts
```
1:// Sprint 10.8 → 10.9-A1 — Model catalog (OPTION B: no LiteLLM proxy).
2-//
3-// ARCHITECTURE NOTE (Phase 0 gate, 2026-06-04 — see sprint-10-9/PHASE_0_GATE.md):
4-// Goblin routes inference DIRECTLY to provider APIs (Anthropic / OpenAI SDKs),
5:// not through a LiteLLM proxy. There is no `litellm` npm dependency and no
6:// functioning proxy service. "LiteLLM" survives only as a *concept* (OpenAI-style
7-// schema + per-provider adapters / slug prefixes), NOT as a /v1/models source.
8-//
9-// Source-of-truth split:
--
15-//
16-// The dead `GET /v1/models` proxy sync (10.8-1) was retired here in 10.9-A1: it
17-// targeted an endpoint that does not exist in this architecture and silently
18:// no-op'd into the static fallback. `syncFromLiteLLM` is kept as a retired no-op
19-// so its callers keep compiling; the real refresh path is the per-user
20-// provider-discovery refresh (10.9-2).
21-
--
26-import { isFreeApiPoolEnabled } from './model-router';
27-
28-// ── Provider derivation ──────────────────────────────────────────────────────
29:// LiteLLM serves model ids either prefixed ("anthropic/claude-...", "gemini/...")
30-// or bare ("gpt-4o"). Map back to a Goblin ProviderId via the configured prefix,
31-// then fall back to owned_by, then to a sensible default.
32-const PREFIX_TO_PROVIDER: Record<string, ProviderId> = Object.fromEntries(
33-  Object.values(PROVIDERS)
34:    .filter((p) => p.litellmPrefix)
35:    .map((p) => [p.litellmPrefix.replace(/\/$/, ''), p.id]),
36-) as Record<string, ProviderId>;
37-
38-const OWNED_BY_TO_PROVIDER: Record<string, ProviderId> = {
--
70-  return 'custom';
71-}
72-
73:// Capability heuristics — LiteLLM /v1/models rarely returns rich capability data,
74-// so we infer from the id. Conservative: everything is chat-capable.
75-export function deriveCapabilities(id: string): Record<string, boolean> {
76-  const lid = id.toLowerCase();
--
95-
96-export interface SyncResult {
97-  ok: boolean;
98:  source: 'litellm' | 'skipped' | 'error' | 'provider-discovery';
99-  discovered: number;
100-  upserted: number;
101-  disabled: number;
--
103-}
104-
105-/**
106: * RETIRED in 10.9-A1 (OPTION B). The LiteLLM `GET /v1/models` proxy sync this
107- * used to perform targeted an endpoint that does not exist in this architecture
108- * (see the file header + sprint-10-9/PHASE_0_GATE.md). It is now a no-op so the
109- * boot hook and the admin endpoint keep compiling. The real refresh of what each
110- * key unlocks is the per-user provider-discovery refresh (10.9-2,
111- * `refreshAllUserDiscovery`). DO NOT re-introduce a /v1/models fetch here.
112- */
113:export async function syncFromLiteLLM(_opts: { force?: boolean } = {}): Promise<SyncResult> {
114-  return {
115-    ok: true,
116-    source: 'skipped',
117-    discovered: 0,
118-    upserted: 0,
119-    disabled: 0,
120:    reason: 'retired in 10.9-A1 — no LiteLLM proxy in this architecture; catalog source is per-user provider-discovery',
121-  };
122-}
123-
--
227-    if (isConnected && discovered.length > 0) {
228-      // Real, user-specific list.
229-      for (const id of discovered) {
230:        const slug = id.includes('/') ? id : `${p.litellmPrefix}${id}`;
231-        const dbMatch = (cachedByok.get(p.id) ?? []).find((s) => s.slug === slug || s.slug.endsWith(`/${id}`));
232-        push({
233-          id, name: dbMatch?.name ?? humanizeName(id), slug, provider: p.id, layer: 'byok',
--
303-}
304-
305-/**
306: * Boot-time trigger — RETIRED in 10.9-A1. There is no LiteLLM proxy to sync from
307- * on boot (OPTION B). Kept as a no-op so the import in index.ts keeps compiling.
308- * Per-user discovered_models is populated on key-add (byok-service) and refreshed
309- * daily by the provider-discovery cron (10.9-2).
```

### ./apps/api/src/services/digest.ts
```
2-//
3-// Composed from catalog_sync_log + provider_health_events over the past week.
4-// Posted to DISCORD_OPS_WEBHOOK_URL; if that is unset, written to a file under
5:// sprint-10-9/ as evidence (never fails). OPTION B: there is no litellm library,
6-// so the digest reports "catalog source: per-user provider-discovery" with no
7-// library-version line.
8-
--
98-  const lines: string[] = [];
99-  lines.push(`**🗓️ Goblin Ops — Wochenreport ${fmt(weekStart)} → ${fmt(weekEnd)}**`);
100-  lines.push('');
101:  lines.push('**Katalog-Quelle:** per-user Provider-Discovery (kein LiteLLM-Proxy, kein Library-Version-Bump — OPTION B)');
102-  lines.push('');
103-  lines.push('**Katalog-Änderungen (Woche)**');
104-  lines.push(`• Modelle neu entdeckt: **${totals.added}**`);
```

### ./apps/api/src/services/goblin-hosted.test.ts
```
28-  type GoblinChatParams,
29-} from './goblin-hosted';
30-import { GOBLIN_DAILY_GUARD } from '../lib/goblin-cap';
31:import { GoblinError } from './litellm-client';
32-
33-// ─── Deterministic mock of the wholesale provider ──────────────────────────────
34-
--
108-  delete process.env.GOBLIN_HOSTED_BASE_URL;
109-  delete process.env.GOBLIN_HOSTED_MODEL_EFFICIENT;
110-  delete process.env.GOBLIN_HOSTED_MODEL_PREMIUM;
111:  delete process.env.LITELLM_BASE_URL;
112-}
113-
114-afterEach(() => {
```

### ./apps/api/src/services/goblin-hosted.ts
```
33- */
34-
35-import OpenAI from 'openai';
36:import { GoblinError } from './litellm-client';
37-import { envFlag } from '../lib/env-value';
38-
39-export type GoblinTierId = 'goblin/efficient' | 'goblin/premium';
```

### ./apps/api/src/services/litellm-client.ts
```
1:// LiteLLM proxy client — optional, falls back to direct API if LITELLM_BASE_URL not set
2:// LiteLLM docs: https://docs.litellm.ai/docs/
3-
4-export class GoblinError extends Error {
5-  constructor(public code: 'rate_limit' | 'invalid_key' | 'model_not_found' | 'provider_down' | 'timeout' | 'unknown' | 'decryption_error', message: string) {
--
12-  return e instanceof GoblinError;
13-}
14-
15:function getLiteLLMBase(): string | null {
16:  const raw = process.env.LITELLM_BASE_URL;
17-  if (!raw) return null;
18-  return raw.startsWith('http') ? raw.replace(/\/$/, '') : `https://${raw.replace(/\/$/, '')}`;
19-}
--
22-function mapError(status: number, body: string): GoblinError {
23-  if (status === 429) return new GoblinError('rate_limit', 'Rate limit reached for this provider');
24-  if (status === 401 || status === 403) return new GoblinError('invalid_key', 'Invalid or expired API key');
25:  if (status === 404) return new GoblinError('model_not_found', 'Model not found in LiteLLM');
26-  if (status >= 500) return new GoblinError('provider_down', `Provider error (${status})`);
27-  return new GoblinError('unknown', `Request failed (${status}): ${body.slice(0, 200)}`);
28-}
--
40-}
41-
42-/**
43: * Stream completions via LiteLLM proxy.
44: * Falls back to null (caller uses direct SDK) if LITELLM_BASE_URL not set.
45- */
46:export async function* litellmStream(
47-  model: string,
48-  messages: ChatMessage[],
49-  options: { apiKey?: string; timeout?: number; signal?: AbortSignal } = {},
50-): AsyncGenerator<StreamDelta> {
51:  const base = getLiteLLMBase();
52-  if (!base) return; // Signal: use direct SDK
53-
54-  const controller = new AbortController();
--
56-  // Propagate caller's cancellation (e.g. client disconnect) to the provider request.
57-  options.signal?.addEventListener('abort', () => controller.abort());
58-
59:  // Authenticate to LiteLLM with master key; pass provider API key in body for BYOK routing
60:  const masterKey = process.env.LITELLM_MASTER_KEY;
61-  const authHeader = masterKey ? `Bearer ${masterKey}` : (options.apiKey ? `Bearer ${options.apiKey}` : undefined);
62-
63-  let response: Response;
--
73-        messages,
74-        stream: true,
75-        stream_options: { include_usage: true },
76:        // Pass user's provider key so LiteLLM forwards it to the actual provider
77-        ...(masterKey && options.apiKey ? { api_key: options.apiKey } : {}),
78-      }),
79-      signal: controller.signal,
--
83-    if ((err as { name?: string }).name === 'AbortError') {
84-      throw new GoblinError('timeout', 'Request timed out');
85-    }
86:    throw new GoblinError('provider_down', 'Failed to reach LiteLLM');
87-  }
88-
89-  if (!response.ok || !response.body) {
--
127-  }
128-}
129-
130:/** Validate a provider key via LiteLLM (or skip if not configured). */
131:export async function validateKeyViaLiteLLM(provider: string, key: string): Promise<boolean> {
132:  const base = getLiteLLMBase();
133:  if (!base) return true; // Can't validate without LiteLLM, trust the key
134-
135-  try {
136-    const res = await fetch(`${base}/chat/completions`, {
```

### ./apps/api/src/services/model-router.ts
```
20-import { derivePlanTruth } from '../lib/plan-truth';
21-import { withCompExpiry } from '../lib/comp-expiry';
22-import { PROVIDERS, PROVIDER_BASE_URLS, type ProviderId } from '../config/providers';
23:import { GoblinError, isGoblinError, litellmStream } from './litellm-client';
24-import { formatTokenDisplay } from '../config/pricing';
25-import { trackCompletion } from '../lib/track-completion';
26-import { insertPlatformEvent } from '../lib/platform-events';
--
47-  // model id), while `model`/`modelSlug` stay the Goblin tier id — so the provider
48-  // slug NEVER reaches the browser or the DB (two-level truth, HR-6).
49-  apiModel: string;
50:  // LiteLLM-native model name for pass-through routing (provider/model format)
51:  litellmModel: string;
52-  // The Goblin tier (only set for layer === 'goblin_hosted').
53-  goblinTier?: GoblinTierId;
54-}
--
61-  baseURL: string;
62-  model: string;
63-  slug: string;
64:  // LiteLLM-native model identifier (provider/model format for pass-through routing)
65:  litellmModel: string;
66-}
67-
68-// FREE_API_POOL (Goblin-owned keys) is intentionally disabled — Strategy V1 C-8 fix.
--
177-  return null;
178-}
179-
180:// Goblin-internal tier-tagged slugs → LiteLLM-native model identifier
181-// "free/" prefix is tier metadata, not a provider — strip and map to real provider model
182:const FREE_SLUG_TO_LITELLM: Record<string, { provider: ProviderName; litellm: string }> = {
183:  'free/gemini-flash':    { provider: 'google',  litellm: 'gemini/gemini-1.5-flash' },
184:  'free/groq-llama':      { provider: 'groq',    litellm: 'groq/llama-3.3-70b-versatile' },
185:  'free/openrouter-free': { provider: 'openrouter', litellm: 'openrouter/meta-llama/llama-3.3-70b-instruct:free' },
186-};
187-
188:function resolveFreeSlug(slug: string): { provider: ProviderName; litellm: string } | undefined {
189:  return FREE_SLUG_TO_LITELLM[slug];
190-}
191-
192-// Map modelSlug prefix to provider
--
208-function slugToModelId(slug: string): string {
209-  const free = resolveFreeSlug(slug);
210-  if (free) {
211:    // strip provider prefix from litellm slug: 'gemini/gemini-1.5-flash' → 'gemini-1.5-flash'
212:    const parts = free.litellm.split('/');
213-    return parts.slice(1).join('/');
214-  }
215-  const parts = slug.split('/');
--
234-    model: tierId,
235-    modelSlug: tierId,
236-    apiModel: providerModel,
237:    litellmModel: `openai/${providerModel}`,
238-    goblinTier: tierId,
239-  };
240-}
--
379-    const defaultModel = providerCfg?.models[0]?.id ?? 'gpt-4o';
380-    const resolvedModel = modelId ?? defaultModel;
381-    const slug = preferredModel ?? `${byok.provider}/${resolvedModel}`;
382:    // free/ slugs are Goblin-internal tier tags — translate to real provider/model for LiteLLM
383-    const free = preferredModel ? resolveFreeSlug(preferredModel) : undefined;
384:    const litellmModel = free?.litellm ?? slug;
385-    return {
386-      layer: 'byok',
387-      provider: byok.provider,
--
390-      model: resolvedModel,
391-      modelSlug: slug,
392-      apiModel: resolvedModel,
393:      litellmModel,
394-    };
395-  }
396-
--
405-      model: free.model,
406-      modelSlug: free.slug,
407-      apiModel: free.model,
408:      litellmModel: free.litellmModel, // provider-prefixed for LiteLLM pass-through
409-    };
410-  }
411-
--
514-    ...chatHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
515-    { role: 'user' as const, content: message },
516-  ];
517:  // OpenAI-compatible providers (incl. LiteLLM + the Goblin-hosted wholesale
518-  // endpoint) take the system prompt as a leading system message; Anthropic
519-  // takes it as the dedicated `system` param below.
520-  const oaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = systemPrompt
--
585-    .insert({ user_id: userId, project_id: projectId, model_used: route.model, source_tier: route.layer, status: 'running' })
586-    .select().single();
587-
588:  // Try LiteLLM first if configured. The Goblin-hosted tier always uses its own
589:  // injectable client (never the optional LiteLLM proxy) so the wholesale provider
590-  // call path stays single-source and deterministically testable.
591:  const litellmBase = route.layer === 'goblin_hosted' ? undefined : process.env.LITELLM_BASE_URL;
592:  if (litellmBase) {
593-    try {
594:      for await (const delta of litellmStream(route.litellmModel, oaiMessages, { apiKey: route.apiKey, timeout: timeoutMs, signal })) {
595-        if (delta.type === 'delta' && delta.content) {
596-          yield JSON.stringify({ type: 'delta', content: delta.content });
597-        } else if (delta.type === 'usage') {
--
645-  // model id exactly as the provider's own /models endpoint returned it
646-  // (provider-discovery → byok_keys.discovered_models, prefix stripped by
647-  // slugToModelId). Send it to the provider VERBATIM. Do NOT canonicalize it to a
648:  // "LiteLLM-canonical" name or guess an alias here — when Goblin talks directly
649-  // to a provider, the provider only accepts its own slug. A provider
650-  // "model not found / invalid model" error is a slug failure: it must surface
651-  // (and feed the 10.9-3 circuit breaker), never be silently rewritten.
```

### ./apps/api/src/services/provider-discovery.ts
```
4-// the key actually unlocks. The result is cached on byok_keys.discovered_models
5-// so the ModelPicker can show the real list per user instead of a hardcoded
6-// promise. All providers below expose a /models endpoint; the one exception
7:// (none currently) would fall back to the LiteLLM catalog filtered by provider.
8-//
9-// This mirrors the endpoints byok-service.validateKey() already probes, but
10-// parses the body instead of only checking the status code.
```

### ./apps/web/app/status/page.tsx
```
100-const SERVICE_LABELS: Record<string, string> = {
101-  supabase: 'Database (Supabase)',
102-  storage: 'File Storage',
103:  litellm: 'AI Proxy (LiteLLM)',
104-  stripe: 'Payments (Stripe)',
105-};
106-
```

### ./apps/web/components/chat/ChatInput.tsx
```
426-const MODEL_STORAGE_KEY = 'goblin:last-model';
427-
428-// Sprint 9.5: default new users to the working Groq model. The free Gemini model
429:// is broken in the prod LiteLLM proxy; Groq Llama 3.3 70B works end-to-end and is
430-// now the onboarding-recommended provider. The first-BYOK auto-select below still
431-// applies once the user connects any key.
432-// F5-1 (DD §C): when the Goblin-bundled pool is live, the keyless default is Goblin
```

### ./apps/web/lib/friendly-error.ts
```
1-// Sprint 9 P1: turn raw backend/model errors into plain, jargon-free copy.
2:// The model layer surfaces developer strings like "Model not found in LiteLLM"
3-// and "LLM Provider NOT provided" straight to the UI — fatal for non-dev users
4-// (Max). This maps known failure shapes to calm copy and scrubs any internal
5-// component names from anything that slips through.
--
12-import { readLang } from './use-lang';
13-
14-const RULES: Array<{ test: RegExp; de: string; en: string }> = [
15:  // model unavailable / misconfigured (LiteLLM "model not found", wrong provider prefix, etc.)
16:  { test: /litellm|model not found|provider not provided|no such model|unknown model|invalid model/i,
17-    de: 'Dieses KI-Modell ist gerade nicht verfügbar. Wähle oben ein anderes Modell und versuch es nochmal.',
18-    en: "This AI model isn't available right now. Pick another model above and try again." },
19-  // missing / invalid key
--
41-
42-// Tokens that should never reach a user; if a leftover message contains one,
43-// fall back to a generic line instead of showing internals.
44:const JARGON = /litellm|byok|endpoint|provider|traceback|stack|undefined|null|\bSQL\b|supabase|railway|hono/i;
45-
46-export function friendlyError(raw: unknown, fallback?: string): string {
47-  const lang = readLang();
```

### ./docs/ACT2_CARRY_FORWARD.md
```
156-| **K4** | **`G-P5-1` — ab 209 aktiven Apps reicht der 5-%-Anteil nicht mehr.** Der Takt liegt dann auf der 60-Minuten-Decke und das Budget ist überschritten. Der Läufer meldet `overBudget`, die Konsole zeigt es, still überzogen wird nichts. Drei Wege, alle mit Konsequenz: Anteil erhöhen · Workers Paid $5/Monat (löst zugleich **P6**/**G-P4-1**) · Takt strecken und die Zusage mitverschieben. | `ACT2_PHASE5_DECISIONS.md` § Eskalation · `cadenceFor` in `ops-check-budget.ts` | **GRÜNDER-KENNTNISNAHME 2026-08-14: wie berichtet angenommen, nicht blockierend** — die PR wurde in Kenntnis dieser Zeile gemergt. **Auslöser: die 209. aktive App**, oder früher, sobald `overBudget` in der Konsole auftaucht. Bis dahin folgenlos; die Beta hat eine Handvoll Apps. |
157-| **K5** | **Ein Zeitüberschreitung-Fehler ist UNBEKANNT, kein Ausfall — auch wenn die App wirklich tot ist.** `classifyTransportFailure` zählt nur eindeutige Netzantworten (NXDOMAIN, abgelehnt, TLS) als gemessenen Fehlschlag; Timeouts und `EAI_AGAIN` könnten genauso gut **an uns** liegen. Eine tote App mit langsamem DNS liest sich deshalb als UNBEKANNT statt als „nicht erreichbar". **Bewusste Richtung** (lieber blind als falsch behauptend), aber sie hat einen Preis: Untererkennung. | `classifyTransportFailure` in `ops-check-runner.ts` | Wenn ein echter Ausfall im Fenster als UNBEKANNT gemeldet wird. Dann ist die Frage, ob der Betreiber-Blick auf UNBEKANNT scharf genug ist — nicht, ob die Klassifizierung gelockert wird. |
158-| **K6** | **Es gibt keine Verdichtung der Prüfhistorie.** Beschnitten wird auf 8 Tage (P5-e), also ist nach dem Beschneiden **keine** Aussage über mehr als 7 Tage mehr berechenbar. Phase 7 (Wochenbericht) braucht möglicherweise eine längere Reihe — die wäre ein eigener Unit (Tagesaggregate), hier ausdrücklich **nicht** gebaut. | `CHECK_RETENTION_DAYS` in `ops-checks-store.ts` | **Vor Phase 7**, falls dort eine Reihe über mehr als eine Woche gebraucht wird. |
159:| **K7** | **Die Plattform-Prüfung `api` ist schwächer, als sie aussieht.** Der Läufer sitzt im selben Prozess wie die API, die er über ihre öffentliche Adresse abfragt. Belegt sind damit DNS, Proxy und „der Prozess antwortet" — **nichts** über innere Abhängigkeiten (Supabase, Storage, LiteLLM), die `/health/deep` prüft und diese Zeile nicht. Steht so auch in der Konsole. | `ops-check-runner.ts` (Plattform-Abschnitt) · Konsolen-Text `checks.apiNote` | Dauerhaft, als **Lesehilfe**. Die eigentliche Konsolidierung des Monitorings ist mit dieser Phase **begonnen**, nicht abgeschlossen — siehe Phase-5-Bericht. |
160-| **K8** | **Keine Screenshots der neuen Karten.** Dieselbe Ursache wie **B3**/**E5**: das Konsolen-Harness braucht einen Browser-Pfad, und die Besitzer-Karte hängt an einer angemeldeten Sitzung hinter `opsGate`. Der **Wortlaut** ist statt dessen direkt getestet, einschließlich der Eigenschaft „kein Zustand ohne Messzeitpunkt" — die **Farben** sind es nicht. | `evidence/akt2-phase5/README.md` | Wenn eine Farbaussage gebraucht wird. Für Wortlaut und Verhalten trägt der Beleg. |
161-| **K9** | **Die Cron-Trigger-Decke ist 5 (Free), nicht 250 (Paid).** Der Phase-5-Prompt nannte 250; `OPS_SPIKE_0_DECISION_TABLE.md` §2 (Abruf 2026-07-25) sagt **5 (Free) / 250 (Paid)**, und Goblin fährt Workers **FREE**. Damit bricht Spike-Befund **F2** („ein Cron pro App skaliert nicht“) **bei fünf Apps**, nicht bei 250 — eine Größenordnung dringender, als der Prompt annahm. **Phase 5 hat daraufhin 0 von 5 Triggern verbraucht** (der Fan-out läuft im Railway-Prozess), die Zeile ist also heute **folgenlos** — sie steht hier als **Sprachregel und Planungszahl**, weil „250“ in einem späteren Prompt oder Plan wieder auftauchen wird. | `OPS_SPIKE_0_DECISION_TABLE.md` §2 und §F2 · Kopfkommentar von `ops-check-budget.ts` · Ledger **M-K1** | **GRÜNDER-KENNTNISNAHME 2026-08-14: wie berichtet angenommen, nicht blockierend.** Fällig, **sobald irgendeine Phase einen Cloudflare-Cron-Trigger anlegen will** — dann sind es fünf, nicht 250, und der Entwurf muss das voraussetzen. Mit **C4** neu zu prüfen, falls auf Workers Paid gewechselt wird (dann gilt 250 wirklich). |
```

### ./docs/AKT2_PHASE5_REPORT.md
```
277-**Was fehlt, damit man „geschlossen" sagen darf:**
278-
279-1. **`/health/deep` ist nicht eingebunden.** Die `api`-Prüfung fragt `/health` von außen und belegt
280:   nichts über Supabase, Storage oder LiteLLM. (**K7**)
281-2. **Kein Alarm.** Wird Goblin selbst rot, sieht das nur, wer die Konsole öffnet. Benachrichtigung
282-   ist Phase 6, der wiederkehrende Bericht Phase 7.
283-3. **Kein Verlauf über eine Woche hinaus.** (**K6**)
```

### ./docs/ENV_REFERENCE.md
```
97-### Optional, grouped
98-
99-The long tail — Layer-2 hosted models (`GOBLIN_HOSTED_API`, `DEEPINFRA_API_KEY`,
100:`GOBLIN_HOSTED_MODEL_*`), LiteLLM (`LITELLM_*`), agent concurrency and runtime knobs
101-(`AGENT_*`, plus `CHAT_MAX_RUNTIME_MS` — the chat twin of `AGENT_MAX_RUNTIME_MS`, which
102-bounds a turn whose reader disconnected), rate-limit caps (`SEARCH_DAILY_CAP`, `PUBLISHES_PER_HOUR`,
103-`ATTACHMENT_BYTES_PER_DAY`), eval runner (`EVAL_*`), digests
```

### ./docs/L2_PIVOT_SESSION1_REPORT.md
```
28-- Version bumped v6.0→v6.1 (April→June 2026) + changelog at top.
29-
30-## Phase 4 — Code scaffold (behind `GOBLIN_HOSTED_API`, no live calls)
31:- **Provider abstraction** — `apps/api/src/services/goblin-hosted.ts` refactored in place: API-first, server-side-keyed (inverse of BYOK), flag `GOBLIN_HOSTED_API`, OpenAI-compatible endpoint via LiteLLM **library** (no proxy). `model-router.ts` Layer-2 block updated to the new config + tier resolution. Unreachable while flag off.
32-- **Model branding** — two Goblin-named tiers (`goblin/efficient` default, `goblin/premium` upsell) → provider-agnostic model IDs via env. Placeholder display names ("Goblin Swift" / "Goblin Forge"). Mirrored in `apps/web/lib/goblin-hosted-models.ts`. Pricing rows added (`model-pricing.ts`).
33-- **Cap data model** — `supabase/migrations/0067_goblin_hosted_token_rollup.sql` (per-user monthly goblin_hosted token rollup view, `security_invoker`, built on `completion_costs`). **File only — NOT applied.**
34-- **Usage bar** — `apps/web/components/usage/GoblinUsageBar.tsx`, design-system tokens (HR-13), EN/DE. Flag OFF → neutral "coming soon" empty state, no cap implication. Flag ON → renders a `CapStatus`.
```

### ./docs/NAV_MAP_L2_PIVOT.md
```
25-| Line (EN/DE) | Current text (abbrev) | Proposed change | Surface | Risk |
26-|---|---|---|---|---|
27-| 95 / 490 `stack.l2Body1` | "…hosted on dedicated GPU capacity Goblin **rents and routes**…" | Drop GPU-rental mechanism. "…curated, Goblin-bundled coding models — managed inference, bundled into your subscription. No API key. No per-token counter. No metered cutoff." | PUBLIC | med |
28:| 97 / 492 `stack.l2Body2` | "Today: LiteLLM… **Tomorrow (Q1 2027): Goblin-owned GPU pool on Clore.ai**…" | Remove Clore.ai + Q1 2027 GPU-pool promise. Reframe: managed bundled inference today, provider-agnostic, scales without per-token anxiety. | PUBLIC | med |
29-| 76 / 471 `problem.walls[3].body` | "…we own the **substrate**, not the inference. Same Layer 2 inference…" | Keep region-pricing point; soften "own the substrate" → "we manage the inference, you don't meter it." Provider-agnostic. | PUBLIC | low |
30-| 191 / 588 `whyNow.b1Body2` | "…**rented GPUs**… 70-80% gross margin… **fully-loaded GPU rental**…" | Public econ framing without GPU mechanism: managed open-source-class inference now a fraction of frontier API cost; bundled economics work. Keep the "window" thesis. | PUBLIC | med |
31-| 252 / 651 `pricing.metrics[2].explain` | "once we **run our own GPUs from Q1 2027**" | "from managed, bundled inference economics" (provider-agnostic). | PUBLIC | low |
--
86-| 249, 308 | **Fly.io** | **Railway** (Hono API) |
87-| 223–224, 250–252, 304, 514–515, 526 | Clore.ai / Vast.ai / vLLM GPU rows | API-first (see §5); keep one "GPU buildout — deferred" note |
88-
89:Leave untouched: Supabase, Vercel, Cloudflare, Stripe, Resend, LiteLLM.
90-
91----
92-
```

### ./evidence/webhook-hardening/UPTIMEROBOT_SETUP.md
```
2-
3-`GET /health` returns **200** (verified — `apps/api/src/routes/health.ts:9`, runtime-checked
4-in this sprint). It is a cheap liveness probe: no auth, no DB dependency on the root path
5:(the DB/storage/LiteLLM checks live on `/health/deep`, which can 503 — do NOT point the
6-uptime monitor at `/deep`, only at the root `/health`).
7-
8-Wiring an **external** monitor closes the ticket-#12 blind spot: "Railway down and nobody
```

### ./infra/litellm/config.yaml
```
1-model_list:
2-  # Free Pool — Goblin's own keys, registered as virtual models
3-  - model_name: free/llama-70b
4:    litellm_params:
5-      model: groq/llama-3.3-70b-versatile
6-      api_key: os.environ/GROQ_FREE_API_KEY
7-
8-  - model_name: free/llama-70b-cerebras
9:    litellm_params:
10-      model: cerebras/llama-3.3-70b
11-      api_key: os.environ/CEREBRAS_FREE_API_KEY
12-
13-  - model_name: free/gemini-flash
14:    litellm_params:
15-      model: gemini/gemini-2.0-flash
16-      api_key: os.environ/GOOGLE_FREE_API_KEY
17-
18-  - model_name: free/deepseek
19:    litellm_params:
20-      model: openrouter/deepseek/deepseek-chat
21-      api_key: os.environ/OPENROUTER_FREE_API_KEY
22-
23-  # BYOK pass-through — model name is provider-prefixed, api_key comes from request body
24:  # LiteLLM natively routes anthropic/, openai/, groq/, etc. prefixes
25:  # No explicit config needed; LiteLLM uses api_key from request body for auth
26-
27-general_settings:
28:  master_key: os.environ/LITELLM_MASTER_KEY
29-
30:litellm_settings:
31-  drop_params: true
32-  set_verbose: false
33-  cache: false
```

### ./sprint-10-9/PHASE_0_GATE.md
```
1-# Sprint 10.9 — Phase 0 Architecture Gate
2-
3-**Date:** 2026-06-04
4:**Decision:** **OPTION B** (no `litellm` npm dep; per-user provider-discovery is the routing source-of-truth)
5-**Stop-condition (d) — REAL reachable proxy found?** NO. A proxy instance is reachable but is an empty/unconfigured shell that cannot route. Premise of the 10.9 revision **holds**. Proceed with Option B.
6-
7----
--
13-- `resolveModel()` (`:189`) picks a BYOK key + provider baseURL from
14-  `config/providers.ts`. No proxy involved in resolution.
15-- `streamCompletion()` (`:272`) has **two** paths:
16:  - **Proxy path** (`:308-342`): only runs `if (process.env.LITELLM_BASE_URL)`.
17:    Calls `litellmStream()` → `POST {base}/chat/completions`.
18-  - **Direct SDK path** (`:344-373`): the default. Anthropic via
19-    `@anthropic-ai/sdk` (`new Anthropic({ apiKey })`, `:347`), everything
20-    else via `openai` SDK with the **provider's own baseURL**
--
24-env-gated and, even when the env var is set, points at a dead proxy
25-(see below) that 400s every model — a `code:'unknown'` GoblinError
26-that `:336` *re-throws* rather than falling through. Production must
27:therefore run with `LITELLM_BASE_URL` **unset** (Groq routing works in
28-prod per Sprint-9/10 memory; an empty proxy would reject it). Confirmed
29-DIRECT.
30-
31:## CHECK 2 — LiteLLM dependency: NOT FOUND → OPTION B
32-
33-`apps/api/package.json` dependencies + devDependencies (`:15-51`):
34:no `litellm` package. Present instead: `@anthropic-ai/sdk ^0.27.0`
35:(`:16`), `openai ^4.52.0` (`:30`). The file `services/litellm-client.ts`
36:is a hand-written *optional proxy client*, **not** the litellm library;
37:there is no `node_modules/litellm`, no `model_prices_and_context_window.json`.
38-
39:**Finding:** no litellm library to update (10.9-1 N/A) and no
40-`model_cost` map to import (Option C not viable). → **OPTION B**.
41-
42-## Proxy reachability probe (the decisive stop-(d) test)
43-
44:`LITELLM_BASE_URL=litellm-production-6ba8.up.railway.app` appears only
45-in `.env.local` (not `.env.example` as an active value). Probed it:
46-
47-| Request | Result |
--
53-| `GET /model/info` (master key) | HTTP 500 `"LLM Model List not loaded in. Make sure you passed models in your config.yaml"` |
54-| `POST /chat/completions {model:"groq/llama-3.3-70b-versatile"}` | HTTP 400 `"Invalid model name ... Call /v1/models to view available models for your key."` |
55-
56:**Conclusion:** a LiteLLM proxy is *deployed* but has **no `model_list`
57-loaded** — even authenticated with the master key it serves zero models
58-and cannot route any completion. It is functionally dead. This is NOT a
59-"real reachable proxy" in the sense of stop-condition (d): no inference
60-can flow through it. It corroborates the revision premise — the dynamic
61-`/v1/models` catalog path has never produced anything (empty response →
62:`syncFromLiteLLM` returns `error: "empty LiteLLM response"` → static
63-fallback), and routing is direct.
64-
65-## Branch consequences for the remaining items
--
68-  (no-op it with a clear comment). provider-discovery = routing source.
69-- **10.9-A2**: `config/providers.ts` static lists become explicitly
70-  DISPLAY-ONLY (hand-maintained), never a routing source.
71:- **10.9-1**: **STRIKE** — no litellm dep to auto-update. N/A under Option B.
72-- **10.9-2**: "Daily Per-User Provider-Discovery Refresh" (re-validate
73-  keys, refresh `discovered_models`, mark dead keys, don't delete).
74-- **10.9-3 / -4 / -5 / -6**: unchanged scope; digest/admin content
75:  reflects "catalog source: per-user discovery" (no litellm-version line).
76-
77-## Founder follow-up (recommended, not blocking)
78-
79:- Remove the dead `LITELLM_BASE_URL` line from `.env.local` (it would
80-  break local chat if the API loads it: every completion would 400/throw).
81:- Decommission the empty `litellm-production-6ba8.up.railway.app`
82-  Railway service — it is unhealthy and serves nothing.
```

### ./supabase/migrations/0061_dynamic_catalog.sql
```
3-
4--- ── models table: provenance + freshness + capabilities ──────────────────────
5-ALTER TABLE models ADD COLUMN IF NOT EXISTS discovered_via TEXT
6:  DEFAULT 'manual';                       -- 'litellm' | 'provider_api' | 'manual'
7-ALTER TABLE models ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
8-ALTER TABLE models ADD COLUMN IF NOT EXISTS capabilities JSONB
9-  DEFAULT '{}'::jsonb;                     -- { chat, vision, function_calling, ... }
--
16-  ) THEN
17-    ALTER TABLE models
18-      ADD CONSTRAINT models_discovered_via_check
19:      CHECK (discovered_via IN ('litellm', 'provider_api', 'manual'));
20-  END IF;
21-END $$;
22-
```

### ./supabase/migrations/0062_catalog_sync_log.sql
```
4-CREATE TABLE IF NOT EXISTS catalog_sync_log (
5-  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
6-  synced_at    TIMESTAMPTZ DEFAULT now(),
7:  source       TEXT NOT NULL,            -- 'litellm' | 'provider-discovery' | 'manual' | 'cron'
8-  added        INTEGER DEFAULT 0,        -- models newly discovered across users
9-  updated      INTEGER DEFAULT 0,        -- keys re-validated
10-  deactivated  INTEGER DEFAULT 0,        -- keys now-invalid (NOT deleted)
```

### ./tests/e2e/17-magic-link-byok-trial.spec.ts
```
177-    }
178-
179-    // Core verification: BYOK key is decrypted and routing tier is byok.
180:    // (Downstream LiteLLM model config may produce an error event — that is a separate issue
181-    // from encryption/routing which is what this test verifies.)
182-    expect(metaSourceTier).toBe('byok');
183-  });
```

### ./tests/security/chat-secret-isolation.mjs
```
30-  'apps/api/src/routes/chat.ts',
31-  'apps/api/src/routes/chat-sessions.ts',
32-  'apps/api/src/services/model-router.ts',
33:  'apps/api/src/services/litellm-client.ts',
34-];
35-
36-// Patterns that indicate the file is reaching into the secret vault.
```

