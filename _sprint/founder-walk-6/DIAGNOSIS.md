# Founder-Walk-6 (2026-08-15) — Five Findings · DIAGNOSIS ONLY

**Branch `claude/goblin-diagnosis-five-findings-jq5q3c`. No fixes built. Every claim below
is anchored to file:line and was independently spot-checked (not just taken from a single
pass) before being written down.**

## Headline: F1 checked first, as instructed

**Cross-USER session leakage is NOT possible.** Every code-session read/write path enforces
`user_id` ownership server-side, against a verified auth token, at the app layer (the
load-bearing check, since the API runs on the Supabase **service-role key** and therefore
bypasses RLS) and again, redundantly, via RLS policies on the tables themselves. This was
checked route-by-route, not sampled.

**What the founder actually saw is real, but it is cross-*project*, same-user** — the picker
offered a session that legitimately belongs to him, just to the wrong one of his own
projects. Root cause is a frontend state bug (detail in §1), not an authorization bug. Full
proof below.

**A second, independent thread ties F2, F3 and F4 together**: Act-2's Phase-4 form-wiring
feature (`ops-form-wiring.ts`) — which injects a CAPTCHA + fetch-based submit handler into
any published page containing a bare `<form>` — was added *after* the Phase-3 safety
classifier and the deploy verifier were built and hardened, and neither was ever updated for
it. The result is that **any hosted app with a plain contact/signup form** (a very common
case) now: gets shown to the phishing classifier as unexplained injected fetch+CAPTCHA code
(F2), then — if a human overrides the false hold — fails byte-verification on *every* publish
attempt, not just republish (F4), and if that publish failure happens after a console
approval, the item is stuck with no retry path (F3). One feature broke three downstream
systems that were never told about each other.

---

## Severity ranking

