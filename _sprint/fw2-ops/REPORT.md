# FIX-WAVE 2 — TRUTH-REST & OPS · Report

**Branch:** `claude/fix-wave-2-truth-rest-ops-h3hri4` (base = `master` @ `6b3a066`; FW1 merged `1fe018a`, landing fixes `6b3a066`)
**Date:** 2026-07-13 · Cloud session (secretless) · Model: Opus
**Scope:** the escalation-mail ROOT CAUSE + instrumentation, three small frictions, two open P0s, one security test.
**Status at end:** all deterministic gates green; `tsc` clean both apps; every real-model **prod** gate is founder-side (no secrets here). **HALT** for the founder re-walk before merge.

Success rates are numeric. "Green is what was seen." Deterministic verification is labelled as such.

**Suites:** API **734 passed / 16 skipped / 0 failed** · Web **25 passed / 0 failed** · `tsc` clean (api + web).

---

## Per-unit — diagnosis, fix, gate

### U1 · F-38 · Escalation mail root cause + instrumentation (P0, diagnosis-first)
**Diagnosis.** FW1 made the send *honest* (fails visibly). What remained hidden was **why** it fails: `sendSupportEscalation` returned only `error.message`, and the address construction had two silent 422 traps.
- **`from` construction:** Railway stores an env value **including any quotes you type** — `SUPPORT_EMAIL_FROM="Goblin Support <support@justgoblin.com>"` can arrive as the literal `"Goblin Support <…>"` (quotes inside the value) → malformed `from` → **422**. The code passed it verbatim.
- **`to` construction:** if none of `SUPPORT_EMAIL_TO` / `FOUNDER_DIGEST_EMAIL` / `ADMIN_EMAIL` is set, `to` is `undefined` → an empty recipient (a 422 waiting to happen); previously indistinguishable from other failures.
- **No boot signal** that Resend is even configured, and **no full error** on failure.

**Fix (code-side).**
- `resolveFromAddress` / `resolveToAddress` (exported, pure, tested): normalise + **unquote** env values; a missing recipient returns `null` → the caller degrades honestly instead of sending an empty-recipient 422.
- `logResendStatus()` at boot logs `Resend: configured / NOT configured` + recipient-set + resolved-from — **never the key** (`apps/api/src/index.ts`).
- On any Resend rejection the **full** error (`name` + `statusCode` + `message`) is `logger.error`-logged with the ticket id and the `from` used.
- `support@justgoblin.com` renders as a **tappable `mailto:` link** in the support chat (assistant + rate-limit surfaces); the help page already had one.

**Deeper root cause (re-examination — founder: "worked ~12d ago; key + DNS confirmed").** The escalation via the support agent is only 3 days old (J2, 2026-07-10); what worked before is the **founder-digest** path (`lib/email.ts::sendEmail`). J2 built `support-email.ts` as a **parallel Resend client** (the methodology anti-pattern) that **always** sets `replyTo: ticket.userEmail` — and the support route defaults that email to `''` when the auth lookup misses (`routes/support.ts:44`). **Resend 422s on an empty/invalid `reply_to`;** the digest path conditionally omits it, which is exactly why the digest sends and the escalation didn't. **Fix:** `support-email.ts` now **delegates to the hardened `lib/email.ts::sendEmail`** (same path the founder confirms works) and **guards the reply-to** (`validReplyTo` — omit unless it's a real address). `lib/email.ts` now logs the full Resend error (name + statusCode) so both paths are diagnosable.
**Gate (deterministic).** `support-email.test.ts` — from/to construction incl. the **display-name form** and quote-stripping; **delegation** to `sendEmail` with resolved from/to; reply-to **passed when valid, OMITTED when empty/malformed** (the 422 regression); not-ok + logged when `sendEmail` rejects; `missing_config` without calling send. **16/16 green** (full API suite **738**).

