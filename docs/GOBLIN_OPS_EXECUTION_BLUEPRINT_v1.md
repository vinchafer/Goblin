# GOBLIN — OPS EXECUTION BLUEPRINT v1.0
**Companion to `GOBLIN_THESIS_v3_DRAFT.md` · the path, not just the thesis**

v1.0 · 2026-07-11 · Author: Steven · Status: **DRAFT — same promotion gate as Thesis v3 (§11 validation numbers)**

> Reading order for a new team member: (1) `GOBLIN_ARBEITSMETHODIK.md` — how we work, (2) `GOBLIN_THESIS_v3_DRAFT.md` — what and why, (3) this file — how, with what, in what order. Same discipline block as the thesis applies: PROPOSED numbers are proposals; the locked sequence FEEL-4 → Wave J → user-go is untouched; nothing here authorizes spend (Law 8).

---

# PART A — RED-TEAM: THE TEN HARDEST ATTACKS ON v3, AND WHAT EACH ONE CHANGED

I attacked my own thesis as a hostile DD analyst. Verdicts below are what survived. **Six attacks forced real changes** — the change list at the end of Part A is the delta v3 → v3.1.

**A1. "Static sites never break — your Keeper watches paint dry."**
Mostly true, and the most important finding in this document. A static brochure page on modern edge infra has near-zero incident rate; K0 on it produces a boring green report, which is honest but not worth $6/mo for long. **Breakage — and therefore Keeper value — lives where state lives:** forms, auth, bookings, data, third-party APIs, payments. *Consequence (accepted, resequenced):* **DATA-1 (forms first) is a precondition of the Keeper business, not an add-on.** The build order in Part C reflects this: OPS-1 → DATA-1F → KEEPER-1 as one arc. Also: the weekly report earns its keep even when green by carrying *usage* ("43 Besucher, 5 Formular-Einsendungen diese Woche") — Max has no analytics today; the report is his only window into whether his thing matters. Report = uptime + usage + security, always.

**A2. "Max won't pay for insurance — nobody buys monitoring."**
Correct as stated; fatal for the à-la-carte Keeper SKU. Nobody non-technical buys "monitoring." But the *same person provably pays $17–39/mo to Wix/Shopify* for "my site is up and handled." *Consequence (accepted, repackaged):* **kill the standalone Keeper entry SKU. The sellable unit is the "Living App": hosting + watching + honest reports + form inbox as ONE price** — the Shopify mental model. Keeper Pro (diagnosis, self-heal, backups, scan) survives as the upsell on top. Pricing rebuilt in B1.

**A3. "OpenAI/Lovable will add 'keep' within a year."**
Plausible. Three-part defense, one part new: (i) incentive mismatch — their KPI is generation volume, ours is artifact longevity (roadmaps follow KPIs); (ii) the five-property square (honesty culture + Max-language + export freedom + open-model cost floor + mobile) from Thesis §9; (iii) **NEW — turn their scale into our channel before they move: Orphan Rescue** (B2, Wedge 1). Every Lovable/Bolt/Sites user with a dead project is a warm lead whose problem their platform has publicly failed to solve. Speed matters; this is why the blueprint exists now.

**A4. "Solo-founder on-call kills it the first bad week."**
The one attack that can kill the thesis alone. Survives only with all four mitigations as *hard rules*: (1) deterministic-first — ≥95% of Keeper actions are checks and rule-based responses, not agent heroics; (2) substrate with no servers of ours to reboot (Part C: edge-serverless, CF-managed); (3) **promise discipline** — we sell "watched and honestly reported," never uptime theater; the Feeling invariants make over-promising structurally impossible, and that is a *feature* to state publicly; (4) Hire-1 is a platform engineer sharing on-call, and K-ladder height is *contractually tied in the roadmap* to team size: K3 self-heal does not ship before Hire-1 is onboarded. *Consequence: accepted with the K3 gate added.*

**A5. "Hosting margin will be competed to zero."**
True and irrelevant — hosting *is already* nearly zero COGS on the chosen substrate (Part C, verified numbers). We never compete on hosting price; hosting is the delivery mechanism of a relationship. The margin lives in the relationship (Living App), the intelligence (Keeper Pro), and eventually the transactions (Payments). *No change; claim sharpened.*