| Rank | Finding | Why this rank |
|---|---|---|
| 1 | **F4** — deploy verification always fails for any form-bearing hosted app | Broadest blast radius: not "republish only" — it fails on **first** publish too, for any app with a `<form>`, which is a very common app shape. Silently blocks a core product capability. |
| 2 | **F2** — stage-2 classifier false-positives on wired forms | Same root trigger as F4 (form wiring), independently blocks/holds the same broad class of apps at an earlier stage, with real reputational cost ("your chess signup form is phishing"). |
| 3 | **F3** — approved items get stuck, never requeued | A deliberate design choice, but it is the trap that turns F2/F4 failures into permanently stuck queue entries with no recovery path — compounds the other two. |
| 4 | **F1** — session picker offers a stale, wrong-project session | Confirmed non-security (same-user only), but it corrupts model context (the assistant answers using the wrong project's files) — a correctness/trust bug, not a breach. |
| 5 | **F5** — publish sheet doesn't disclose beta-gating | Cosmetic/trust issue only; smallest fix of the five. |

Vercel question (not ranked, informational): **no residue on the Goblin plane is possible** —
see §6.

---

## F1 — session picker offers a session from a different project (same user)

### The backend list query is correctly scoped

`apps/web/hooks/code/useCodeSessions.ts:29,48-79` calls `GET /api/code-sessions?projectId=...`.
Backend, `apps/api/src/routes/code-sessions.ts:144-179`:

```ts
if (!(await ownProject(sb, projectId, userId))) return c.json({ error: 'Project not found' }, 404);
...
.eq('project_id', projectId)
.eq('state', 'active')
```

`ownProject` (`code-sessions.ts:59-62`) filters `.eq('id', projectId).eq('user_id', userId)`.
This is scoped by **both** `project_id` and `user_id`. The list endpoint is not the bug.

### Root cause: stale frontend state survives a soft project switch

- `apps/web/components/project/project-workspace.tsx:70` and
  `apps/web/components/project/code-tab.tsx:63-68` render `<CodeWorkspace projectId={projectId}>`
  with **no `key={projectId}`** — so the component instance is never remounted when the user
  switches projects.
- Project creation navigates via `apps/web/lib/post-create-nav.ts:23-26`
  (`router.refresh(); router.push(href);`) — soft client-side navigation, by the file's own
  comment written to deliberately keep the layout subtree mounted.
- `apps/web/hooks/code/useCodeSessions.ts:48-79` — `refresh()` only overwrites `sessions` on
  success (`setSessions(list)`); it never clears the array or resets `loading` at the *start*
  of a refetch, and nothing in the hook resets state when its `projectId` argument changes.
  So immediately after switching projects, `sessions` still holds the **previous project's**
  list until the new fetch resolves.
- `apps/web/components/code/CodeWorkspace.tsx:158-197` gates on `!s.loading` (stale `false`)
  and at `:189` checks `s.sessions.length >= 2` using that stale array, then at `:260-271`
  renders `<SessionPickerDialog sessions={s.sessions} .../>` — offering the **old** project's
  sessions in the new project's picker.
- Compounding: `apps/web/contexts/app-context.tsx:53-54,84,97-114` — `pendingCodePayload` is a
  single **global, non-project-scoped** context value, never cleared on project switch, fed
  straight into `CodeWorkspace` (`project-workspace.tsx:70`).

### Why the assistant then answered using the old project's code

Picking the stale session calls `injectIntoSession` (`CodeWorkspace.tsx:135-145`) →
`PATCH /api/code-sessions/:sessionId/files` (`apps/api/src/routes/code-sessions.ts:305-325`),
which correctly checks `ownSession()` (user-ownership) — and has no reason to also check
"is this the project currently open in the browser," since it's a session-scoped endpoint by
design. The write succeeds because the session genuinely belongs to that user. Opening/
messaging the session then runs `hydrateSessionFiles()` (`code-sessions.ts:85-125`), which
mirrors files from `session.project_id` — the **old** project — into the model's context.
The assistant wasn't hallucinating continuity; it was faithfully reading the session it was
handed, which was the wrong one.

### Cross-user check (exhaustive, not sampled)

- `apps/api/src/middleware/auth.ts:5-25` — verifies the bearer token server-side via
  `supabase.auth.getUser(token)`; `userId` comes from the verified token only.
  `codeSessions.use('*', authMiddleware)` (`code-sessions.ts:40`) applies it to every route.
- All 12 `:sessionId`-keyed routes call `ownSession()` (`code-sessions.ts:65-68`:
  `.eq('id', sessionId).eq('user_id', userId).single()`) or `ownProject()` before touching
  data. Run-event/report routes add a second check against `agent_runs`.
- `apps/api/src/lib/supabase.ts:35,37` — the API uses `SUPABASE_SERVICE_ROLE_KEY` (RLS
  bypassed at this layer), which is why the `ownSession`/`ownProject` WHERE clauses above are
  the real, load-bearing protection — and they were present and correctly predicated on every
  route checked.
- `supabase/migrations/0055_code_sessions.sql:62-82` — RLS is nonetheless enabled on
  `code_sessions`, `code_session_messages`, `code_session_files` with
  `using (auth.uid() = user_id)` policies — correct defense-in-depth, explicitly documented in
  the migration as such.
- `apps/web/app/dashboard/chat/[sessionId]/page.tsx:30-37` — independent second layer, reads
  via the user's own cookie-scoped (RLS-respecting) client and still filters
  `.eq('user_id', user.id)`.

### Verdict

- **Cross-user leakage: NO.**
- **Cross-project, same-user leakage (the observed bug): YES**, caused by the frontend state
  bug above, not the backend query.
- **Correct scoping for the picker**: project **and** account, which is already what the
  backend list endpoint enforces. The fix is on the frontend: give `CodeWorkspace`/`CodeTab`
  a `key={projectId}` (or otherwise force remount/reset on project change), have
  `useCodeSessions`'s `refresh()` clear `sessions` and set `loading=true` synchronously the
  moment `projectId` changes (before the new fetch resolves), and scope/clear
  `pendingCodePayload` per project instead of leaving it global.
- No test in the repo covers `useCodeSessions`, `CodeWorkspace`, or `SessionPickerDialog` —
  this path is entirely untested today.

---

## F2 — stage-2 classifier flags plain signup/contact forms as phishing/circumvention

### Where the raw evidence for the two incidents actually lives (and its limits)

Stage-2 verdicts persist to `ops_review_queue` (`supabase/migrations/0102_ops_review_queue.sql`,
written by `enqueueReview()` in `apps/api/src/services/ops-review-queue.ts:119-168`). Columns:
`stage1_verdict, stage1_rule_ids, stage2_verdict, stage2_reason, categories,
stage2_confidence, scanned_files, scanned_bytes, ...`.

By explicit design (`abuse-classifier.ts:35-41`, comment): *"THE MODEL'S WORDS NEVER LEAVE
THIS FILE ... `ClassifierResult` carries enums, numbers and nothing else."* So the two queue
rows will show `categories: ['phishing']` / `['circumvention']` and a confidence bucket, but
**no model rationale text and no copy of the scanned HTML** — the row is a reference
(`user_id`+`project_id`), not an artifact copy. To see the exact bytes the classifier read,
someone has to re-run `extractCandidateText()` (`abuse-classifier.ts:214-236`) against the
project's **current** files — accurate only if the project hasn't been edited since.

### The mechanism (confirmed root cause, not the two more obvious candidates)

`ops-publish.ts` rewrites the HTML **between loading it from storage and scanning it**, and
this rewritten copy is exactly what stage 2 reads:

- `apps/api/src/services/ops-publish.ts:362-383` (step "2b. FORM WIRING") — comment: *"WHAT
  IS SCANNED IS WHAT IS UPLOADED, with no exception carved out for the platform's own
  snippet."*
- `wireForms()` (`apps/api/src/services/ops-form-wiring.ts:278-384`): any `<form>` with no
  `action` attribute — the default for essentially every AI-generated signup/contact form —
  gets injected with: a Cloudflare Turnstile CAPTCHA widget (`:251-253`) plus its loader
  script (`:249`), and a client-side script (`:197-247`) that on submit builds JSON from the
  form fields and does `fetch(ENDPOINT + '/f/' + label + '/' + formId, ...)` (`:226`) to an
  absolute, dynamically-constructed, cross-subdomain API origin — **no static `action=`**.
- Confirmed to reach the scanner byte-for-byte by `ops-publish.test.ts:573-590` ("SCANS WHAT
  IT UPLOADS"), which asserts `scannedHtml` contains both `data-goblin-form="kontakt"` and
  `cf-turnstile`.

The stage-2 system prompt (`abuse-classifier.ts:251-286`) explicitly protects native forms
that post to "a normal third-party form service" (`:256-261`) and defines
`circumvention = built to evade safety checks or platform limits` (`:272`) plus an explicit
instruction to treat evasion-shaped content as a circumvention signal (`:279-281`). It has
**no carve-out** for Goblin's own injected wiring:

- The **chess signup form → phishing/high**: what the model saw was JS collecting field
  values into JSON and POSTing them via `fetch()` to a dynamically-built URL on a different
  hostname than the visible page, no visible `action=` — structurally exactly the shape the
  prompt tells it to flag as credential/data harvesting, and the prompt's only carve-out
  (native `action=` to a known third-party form service) doesn't cover it.
- The **guitar contact page → circumvention**: the injected Turnstile bot-challenge in front
  of an otherwise-harmless contact form is exactly the pattern real phishing kits use to
  block automated analysis — precisely what the prompt defines as circumvention, with no way
  for the model to know Goblin itself put the CAPTCHA there for spam protection.

### Ruled out

- `scan-rules.ts`/`signals.ts` have no keyword rules on "sign up"/"contact"/"email" — and are
  irrelevant regardless, since stage 1 only passes/hard-blocks, never produces a "confidence:
  high, held" verdict; that vocabulary is stage 2's alone (`hosted-publish-scan.ts:16-23`
  confirms stage 2 runs only after a stage-1 pass).
- The prompt does not over-index on "form fields = suspicious" — it explicitly protects
  logins, newsletters, contact forms and pages with sensitive-looking-but-non-secret fields
  (`:256-261`), and the existing legit fixtures for these pass.

### Confirmed test-coverage gap

`hosted-scan-battery-v2.ts`'s legit fixtures (`legit-01`..`legit-05`) never pass through
`wireForms()` — they're loaded straight off disk and fed directly to the scanner, bypassing
the `ops-publish.ts` pipeline. The one test that proves the CAPTCHA/fetch snippet reaches the
scanner (`ops-publish.test.ts:573-590`) uses a **mocked** scan function — it proves the
plumbing, never actually classifies the injected content, real model or otherwise. Phase 3
(classifier + battery) shipped before Phase 4 (form wiring) existed, and nothing closed the
loop afterward.

### Options (general mechanism, not tuned to these two cases)

1. **Provenance-fence the injected block** — wrap Goblin's own wiring in a stable marker
   (e.g. `<!-- goblin:platform-injected -->…<!-- /goblin:platform-injected -->`) applied by
   `wireForms()` itself (so a user can't spoof it earlier in the pipeline), and tell the
   classifier prompt to trust content inside that exact fence. Cheap, surgical, no
   latency/cost change. Only fixes this specific injection, not future ones.
2. **Classify pre-wiring content; describe the wiring as structured metadata instead of raw
   markup** — pass the original page plus a fact like "1 form, will be wired to Goblin's own
   endpoint with a CAPTCHA" rather than the injected HTML. Removes the false-positive shape
   entirely, but stage 2 then never re-validates the actual wired output — a future wiring
   bug becomes invisible to the safety layer. Needs restructuring the classifier call site.
3. **Human-review-first tier when `wired.length > 0`** — skip or de-escalate stage 2 for
   artifacts the platform itself just wired, since stage 1 already gates forms structurally.
   Fastest fix, but weakens the safety guarantee for legitimately abusive wired forms
   (false-negative risk trade), and touches the AUP's stated guarantees
   (`docs/ACCEPTABLE_USE_POLICY.md:163-178`) — needs product sign-off.
4. **Close the test gap regardless of which fix is chosen** — run battery fixtures through
   the real `wireForms()` step, add signup/contact-with-CAPTCHA fixtures to
   `FALSE_POSITIVE_GUARD`, and run the real-model gate against them. Doesn't fix anything by
   itself, but it's the only way to measure whether 1 or 2 actually worked, and today the
   suite structurally cannot catch this class at all.

---

## F3 — approval doesn't complete the publish, and the item never returns to the queue

**This is by design, not an accident** — and the design has a real gap. Comment,
`apps/api/src/routes/ops-console.ts:513-523`:

> "Order: settle the row FIRST, then publish. If the publish then fails ... the item does not
> silently return to pending — the decision was made and is recorded... Re-queueing it would
> erase a human decision because a network call failed."

The approve handler (`ops-console.ts:525-581`) runs two independent, un-transacted steps:

1. `ops-console.ts:538` — `decideReview(id, 'approved', ...)` commits the **terminal** status
   write. `decideReview` (`ops-review-queue.ts:248-273`) does an unconditional
   `UPDATE ... SET status = 'approved' WHERE id = $1 AND status = 'pending'` — before
   `publishHostedApp` is even called.
2. `ops-console.ts:563-568` — `publishHostedApp(...)` runs separately; its failure is never
   fed back into step 1's row.

`listPendingReviews` (`ops-review-queue.ts:176-192`) filters `.eq('status', 'pending')` —
once status flips to `approved`, the row is permanently excluded from the queue view whether
or not the publish that followed actually succeeded. No requeue/retry logic exists anywhere
in the repo (confirmed by grep). The response reports `published: result.ok` verbatim
(`ops-console.ts:570-580`) without changing the row's status.

The exact German string comes from `apps/web/app/dashboard/konsole/strings.ts:260-261`:

```
publishFailed:
  'Die Freigabe steht und ist protokolliert — die Veröffentlichung selbst ist nicht durchgelaufen. Der Eintrag geht dadurch nicht zurück in die Warteschlange.'
```

It is not an incidental error message — it is literally narrating the deliberate design
decision above.

**Minimal correct fix (not built)**: add a third, non-terminal status (e.g.
`approved_publish_failed`) that a follow-up write sets when `publishHostedApp` returns
`ok:false` after approval. Surface it in a "needs attention" queue view with a "retry
publish" action that re-invokes `publishHostedApp` for the already-approved row, without
re-running the approval step. Keep the audit record (`decided_by`/`decided_at`) intact — the
comment's underlying worry (never silently erase a human decision) is legitimate and should
survive the fix; only the item's *visibility* needs a third state, not a revert to `pending`.

Note the connection to F4: any form-bearing app that reaches this approve flow is currently
guaranteed to hit exactly this failure mode, because `publishHostedApp`'s own verification
step will fail for it (see next section) — so F3's stuck-forever trap is not a rare edge
case for these apps, it's the default outcome.

---

## F4 — republishing (and, in fact, any first publish of) a form-bearing app fails verification

**Root cause: the hosted-apps verifier assumes "we uploaded the bytes, therefore stored bytes
== served bytes" — an assumption Phase 4's form-wiring step silently breaks.**

The error text: `apps/api/src/services/deploy-verification.ts:89-92`:

```ts
const servedHtml = entry.body ?? '';
if (expectedEntry !== null && servedHtml !== expectedEntry) {
  lastReason = 'Die veröffentlichte Seite entspricht noch nicht dem gespeicherten Stand.';
  continue;
}
```

`expectedEntry` is derived **independently**, by re-reading the file from storage
(`deploy-verification.ts:70-74`):

```ts
if (entryPath && !builtOutput) {
  try {
    expectedEntry = await downloadFile(projectId, entryPath);
  } catch { /* verify without content compare */ }
}
```

This function is shared with the Vercel/framework path, which correctly passes
`builtOutput: true` when the deployed output legitimately differs from source
(`agent/publish.ts:195,219,230`). The hosted-apps path, `ops-hosted-verify.ts:86-89`, never
passes `builtOutput`, so it defaults to `false` and the byte-compare always runs — justified
by the file's own comment (`ops-hosted-verify.ts:10-15`): *"Here WE uploaded the bytes, so we
can demand that what comes back... is byte-for-byte what we put in R2."* True for a plain
static app; **false for any app containing a `<form>`**.

`publishHostedApp` (`ops-publish.ts:362-383`) mutates the artifact **in memory, after loading
it from storage and before uploading it**:

```ts
const wiring = deps.wireForms(artifact.files);
...
if (wired.wired.length > 0) {
  artifact.files = wired.files;   // mutated in memory — never written back to storage
  ...
}
```

`wireForms()` rewrites the entry HTML whenever a `<form>` is present, and **this rewritten
copy is never saved back to the project's file storage** (no `saveFile`/`writeFile`/
`putFile` call exists anywhere in `ops-publish.ts`). So:

- **Upload** (`ops-publish.ts:494-497`) puts the *wired* bytes into R2.
- **Verify** (`ops-hosted-verify.ts:86-89` → `deploy-verification.ts:71-73`) re-derives
  "expected" bytes by re-reading the **original, unwired** `index.html` straight from
  storage.

These can never be equal for any app with a form, on **any** publish — first or Nth. CDN
staleness, non-determinism/nonces, and a deploy/verify idempotency skip were all checked and
ruled out: the Cloudflare Worker sets `cache-control: public, max-age=0, must-revalidate`
with ETag-validated conditional GETs (`ops-router/worker.js:411-414,556-570`), R2 writes are
synchronous per-file `PutObjectCommand`s with strongly-consistent read-after-write
(`cf-deploy.ts:697-740`), and `ops-publish.ts` always fully re-uploads and re-verifies on
every call — no short-circuit for "already live/unchanged" exists at all (which is itself
notable: republish is never idempotent by design here, not just broken for forms).

It presents as "republish only" in practice because operators mostly notice it while
iterating on an already-live app — but the bug is deterministic on the **first** publish of
any form-bearing app too.

**Minimal correct fix (not built)**: stop re-deriving "expected" bytes from a second,
independent storage read. `verifyHostedPublish` already receives the exact uploaded bytes as
its `uploaded: UploadedFile[]` parameter (`ops-hosted-verify.ts:79`) — the entry-content
comparison should use `uploaded.find(f => f.path === entryPath).bytes` (what was actually
just PUT to R2) instead of `downloadFile(projectId, entryPath)`. This makes the "byte-for-byte
what we put in R2" claim true again regardless of what any pipeline step (form-wiring or
future steps) rewrites between load and upload. Passing `builtOutput: true` would be the
wrong fix — it drops the entry content-check entirely for the hosted path, weakening the
"what is scanned is what is uploaded is what is verified" invariant this file's own comments
insist on. Not applied here as a "one-line fix" because it requires a signature change
threaded through `ops-hosted-verify.ts` → `deploy-verification.ts`, not a single-line edit.