**Founder action (env/domain — the likely remaining cause).** In the **Resend dashboard**: (1) **Logs** — every attempted send + its error is listed; a 422 here names the exact reason. (2) **Domains** — confirm `justgoblin.com` is **verified with DKIM**. If the from-domain is unverified, Resend 4xxs regardless of code. Also confirm on **Railway**: `RESEND_API_KEY` set; a recipient env set (`SUPPORT_EMAIL_TO` **or** `ADMIN_EMAIL`); `SUPPORT_EMAIL_FROM` entered **without** wrapping quotes (or leave it unset — the default is already the verified-domain display-name form).

### U2 · F-39 · Help-chat input auto-zoom on focus (P1)
**Diagnosis.** iOS Safari zooms any focused `input/textarea/select` whose font-size computes **<16px** and never zooms back out. The help composer inherited `--t-caption-fs` (12px); the main chat composer `--t-small-fs` (14px) — both trip it.
**Fix.** One systematic CSS rule (not one-off px) in `globals.css`: `@media (pointer: coarse)` forces every text-entry control to **16px** — covering help/support composer, main chat composer, login/auth, settings forms, feedback modal at once. Placed **last** in source order so it also beats the desktop `.settings-section` overrides on coarse-pointer tablets (iPad). Desktop (fine pointer) keeps its intended smaller sizes; no zoom there.
**Swept surfaces:** all are real `<input>/<textarea>` (no `contenteditable`), so the selector covers them. **Adjusted at the token/utility layer**, so no field can reintroduce the trap.
**Gate (deterministic).** `app/input-zoom-guard.test.ts` — parses `globals.css`, asserts the coarse guard exists and enforces **≥16px** on input/textarea/select incl. the settings override (headless iOS is unavailable in CI). **3/3 green.**

### U3 · F-42 · `.md` upload unsupported (P1)
**Diagnosis.** `classifyKind` already reads `.md/.csv/.json` as text — the block was **upstream**: the picker used `accept="image/*,application/pdf,text/*"`, a **MIME-only** whitelist. The OS reports no/unknown MIME for `.md/.csv/.json`, so the picker greyed them out; the founder couldn't even select a `.md`.
**Fix.** `ATTACHMENT_ACCEPT` is derived from the existing text/code **extension** whitelist (single source of truth) and lists each extension explicitly, so every whitelisted type is pickable regardless of MIME. Same size/budget rules; unsupported binaries keep the FW1 honest, type-specific message.
**Gate (deterministic).** `chat-attachments.test.ts` — `.md/.markdown/.txt/.csv/.json` classify as text **even with empty MIME**; a `.md` parses into real content; `ATTACHMENT_ACCEPT` lists the new extensions; an unsupported binary still yields the honest message. **13/13 green.**

### U4 · F-43 · Make the search toggle TRUE (P0 — founder decision D-C: build, don't hide)
**Diagnosis.** FW1 hid the toggle where the model wasn't agent-eligible, but the deeper phantom was: the project/base chat posts to `/api/chat/stream` (and `/api/chat-sessions/:id/stream`) — **tool-less completions that never run the agent**. So the FW1 "append a Websuche directive" was a **placebo**, and `websearchAvailable = isAgentModel(slug)` gated on the wrong thing (being an agent-eligible *model* ≠ the *chat surface* can search).
**Fix — search-augmented generation, reusing the hardened search service (no parallel plumbing).**
- `services/search/augment.ts::runChatWebSearch` resolves the provider (`resolveSearchProvider`), enforces the **same per-user daily cap** (platform key; BYOK exempt), runs **one** live search, and formats real hits with the agent tool's **verbatim citation contract** (`Quelle: <url>`, never fabricate).
- Both chat stream routes: when the toggle is ON, run the search first, inject hits into the system prompt **and** the reduced-context fallback, emit a `search` SSE event, and record `chat_web_search` telemetry (metadata only). **Fully additive** — off / no provider → byte-identical to the plain completion.
- Frontend: availability now reads the honest `/api/integrations/websearch` `live` signal (a real provider is configured), not `isAgentModel`; the toggle passes a structured `websearch` flag instead of mutating the message text.
- **Caps unchanged** (25/day, shared across both surfaces). **Ledger M11 updated same-commit** (new trigger surface, same budget/provider/cap).
**Gate (deterministic).** `services/search/augment.test.ts` — provider resolution, daily-cap enforcement, **BYOK exemption**, honest failure/empty degrade, citation-instructing context block. **8/8 green.**
**Prod gate (founder-side, real model, verbatim):** toggle ON in a project chat → "Welche stabile Tailwind-Version ist aktuell? Quelle nennen." → the `search` step fires and the answer cites `Quelle: …`. This needs the code deployed + a search provider key on Railway (`BRAVE_SEARCH_API_KEY`) or a BYOK Brave key — see Honest-Limitations.

