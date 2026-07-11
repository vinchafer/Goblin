# WAVE-D — Sicherheit vor Menschen · Security Audit & Findings Register
**Branch `claude/wave-d-security-7whp2y` · base `origin/master` @ 7f351d2 · 2026-07-11 · Opus (Runbook-2, no live review)**

Every attack vector tested, its result, and the fix commit or the founder-gated ticket.
"Fixed" means an adversarial test exists and was re-run green. Vectors needing a paid
service, a live 2-user DB, or an auth-flow change are presented as decision/founder gates
per the OS §4 escalation table — **not decided here**.

Verification legend: **FIXED** (code + adversarial test, suite re-run green) · **VERIFIED-SAFE**
(audited, already correct, evidence cited) · **FOUNDER-GATE** (needs a decision/secret/live
env this session must not touch) · **TICKET** (real gap, fix is >1 commit or an auth-flow change).

---

## D-1 — Agent tool sandbox  → **FIXED** (commit `4b39023`)

Attack surface: the agent's `read_file`/`write_file` `path` arg, and every path that
reaches object storage via `save_draft`/`publish` → `uploadFile` → `storageKey`.

| Vector | Before | After | Evidence |
|---|---|---|---|
| Path traversal `../`, `a/b/../../x` | path used verbatim; safe only by S3's literal-key accident | denied (`traversal`), no storage touch, no draft row | `project-path.test.ts`, `tools.security.test.ts`, `file-storage.security.test.ts` |
| Absolute `/etc/passwd`, drive `C:/`, home `~/` | verbatim | denied (`absolute`/`drive_letter`/`home_expansion`) | `project-path.test.ts` |
| Encoded separators `..%2f`, `%2e%2e`, backslash `..\..\` | verbatim | denied (`encoded_separator`/`backslash`) | `project-path.test.ts`, `tools.security.test.ts` |
| Null byte / control char `x\x00y` (truncation) | verbatim | denied (`null_byte`) | `project-path.test.ts`, `tools.security.test.ts` |
| Cross-project escape via `../otherProject/index.html` | S3-literal (no collision) but backend-fragile | denied at `storageKey` choke-point; bystander project untouched | `file-storage.security.test.ts` |
| Cross-project via **id manipulation** | already blocked: run's `projectId` derives from an owned session (`ownSession` enforces `user_id`), never from user input | VERIFIED-SAFE | `code-sessions.ts:574`, `ownSession()` |
| Secret/platform files `.env`, `.env.*`, `.git/*`, `.ssh`, `.npmrc` | writable | denied (`forbidden_file`) at the agent write boundary | `tools.security.test.ts`, `project-path.test.ts` |
| Oversize write (500 MB) | capped at 500k (was present) | retained as named `WRITE_FILE_MAX_CHARS`, `too_large` | `tools.security.test.ts` |

Fix design: `apps/api/src/services/project-path.ts` — a pure canonicalizer (collapse `./`
and `//`, reject the vectors above, assert the composed key stays under the prefix). Wired
at TWO layers: the agent tools (honest German `invalid_path`/`forbidden_file` errors, no
storage touch) **and** `storageKey()` in `file-storage.ts` (throws `unsafe_path`), so no
caller — agent tools, file-explorer upload, templates, generator, cross-project move —
can compose an escaping key. 105 adversarial assertions; full API suite 619→ green.

---

## D-2 — Rate limits & abuse caps  → **FIXED** (commit `132ab04`)

| Limit | Before | After | Knob (default) | Evidence |
|---|---|---|---|---|
| Agent runs / hour | none (only global 60/min + token allowance) | **capped after eligibility** | `AGENT_RUNS_PER_HOUR` (30) | `code-sessions.ts`, `tools.security.test.ts` (publish sibling), `rate-limit.test.ts` |
| Publishes / hour (agent path) | none | **capped in `publish` tool** | `PUBLISHES_PER_HOUR` (20) | `tools.security.test.ts` |
| Builds / hour (deploy button) | 10/hr hardcoded, English copy | env-knobbed + German 429 | `BUILDS_PER_HOUR` (10) | `deploy.ts` |
| Attachment bytes / day | per-file 10 MB only | **per-user daily byte cap** (upload flood) | `ATTACHMENT_BYTES_PER_DAY` (100 MB) | `abuse-caps.test.ts` |
| Transcriptions / day (M8) | exists, hardcoded 30 | verified + made env-knobbable | `TRANSCRIBE_DAILY_CAP` (30) | audit |
| Web searches / day (M11) | exists (env `SEARCH_DAILY_CAP`=25, per-run `AGENT_MAX_SEARCHES`=3) | VERIFIED-SAFE, unchanged | — | `search/index.ts`, `tools.ts` |

All 429s now carry honest German copy ("Du gehst zu schnell …") + `Retry-After`; a denied
request never consumes budget; legitimate use under the threshold is unaffected (tested).
Reuses the hardened fixed-window limiter (`hitRateLimit`). Ledger updated same commit
(WAVE-D note: COGS-bounding, knobs + locations + billing side).

**Honest limitation (documented, founder-gated hardening):** the new count/byte counters
are **in-memory per-instance** — consistent with the existing M8/M11 caps, but they reset
on deploy and are not shared across replicas. The durable cross-replica upgrade (a DB
counter table, mirroring `soft-limits.ts` → `daily_request_counts` + an RPC) is an infra
decision (OS §4 "New dependencies / Security model"):

| Option | Effort | Cross-replica | Survives deploy | Recommendation |
|---|---|---|---|---|
| Keep in-memory (shipped) | 0 | ✗ | ✗ | fine for single-instance Phase 1 |
| DB counter table + RPC | ~1 migration + wiring | ✓ | ✓ | **recommended before horizontal scaling** |
| Redis limiter (`@hono-rate-limiter/redis`) | new dependency + infra | ✓ | ✓ | if Redis is adopted for other reasons |

→ **Founder gate:** adopt the DB-counter upgrade when scaling past one instance.

---

## D-3 — Secrets scrubbing  → **FIXED** (commit `c49484e`)

No secret may surface in a durable or client-visible sink. One scrubbing pass
(`apps/api/src/lib/scrub-secrets.ts`), two layers: **pattern** (sk-ant-/sk-/sk-or-/
sk_live_/whsec_/AIza/gsk_/xai-/fw-/re_/gh*_/GitHub PAT/JWT/Bearer) + **env-value** (exact
plaintext of DeepInfra, Brave, VAPID private, Stripe, Supabase service-role, master key,
… — the prefix-less crown-jewels).

| Sink | Injection test | Result |
|---|---|---|
| Structured logs (pino) | `scrub-secrets.test.ts` (formatter path) | value-blind gap closed via `formatters.log` — ~40 `logger.*` sites at once |
| `agent_runs.step_log` + `report` | `run-store.security.test.ts` | secret injected into step + modelText + failureReason → row shows only `[REDACTED]` |
| Chat history (`chat_messages`, `code_session_messages`) | code path | assistant/model output scrubbed before persist (`chat.ts`, `code-sessions.ts`) |
| Client error responses (SSE `type:error`) | `scrub-secrets.test.ts` (`safeErrorMessage`) | upstream 401 body echoing a key never reaches the browser verbatim |
| Deep/cyclic objects, ordinary prose | `scrub-secrets.test.ts` | nested secrets redacted, cycle-safe, prose ("token"/"key") untouched |

24 scrubber assertions + the agent_runs injection test. **Note (not re-consolidated
this wave):** three older per-file PII regex sets (`setup-buddy-agent.ts`,
`support-agent.ts`, `support-email.ts`) still cover only 3 prefixes; folding them onto the
new shared scrubber is a low-risk follow-up (TICKET, out of D-3's core sink scope).

---

## D-4 — BYOK & auth surface  → **VERIFIED-SAFE** (BYOK) · **FOUNDER-GATE** (RLS probe, #8/#9)

**BYOK encryption at rest — VERIFIED-SAFE.** App-level AES-256-GCM under a per-user KEK
stored in Supabase Vault (`byok-encryption.ts`, migration 0043). Keys are never returned
to the client (`listKeys` selects only a last-4 `key_hint`), never logged (decrypt audit
log stores provider/op/ip only, user id SHA-256-hashed). Lazy v1→v2 re-encrypt on read.
Auth-tag tamper detection. No change needed.

**Auth model — VERIFIED (app-level).** All API DB access uses the service-role client
(`getSupabaseAdmin`, RLS-bypassing); authorization is enforced in application code via
`.eq('user_id', userId)` ownership predicates (`ownProject`/`ownSession`,
`mgmt-ownership.test.ts`). RLS is enabled on every user-scoped content table (projects,
chat_messages, code_session_messages, byok_keys, project_state, agent_runs, code_sessions,
code_session_files, push_subscriptions) as **defense-in-depth** for any anon-key path;
support_tickets/feedback are service-role-only by design. The single point of failure is a
missing `.eq('user_id', …)` in app code — worth a standing lint/review, not a code change.

**RLS cross-read probe (D-4 gate) — FOUNDER-GATE (BLOCKED here).** The gate asks for a
two-test-user cross-read-denied probe. That requires a live Supabase project + the **anon
key** + two seeded users — a live secret + prod data this session must not touch (rider #3,
OS §1.7-8). Exact founder probe (run in Supabase SQL editor / a scratch script with the
anon key, NOT service-role):
1. Seed users A and B; as A insert a project row; note its id.
2. With B's JWT via the anon client: `select * from projects where id = '<A-project-id>'` → must return 0 rows.
3. Repeat for `chat_messages`, `byok_keys`, `agent_runs`, `code_session_files`, `project_state`.
4. Any row returned = an RLS hole → fix the policy. (App-level path already denies these via ownership checks.)

**Defect #8 (magic-link session) — TICKET (open).** Per `_sprint/feel-1/SPRINT_REPORT.md`
it is filed as a GitHub issue, not fixed. Audit corroboration (`hygiene-0705`,
`chat-io`): it is a **test-harness / PKCE-vs-implicit-hash** login-persistence limitation
(admin-minted implicit-hash link vs prod PKCE code-flow), **not a production auth bypass**.
Fixing/verifying needs the web auth flow + live login (Security-model class, OS §4) →
founder-gated, not a ≤1-commit in-session fix.

**Defect #9 (logout / token persistence) — TICKET (open).** Filed, not closed. Server-side
controls exist (`persistSession:false` on stateless clients; global `signOut(userId,
'global')` in `account.ts`). The specific client-token-persistence defect needs the web app
+ live auth to fix/verify → founder-gated.

---

## D-5 — Deletion & data-retention completeness  → **FIXED** (commit `d247d41`)

Audited every store a real user generates against `hardDeleteUser`. Two gaps found and
closed; everything else already purged (cascade or explicit) and idempotent/batched.

| Store | Status |
|---|---|
| projects + storage, chat history, agent_runs + steps, attachments, code_sessions/files, byok_keys, push_subscriptions, chat_sessions, build_runs, platform_events, support_tickets, feedback, users+auth | **purged** (cascade or explicit) — VERIFIED |
| **Provisioned backend / live Vercel deployments** | was **MISSING** → **FIXED**: `teardownVercelProject` per project before the cascade; best-effort, logged, never blocks PII delete |
| **Per-user Vault KEK** (`byok_kek_user_<id>`) | was **orphaned** (SET NULL) → **FIXED**: migration 0090 `delete_user_kek` RPC, called pre-migration-tolerant |

Idempotent (re-runs safely; storage purge verifies-empty before the cascade so ids aren't
lost) and batched (1000-object `DeleteObjects`). Evidence:
`account-deletion-teardown.security.test.ts` (teardown per named project, KEK RPC called,
missing-RPC + failed-teardown both tolerated). **Migration 0090 authored, NOT applied.**

**Adjacent finding (out of scope, TICKET):** the interactive single-project `deleteProject()`
(`file-storage.ts:462`) sends `DeleteObjects` **un-batched** → a >1000-file project delete
would fail. The account-purge path avoids this (uses the batched `purgeProjectStorage`); the
interactive route still carries the bug. One-commit follow-up, not on the D-5 purge path.

---

## Founder actions
1. **Apply migration 0090** (`delete_user_kek` RPC) via Supabase SQL editor — until then the
   KEK purge is a logged no-op (delete still completes).
2. **Run the D-4 RLS cross-read probe** (steps above) with the anon key + two test users.
3. **Decide the durable rate-limit upgrade** (D-2 decision table) before horizontal scaling.
4. **#8/#9**: keep the GitHub tickets open; schedule the auth-flow fixes with web + live auth.
5. Set the new env knobs if the defaults need tuning (`AGENT_RUNS_PER_HOUR`,
   `PUBLISHES_PER_HOUR`, `BUILDS_PER_HOUR`, `ATTACHMENT_BYTES_PER_DAY`, `TRANSCRIBE_DAILY_CAP`).

## Honest limitations
- D-2 counters are in-memory/per-instance (see decision table) — not cross-replica.
- D-4 RLS cross-read + #8/#9 are founder-gated (live secret / auth-flow) — audited, not probed here.
- The three legacy PII regex sets (D-3) and the un-batched `deleteProject` (D-5) are named
  follow-up tickets, deliberately out of this wave's per-ticket scope.
- No prod smoke / merge performed this session (see MERGE_REPORT.md).