---

## F5 — publish sheet doesn't disclose beta-gating

**Confirmed: zero UI indication.** `apps/web/components/code/HostedPublishSheet.tsx` (403
lines, read in full) contains no "beta"/"allowlist"/similar string anywhere. The
Goblin-hosted default renders at `:244-252` with no badge, tooltip, or footnote.

Gating mechanism:

- `apps/api/src/services/ops-beta.ts:79-84` — `isOpsBetaAccount()`: `OPS_HOSTING_ENABLED
  === 'true'` AND the account's email is in the `OPS_BETA_ACCOUNTS` env allowlist.
- `ops-beta.ts:87-102` — the deny reason is explicitly documented "FOR LOGS AND TESTS
  ONLY — never return this to a client."
- `apps/api/src/routes/ops.ts:302-321` — `GET /api/ops/eligibility` is the only
  client-facing signal: `{hosted: true, appsDomain}` for allowlisted accounts, a
  byte-identical 404 for everyone else, by design ("it never learns that an allowlist
  exists," `:305-309`).
- `apps/web/components/code/SessionPane.tsx:33-36,131-136,615-636` — `HostedPublishSheet` is
  behind a `dynamic()` import specifically so its strings never ship to non-allowlisted
  users' bundles, and it only mounts after the client already received `hosted:true`.

This is a deliberate stealth design (non-beta users must never learn Act-2/hosted-publish
exists — `ops-beta.ts:1-33`), but its flip side is exactly the founder's bug: **the
allowlisted viewer gets no cue that what they're seeing is exclusive**, so it reads as the
universal default.

**Smallest honest fix (not built)**: because `HostedPublishSheet` only ever mounts after
eligibility is already an established fact, a **static, hardcoded** badge needs no new API
surface and can't leak to the ungated cohort (the dynamic-import boundary already prevents
that). Placement: right after the intro paragraph at `HostedPublishSheet.tsx:248-252`, before
the `<label htmlFor="hosted-name">` at `:254`:

