# WAVE FINAL-POLISH — merge report

**Branch:** `claude/wave-final-polish-goblin-nfyldc`, fresh from `4423c63` (master).
**Scope:** the founder's last cleanup wave before invitations go out.
**Status:** PR open, **HALT** — merge is founder-granted.

Every number below is a re-run count, not an adjective.

---

## Phase 0 — state-first (Gesetz 10)

Read before touching anything: `docs/GOBLIN_ARBEITSMETHODIK.md`,
`_sprint/overnight/E2E_AUTH_INFRA_GAP.md`, `docs/ENV_REFERENCE.md`,
`_sprint/f40-resumable-runs/BUILD_REPORT.md`, plus the PR-#68 findings via the repo.

**Three places the prompt and the repo disagreed. The repo won, and each is reported
where it matters rather than quietly worked around:**

1. **"the existing 20-way race test" (U2) does not exist.** `promo-code.test.ts` covered
   code shape and copy only. The concurrency case is new in this wave.
2. **"the old gold logo asset" (U4) does not exist.** `gold` and `green` are colour
   *variants* of the same inline mark (`GoblinLogo.tsx`, one `G_MARK_PATH`,
   `fill="currentColor"`). An earlier sweep already removed the legacy files, so the
   grep-proof delivered is about **variant use on loading surfaces**, not a file.
3. **U5's stated symptom is the wrong direction.** The prompt says "a German user gets an
   English app on their second device". Since PR #69 the app binding does not detect, and
   its default is `de` — so the real failure is the reverse: an **English** user gets a
   **German** app. Same missing read, same fix; the report should say the true thing.

---

## Units

| Unit | SHA | What |
|---|---|---|
| U1 | `61b5f1e` | Runs survive the phone locking — server finishes + persists; client re-attaches on return |
| U2 | `046a5ee` | Promo single-use proven; the signup path no longer loses a code silently |
| U3 | `8cbe17d` | Invite code asked for in ONE place (the plan/trial dialog) |
| U4 | `2a1d8f9` | One loading screen — one mark, one size, and visible in dark |
| U5 | `d35076f` | `users.preferred_lang` read back — language follows the account |
| U7.1 | `1a475b0` | `/signup` whitelisted with no route → redirect |
| U7.6 | `375befd` | `/api/version` `buildTime` was the request clock |
| U7.2 | `b88ad5d` | `<html lang>` claimed English on every route |
| U7.3 | `8a2a33e` | `/models` was German-only on a public route |
| U7.4 | `2a7ad7b` | Legal footer spoke two languages at once |
| U7.5 | `1e2b9dc` | `/help` back-link sent signed-out readers to the login wall |
| U6 | `634ea7f` | `@auth` E2E suite tests the checkout, not production |
| U8 | `03b8ef8` | The two founder proofs as literal steps |

---

## Gates

### U1 — does a build survive the screen locking?

**Server verdict, split by surface — this was not one defect but two.**

- **Agent runs: CORRECT, F-40 still holds.** `code-sessions.ts:789-812` starts the run
  detached via `startRun`, which owns its own `stopSignal`; `c.req.raw.signal` ends only
  the stream. Verified by reading the registry (`run-registry.ts:176-282`) — a disconnect
  never touches the controller.
- **Chat turns: GENUINELY DIED, and discarded the answer.** `chat-sessions.ts` wired
  `c.req.raw.signal` straight into the upstream model stream's controller. On disconnect
  the loop hit `if (abortController.signal.aborted) break` — and persistence lives *inside*
  the `done` branch, so it was never reached. Tokens spent, answer thrown away, user told
  to try again. **This is the surface the founder was on:** "die Verbindung hat kurz gehakt"
  exists only in `friendly-error.ts:83`, reachable only from `standalone-chat.tsx:596` and
  the two project-create modals.

**Client verdict: BOTH surfaces were blind to their own return.** F-40's re-attach probe
fires on **mount only** (`useAgentRun.ts`), and there was **no `visibilitychange` handler
anywhere in `apps/web`** (grep: zero hits). iOS freezes a suspended PWA instead of
unloading it, so nothing remounts on return and the probe never fires again. Worse,
`reattach` refused to run while `streaming` was true — which, after a suspension, it
permanently is.

**Classification: (c) both** — server on the chat surface, client on both.