### U5 · F-35 · `/api/health` 404 on the primary domain (P0)
**Diagnosis (curl-verified, 2026-07-13).** Health mounted only at `/health`. The primary domain (`justgoblin.com` → `www`) rewrites **only `/api/*`** to the Railway API. So `www.justgoblin.com/api/health` → Railway `/api/health` (**unmounted → 404**), and `/health` was never rewritten. Railway origin `/health` returned **200 `{status:ok}`** the whole time — the route was fine, only unreachable on the domain.
**Fix.** Dual-mount at **`/health` and `/api/health`** (mirrors the existing `/version` + `/api/version` pattern). The canonical public path `www.justgoblin.com/api/health` (+ `/api/health/deep`) now reaches it via the existing rewrite; the direct Railway `/health` probe is unchanged. `_sprint/webhook/UPTIMEROBOT_SETUP.md` updated to the verified canonical URLs.
**Gate (deterministic).** `routes/health.test.ts` — mounts the same router at `/api/health`, asserts `/api/health` → **200 `{status:"ok"}`**, `/health` still 200, `/api/health/deep` reachable (200/503, not 404). **3/3 green.** Live curl evidence: `evidence/fw2/U5_health_curl.txt`.
**Founder confirm (post-deploy):** `curl https://www.justgoblin.com/api/health` → `{status:"ok"}` (+ `/api/health/deep`).

### U6 · F-31 · `/admin/insight` inaccessible to the founder (P0, diagnosis-first)
**Diagnosis.** The `/admin` **layout silently redirected** any non-admin to `/dashboard` — "no access with any account and no error detail", exactly as reported. A second, separate failure (the `/api/admin` proxy injecting an **empty `x-admin-key`** when `ADMIN_API_KEY` is unset → API 401) also read as a blank "no access".
**Fix.**
- `lib/admin-access.ts::resolveAdminAccess` — one pure, unit-tested gate (grant via `users.is_admin` **or** an exact `ADMIN_EMAIL` match), shared by **both** the layout and the proxy so UI and data path can't drift.
- Layout: on deny, render an honest **"Kein Admin-Zugriff"** screen that **names the signed-in account** (so the founder sees *which* account) instead of a silent bounce; no-user still → `/login`. (Grant mechanism is **not** leaked to arbitrary users.)
- Proxy: fail with an actionable **500 `admin_key_unconfigured`** instead of proxying an empty key; the insight page surfaces 401/500 config errors honestly.
**Gate (deterministic).** `lib/admin-access.test.ts` — `is_admin` 200-path; `ADMIN_EMAIL` fallback (case/whitespace-tolerant); non-admin → honest deny; no-user → `not_authenticated`; empty-email never matches. **7/7 green.**
**Founder action (env-side, ~2 min).** The founder's real account id/email is in **Supabase → Authentication → Users** (the `users` table `id`/`email`). Then EITHER: (a) set `users.is_admin = true` for that account (SQL editor), OR (b) set **`ADMIN_EMAIL`** on **Vercel** (web) to that exact email. Separately, `ADMIN_API_KEY` must be set to the **same value on BOTH Vercel (web) and Railway (API)** — if it's missing on Vercel the new honest 500 says so; if it differs the insight page shows the honest 401.