```
{t(lang, "Beta — nur für ausgewählte Konten sichtbar", "Beta — visible to selected accounts only")}
```

---

## Vercel question — did the accidental direct-to-Vercel publish leave anything on the Goblin plane?

**No. Verified, not assumed.**

- Vercel connection is a pasted-token integration, not OAuth webhooks:
  `apps/api/src/routes/integrations.ts:12-44` → `apps/api/src/services/byok-service.ts:499-554`
  stores the token in `byok_keys` (`provider='vercel'`) — a table Goblin only *reads from* to
  call Vercel's API; never a channel Vercel calls back into.
- All deploys are Goblin-initiated: `apps/api/src/routes/deploy.ts:52-273`
  (`POST /api/deploy/vercel`) is the only path that creates a Vercel deployment, writes
  `projects.preview_url`, fires `platform_events`, and snapshots a checkpoint. None of this
  runs unless the request hits this authenticated Goblin route.
- **No Vercel webhook receiver exists anywhere** — `grep -rn webhook apps/api/src/routes`
  found only Stripe (`billing.ts`) and Supabase auth (`auth-email-hook.ts`); a combined
  search for any Vercel+webhook combination across the whole repo returned zero matches.
- Act-2's own audit tables (`ops_apps`, `ops_app_audit`) belong to a separate,
  Cloudflare-based pipeline (`ops-publish.ts`, `ops-apps-store.ts`, `cf-deploy.ts`), reachable
  only via `/api/ops/apps/publish` and gated by `isOpsBetaAccount()` — a Vercel deploy has no
  mechanism to touch it.
- The one loose thread, `apps/api/src/services/support-agent.ts:132` querying a
  `vercel_tokens` table that doesn't exist in any migration, is a **pre-existing, unrelated**
  drift bug (documented in `supabase/checks/migration_status.sql:199-201`) — it silently
  falls back to "no Vercel connection" via a try/catch (`support-agent.ts:146-148`) and has
  no write path from anywhere, so it cannot receive or record anything either.

Since a direct Vercel UI/CLI publish never calls any Goblin API endpoint, and Goblin has no
webhook or polling listener for Vercel-side events, no Goblin table can receive a row from
it. It is outside Goblin's plane by construction, not merely by policy.

---

## What was and wasn't verified independently

Every finding above was produced by a dedicated research pass per finding; the three most
load-bearing claims — F1's `ownSession`/auth middleware, F3's approve-handler ordering and
comment, and F4's byte-comparison in `deploy-verification.ts` — were re-read directly in this
session and matched exactly. No code was changed; no fix in this document has been applied.