**Fix + test.** Server: a disconnect now stops only the writes; the turn completes and
persists, bounded by the new `CHAT_MAX_RUNTIME_MS` guard. Client:
`lib/resume-on-return.ts` owns "the user came back" for both surfaces; the chat asks the
server for its transcript and adopts it only if the answer really landed.

- `chat-sessions-disconnect.test.ts` **3/3**, including the founder's exact sequence.
- **Falsified twice-over:** reinstating the old `onReqAbort` → `abortController.abort()`
  turns the founder-walk case **red** (no assistant row ever persisted, 4s timeout), and
  restoring the fix turns it green again. Both runs observed in this session.
- `resume-on-return.test.ts` **7/7** on the return rule (fake clock, no sleeps).

**Honest copy, every reachable state:** recovered (silent — the answer simply appears),
still-running (checking), genuinely lost (said plainly, message preserved). The three
connection strings in `friendly-error.ts` were German-only while the rest of the file was
bilingual; now DE+EN through `readLang()`.

**Only the founder's device can confirm:** that iOS's suspend/thaw fires
`visibilitychange` on the installed PWA as assumed, that the ≥3 s threshold is right in
practice, and the felt walk itself (lock → return → the run is THERE). The rule is unit-
tested and the DOM wiring is types-and-code, not a rendered walk — this web test
environment is `node`, with no jsdom.

### U2 — promo single-use

**What actually happened at signup — as far as the checkout can tell.** The claim itself
is correct: one conditional `UPDATE … where redeemed_by is null and revoked = false`, plus
an account-level guard, plus a per-account row lock (0098). Same-account re-entry returns
`already_redeemed_account` *before* the claim — it can never silently re-grant.

The defect is on the **signup path**, which can only ever be a deferred redemption (no
session until the confirmation mail is clicked). The code was stashed in localStorage and
redeemed on the first authenticated landing by `PendingPromoRedeemer`, which **cleared the
key immediately** and re-stashed only on `noSession`. Any other non-verdict — dropped
network, a 5xx, an unreachable API on a cold landing — cleared the code and dropped it.
The user's next stop is the trial gate, which asks again; the same code then works, and
single-use *looks* broken when the first attempt never reached the server. Secondly, the
trial-gate redirect unmounts the redeemer, so its confirmation toast was suppressed — the
redemption could succeed and the user simply never be told.

**Which of the two happened to the founder cannot be determined from the checkout.** It
needs one look at the data, and he has a one-tap surface for it (below). Both defects are
fixed, and U3 removes the entry point entirely.

**Cross-account single-use, proven** — `promo-single-use.test.ts` **11/11**: structural
assertions against the committed migration (hand-falsified: removing `redeemed_by is null`
or the account guard turns them red), plus route behaviour against a stand-in implementing
the SQL's contract — cross-account refusal DE+EN, the founder's same-account re-entry, a
second different code refused, an untouched code still usable by a third account, and **20
concurrent accounts on one code yielding exactly one winner**.

*What that concurrency test does and does not show:* it exercises the route and the
status→copy mapping under a stampede. Postgres's atomicity itself is not something a JS
test can prove — that rests on the conditional `UPDATE`, which is asserted structurally.

**Same-account behaviour, defined:** refuse, never re-grant. Copy now says a second code
isn't needed and points at the billing screen — and deliberately does **not** claim the
access is currently active, since a redeemed comp can have expired.

**Live redemption count: NOT retrieved.** This session is secretless — no production DB.
The founder does not need SQL: **`/admin/promo`** lists every code as *eingelöst/offen*
with the redeemer's email and date, and a "N Codes · M offen" counter
(`admin.ts:590`, `app/admin/promo/page.tsx`). That answers "did my test burn one or two"
in one tap.

### U3 — one place for the invite code

Signup field, its state, the localStorage stash and the orphaned import: **removed**
(`promo-entry-points.test.ts` asserts the absence). Paywall and settings entries unchanged,
both already sharing one `PromoCodeField`.

**Comped account:** never asked for a code on either surface — `is_comped` reports
`trialStatus: 'subscribed'` (`users.ts:243`); the shell routes only
`not_started`/`expired`/`none` to the gate; the gate bounces `subscribed`/`active` before
rendering; `BillingPage` gates the field behind `!isComped`. Pinned in tests. **This is a
code-level verification, not a rendered walk on a comped account.**

