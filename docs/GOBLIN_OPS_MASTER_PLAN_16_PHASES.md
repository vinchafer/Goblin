# GOBLIN — OPS MASTER PLAN · 16 PHASEN FÜR OPUS 4.8
**Der komplette Bau von "Living App / Keeper" — exekutierbar ohne Steven/Fable**

v1.0 · 2026-07-11 · Autor: Steven · Für: Founder + CC (Opus 4.8)
Companion zu: `GOBLIN_ARBEITSMETHODIK.md` · `GOBLIN_THESIS_v3_DRAFT.md` · `GOBLIN_OPS_EXECUTION_BLUEPRINT_v1.md`

---

## BEDIENUNGSANLEITUNG (für Vincent — Deutsch, alles ab Master-Block Englisch)

**So funktioniert dieses Dokument:** Jede Phase wird zu genau einem Standalone-CC-Prompt, indem du **zwei Blöcke** in eine frische (gecleerte) Opus-Session pastest: (1) den `MASTER HARD RULES BLOCK` unten — immer, wörtlich, komplett — und (2) den jeweiligen `PHASE N`-Block. Das erfüllt das Standalone-Protokoll ohne 16-fache Duplikation. Niemals zwei Phasen in einer Session ketten (Langlauf-Schutz der Methodik).

**Ablauf pro Phase:** Session clearen → Block + Phase pasten → Opus arbeitet Unit für Unit → Opus öffnet PR (Cloud-Modus, niemals selbst mergen) → du prüfst den Report gegen die Gates → mergen via GitHub-App → Migrationen anwenden, falls im Report gelistet → Founder-Actions der Phase abarbeiten. Bei jedem HALT im Report: nichts mergen, HALT-Grund lesen, entscheiden.

**Dein Steven-Ersatz ist die Selbst-Review-Checkliste** in `GOBLIN_ARBEITSMETHODIK.md` — der Master-Block zwingt Opus, sie vor jedem PR durchzugehen und das Ergebnis in den Report zu schreiben. Deine Prüf-Frage bei jedem Report bleibt die Steven-Frage: *"Käme ein skeptischer Prüfer mit nur dieser Evidenz zu diesem Urteil?"* Wenn der Report Adjektive statt Zahlen enthält oder Artefakte behauptet, die du nicht öffnen kannst → zurückweisen, nicht mergen.

**Sequenz-Gesetz:** Phase 0 (Papier) darf sofort nach user-go-Vorbereitung laufen. **Phasen 1–15 starten erst nach Gate G1** (Validierungszahlen der ersten Kohorte, Thesis §11: W4-Rückkehr · W8-App-lebt · Concierge ≥3/10). Phasen strikt in Reihenfolge, außer als PARALLEL-SAFE markiert. Phase 13 ist auf Hire-1 gesperrt, Phase 14 auf Decision D5 — diese Sperren stehen in den Phasen selbst und Opus wird sie respektieren; überstimme sie nicht spontan.

**Modell:** Alles Opus 4.8. Einzige empfohlene Ausnahme: Phase-Units, die mit `[DESIGN-SENSITIVE]` markiert sind (Status-Card, Report-E-Mail, Badge) — dort, falls verfügbar, stärkeres Modell, sonst Opus mit den Design-Gates.

---

## MASTER HARD RULES BLOCK (paste this verbatim at the top of EVERY phase prompt)