### U7 · F-26 · RLS cross-account test (P1 — a test, not a fix)
**Audit.** All four resources have RLS ownership policies keyed on `auth.uid()`:
`projects` (FOR ALL), `chat_messages` (FOR ALL, via owning project), `deployments` (FOR SELECT; writes are service-role only), `project_file_meta` (FOR SELECT; writes service-role only). The API uses the **service-role key (bypasses RLS)**, so its paths enforce ownership **in code** — spot-audited: `routes/projects.ts` (`.eq('user_id', userId)` on every read/write), `routes/chat.ts` (project-ownership check before any chat op), `routes/deploy.ts` (`.eq('user_id', userId)`). No service-role path was found returning another account's row without an ownership filter.
**Deliverables.**
- **Deterministic policy audit** (`apps/api/src/__tests__/rls-policies.security.test.ts`, **12/12**): parses the committed migrations and asserts, per table, RLS **enabled** + an **auth.uid() ownership policy** + no `USING (true)` blanket. Runs in CI, no secrets.
- **Repeatable live probe** (`tests/security/rls-cross-account.mjs`, `pnpm test:rls`): mints JWTs from two test-account credentials **at runtime** (secretless — nothing committed), discovers account-3's ids, and runs the **4-resource × {read, write}** matrix with account-4's JWT, asserting every cell **DENIED** (RLS hides the row on read; rejects the write). Exit 0 = pass, 1 = leak, **2 = SKIPPED (prod-unverified)** — never a false pass.
**Gate status.** Policy matrix **green (12/12)**. The live JWT probe is **prod-UNVERIFIED in this session** (no test-account creds here) — see Honest-Limitations; the script is committed and ready.

---

## Honest-Limitations (mandatory)
- **U4 prod gate is founder-side.** The "real model cites a source" step cannot run pre-merge/pre-deploy from this secretless cloud session. It also requires a search provider configured on Railway (`BRAVE_SEARCH_API_KEY`) **or** a BYOK Brave key on the test account — if neither is set, the toggle is correctly **hidden** (the `live` signal is false) and no phantom appears, but the cite-a-source walk can't be demonstrated until a key exists.
- **U7 live probe is prod-UNVERIFIED.** The deterministic policy + code audit is green, but the cross-account JWT matrix against the live DB was not executed here (no test-account credentials in this environment). The probe exits `2 (SKIPPED)` rather than claiming a pass. Founder/CI can run `pnpm test:rls` with `RLS_ACC3_*`/`RLS_ACC4_*` set.
- **U1 remaining cause is likely env/domain-side** (Resend domain verification), which is a founder dashboard check — the code now makes any such failure fully visible in the logs, but cannot self-verify the founder's Resend account.
- **U5 domain 200 is post-deploy.** The fix is proven deterministically (router test) and the diagnosis is curl-proven, but `www.justgoblin.com/api/health` returns 200 only after this branch deploys; captured as a founder confirm.
- Migrations: **none authored** this wave (U7 asserts existing policies; nothing applied).

## Founder-action list (consolidated)
1. **U1 — Resend:** dashboard → **Logs** (read the 422 reason) + **Domains** (verify `justgoblin.com` DKIM). On Railway confirm `RESEND_API_KEY`, a recipient env, and `SUPPORT_EMAIL_FROM` without wrapping quotes.
2. **U6 — admin:** read the account id/email in Supabase → Auth → Users; set `users.is_admin=true` OR `ADMIN_EMAIL` (Vercel) to that email; ensure `ADMIN_API_KEY` matches on **Vercel + Railway**.
3. **U5 — health:** after deploy, `curl https://www.justgoblin.com/api/health` (+ `/api/health/deep`) → `{status:"ok"}`; point UptimeRobot at the www `/api/health`.
4. **U4 — search:** ensure `BRAVE_SEARCH_API_KEY` on Railway (or add a BYOK Brave key), then re-walk the toggle-on cite-a-source query.
5. **U7 — RLS:** optionally run `pnpm test:rls` with the two test accounts' creds to record the live matrix.

## Merge (founder-granted, after the re-walk)
Per the prompt: merge after **mail arrives** (screenshot), **toggle-on search cites a source**, **/admin/insight renders for the founder**, **health URL curls ok**. All deterministic gates are green now; these four are the founder's prod confirmations. **HALT.**

---

### Unit → commit map
- U1 `2af99e8` · U2 `6cb15f5` · U3 `edb1b47` · U4 `3e29b53` · U5 `a7d8d5e` · U6 `46a7875` · U7 (this commit)