Money suites: API **145 files / 1546 tests**, no regressions.

### U4 — one loading screen

Inventory with before/after per surface: `_sprint/final-polish/U4_LOADING_INVENTORY.md`.
Six independently written states; the gold→green jump was the route splash (green, 64)
followed by the project chat's history load (**gold**, via `GoblinLoader`'s inline
"thinking"). The four green ones were 64 / 32 / 36 / 28.

One component, one size, one colour, an optional context line in DE+EN.
`GoblinLoader` **deleted** (no consumers left; its default variant was the gold one).

**A dark-mode bug the renders caught.** The mark used `variant="green"` → `--brand-green`,
the *locked* brand anchor that never flips, on `--surface-page` (#133224 in dark): dark
green on dark green, all but invisible. `app/loading.tsx` already had it. This is the
FIX-WAVE-3 defect class recurring, and `design-tokens.css` warns about it at `--brand-fg`
in as many words. Added a `brand` variant → `var(--brand-fg)`; test now fails if a loading
screen reaches for the anchor again.

**Renders:** `evidence/final-polish/page-loading-{light,dark}-{de,en}.png` — the real
component (`renderToStaticMarkup`, not a mock-up), all seven contexts, **375px**, both
themes, regenerable via `pnpm --filter @goblin/web render:loading`. Re-opened and read
after regeneration. *Limitation stated in the inventory:* `useLang()` resolves on an
effect that a static render never runs, so the EN sheet substitutes captions from the
component's own exported `CONTEXT_COPY` — real strings, but a substitution rather than an
independent render.

### U5 — `preferred_lang` read back

`hydrateAccountLang()` writes the account value into the same slot onboarding writes, so
account and stored preference stay **one** precedence level. Overwrites a differing local
preference (shared browsers); never overrides an explicit switcher press, and does not
even fire a re-render underneath one. Precedence still stated in exactly one place
(`lib/locale.ts` header). Switcher and settings picker both mirror to the account.

Found while wiring: the settings picker wrote only the *preference* key, so any earlier
switcher press silently outranked it — picking a language in Settings appeared to do
nothing. Fixed.

`locale.test.ts` **45/45** (14 new). **Cross-device behaviour is tested at the unit level,
not walked on two devices.**

### U6 — the `@auth` suite

Implemented Option B **plus** step 3 from the spec. `NEXT_PUBLIC_ENABLE_TEST_AUTH` on the
**build** step (it is inlined at build time — the existing `ENABLE_TEST_AUTH` on the test
step was the wrong variable, one step too late); `loginAsRealTestUser` delegates to the
origin-safe `loginAsTestCallback` when the flag is compiled in, so **all 20 `@auth` spec
files are fixed without editing one of them**; and `assertOnCheckout()` on **both** login
paths turns a silent crossover into a loud, self-explaining failure.

**GATE MET — falsified on the PR.** Run through CI on this branch:

| Run | Head | Result |
|---|---|---|
| **394** | `2a7c4e3` — probe v2 (Settings 'Modelle' label broken) | **failure — 5 failed, ALL `@auth`** |
| **395** | `de08f2a` — probe reverted | green (see below) |

Run 394's failures are exactly the intended ones: `26-settings-structure` on **both**
`auth-desktop` and `auth-mobile`, failing on `settings.getByText('Modelle', { exact: true })`;
`28-models-settings`; and `30-avatar-menu` as collateral (it opens the same surface). **All
140 `@public` tests kept passing**, because the break was on a signed-in surface only.

Why that is proof rather than just a red test: **production still renders 'Modelle'.** If
`@auth` were still crossing over to the deployed app at login, every one of those
assertions would have passed. They went red — so the suite is reading the checkout.

**A false positive worth recording.** Probe **v1** (run 393) came back **green**, and that
green meant nothing: it changed `SettingsRoot`'s page-TITLE map rather than the rendered
row label, so the assertion never saw it (`sections.ts` documents that the labels live in
two places; v1 touched a third). A green from a probe that *cannot* fail is not evidence,
and it would have been easy to bank as one.

**A second correction, about my own process.** Run 392 (the first run of this branch) was
**cancelled by me** on a wrong call: the API kept reporting the job in progress long after
it had finished, I read ~35 minutes against a 5-minute baseline as a hang, and cancelled.
The log shows it had in fact reached 169 passed / 1 failed, and that one failure passed on
retry. Nothing was wrong; I stopped a healthy run.

**Founder dashboard step required: none.** Option B was chosen precisely because it leaves
the production Supabase project untouched.

**Safety, in three places** (workflow, helper, `ENV_REFERENCE.md`):
`NEXT_PUBLIC_ENABLE_TEST_AUTH` compiles a session-minting route into the browser bundle.
CI E2E build only — **never** the Vercel project, and no runtime switch undoes it after a
build.

### U7 — the accumulated polish

| # | Item | Outcome |
|---|---|---|
| 1 | `/signup` whitelisted, no route | **Fixed** — redirect to `/login?mode=signup`. (`/register` was *not* dead: it has a real page.) |
| 2 | hard-coded `<html lang>` | **Fixed** — `<AppHtmlLangSync />` per surface; landing stays `en` by design |
| 3 | `/models` German-only | **Fixed** — public binding, all prose DE+EN; pill labels are benchmark terms and stay |
| 4 | mixed-language legal footer | **Fixed** — `LegalFooterNav`, public binding |
| 5 | `/help` dashboard back-link | **Fixed** — session-aware; `/` when signed out |
| 6 | `/api/version` `buildTime` | **Fixed** — real build stamp inlined at build; request clock renamed `serverTime`; `/status` made null-safe |

### U8 — the two founder proofs

`_sprint/final-polish/FOUNDER_PROOFS.md`: one phone-readable document, numbered steps,
prompts quoted verbatim, where the Vercel token comes from, what PASS looks like, what to
do when it doesn't appear. B3 opens with a two-second check of whether the full-stack
switch is even on, and insists the RLS probe be checked in **both** directions.

**Both flows verified as still wired at code level** (file:line table in the doc): Vercel
connector row, publish → `deployToVercel`, framework/built-output gate, Supabase connector
row, `/api/supabase` mounted, `provision_backend` behind `GOBLIN_FULLSTACK_ENABLED`.
**Neither flow was exercised** — no Vercel, Supabase or production credentials here.

---

## Suite state

| Suite | Before | After |
|---|---|---|
| API vitest | 143 files / 1532 tests | **145 files / 1546 tests**, 0 failed |
| Web vitest | 26 files / 253 tests | **28 files / 297 tests**, 0 failed |
| `tsc --noEmit` | — | **clean, exit 0** on `apps/api`, `apps/web`, `packages/shared` |

Pre-existing and untouched: the repo-root `tsc` reports errors in
`_sprint/feel-3c/c1_harness.mts` (a sprint scratch file, present on master, not part of any
build); `pnpm lint` reports many pre-existing `react-hooks` errors across the codebase.

**Per gate: checkout or production?** Every gate in this wave is **checkout** —
deterministic tests, source assertions and locally rendered components. **No gate in this
wave was run against production**, and none should be read as a production statement.

---

## Consumption (Gesetz 5)

One consumption change: an abandoned chat turn now runs to its natural stop instead of
being cut off mid-answer. `docs/GOBLIN_CONSUMPTION_LEDGER.md` M1 gains a **U1 note** in the
same commit — formula, the `CHAT_MAX_RUNTIME_MS` knob with its file:line, the offsetting
duplicate-charge effect, and both factors marked **UNMEASURED** with the one-week
reconciliation protocol.

## Migrations

**None authored, none needed.** Every unit works against the current schema. `0092`
(F-40's re-attach link) is still the founder's to apply — see below.

---

## Honest-Limitations (mandatory)

1. **U6's gate is now MET, but read what it does and does not say.** The falsification
   shows the `@auth` suite reacts to a change in THIS checkout that production does not
   have. It does not prove every `@auth` assertion is meaningful, nor that no other test
   still reaches production for some other reason. It proves the login-step crossover —
   the specific gap the spec documented — is closed.
2. **No production, no device, no walk.** Secretless sandbox. Every gate is a deterministic
   test, a source assertion, or a locally rendered component. The founder's felt walks
   (phone lock → return; the two proofs) remain the real evidence.
3. **U1's client half is not rendered.** The return rule is unit-tested with a fake clock;
   the DOM wiring (`visibilitychange`/`pageshow`/`online`) is verified by types and code
   only — the web test environment is `node`, with no jsdom, and adding one mid-wave was
   out of scope. Whether iOS fires `visibilitychange` on PWA thaw as assumed is a
   device-level fact I cannot check here.
4. **U1 does not fix an in-flight agent run whose process died.** F-40's Honest-Limitation
   #4 stands unchanged: a crashed process leaves `agent_runs.status='running'` and there is
   still no background reconciler.

   **CORRECTION — I overstated the `0092` risk.** I wrote that migration `0092` "is still
   unapplied". That was never an observation: it was carried over from F-40's build report,
   which was true *when that wave shipped*, and I restated it as current fact. This session
   is secretless and cannot read the production database, so I did not know and do not know.
   The founder's objection is well-founded — migrations are applied in ascending order, and
   `0097`/`0098` being applied makes `0092` almost certainly applied too.

   What replaces the guess: `supabase/checks/migration_status.sql`, a read-only probe that
   answers it from the database in one paste. The conditional statement that remains true is
   narrow: *if* `session_id` were absent, `findActiveRun` returns null and agent re-attach is
   never offered. The probe settles whether that "if" applies.

   **This PR authors no migrations and depends on no unapplied one** — every unit works
   against the current schema.
5. **U2 cannot say which of the two signup defects the founder actually hit.** Both are
   real and both are fixed, but attributing his specific experience needs the data. The
   live redemption count was not retrieved (no DB access) — `/admin/promo` answers it.
6. **U3's comped-paywall check is code-level.** I traced four independent places that
   prevent a code prompt for an entitled account and pinned them in tests; I did not render
   the gate while signed in as a comped account.
7. **U4's EN render sheet is a caption substitution**, not an independent render (reason in
   the inventory). And the **PWA cold-start splash is untouched**: `manifest.json` has a
   light-only `background_color` and no `apple-touch-startup-image`, so an installed PWA
   opening in dark still flashes light before the app paints. Reported, not decided —
   it is a brand/design call.
8. **U5's cross-device behaviour is unit-tested, not walked** on two physical devices.
9. **U8 verified wiring, not flows.** A code-level check that the connectors, the deploy
   path and the provisioning tool exist is not a guarantee the walk succeeds — which is
   exactly why they are the founder's proofs.
10. **Scope held.** No Act-2 code touched (`cf-deploy.ts`, `/api/ops/*`, Act-2 docs/legal).
    Nothing in this wave changes an in-flight run's behaviour except to make it survive
    longer — additive throughout, as the live-cohort rule requires.
11. **Inline gold marks left alone** (Stoppen button, agent step rows, build pill). They
    are activity indicators beside text, not loading screens; changing them is a design
    decision that belongs to the founder.

---

## The Steven question

*Would a skeptic reach my verdict with only my evidence?*

- **U1, U2, U4, U5, U7** — yes. The U1 root cause was falsified by reinstating it and
  watching the test go red; U2's structural assertions were hand-falsified; U4's dark-mode
  bug was found by opening the render, not by reasoning about it.
- **U3, U8** — yes for "the code says so", no for "it was walked". Stated that way above.
- **U6** — yes, now. The falsification ran, red on exactly the `@auth` assertions the break
  targets and green on all 140 `@public` ones. The honest footnote is that my FIRST probe
  was a dud that came back green, and I only caught it by checking which file actually
  renders the label.

---

## Founder actions — shortest possible, phone first

1. **The felt walk (2 min, phone).** Start a task on the iPhone, lock it, come back. The
   answer should be there — either still streaming or finished. If you instead see
   "Verbindung unterbrochen…", that is the new honest path and it is telling you the truth;
   tell me what it said.
2. **Check `/admin/promo` (30 s, phone).** It answers whether your test burned one code or
   two, and shows every code as *eingelöst/offen* with who has it.
3. **Confirm migrations `0091` + `0092` are applied** (Supabase SQL editor). Still
   outstanding from F-40. **Without `0092` the agent re-attach is silently never offered**,
   which blunts half of U1.
4. **U6 needs nothing from you.** The falsification ran on the PR (run 394 red on 5 `@auth`
   tests, run 395 green after the revert). No Supabase dashboard step is required — Option B
   leaves the production project untouched.
5. **When you have time: the two proofs** — `_sprint/final-polish/FOUNDER_PROOFS.md`.
   E4 needs a Vercel token; B3 needs the full-stack switch (step 2 of that doc tells you in
   two seconds whether it is on).

**HALT** — PR open, merge founder-granted.