```
=== GOBLIN OPS BUILD — STANDING CONTEXT & ABSOLUTE RULES (v1.0, 2026-07-11) ===

CONTEXT: You are CC (Claude Code, Opus 4.8), the executor for Goblin (justgoblin.com) — a cloud-native
AI build-and-deploy platform for non-technical builders, live on Vercel (Next.js 15 web) + Railway
(Hono API) + Supabase (platform DB/auth) + Backblaze B2 (project storage) + Stripe Live + DeepInfra
(inference: Goblin Swift = DeepSeek V3.2, Goblin Forge = Kimi K2.6) + Resend (email). Monorepo pnpm:
apps/web + apps/api + packages/shared. Repo: vinchafer/Goblin. You are building the OPS PLATFORM
extension ("Living App" hosting + "Keeper" operations agent) per docs/GOBLIN_THESIS_v3_DRAFT.md and
docs/GOBLIN_OPS_EXECUTION_BLUEPRINT_v1.md — read both in Phase 0 of every session. The user-app plane
runs on Cloudflare (Workers for Platforms, D1 per app, R2, Turnstile, Cron, Queues); the platform
plane (existing stack) is NOT rewritten.

ABSOLUTE RULES — violating any of these is a failed session regardless of code quality:
1. STATE-FIRST. Before any work: git log --oneline -15, check /api/version endpoints, verify every
   file this prompt names actually exists. If the prompt contradicts repo reality, BELIEVE THE REPO,
   HALT, report the discrepancy. The prompt is a plan; the repo is the truth.
2. ONE UNIT = ONE ISOLATED, REVERT-READY COMMIT. No drive-by fixes outside scope; found bugs are
   reported as FINDINGS, fixed only if the fix is ≤1 commit and the phase allows it.
3. GREEN = SEEN. A gate passes only if its evidence artifact exists and you re-opened and checked it.
   Deterministic verification is labeled as such. Success rates as numbers ("4/5"), never adjectives.
   NEVER claim an action you did not perform, a state you did not verify, or content you did not see.
4. CLOUD MODE: you open a PR; you NEVER merge. Migrations are AUTHORED, never applied — code must be
   pre-migration tolerant and tested in both states; the founder applies migrations.
5. NO live keys, service-role keys, or Cloudflare account tokens in this session, ever. Server-side
   secrets live only in Railway env; you write code that reads them, you never see values. Real-model
   or real-API gates run against the PROD API using ONLY test accounts vinc.hafner3@gmail.com
   (fallback vinc.hafner4@gmail.com). NEVER the founder's personal account.
6. NO new paid service, no new account, no live-money action. Where one is needed, output exact
   founder setup steps instead and mark the unit BLOCKED-ON-FOUNDER.
7. CONSUMPTION LEDGER: any change affecting tokens or external costs updates
   docs/GOBLIN_CONSUMPTION_LEDGER.md IN THE SAME COMMIT (trigger, formula, adjustment lever + code
   location, cost, billing side user-quota vs platform-COGS, dependent CFO figure).
8. FEELING INVARIANTS bind every user-facing string and mechanism: German UI strings + EN i18n keys;
   design-system tokens only (--text/--border/--panel etc., fonts Manrope/Instrument Serif/JetBrains
   Mono); no phantom affordances (visible-disabled "Bald" is honest, clickable-dead is forbidden);
   never a raw stack trace to a user; honest degradation in the user's language; UNKNOWN is a valid
   honest state and must be shown as such, never guessed into green.
9. ESCALATE, don't decide: money/plans, new paid dependencies, security model, scope expansion,
   licenses/legal, product philosophy, user data policy, anything irreversible beyond git-revert →
   output a DECISION TABLE for the founder and HALT that unit.
10. SELF-REVIEW before the PR (mandatory, results go in the report): evidence audit (open every
    referenced artifact — does it show what the report claims?), diffstat vs scope, one regression
    probe on an untouched path, honesty sweep of new user strings (invented claims/times/labels →
    remove), ledger check, report completeness. The skeptic question: "Would a skeptical reviewer,
    with only my evidence, reach my verdict?" If no → add evidence or weaken the claim.

REPORT FORMAT (end of session, mandatory): PR link · unit list with SHAs · per-gate evidence refs ·
numeric success rates · HONEST LIMITATIONS section (mandatory, "none" must be argued) · FINDINGS ·
FOUNDER ACTIONS (migrations to apply, env vars to set, decisions pending) · self-review results.

FEW-SHOT — the exact failure to avoid:
WRONG report line: "Deployed and verified, everything works great."
RIGHT report line: "Publish gate: 5/5 verification loops green on test app goblin-test-3
(evidence: screenshots s1–s5 in PR, D1 row count = 5). Runtime smoke NOT executed (no browser in
sandbox) — marked UNVERIFIED."
WRONG user string: "Deine App ist sicher und läuft perfekt."
RIGHT user string: "Letzte Prüfung 14:02 Uhr: Startseite erreichbar, Formular antwortet. Nächste
Prüfung in 5 Minuten."
=== END STANDING BLOCK ===
```