**A6. "20 users / 10 concierge asks is statistically nothing."**
Fair. *Consequence (accepted):* validation widened at zero build cost: (a) **fake-door pricing test** at user-go — the real pricing page shows the Living-App plan with a "Notify me" gate; click-through on price-exposed CTA is a willingness-to-pay signal across *all* trial users, not just 10; (b) **price-ladder script** in concierge conversations ($3 → $6 → $12 — find the wince point); (c) orphan-rescue landing page live during P1 measures pull from *other platforms'* users before we build anything. Three instruments instead of one.

**A7. "Two fronts (builder polish + ops platform) exceed one founder + AI team."**
Correct. *Consequence (accepted, needs founder sign-off → D8):* **builder feature-freeze after FEEL-4** — from user-go onward, builder work is bugfix + Feeling-regression only; 100% of new build capacity goes to the ops arc. The builder is good enough to be the funnel; it will never out-generate OpenAI, and every hour spent trying is an hour taken from the only race we can win.

**A8. "You become a data processor for your users' end-customers — GDPR scope explodes."**
Real, bounded, priceable. Forms/auth/data make Goblin a processor for the app owner's end-user data. Requirements: DPA template offered to every Living-App owner, subprocessor list published (CF, Supabase, Resend, Stripe), EU-region posture (CF EU data localization options at SPIKE-0), retention defaults, export/delete tooling (DATA-1 export covers it). This is paperwork + design constraints, not a blocker — Wix and Shopify carry the same role at scale. *Consequence: legal workstream in Part D expanded; DPA lands with DATA-1, not later.*