---

## GLOBAL SEQUENCING RULES (read once, they are repeated where they bind)

G1 (validation numbers) gates Phases 1–15 · Phase 0 is paper and may run pre-G1 · PARALLEL-SAFE marks the only phases that may run as a second stream (own worktree/branch — never two sessions on one working copy) · Phase 13 hard-gated on Hire-1 onboarded · Phase 14 hard-gated on founder decision D5 · every phase's first unit is the Law-1 state check · if a phase discovers its preconditions unmet → HALT, do not improvise forward.

---

# THE 16 PHASES

## PHASE 0 — OPS-SPIKE-0: SUBSTRATE EVIDENCE & DECISION TABLE (paper, pre-G1 allowed)
**Objective:** Turn the blueprint's Cloudflare recommendation into founder-decidable evidence. No product code.
**Units:** (0.1) Requirements-vs-substrate matrix: verify against LIVE Cloudflare docs (fetch, do not trust memory): Workers for Platforms pricing/limits, per-tenant custom limits API, D1 per-tenant model + export, R2, CF for SaaS custom hostnames, Turnstile, Cron, Queues, EU data localization options. Cite URLs + retrieval date. (0.2) Cost model: fixed line (WfP base + buffers) and marginal cost per Living App at 3 traffic profiles (dead/typical/viral-day); output a table; state the new break-even delta. (0.3) Abuse SOP draft: pre-deploy scan design, report-abuse endpoint spec, 24h takedown runbook, subdomain naming rules. (0.4) Credentials architecture: where CF tokens live (Railway env only), how deploy adapter authenticates, rotation plan; explicit statement why cloud CC sessions never touch them. (0.5) Deliverable: `docs/OPS_SPIKE_0_DECISION_TABLE.md` covering D1 (hosting go), D2 (substrate + fixed cost) with options, evidence, recommendation.
**Gates:** every claim in 0.1 carries a live-doc citation; cost table arithmetic shown; decision table complete.
**Founder actions after:** decide D1/D2; if GO: create Cloudflare account + WfP subscription (exact steps from 0.4), put tokens in Railway env.

## PHASE 1 — FOUNDATION: DEPLOY ADAPTER & NAMESPACE (post-G1, post-D1/D2)
**Objective:** The platform plane can talk to the user-app plane. Nothing user-visible yet.
**Preconditions:** G1 passed · CF account exists · `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_DISPATCH_NAMESPACE` set in Railway (verify presence via a health probe, never print values).
**Units:** (1.1) `apps/api/src/services/cf-deploy.ts`: typed adapter — uploadUserWorker, uploadStaticAssets, setTenantLimits, provisionD1, bindResources, deleteApp (batched — remember the unbatched-deleteProject anti-pattern). (1.2) `ops_apps` table migration (AUTHORED only): app_id, user_id, namespace_script_id, d1_id, status, caps_profile, created_at. (1.3) Health probe `GET /api/ops/health`: CF reachable, namespace exists, token scope correct — deterministic, no secrets in output. (1.4) Integration test against a throwaway script in the namespace: create → verify exists via CF API read-back → delete → verify gone (evidence: API responses in test output).
**Gates:** 1.4 round-trip 3/3 · migration file exists but NOT applied · code tolerant to missing table (feature-flag `OPS_HOSTING_ENABLED=false` default).
**Ledger:** M-H1 line authored (hosting COGS class, platform-COGS).
**Founder actions:** apply migration when merging; keep flag off.