**A9. "Data primitives = you're building a BaaS. Scope monster."**
The most dangerous scope trap in the plan. *Consequence (accepted, fenced):* exactly **three primitives, opinionated, non-general**: Forms (submissions → table + email), Auth (login for the app's users, magic-link, one widget), Data (collections with row caps). No queries language, no functions marketplace, no general database product, no "just add one more primitive." The fence is written into the DATA-1 spec (C4) and any extension is a founder decision-table item.

**A10. "The thesis assumes kept apps get traffic. Most won't — then nothing is worth keeping."**
Sharp, and half-confirmed by W8-survival being a validation gate at all. *Consequence (accepted, new capability):* **"Keep" includes helping the app matter, not just run**: SEO/meta/share-card correctness at deploy (deterministic), QR + share kit for the owner, the usage section of the weekly report, and later a "Erste Besucher"-Playbook card. Cheap to build, directly increases artifact survival — which is *our* revenue metric. Distribution help becomes part of the Keep promise.

**Change list v3 → v3.1 (what the red-team cost the thesis):**
1. DATA-1F (forms) moves *ahead of* KEEPER-1 in the build arc; "living" implies stateful.
2. Entry SKU repackaged: **Living App** (host+keep+forms, one price) replaces à-la-carte Keeper; Keeper Pro remains as upsell.
3. K3 self-heal gated on Hire-1 onboarded (promise discipline).
4. Builder feature-freeze post-FEEL-4 (→ founder decision D8).
5. Validation widened: fake-door pricing + price ladder + orphan-rescue pull test.
6. Keep includes distribution help (usage reports, SEO/share correctness, QR kit).
7. Marketplace demoted below Agency in every sequence; DPA moved forward to DATA-1.

---

# PART B — BUSINESS 2.0 (the doubled energy)

## B1. Packaging & pricing v3.1 (all PROPOSED — CFO reconciliation §14 of thesis before any external use)

The unit the customer understands is **the app, alive**. Build plans stay the creation funnel; Living Apps are the business.

| SKU | Contains | T1 / T2 / T3 (per month) |
|---|---|---|
| Build / Pro / Power | creation (canon, unchanged) **+ included Living Apps: 1 / 3 / 10** | canon $11/19/39 · $7/12/25 · $4/7/14 |
| **Living App** (additional) | Goblin-hosted, `name.goblin.app`, SSL, K0 watch, error capture, weekly honest report (uptime+usage+security), form inbox, share/SEO kit, one-tap SQLite export | **$6 / $4 / $2.50 per app** |
| **Living App Plus** | + K2 diagnosis & one-tap fixes, K3 self-heal (post-Hire-1), backups+restore, security scan, auth+data primitives at higher caps, custom domain incl. | **$14 / $9 / $5 per app** |
| Custom domain (on base Living App) | registration at cost + handling, auto-renew, honest expiry warnings | **$9/yr flat** |
| Goblin Payments | Stripe Connect Standard; app takes bookings/payments | **1.5% / 1.0% / 1.0%** platform fee + Stripe pass-through |
| Forge packs | heavy builds & heavy diagnoses (exists conceptually) | canon mechanism |
| Agency (later, P4) | N client apps, client-branded status pages, consolidated billing | $49–99 + volume Living-App pricing |

Design notes: included Living Apps create the endowment ("mein Ding lebt schon — warum sollte ich es sterben lassen?"); the *additional*-app price is where success compounds; annual prepay (2 months free) PROPOSED for cash-flow smoothing; **public commitments carry over verbatim** (no ads, no data selling, no invisible charges, export always free). The 66.3% margin floor test applies per SKU per regional cell — with Part-C COGS it passes with an order of magnitude of headroom (B6).

## B2. GTM engine — four wedges, one loop

**Wedge 1 — Orphan Rescue (the flagship).** "Deine App lebt noch. Bring sie zu Goblin." Import from ZIP / GitHub / any builder's export → Goblin adopts it, hosts it, keeps it, first honest health report within the hour. The category's own churn crisis (documented 76% traffic collapse; orphaned projects at every incumbent) is our acquisition channel — and no incumbent can copy this wedge without admitting the orphan problem is theirs. Landing page live in P1 as a pull-measurement instrument *before* the feature exists (waitlist = evidence).

**Wedge 2 — the Kept-by-Goblin surface.** Every Living App gets an optional public status/badge ("✓ Diese App wird von Goblin am Leben gehalten — Uptime 99.8%"). The "Powered by Shopify" distribution mechanic, but the badge carries *proof* (real measured uptime), which only an honesty-architected platform can dare to show. Every kept app markets us to its visitors.

**Wedge 3 — the weekly report as growth surface.** The one email Max reliably opens (it's about *his* thing). Carries usage numbers he can't get anywhere else, one improvement suggestion, and the referral mechanic ("Schenk einem Freund einen Monat Living App"). Retention channel and referral channel in one artifact we already need to build.

**Wedge 4 — the phone-builder narrative.** Apple's crackdown crippled every mobile competitor; the 84% App-Store submission surge proves the demand. Content line: "Du brauchst keinen Laptop und keinen App Store. Bau es vom Handy. Es läuft im Browser. Goblin passt drauf auf." Founder-authentic short-video build-in-public from the iPhone (the Fable-Remote workflow *is* the content), programmatic SEO ("Was kostet eine Buchungsseite für …"-class pages), community presence where Max already asks for help.

Positioning language, canonical: **DE: "Goblin baut es. Goblin stellt es live. Goblin passt drauf auf."** · **EN: "Build it. Ship it. Goblin keeps it alive."**

## B3. Operating plan — five phases, trigger-gated (no calendar promises)

- **P0 (now → user-go):** FEEL-4 → Wave J → open-items list. Paper only in parallel: OPS-SPIKE-0, this blueprint + thesis committed to `docs/`, legal templates drafted (D-checklist), orphan-rescue landing copy written. Zero ops code.
- **P1 (user-go, ~weeks 1–8):** 20-user cohort. Instruments: Concierge-K (manual keeping + weekly hand-written honest reports), price ladder in conversations, fake-door Living-App pricing page, orphan-rescue waitlist page. Metrics: W4 unprompted return · W8 artifact-alive+used · concierge conversion (target ≥3/10) · fake-door CTR. **Gate G1** = thesis §11 numbers.
- **P2 (G1 pass):** Build arc 1 — OPS-1 (hosted publish) → DATA-1F (forms) → KEEPER-1 (K0/K1 + weekly report). Sellable Living App exists. Target: 50 living apps, Concierge users migrated onto product, Hire-1 search opens. **Gate G2:** ≥50 living apps AND monthly logo churn on Living plans <5%.
- **P3 (G2 pass):** KEEPER-2 (diagnosis+fix proposals) → DATA-1 auth/data → custom domains → orphan-rescue *feature* (import pipeline). Hire-1 onboarded → K3 unlocked. Target: 150 living apps. **Gate G3:** ≥150 living apps, ≥25 orphan rescues, support load per app known. Seed-or-bootstrap decision point (D9) — decided from strength, evidence in hand.
- **P4 (G3 pass):** MONEY-1 (Goblin Payments) → KEEPER-3/4 (self-heal, backups, scan) → Agency pilot → Hire-2. The Shopify curve begins: payments volume becomes the compounding line.

## B4. Team plan (the "1–2 Personen" he intends)

- **Hire-1 — Platform Engineer ("the Substrate Owner").** Profile: production TypeScript + edge/serverless (Workers-class), security/abuse instinct, comfortable owning on-call runbooks, allergic to dashboard theater — the Feeling test applies to hires. Sourcing: the first power users and the orphan-rescue waitlist are the pool (people who *chose* the honest platform). Owns: user-app plane, abuse SOP, on-call rotation with founder. Trigger: G2. Equity: PROPOSED band 3–8% (founder decision D10; Swiss vesting standard 4y/1y cliff).
- **Hire-2 — Keeper-Human (support/community/QA hybrid).** Turns Concierge into a scaled function; owns the human layer of "we watch it," the community, and the honesty QA on outgoing reports. Trigger: P4 or support-load threshold, whichever first.
- **Founder:** product, GTM, every decision table, the face of "build from a phone."
- **Steven/CC:** unchanged roles per Arbeitsmethodik; this document + thesis + methodology are written precisely so any Claude instance resumes the architect role losslessly (Part E).

## B5. Capital strategy — independence by default

Bootstrap math: current fixed ≈ €80/mo; ops plane adds ≈ $25–75/mo fixed (WfP base + buffers, SPIKE-0 confirms) → new break-even ≈ **15–17 Build-plan users or ~10 users with one extra Living App each** — still absurdly low, still founder-controlled. Rule: **no raise before G3.** If raised at G3, it is raised on evidence (living apps, churn, orphan pull, payments pilot) — a seed on those numbers prices itself; a seed before them prices *us*. The payments line is the venture story; it needs no capital to *start*, only to *scale*. Independence is not ideology here — it is the negotiating position.

## B6. Margin model (verified where marked)

| Line | Revenue (T1) | COGS | Gross margin |
|---|---|---|---|
| Living App | $6/app/mo | edge hosting ≈ $0.01–0.10/app/mo typical (VERIFIED class: $5 Workers plan carries 10M req + 30M CPU-ms; **zero egress/bandwidth cost**; WfP $25/mo base across *all* tenants; per-tenant hard caps available) + D1 pennies + heartbeat ≈ $0 | **>95%** typical; T3 $2.50 still clears the 66.3% floor ~10× over |
| Living App Plus | $14/app/mo | + diagnosis tokens: Swift-class ≈ $0.02–0.07/incident (ASSUMPTION at canon $0.35/M blended — measure week 1) + backup storage (B2/R2, cents) | **>90%** |
| Payments | 1.5% of GMV | ≈ $0 marginal (Stripe rails; support only) | **≈100% marginal** |
| Domains | $9/yr | registrar at cost pass-through | handling margin only — trust product, not profit line |
| Build subs | canon | canon (ledger-governed inference) | ≥66.3% floor (canon) |

The structural sentence for the pitch (after reconciliation): *the builder line carries model COGS; the ops line is nearly pure margin; the payments line is take-rate. Revenue quality improves at every step of the customer's own success.*

---

# PART C — TECHNICAL BLUEPRINT (how it gets built, with what, staying independent)

## C0. Prime architectural decision: TWO PLANES

**Platform plane (exists, unchanged):** Next.js 15 on Vercel (justgoblin.com) · Hono on Railway (API) · Supabase (platform DB/auth) · Backblaze B2 (project storage) · DeepInfra (Swift/Forge) · Stripe Live · Resend. Nothing is rewritten. The company we have keeps running.

**User-app plane (new, isolated):** Cloudflare stack —
- **Workers for Platforms** ($25/mo base): dispatch namespace, one user-Worker per Living App, **per-tenant custom limits** (CPU/request caps = runaway-bill and denial-of-wallet protection, natively supported);
- **Static Assets / Pages-class delivery**: unlimited bandwidth, the static tier of every app;
- **D1 (SQLite) one database per app**: perfect tenant isolation, and the export story writes itself — *export = the SQLite file*;
- **R2** for app assets/uploads: S3-compatible API, **zero egress**;
- **Cloudflare for SaaS** for customer custom domains (managed SSL per hostname);
- **Turnstile** on every form (abuse), **Queues** for the error-ingest pipeline, **Cron Triggers** for heartbeats.

Why two planes: blast-radius isolation (a hostile user app can never touch platform data), cost legibility (the whole user-app plane is one bill with per-tenant caps), zero-rewrite adoption, and clean team ownership later (Hire-1 owns exactly one plane).

## C1. Independence & exit paths (the "eigenständig bleiben" answer, explicit)

| Dependency | Lock-in level | Documented exit |
|---|---|---|
| Cloudflare (user plane) | medium | Workers = standard JS/Web-APIs → portable to Deno Deploy/Fastly/self-run workerd (OSS runtime); D1 = SQLite files; R2 = S3 API. Exit = re-point deploy pipeline, migrate files. |
| Models | **none by design** | wholesale per-token APIs, swappable (canon three existential conditions hold) |
| Stripe (Connect **Standard**) | low | merchants own their Stripe accounts; we hold a fee config, not their money |
| Supabase / Railway / Vercel (platform plane) | medium | Postgres + containers + Next — commodity, documented in ARCH |
| Generated apps | **none — the moat** | plain web standards (+ optional React), no proprietary runtime in user code, one-tap code+SQLite export. "You stay because it works" stays literally true. |

Rule going forward: any new dependency enters this table in the same commit that introduces it.

## C2. Deploy pipeline (OPS-1)

Existing truth-gated publish extended, not replaced: build artifact (exists) → platform API (Railway) calls CF API server-side (keys live only in Railway env — **never in CC cloud sessions**, standing law) → upload static assets + user-Worker to dispatch namespace → set per-tenant limits → bind D1/R2 → run the *existing* verification loop (entry 200, byte-match, assets 200) + new: D1 reachable, form endpoint answers → only then "Live". `name.goblin.app` wildcard first; custom domains via CF-for-SaaS in P3. Pre-deploy **abuse scan** unit: deterministic rules (blocked keywords/patterns, external-form-action to known-phish domains) + Swift-class content classifier on text content; fail = honest German message + human review path. Ledger: M-H1 (hosting COGS class), M-A1 (scan tokens).

## C3. Keeper system (KEEPER-1/2/3)

- **Heartbeat (K0):** Cron Worker per region schedule → GET entry + synthetic form-echo check + cert/domain expiry lookups → results to platform DB `app_checks`; state machine per app (healthy / degraded / down / unknown — *unknown is a first-class honest state*).
- **Error SDK (K1):** ~1 KB script auto-injected at deploy: `window.onerror`, `unhandledrejection`, wrapped `fetch` failures → `navigator.sendBeacon` → ingest Worker → Queue → platform API. Hard privacy rules: no form values, no PII, no cookies captured; DNT respected; documented in the DPA.
- **Incident pipeline:** dedupe (fingerprint) → deterministic classification first (known classes: asset 404, JS TypeError, endpoint 5xx, cert, domain, quota) → notify owner via Resend + PWA push **in Max-language** (Swift-class translation of the technical fingerprint, one honest sentence, never a stack trace — anti-pattern law).
- **Diagnosis & fix (K2):** on owner tap "Goblin, schau es dir an": bounded FEEL-3-orchestrator run (existing agent, new tool context: app repo snapshot from B2 + incident fingerprint + last deploy manifest) → output = STC-style diff + change manifest (existing surfaces reused) → owner approves → truth-gated redeploy → verify → incident closed with honest report. Budget cap per run; success rate measured as a number on a fixed incident battery (≥4/5 before any headline claim — flakiness law). Ledger M-K3; billing side = **founder decision D4** (recommend platform-COGS at launch).
- **Self-heal (K3, gated on Hire-1):** policy allowlist (dependency patch, broken asset re-link, cert/domain renewal, form-endpoint restart) × per-app owner policy × full audit log × morning digest. Never silent, never outside the allowlist.
- **Weekly report:** generator over `app_checks` + usage counters + form counts + security scan status; German/EN; the honesty QA rule: every sentence must be backed by a measured value in the row it cites. **This wave absorbs and closes the standing "monitoring consolidation" thread** — Goblin's own /health and the users' apps ride the same instrument.

## C4. Data primitives (DATA-1 — fenced per A9)

- **Forms (DATA-1F, first):** platform endpoint `/f/:appId/:formId` → Turnstile verify → validate → insert into the app's D1 → Resend notify owner → inbox table in the Goblin dashboard (mobile-first card list, design-system tokens). Caps per plan (e.g., 500 submissions/mo Build-tier, PROPOSED).
- **Auth (P3):** per-app `users` table in that app's D1; magic-link via Resend; session cookie; exactly one drop-in widget; no OAuth zoo at launch.
- **Data (P3):** constrained collections API (create/read/update/delete, row caps, no query language); auto-schema from first write; visible as tables in the dashboard.
- **Export (always):** one tap → app code (exists) + the D1 SQLite file. The export story is a *marketing asset*; treat it as product, test it in E2E.

## C5. Payments (MONEY-1, P4)

Stripe **Connect Standard** (lowest platform liability; merchant owns account & compliance surface) · `application_fee_amount` = our take · webhooks into the *hardened* billing patterns from Ticket #12 (200-after-verify, idempotency on event.id, per-call timeouts — already learned, reuse) · payout risk stays Stripe's. One opinionated use-case first: **bookings/paid forms**, not general commerce. Own decision table before build (D5).

## C6. Abuse & safety stack (day-one, not later)

No free hosting tier at launch (the single biggest abuse filter — payment = identity) · pre-deploy scan (C2) · Turnstile on all forms · per-tenant CPU/request caps (native WfP) · rate limits at dispatch · `report-abuse` endpoint + published 24h-takedown SOP + audit trail · subdomain naming rules (no brand-squat patterns) · repeat-offender = account action per AUP. Legal surface in Part D (ToS, AUP, DPA, DMCA agent).

## C7. What CC builds — wave/unit sketch (prompt-ready granularity)

- **OPS-SPIKE-0 (paper):** substrate confirmation vs. requirements table · cost model incl. new fixed line · EU-localization option check · abuse SOP draft · Keeper-credential design (how the platform plane holds CF tokens; never in cloud sessions) · deliverable = decision table D1/D2 with evidence. ~2–3 CC sessions, zero prod risk.
- **OPS-1 (≈6 units):** CF account/namespace bootstrap (founder creates account — Law 8) · deploy adapter in API · verification-loop extension · `name.goblin.app` routing · per-tenant limits · abuse-scan unit · publish-flow UI ("Live stellen" gains the hosted default path; Vercel-connect remains as "Eigenes Vercel verbinden"). Gates: E2E publish→verify on test account against prod API; evidence screenshots per unit.
- **DATA-1F (≈4 units):** form endpoint Worker · D1 provisioning per app · dashboard inbox UI · Resend notify + caps + ledger lines. Gate: real submission round-trip on a test app, screenshot + DB row.
- **KEEPER-1 (≈6 units):** cron heartbeat · checks schema/state machine · error SDK + ingest Queue · incident notify (Max-language templates, DE+EN i18n) · status card in app dashboard · weekly report generator + send. Gates: induced failure (break an asset on the test app) → incident fires → honest message received; report email opens with only measured values.
- **KEEPER-2 (≈5 units):** orchestrator tool-context extension · diagnosis run budgeting · fix-proposal surface (reuse STC manifest/diff components) · approve→redeploy→verify loop · incident battery + success-rate harness (the ≥4/5 gate). 
- Each wave: one unit = one revert-ready commit, standalone CC prompts, ledger same-commit, migrations authored-never-applied, founder merges. Unchanged laws, new territory.

---

# PART D — MASTER CHECKLIST (owner-tagged: F=Founder · S=Steven · CC · H1=Hire-1)

**Product/Engineering:** FEEL-4 (CC/S, gate: Steven regrade) ☐ · Wave J (CC) ☐ · user-go open items (F) ☐ · OPS-SPIKE-0 (S+CC paper) ☐ · OPS-1 → DATA-1F → KEEPER-1 arc (CC, gates above) ☐ · KEEPER-2 (CC) ☐ · domains/CF-for-SaaS (CC/H1) ☐ · orphan-import pipeline (CC) ☐ · MONEY-1 (CC+F decision D5) ☐ · K3 (H1 gate) ☐
**Validation (P1, zero code):** Concierge-K weekly reports (F+S) ☐ · price-ladder script (S writes, F asks) ☐ · fake-door pricing page (CC, 1 unit) ☐ · orphan-rescue waitlist page (CC, 1 unit) ☐ · G1 metrics readout (S) ☐
**Legal/Compliance:** ToS + AUP for hosted content (F w/ counsel) ☐ · DPA template + subprocessor page (S drafts, counsel reviews) ☐ · DMCA/abuse agent + SOP (S drafts) ☐ · Stripe Connect platform agreement review (F) ☐ · entity check for payments/hosting liability — GmbH timing (F, Swiss counsel; note LICENSE-name thread from DD) ☐ · domain-reseller terms (F) ☐
**Finance:** CFO dashboard v2: Living-App SKUs × 9 regional cells + 66.3% test (S) ☐ · ledger lines M-H1/A1/K1/K2/K3 authored with the waves (CC) ☐ · new fixed-cost line post-SPIKE-0 → break-even restated (S) ☐ · week-1 measurement plan for every ASSUMPTION in B6 (S) ☐
**Brand/GTM:** naming pass "Living App / Keeper" DE-EN (F+S) ☐ · status-page/badge design per design system (CC, Fable-escalation likely — design-sensitive) ☐ · weekly-report template voice (S, honesty QA) ☐ · orphan-rescue landing copy (S) ☐ · phone-builder content plan + first 10 short-video beats (F) ☐ · positioning line into pitch after D6 (S) ☐
**Hiring:** H1 job spec + Feeling-test interview questions (S drafts) ☐ · sourcing from cohort/waitlist (F) ☐ · equity decision D10 (F) ☐
**Docs (Law: what lives only in chat is lost):** commit thesis v3 + this blueprint to `docs/` ☐ · ARCH v8 outline (two planes + exit table) after G1 (S) ☐ · CLAUDE_FEELING_SPEC.md housekeeping (standing item) ☐

---

# PART E — HANDOVER PROTOCOL ("den Geist behalten")

The founder's constraint — Fable for only days — is designed around, not regretted:
1. **Everything decision-relevant is now in three repo documents:** `GOBLIN_ARBEITSMETHODIK.md` (how), `GOBLIN_THESIS_v3_DRAFT.md` (what/why), this blueprint (path). Any capable Claude instance + these three = Steven continues. The ten laws are the personality; the documents are the memory.
2. **Prompts stay standalone** (Law 9) — nothing depends on a particular session's context surviving.
3. **Every open judgment is externalized** as a decision table (D1–D10 below) or a gate with numbers (G1–G3) — no "Steven would have known" left implicit.
4. **New-hire day 1** = read the three documents in order + the anti-pattern catalog; day 2 = run one Keeper unit end-to-end on the test account.

**Consolidated founder decisions:** D1 hosting-go (SPIKE-0) · D2 substrate+fixed-cost sign-off · D3 pricing v3.1 adoption · D4 diagnosis-token billing side · D5 payments entry · D6 thesis→canon + pitch rewrite (post-G1) · D7 Concierge participation · **D8 builder feature-freeze post-FEEL-4 (new)** · **D9 bootstrap-vs-seed at G3 (new)** · **D10 Hire-1 equity band (new)**.

**Honest limitations of this blueprint:** CF prices verified 2026-07-11 at list — SPIKE-0 re-verifies against the live dashboard before D2 · every B1/B6 revenue figure is PROPOSED and unreconciled · the incident-rate assumption behind Keeper value (A1) is the largest unknown and is measured, not argued, in P1–P2 · no line of this document has met a user yet — G1 exists because of exactly that.

*Written 2026-07-11, at maximum energy and maximum honesty. The thesis says where; this says how; the cohort says whether. In that order.*