## PHASE 2 — HOSTED PUBLISH (STATIC): THE FIRST LIVING URL
**Objective:** A Goblin project publishes to `name.goblin.app` through the existing truth-gated pipeline.
**Units:** (2.1) Wildcard routing: dispatch Worker resolving `{name}.goblin.app` → tenant script (plus reserved-names list: www, api, admin, status, mail…). (2.2) Publish path in API: build artifact (existing) → cf-deploy upload → setTenantLimits(default caps) → record in ops_apps. (2.3) Extend the EXISTING verification loop: entry 200 via public URL, N assets byte-checked, headers sane; reuse, don't fork, the current verifier. (2.4) Name claim flow: availability check, honest German errors ("Dieser Name ist vergeben"), rename = new deploy + old released. (2.5) E2E on prod API with test account: publish test app → verification green → screenshot of live URL fetched server-side (curl output as evidence, since sandbox has no browser — label it deterministic).
**Gates:** 2.5 publish→verify 5/5 · caps demonstrably set (CF API read-back in evidence) · flag still off for real users.
**HALT if:** wildcard DNS/SSL for `*.goblin.app` not yet configured — output exact founder steps (CF dashboard) and stop.

## PHASE 3 — PUBLISH UX + PRE-DEPLOY ABUSE SCAN
**Objective:** "Live stellen" gets the hosted default path; nothing ships un-scanned.
**Units:** (3.1) [DESIGN-SENSITIVE] Publish sheet v2: hosted path default ("Live auf name.goblin.app — nichts zu verbinden"), Vercel-connect remains as "Eigenes Vercel verbinden (für Fortgeschrittene)" — both honest, neither phantom; German + EN i18n. (3.2) Pre-deploy scan unit: deterministic ruleset (blocked patterns, external form-action targets, crypto-drainer signatures) + Swift-class content classifier on extracted text; verdict pass/review/block with honest user message; review queue table (migration AUTHORED). (3.3) Scan wired into publish path before upload; blocked = nothing uploaded. (3.4) Admin review surface (minimal list in /admin, reuse existing admin patterns).
**Gates:** scan battery: 10 seeded samples (7 benign, 3 hostile from 3.2's own test fixtures) → expected verdicts 10/10 · publish UX walk on test account with screenshots · no English leaks (grep i18n).
**Ledger:** M-A1 (scan tokens: formula = extracted-text tokens × classifier rate; platform-COGS).

## PHASE 4 — DATA-1F: FORMS (the "living" precondition)
**Objective:** Every Living App can receive form submissions; the owner sees them.
**Units:** (4.1) D1 provisioning on first form-enabled publish (per-app DB; record d1_id). (4.2) Ingest endpoint `/f/:appId/:formId` as platform Worker: Turnstile verify → schema-light validation → D1 insert → Resend notify owner (German template, honest: what arrived, when, from which form — no invented context). (4.3) Dashboard inbox: mobile-first card list per app, mark-read, CSV export; design tokens only. (4.4) Caps per plan (PROPOSED 500/mo Build-tier; read from config, not hardcoded) + honest over-cap behavior (submission stored? NO — rejected with honest message to visitor AND owner notified; decide-and-document in code comment referencing this phase). (4.5) Form snippet auto-injected into generated apps that declare a form (builder-side minimal change).
**Gates:** real round-trip on prod test app: submit → D1 row (evidence: row dump) → owner email received (evidence: screenshot from test-account inbox) 3/3 · Turnstile failure path honest.
**Ledger:** email sends line if not covered; caps documented.
**Founder actions:** apply migrations; confirm Turnstile keys in Railway (setup steps provided).

## PHASE 5 — KEEPER-1a: HEARTBEAT & HONEST STATUS (K0)
**Objective:** Goblin factually knows whether each Living App is up — and shows it without cosmetics.
**Units:** (5.1) Cron Worker (5-min tier): GET entry, form-echo synthetic, cert/domain expiry lookups → POST results to platform API. (5.2) `app_checks` schema + state machine healthy/degraded/down/UNKNOWN (migration AUTHORED); UNKNOWN is first-class (e.g., cron gap = UNKNOWN, never assumed green). (5.3) [DESIGN-SENSITIVE] Status card in app dashboard: last-check timestamp always visible, state in plain German ("Zuletzt geprüft 14:02 — erreichbar"), uptime 7d as measured number. (5.4) Platform self-checks fold in: Goblin's own /health rides the same instrument (begins the monitoring consolidation). 
**Gates:** induced-failure test: break test app asset → state flips to degraded within 2 cycles (evidence: check rows) → fix → recovers; 3/3 runs · UNKNOWN path demonstrated (pause cron in test) · card shows only measured values (honesty sweep).
**Ledger:** M-K1 (heartbeat ≈ $0, platform-COGS) authored.

## PHASE 6 — KEEPER-1b: ERROR CAPTURE & INCIDENTS (K1)
**Objective:** When an app breaks in a visitor's browser, the owner learns it — in their language.
**Units:** (6.1) Error SDK ~1KB injected at deploy: onerror/unhandledrejection/fetch-fail → sendBeacon; hard privacy rules in code (no form values, no PII, no cookies; DNT respected) + a PRIVACY.md section. (6.2) Ingest Worker → Queue → API; fingerprint dedupe; incident table (migration AUTHORED). (6.3) Deterministic classification (asset-404 / js-error / endpoint-5xx / cert / domain / quota) — Swift only for the one-sentence German explanation, never for the verdict. (6.4) Owner notification: Resend + PWA push, Max-language, one honest sentence + one next step; NEVER a stack trace. (6.5) Incident list in dashboard with state (offen/erklärt/behoben).
**Gates:** seeded-error battery on test app: 5 error classes → 5 correct classifications → 5 honest notifications received (screenshots) — report as N/5 · dedupe proven (same error ×20 → 1 incident) · privacy grep: no captured-value fields anywhere.
**Ledger:** M-K2 (explanation tokens, formula, platform-COGS).

## PHASE 7 — KEEPER-1c: THE WEEKLY HONEST REPORT
**Objective:** The one email the owner opens — uptime + usage + forms + security, every sentence backed by a measured row.
**Units:** (7.1) Usage counters (privacy-light: request counts per app from edge logs/analytics engine — verify availability live, else server-side counter; NO visitor tracking beyond counts). (7.2) [DESIGN-SENSITIVE] Report template DE/EN: measured-values-only rule enforced by construction (template renders from a typed struct; free text limited to the one improvement suggestion, marked as suggestion). (7.3) Generator + weekly send (Resend), per-user opt-out honored. (7.4) Referral block placeholder (mechanic in Phase 8, honest "Bald" until then is FORBIDDEN as clickable — omit instead).
**Gates:** generated report for the test app opened side-by-side with DB rows: every number traced (evidence: annotated screenshot) · zero unbacked sentences (honesty sweep is the gate) · send/receive proven on test account.
**Note:** this phase CLOSES the standing "monitoring consolidation" thread — state it in the report.

## PHASE 8 — BILLING: LIVING APP SKUs (PARALLEL-SAFE with 5–7 after Phase 4)
**Objective:** The Living App is purchasable; included-apps logic works; nothing invisible is billed.
**Preconditions:** founder decision D3 (pricing v3.1 adoption) — HALT at start if undecided.
**Units:** (8.1) Stripe products/prices for Living App + Plus across 3 regional tiers (test mode first; live creation = founder step list). (8.2) Included-apps logic (Build=1/Pro=3/Power=10) + entitlement checks at publish. (8.3) Upgrade/downgrade flows with honest proration copy; webhook handling reuses the HARDENED billing patterns (200-after-verify, idempotency, per-call timeouts — Ticket #12 style, verify they exist, reuse). (8.4) Pricing page update: real Living-App pricing replaces fake-door; PROPOSED-price guard: prices read from config traceable to CFO dashboard v2 — if CFO v2 not yet reconciled, HALT this unit. (8.5) CFO-dashboard v2 reconciliation support: emit a `docs/OPS_PRICING_TRACE.md` mapping every UI price → dashboard cell.
**Gates:** test-mode checkout → entitlement → publish allowed round-trip 3/3 on test account · webhook battery green (existing suite extended) · price-trace file complete.
**Founder actions:** D3 · live Stripe products (steps provided) · CFO dashboard v2 sign-off before 8.4 merges.

## PHASE 9 — KEEPER-2: DIAGNOSIS & ONE-TAP FIX (K2)
**Objective:** "Goblin, schau es dir an" → bounded diagnosis → proposed diff → approve → truth-gated redeploy.
**Units:** (9.1) Orchestrator tool-context extension: incident fingerprint + repo snapshot (B2) + last deploy manifest as inputs to the EXISTING FEEL-3 agent (reuse, don't fork). (9.2) Run budget: hard token/step caps; over-budget = honest "Ich konnte es nicht sicher eingrenzen" (never a guessed fix). (9.3) Fix-proposal surface reusing STC manifest/diff components; approve → redeploy → verification loop → incident auto-closes ONLY on green re-check. (9.4) Incident battery harness: 10 scripted breakages across the Phase-6 classes; measure fix-success as N/10; persist harness for regression. (9.5) Billing side per founder decision D4 (default platform-COGS; if quota → wire to existing consumption path).
**Gates:** battery ≥ 7/10 with zero false "behoben" claims (a wrong fix marked fixed = phase fail regardless of rate) · budget cap proven (seeded unsolvable case → honest degradation message).
**Ledger:** M-K3 (diagnosis run formula; billing side per D4).

## PHASE 10 — DATA-1 AUTH: "MEINE KUNDEN KÖNNEN SICH EINLOGGEN"
**Objective:** Per-app end-user auth, one widget, magic-link only.
**Units:** (10.1) Per-app `users` table in that app's D1; session cookie (httpOnly, per-app scope). (10.2) Magic-link flow via Resend; rate-limited; honest error states. (10.3) One drop-in widget (login/logout/state), design tokens, DE/EN. (10.4) Builder integration: "Login für deine Nutzer" as declared capability. (10.5) DPA groundwork: subprocessor page + data-category doc updated (processor role begins here — reference Blueprint A8).
**Gates:** full auth round-trip on prod test app 3/3 (evidence: emails + session proof) · rate-limit proven · scope fence honored (NO OAuth providers, NO password auth — Blueprint A9 fence; adding any = decision-table HALT).

## PHASE 11 — DATA-1 DATA + EXPORT: THE ANTI-LOCK-IN PROOF
**Objective:** Constrained collections + the one-tap export that makes "you stay because it works" literally true.
**Units:** (11.1) Collections API (CRUD, row caps per plan, auto-schema on first write; NO query language — fence). (11.2) Dashboard table views (mobile-first). (11.3) One-tap export: app code (existing) + D1 SQLite file download; export is a PRODUCT — E2E-tested, documented user-facing. (11.4) Delete-my-app flow incl. D1/R2 teardown (batched, revert-window honest copy).
**Gates:** export opened locally in sqlite3 with row-count match (evidence: command output) 3/3 · caps enforced honestly · teardown leaves zero orphan resources (CF API read-back).

## PHASE 12 — CUSTOM DOMAINS (PARALLEL-SAFE after Phase 8)
**Objective:** `meinefirma.ch` on a Living App, with the honest expiry story.
**Units:** (12.1) CF-for-SaaS custom hostname integration (verify live docs; per-hostname cost → ledger + pricing trace). (12.2) Guided DNS flow with per-registrar honest instructions + verification states (pending is shown as pending, never spun as done). (12.3) Expiry/renewal watch into Keeper checks + report. (12.4) $9/yr handling SKU wiring (Phase 8 patterns).
**Gates:** real domain connected on test app (founder provides one throwaway domain — founder action) end-to-end with SSL green · pending/failure states walked with screenshots.

## PHASE 13 — KEEPER-3: SELF-HEAL (K3) — **HARD-GATED: HIRE-1 ONBOARDED**
**Objective:** Pre-authorized fix classes applied autonomously, audited, reported every morning.
**Precondition check (Law-style):** founder statement "Hire-1 onboarded, on-call shared" in the prompt — absent → HALT immediately (promise discipline: unattended healing without a second human is a promise Goblin cannot keep).
**Units:** (13.1) Policy engine: allowlist (dependency patch, asset re-link, cert/domain renewal, form-endpoint restart) × per-app owner opt-in policy. (13.2) Execution path = Phase-9 loop minus approval, plus double verification. (13.3) Audit log + morning digest ("Heute Nacht: 1 Eingriff, hier ist er, hier der Beweis"). (13.4) Kill-switch per app + global.
**Gates:** each allowlisted class demonstrated once on seeded breakage with digest evidence · out-of-allowlist case proven to NOT act (negative test is the headline gate).

## PHASE 14 — MONEY-1: GOBLIN PAYMENTS — **HARD-GATED: FOUNDER DECISION D5**
**Objective:** Bookings/paid forms via Stripe Connect Standard; our fee as application_fee.
**Units:** (14.1) Connect Standard onboarding flow (merchant owns account; we store account id + fee config only). (14.2) One opinionated use case: paid form/booking block for Living Apps. (14.3) Webhooks into hardened billing patterns; payout status honest ("Auszahlung ist Sache von Stripe — Status: …" with real status). (14.4) Fee config per regional tier from CFO v2 trace. (14.5) Legal surface checklist emitted for founder (platform agreement, receipt requirements).
**Gates:** test-mode end-to-end: visitor pays on test app → merchant test account receives → our fee visible in Stripe test dashboard (screenshots) 3/3 · refund path walked.

## PHASE 15 — ORPHAN RESCUE + HARDENING + ARCH v8 (the closing arc)
**Objective:** The flagship wedge ships, and the platform is DD-clean again.
**Units:** (15.1) Import pipeline: ZIP + GitHub repo → project ingest → publish path → first honest health report within the hour (the marketing promise, made literal). (15.2) Rescue landing page wired to real flow (replaces waitlist). (15.3) E2E suite extension across Phases 1–14 critical paths; numeric pass rates in report. (15.4) `docs/GOBLIN_ARCH_v8.md`: two-plane architecture + dependency/exit table (Blueprint C1) + Schema A carried through. (15.5) Security pass: secrets scan (gitleaks), permissions audit on ops endpoints, abuse SOP rehearsal (one simulated takedown, timed). (15.6) Docs travel with features check: every phase's user-facing capability documented in Hilfe (Wave-J agent content updated).
**Gates:** one real orphan (a founder-provided export from another tool) rescued end-to-end with report evidence · E2E ≥ existing suite green + new paths numeric · gitleaks clean · takedown rehearsal ≤ 24h simulated.

---

## WAS DIESER PLAN BEWUSST NICHT ENTHÄLT
Agency-Tier, Marketplace, Payments-Skalierung, i18n über DE/EN hinaus — alles Post-G3, alles eigene Entscheidungen. Und: kein Phase-Plan überlebt den Kontakt mit G1 unverändert — wenn die Kohorte etwas anderes sagt (z.B. A10: Apps sterben an Traffic-Mangel, nicht an Bugs), dann gilt Gesetz 10 im Grossen: **die Realität ist die Wahrheit, der Plan ist der Plan.** Opus wird das nicht selbst umwerfen — das ist dann dein Call, mit der Decision-Table-Mechanik.

*16 Phasen, jede ein PR, jede ein Gate, jede revertierbar. Genau so, wie FEEL gebaut wurde — nur ist das Ziel diesmal die Firma.*
