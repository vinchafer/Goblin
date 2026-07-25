# OPS-SPIKE-0 — SUBSTRATE EVIDENCE & DECISION TABLE

**Act 2 · Phase 0 · PAPER ONLY — no product code, no migration, no paid action.**

v1.0 · Retrieval date for every Cloudflare citation below: **2026-07-25** · Author: CC
Companion to `GOBLIN_THESIS_v3_DRAFT.md` · `GOBLIN_OPS_EXECUTION_BLUEPRINT_v1.md` · `GOBLIN_OPS_MASTER_PLAN_16_PHASES.md`

> **What this document is.** The blueprint *recommended* Cloudflare. This document turns that
> recommendation into evidence the founder can sign or reject. Every substrate claim carries a live
> documentation URL fetched on 2026-07-25 — **zero claims from training memory**. Where the live docs
> do not answer a question, this document says so and prices both outcomes rather than guessing.
>
> **What this document is not.** It is not an authorization to spend. Nothing here creates an account,
> subscribes to a plan, or touches a key. The founder decides D1 and D2; §6 is the click-by-click list
> for executing them if the answer is GO.

---

## 0. STATE CHECK (Law 1) — repo reality vs. this prompt

Performed before any research. `git log --oneline -15` at `5524d87` ("Merge PR #55 — Founder-Walk-3").
All three named documents exist and were read in full. **Four discrepancies found; none is fatal;
all are reported rather than silently absorbed.**

| # | Prompt / plan says | Repo says | Handling |
|---|---|---|---|
| S1 | Branch from `origin/main` | The repository's default branch is **`master`**. `origin/main` does not exist (`git fetch origin main` → `fatal: couldn't find remote ref main`). | Worked from `origin/master` (`5524d87`), which the working branch already matched exactly. No divergence. |
| S2 | "Each blueprint requirement (**Blueprint** §5.2 a–e)" | The Blueprint has no §5.2 — it is structured PART A–E with sections C0–C7. The (a)–(e) requirement list lives in **`GOBLIN_THESIS_v3_DRAFT.md` §5.2 (SHIP)**, line 79. | Used **Thesis §5.2 (a)–(e)** as the requirement set. This is the only list in the repo matching the description. |
| S3 | "the canonical ~13–14 users (**WS-C**)" | The token `WS-C` appears in the repo only as an unrelated code-comment tag for a past walk (`apps/web/app/dashboard/page.tsx:261`, `about/page.tsx:6`, `lib/api.ts:64`). It is **not** a financial anchor. | Used the two real in-repo anchors: Thesis §8 (`:154`) "Break-even stays ~13 payers at ~€80/mo fixed (canon)" and `NAV_MAP_L2_PIVOT.md:17` (net ARPU ≈ $9.40 · contribution ≈ $8.83 · break-even ~13 users). Stated as inherited, not re-derived — see §2.5. |
| S4 | Thesis §14 names `GOBLIN_CFO_DASHBOARD_DE.html` as "the financial source of truth" | **That file does not exist in the repo** (`find . -iname "*CFO*"` → no results). | Every figure in §2 is therefore *document-derived*, not dashboard-derived. Flagged in §7 Limitations. The CFO-v2 reconciliation in Thesis §14 remains an open founder/Steven task and is a hard precondition of Phase 8. |

**No contradiction rises to a HALT.** The substrate work is unaffected by S1–S4; the cost work is
affected only by S3/S4, and is presented as a *delta* computation for exactly that reason (§2.5).

---

# U0.1 — REQUIREMENTS-VS-SUBSTRATE MATRIX

## 1.1 Verdicts against Thesis §5.2 (a)–(e)

Verdict legend: **VERIFIED** = live doc states it explicitly · **PARTIAL** = substantially supported
but with a named gap or an inference step · **FAILED** = the substrate does not meet the requirement.

| Req | Thesis §5.2 wording | Verdict | Evidence (all retrieved 2026-07-25) |
|---|---|---|---|
| **(a)** | "static + serverless-dynamic tiers" | **VERIFIED** | Static tier: Workers Static Assets — *"Requests to static assets are free and unlimited."* Limits: 100,000 files per Worker version (Paid), 25 MiB per file. Dynamic tier: user Workers in a dispatch namespace, *"Max of 30 seconds of CPU time per invocation."* Both tiers are the same deploy unit. [workers/platform/pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [static-assets/billing-and-limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) · [workers/platform/limits](https://developers.cloudflare.com/workers/platform/limits/) · [wfp/reference/pricing](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/) |
| **(b)** | "hard per-app resource caps (cost blowout protection)" | **PARTIAL** | Native and real, but **narrower than the blueprint implies**. WfP custom limits expose exactly **two** knobs — `cpuMs` and `subRequests` — set **at dispatch time**, not at upload time: `env.dispatcher.get(workerName, {}, { limits: { cpuMs: 10, subRequests: 5 } })`. On breach *"the user Worker will immediately throw an exception."* **Gap: there is no per-tenant *request-count* cap and no per-tenant memory cap in this API.** A request-rate cap must be built by Goblin at the dispatch Worker. [wfp/configuration/custom-limits](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/custom-limits/) |
| **(c)** | "EU-storage compatibility with the existing B2/Supabase posture" | **PARTIAL** | Achievable at the *data* layer, **not** at the network layer without Enterprise. **D1:** jurisdiction `eu` *"constrains data to run and store within a region to help comply with data locality regulations such as GDPR"*; hints `weur`/`eeur`. **R2:** jurisdictions `eu` and `fedramp`; endpoint `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`. **Both are immutable after creation** — D1: *"Jurisdictions can only be set on database creation and cannot be added or updated after the database exists"*; R2: *"Once an R2 bucket is created, the jurisdiction cannot be changed."* **Gap:** the Data Localization Suite (Regional Services, Customer Metadata Boundary, Geo Key Manager) is an *"Enterprise-only paid add-on"* — so *where TLS terminates and where metadata flows* is **not** controllable on a $25 plan. [d1/configuration/data-location](https://developers.cloudflare.com/d1/configuration/data-location/) · [r2/reference/data-location](https://developers.cloudflare.com/r2/reference/data-location/) · [data-localization](https://developers.cloudflare.com/data-localization/) |
| **(d)** | "marginal cost per idle app ≈ $0.00x (ASSUMPTION to verify)" | **VERIFIED** — and better than assumed | Computed in §2.2 from live rates: an idle app costs **≈ $0.004/month at marginal rates, and $0.00 inside the included allotment**. The dominant driver is Goblin's own heartbeat, not the app. D1 bills *"scale-to-zero"*; egress is $0 on Workers, D1 and R2 alike (*"There are no additional charges for data transfer (egress) or throughput (bandwidth)"* · *"no data transfer (egress) or throughput (bandwidth) charges for data accessed from D1"* · R2 egress *"Free"*). |
| **(e)** | "abuse controls (subdomain phishing is a day-one threat)" | **PARTIAL** | The *primitives* exist and are verified: Turnstile free tier with *"Unlimited challenges"*; per-tenant `cpuMs`/`subRequests` caps; instant `DELETE` of a single tenant script. **But no Cloudflare feature performs content moderation for us** — the pre-deploy scan, the report-abuse path and the takedown runbook are Goblin's to build and operate (U0.3). The requirement is met by *substrate + our own layer*, not by substrate alone. [turnstile/plans](https://developers.cloudflare.com/turnstile/plans/) · [wfp/reference/platform-examples](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/platform-examples/) |

**Summary: (a) and (d) VERIFIED · (b), (c), (e) PARTIAL · nothing FAILED.**
No requirement is unmet in a way that blocks D1. Each PARTIAL has a named, bounded engineering
consequence, carried into §1.3.

## 1.2 Component-by-component evidence table

Every row was fetched live on **2026-07-25**. Figures in quotes are the documentation's own words.

| Component | Verified facts | Source |
|---|---|---|
| **Workers for Platforms — price** | *"The Workers for Platforms Paid plan is **$25 monthly**."* Includes *"20 million requests included per month"*, *"60 million CPU milliseconds included per month"*, *"1000 scripts"*, *"No charge or limit for duration"*. Overage: *"+$0.30 per additional million"* requests · *"+$0.02 per additional million CPU milliseconds"* · *"+$0.02 per additional script"*. Invocation ceilings: *"Max of 30 seconds of CPU time per invocation"*, *"Max of 15 minutes of CPU time per Cron Trigger or Queue Consumer invocation"*. | [wfp/reference/pricing](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/) |
| **Workers for Platforms — prerequisite** | **UNRESOLVED against live docs.** Neither the WfP overview, the get-started page, the get-started/configuration page, nor the WfP pricing page states whether a **Workers Paid ($5/mo)** subscription is *also* required alongside the $25 WfP plan. All four pages are silent. Priced both ways in §2.4. | [wfp/](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/) · [wfp/get-started](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/get-started/) · [wfp/get-started/configuration](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/get-started/configuration/) · [wfp/reference/pricing](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/) |
| **Dispatch namespaces** | *"a container that holds all the Workers your platform deploys on behalf of your customers."* Upload: `PUT /accounts/{ACCOUNT_ID}/workers/dispatch/namespaces/{NAMESPACE_NAME}/scripts/{SCRIPT_NAME}`. Delete: `DELETE` on the same path. Routing is done by a **dynamic dispatch Worker** that extracts the tenant from the hostname — the docs' own example is `new URL(request.url).hostname.split(".")[0]`, i.e. exactly the `{name}.goblin.app` model. Namespace creation is documented as done *"via the dashboard"*; the REST create endpoint is not given on the examples page. | [wfp/reference/platform-examples](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/platform-examples/) · [wfp/how-workers-for-platforms-works](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/how-workers-for-platforms-works/) |
| **Per-tenant custom limits** | Exactly two knobs: `cpuMs`, `subRequests`. Set **at dispatch time** via the third argument of `dispatcher.get()`. Breach → *"the user Worker will immediately throw an exception."* Memory limits **not** offered. Request-count limits **not** offered. | [wfp/configuration/custom-limits](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/custom-limits/) |
| **Workers Static Assets** | *"Requests to static assets are free and unlimited."* Limits: files per Worker version **100,000** (Paid) / 20,000 (Free); individual file **25 MiB**; `_headers` rules 100; `_redirects` static 2,000 / dynamic 100. Caveat: with Workers caching enabled, *"requests served from the Worker's cache are billed at the same per-request rate as requests that invoke the Worker. This includes requests to static assets."* | [workers/platform/pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [static-assets/billing-and-limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) · [workers/platform/limits](https://developers.cloudflare.com/workers/platform/limits/) |
| **Request counting (Worker→Worker)** | Directly fetched: *"Cloudflare does not bill for subrequests you make from your Worker."* · *"Requests made from your Worker to another worker via a Service Binding do not incur additional request fees."* Durable Object RPC is the exception (*"its own RPC session and therefore a single billed request"*). Search-derived (blog, **not** directly fetched this session): the model is one request for the initial invocation plus *"a single billable duration across all Workers triggered by a single incoming request"*. **Inference flagged:** the docs state this for **Service Bindings**; `dispatcher.get()` in a dispatch namespace is a *different* binding type and no fetched page states its request-counting rule explicitly. §2 assumes dispatch→user-Worker = **one** billed request. If that inference is wrong, every request figure in §2 doubles — see F6 and §2.3's headroom. | [workers/platform/pricing](https://developers.cloudflare.com/workers/platform/pricing/) (fetched) · [blog: Service Bindings GA](https://blog.cloudflare.com/service-bindings-ga/) (search result only) |
| **D1 — pricing** | Workers Paid: rows read *"First 25 billion / month included + $0.001 / million rows"*; rows written *"First 50 million / month included + $1.00 / million rows"*; storage *"First 5 GB included + $0.75 / GB-mo"*. *"Row size or the number of columns in a row does not impact how rows are counted."* Scale-to-zero. No egress charge. | [d1/platform/pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| **D1 — per-tenant model** | Explicitly endorsed: D1 is *"designed for horizontal scale out across multiple, smaller (10 GB) databases, such as per-user, per-tenant or per-entity databases"* at no extra cost beyond queries and storage. Databases per account: *"50,000 (Workers Paid)"*, increasable — docs note support for *"millions to tens-of-millions of databases."* Max DB size **10 GB** (cannot be increased). Max storage/account **1 TB** (requestable). Queries per invocation 1,000. Each database is *"inherently single-threaded, and processes queries one at a time"*; *"If your average query takes 1 ms, you can run approximately 1,000 queries per second."* | [d1/platform/limits](https://developers.cloudflare.com/d1/platform/limits/) |
| **D1 — export** | `npx wrangler d1 export <database_name> --remote --output=./database.sql` → **a `.sql` dump, not a raw SQLite file.** REST equivalent: `POST /accounts/{account_id}/d1/database/{database_id}/export`, polling-based (*"an in-progress export must be continually polled or will automatically cancel"*), returns `signed_url` — *"The URL to download the exported SQL. Available for one hour."* Known limitation: *"A running export will block other database requests."* | [d1/best-practices/import-export-data](https://developers.cloudflare.com/d1/best-practices/import-export-data/) · [api: d1 export](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/export/) |
| **R2** | Standard storage *"$0.015 / GB-month"*; Class A (write/mutate) *"$4.50 / million requests"*; Class B (read) *"$0.36 / million requests"*; egress *"Free"*. Free tier: 10 GB-month storage, 1M Class A, 10M Class B per month. Infrequent Access: $0.01/GB-mo + $0.01/GB retrieval, 30-day minimum duration. | [r2/pricing](https://developers.cloudflare.com/r2/pricing/) |
| **Cloudflare for SaaS** | **100 custom hostnames included at no additional cost on every plan — Free, Pro, Business and Enterprise.** Beyond that, *"$0.10"* per additional hostname on Free/Pro/Business. Ceiling 50,000 hostnames on those plans. No minimum spend documented. | [cloudflare-for-saas/plans](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/) |
| **Turnstile** | Free plan: *"Free"*, *"Up to 20 widgets"*, *"Unlimited challenges (traffic or verification requests)"*, *"10 hostnames per widget"*, 7-day analytics. Enterprise: contact sales, 200 hostnames/widget. Hostname semantics: *"Wildcard characters (such as `*`) are not supported in the hostname field"* — **but** *"When you add a hostname, the widget will work on that exact hostname and all of its subdomains."* | [turnstile/plans](https://developers.cloudflare.com/turnstile/plans/) · [turnstile/concepts/hostname-management](https://developers.cloudflare.com/turnstile/concepts/hostname-management/) |
| **Cron Triggers** | **Account-level limit: 5 (Free) / 250 (Paid).** CPU per cron invocation (Paid): *"30 seconds (< 1 hour interval)"* or *"15 min (>= 1 hour interval)"*. Smallest documented schedule example is `*/1 * * * *` (every minute); the page does not state a minimum explicitly. | [workers/platform/limits](https://developers.cloudflare.com/workers/platform/limits/) · [workers/configuration/cron-triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) |
| **Queues** | *"$0.40/million operations"* on Workers Paid, with *"1,000,000 operations/month included"*. *"An operation is counted for each 64 KB of data that is written, read, or deleted"* — a 127 KB message counts as two. Workers Free: *"10,000 operations/day included"*, no paid overage. Consumer CPU ceiling 30 s (up to 15 min at longer intervals). | [queues/platform/pricing](https://developers.cloudflare.com/queues/platform/pricing/) · [workers/platform/limits](https://developers.cloudflare.com/workers/platform/limits/) |
| **EU data localization** | Data Localization Suite = Regional Services + Customer Metadata Boundary + Geo Key Manager, and is an *"Enterprise-only paid add-on"*. Product-level EU residency is nevertheless available without it via **D1 jurisdiction `eu`** and **R2 jurisdiction `eu`** (rows above). | [data-localization](https://developers.cloudflare.com/data-localization/) |

## 1.3 Findings that change the plan

These are the six places where live documentation contradicts, narrows, or materially sharpens the
blueprint. **Each is a real engineering consequence, not a note.**

**F1 — "export = the SQLite file" is false as written. (Blueprint C0/C4, Thesis §5.2)**
The blueprint says *"D1 (SQLite) one database per app: … the export story writes itself — export = the
SQLite file"* and sells *"one-tap SQLite export"* as a marketing asset (B1 SKU table, C4, Phase 11).
D1 does **not** hand back a `.sqlite3` file. Both the CLI and the REST API produce a **`.sql` dump**.
*Consequence:* the promise is still deliverable — a `.sql` dump rehydrates into a real SQLite file with
one `sqlite3 app.db < dump.sql` — but Goblin must **perform that conversion server-side** if the
user-facing words stay "deine Datenbank als Datei". Phase 11's gate (*"export opened locally in sqlite3
with row-count match"*) is achievable only with that conversion step in the path. **Either build the
conversion or change the copy — the current copy is not honest about what D1 returns.** Additional
constraint for the same unit: *"A running export will block other database requests"*, so export must
be queued/rate-limited per app, never fired synchronously from a tap.

**F2 — Cron Triggers cannot scale per-app. (Blueprint C3, Master Plan Phase 5)**
Phase 5 specifies a *"Cron Worker (5-min tier)"* per the K0 design. The account ceiling is **250 cron
triggers, account-wide** — not per Worker, not per tenant. A one-cron-per-Living-App design breaks at
250 apps, below the Phase-3 target of 150→ and far below any real scale. *Consequence:* K0 must be
**one (or a few) scheduled fan-out Workers that iterate the app list from the platform DB**, not a
trigger per tenant. This is cheaper and simpler, but it must be designed that way from unit 5.1 — and
it makes the fan-out Worker's 30-second CPU ceiling (<1h interval) the real scaling constraint, which
in turn forces batching. **Write this into the Phase 5 prompt.**

**F3 — Per-tenant caps do not cover requests. (Blueprint C0/C6, Master Plan Phase 1/2)**
The blueprint repeatedly claims *"per-tenant custom limits (CPU/request caps = runaway-bill and
denial-of-wallet protection, natively supported)"*. Live docs expose **`cpuMs` and `subRequests` only**.
There is no native per-tenant request-count cap. *Consequence:* denial-of-wallet via sheer request
volume (the cheapest attack against a $0.30/M line) is **not** natively defended. Goblin must implement
request-rate limiting in the dispatch Worker itself — the existing Wave-D in-memory limiter pattern does
not transfer, because dispatch Workers are globally distributed. This is a named unit for Phase 2, not
a freebie. Note the mitigating fact: static-asset requests are free and unlimited, so the exposure is
confined to dynamic requests.

**F4 — The AUP and the abuse runbook are about to become false. (docs/ACCEPTABLE_USE_POLICY.md, docs/ABUSE_RESPONSE.md)**
Both documents currently rest on a structural claim, stated in bold in both: **"Goblin hostet
Nutzer-Inhalte NIE öffentlich."** The AUP builds its entire liability argument on it (*"Die
Hosting-Ebene — und damit die Trust-&-Safety-Maschinerie … gehört dem Nutzer und **Vercel**"*), and
`ABUSE_RESPONSE.md` routes third-party reports to Vercel's reporting path on that basis. **A GO on D1
makes both statements untrue on the day the first app goes live on `*.goblin.app`.** *Consequence:*
rewriting both documents is a **blocking precondition of Phase 2** (the first public Living URL), not a
Phase-15 cleanup. Detailed in U0.3 §3.6. The AUP is also the canonical source for `/acceptable-use` and
for the K3 block copy, so the rewrite touches three surfaces by its own rule.

**F5 — Turnstile's 20-widget cap is not a problem; its hostname model is the reason.**
A naive design (one widget per Living App) dies at 20 apps on the free plan. It is unnecessary:
*"When you add a hostname, the widget will work on that exact hostname and all of its subdomains."*
**One widget with the hostname `goblin.app` covers every `*.goblin.app` Living App, unlimited, free.**
*Residual constraint:* **custom domains** (Phase 12) each need their own hostname entry, at 10 hostnames
per widget × 20 widgets = **200 custom domains** before the free plan runs out. That is a Phase-12
ceiling to record now, not a launch blocker. **Design rule: one shared Turnstile widget for the
subdomain fleet; a widget pool only for custom domains.**

**F6 — Three cost questions the live docs do not answer.**
All are handled conservatively in §2 rather than guessed.
(i) **Does the $25 WfP plan require Workers Paid ($5) alongside it?** Four Cloudflare pages are silent.
Cost impact: $5/mo. (ii) **Are static-asset requests inside a dispatch namespace still free**, given the
dispatch Worker runs first? The static-assets page says asset requests are *"free and unlimited"*; the
same page warns that cache-served requests *"including requests to static assets"* are billed at the
Worker rate when Workers caching is enabled. The WfP docs do not address the interaction. §2 therefore
counts **every inbound HTTP request as one billable Worker request** — the conservative reading. If the
generous reading holds, real cost is *lower* than every number in §2.
(iii) **Is a dispatch-namespace invocation (`dispatcher.get()`) billed like a Service Binding — one
request for the pair — or as two requests?** The Service-Binding rule is documented; the dispatch
equivalent is not stated on any page fetched. §2 assumes **one**. If it is two, every request line in
§2.2 doubles (Profile B → $0.0128/app/mo) and the app ceiling in §2.3 falls from ~1,127 to the request
bound of ~940 — still far past Gate G3, so **no recommendation changes**, but the flat-cost claim would
need restating. **Resolve at the Phase-2 E2E gate by reading the actual Cloudflare usage dashboard**
after a known number of test requests — that is a measurement, not a doc question.

**One blueprint claim is confirmed stronger than written.** C0 asserts per-tenant D1 isolation is
sound; the docs go further and name *"per-user, per-tenant or per-entity databases"* as an intended
design with *"millions to tens-of-millions of databases"* supportable. The 50,000-database default
ceiling is above any pre-G3 scale.

---

# U0.2 — COST MODEL

## 2.1 Method and stated assumptions

All rates are the live figures from §1.2. Arithmetic is shown at each step so the founder (or a
skeptical reviewer) can reproduce every number with a calculator.

| # | Assumption | Value | Status |
|---|---|---|---|
| A1 | Average CPU per dynamic request | **5 CPU-ms** | **ASSUMPTION** — must be measured at Phase 2's E2E gate and this table re-run. The single largest source of error here. |
| A2 | Keeper heartbeat cadence | 5 min → **8,640 checks/app/month** (43,200 min ÷ 5) | Design choice from Blueprint C3 / Phase 5 |
| A3 | One user Worker (script) per Living App | 1 script/app | Blueprint C0 |
| A4 | Every inbound HTTP request billed as 1 Worker request | conservative | Per F6(ii) — real cost may be lower |
| A5 | Month length | 30 days | — |
| A6 | Stripe fee on a $6 charge | 1.4% + €0.25 ≈ $0.354 | From `GOBLIN_CONSUMPTION_LEDGER.md` (FW5-U5, VERIFIED 2026-07-15) |

## 2.2 Marginal cost per Living App at three traffic profiles

**Profile definitions.** *Dead* = zero visitors; only Goblin's heartbeat touches it. *Typical Max app* =
500 visits/month × 4 page-views, 50 form submissions, 5 MB of D1 data, 100 MB of R2 assets.
*Viral day* = one day of 100,000 requests on top of a typical month.

**Profile A — Dead app**
```
Requests  = 8,640 heartbeats                      = 8,640
CPU       = 8,640 × 5 ms                          = 43,200 CPU-ms
Requests  → 8,640 ÷ 1,000,000 × $0.30             = $0.002592
CPU       → 43,200 ÷ 1,000,000 × $0.02            = $0.000864
D1 storage→ 0.001 GB × $0.75                      = $0.00075
                                          TOTAL   ≈ $0.0042 / app / month
```

**Profile B — Typical Max app**
```
Requests  = 2,000 visitor + 8,640 heartbeat       = 10,640
CPU       = 10,640 × 5 ms                         = 53,200 CPU-ms
Requests  → 10,640 ÷ 1,000,000 × $0.30            = $0.003192
CPU       → 53,200 ÷ 1,000,000 × $0.02            = $0.001064
D1 writes → 50 ÷ 1,000,000 × $1.00                = $0.00005
D1 reads  → 20,000 ÷ 1,000,000 × $0.001           = $0.00002
D1 storage→ 0.005 GB × $0.75                      = $0.00375
R2 storage→ 0.1 GB × $0.015                       = $0.0015
Queues    → 20 ops (of 1,000,000 included)        = $0.00
                                          TOTAL   ≈ $0.0096 / app / month
```

**Profile C — Viral day (that month)**
```
Requests  = 10,640 + 100,000                      = 110,640
CPU       = 110,640 × 5 ms                        = 553,200 CPU-ms
Requests  → 110,640 ÷ 1,000,000 × $0.30           = $0.033192
CPU       → 553,200 ÷ 1,000,000 × $0.02           = $0.011064
D1 reads  → 500,000 ÷ 1,000,000 × $0.001          = $0.0005
D1 writes → 500 ÷ 1,000,000 × $1.00               = $0.0005
D1 storage+ R2 storage (as B)                     = $0.00525
R2 Class B→ 50,000 ÷ 1,000,000 × $0.36            = $0.018
Egress    → free on Workers, D1 and R2            = $0.00
                                          TOTAL   ≈ $0.0685 / app / month
```

**Margin check against the PROPOSED Living App price (Blueprint B1) and the 66.3% floor:**

The "headroom" column answers: **by what factor could real COGS exceed this estimate before the
66.3% margin floor is breached?** At T1 the floor permits COGS up to $6.00 × 0.337 = $2.022; at T3, up
to $2.50 × 0.337 = $0.8425.

| Profile | COGS/app/mo | Margin at T1 $6.00 | Margin at T3 $2.50 | Headroom to the 66.3% floor |
|---|---|---|---|---|
| A — dead | $0.0042 | 99.93% | 99.83% | 481× (T1) / 200× (T3) |
| B — typical | $0.0096 | 99.84% | 99.62% | 211× (T1) / 88× (T3) |
| C — viral | $0.0685 | 98.86% | 97.26% | 30× (T1) / 12× (T3) |

Blueprint B6's claim of *">95% typical"* margin on the Living App line is **confirmed, with room** —
even the viral profile at the cheapest regional tier could absorb a **12×** cost surprise before the
floor is threatened.

**The most important number in this section:** in Profile B, **8,640 of 10,640 requests (81.2%) are
Goblin's own heartbeat.** At low traffic — which is *most* Living Apps — the substrate bill is driven by
our monitoring, not by our users. Cadence is therefore a genuine cost lever (§2.3).

## 2.3 Aggregate cost — where the $25 allotment actually runs out

The included allotment is **20M requests, 60M CPU-ms, 1,000 scripts** per month. Using Profile B:

```
Requests: 20,000,000 ÷ 10,640  = 1,879 apps
CPU:      60,000,000 ÷ 53,200  = 1,127 apps   ← binding resource
Scripts:  1,000 ÷ 1            = 1,000 apps   ← binding limit, but trivially priced
```

**Reading:** the *script* count binds first at 1,000 apps, but at *"+$0.02 per additional script"* that
is $0.02/app/month — noise. The real ceiling is **CPU at ≈1,127 typical apps**, at which point marginal
cost resumes at $0.02 per million CPU-ms.

Against the plan's own targets:

| Milestone | Living apps | Requests used | CPU-ms used | Marginal CF cost |
|---|---|---|---|---|
| P2 gate G2 | 50 | 532,000 (2.7% of 20M) | 2,660,000 (4.4% of 60M) | **$0.00** |
| P3 gate G3 | 150 | 1,596,000 (8.0%) | 7,980,000 (13.3%) | **$0.00** |
| Blueprint B5 horizon | 500 | 5,320,000 (26.6%) | 26,600,000 (44.3%) | **$0.00** |
| First real overage | ~1,127 | 11,990,000 (60%) | 60,000,000 (100%) | starts here |

**The $25 line is genuinely flat through Gate G3 and well beyond.** Every Living App from the first to
roughly the thousandth is served inside the base subscription. This is the strongest single finding in
the cost model and the core of the D2 recommendation.

**Cadence lever.** Dropping dead/low-traffic apps to a 15-minute heartbeat (2,880/mo) cuts Profile B to
4,880 requests and 24,400 CPU-ms → the CPU ceiling moves from ~1,127 to **~2,459 apps**, roughly
doubling headroom for free. *Recommendation: 5-minute cadence for apps with measured traffic,
15-minute for dormant ones — decided at Phase 5, recorded here as the lever.*

## 2.4 The new monthly fixed-cost line

| Line | Amount | Basis |
|---|---|---|
| Workers for Platforms subscription | **$25.00** | VERIFIED, live doc |
| Workers Paid, *if additionally required* | $0.00 **or** $5.00 | **UNRESOLVED** — F6(i) |
| Cloudflare for SaaS (custom hostnames) | **$0.00** | 100 hostnames included on all plans; Phase 12 stays free to 100 domains, then $0.10 each |
| Turnstile | **$0.00** | Free plan, unlimited challenges |
| D1 / R2 / Queues at G3 scale | **$0.00** | All inside included/free tiers per §2.2–2.3 |
| Cloudflare Registrar — `goblin.app` | **~$1.00–1.60/mo equivalent** | **NOT YET VERIFIED — see below.** A `.app` domain is typically billed annually; treat as ~$12–20/yr. |
| Usage buffer (deliberate over-provision) | $5.00 | Judgment, not a quoted rate. Covers A1 error and traffic surprises. |
| **Planning fixed-cost line** | **$30–35/month** | **Recommend budgeting $35/month.** |

**Committed, contract-level fixed cost is $25.00/month** ($30.00 if F6(i) resolves against us).
Everything above that is buffer, not obligation.

> **`goblin.app` is an unpriced, unverified dependency.** The entire `name.goblin.app` design in the
> blueprint and in Master-Plan Phases 2 and 12 assumes Goblin controls the domain `goblin.app`. This
> spike did **not** verify that the domain is owned, available, or purchasable, and did not check its
> price — doing so would be a live commercial action this session is forbidden to take (Rule 4). The
> platform domain is `justgoblin.com`; `goblin.app` is a *different* registration. **Founder action
> F-0 in §6.1, and a HALT condition for Phase 2 if it does not resolve.** Note that `.app` is an
> HSTS-preloaded TLD — HTTPS-only is mandatory, which the Cloudflare stack satisfies by default.

## 2.5 The new break-even

**Why this is computed as a delta.** Per state-check S3/S4, the "~13–14 users" figure has no verifiable
in-repo derivation and the declared financial source of truth (`GOBLIN_CFO_DASHBOARD_DE.html`) is not in
the repository. Re-deriving the *absolute* break-even from documents alone would be inventing precision.
The **delta**, however, is fully reproducible from the one contribution figure the repo does carry.

```
Inherited anchors (docs, not dashboard):
  Break-even today          ≈ 13 payers          (GOBLIN_THESIS_v3_DRAFT.md:154)
  Contribution per user     ≈ $8.83 / month      (NAV_MAP_L2_PIVOT.md:17)
  Current fixed cost        ≈ €80 / month        (GOBLIN_THESIS_v3_DRAFT.md:154, Blueprint B5)

Additional users required to absorb the new fixed line:
  at $25 → 25 ÷ 8.83 = 2.83 → 3 users  → new break-even ≈ 16 users
  at $30 → 30 ÷ 8.83 = 3.40 → 4 users  → new break-even ≈ 17 users
  at $35 → 35 ÷ 8.83 = 3.96 → 4 users  → new break-even ≈ 17 users
```

**New break-even ≈ 16–17 Build-plan users, up from ~13. Delta = +3 to +4 users.**

*Independent cross-check:* Blueprint B5 states, from separate reasoning, *"new break-even ≈ 15–17
Build-plan users"*. This spike's arithmetic lands inside that band without having been fitted to it.

**The framing that matters more than the user count.** The new fixed line is not paid for by Build
subscriptions — it is paid for by the thing it enables:

```
One Living App at T1 $6.00:
  revenue                                    $6.000
  − Stripe (1.4% + €0.25 ≈ $0.354)          −$0.354
  − substrate COGS (Profile B)              −$0.0096
  = contribution per Living App              $5.636

  $25.00 ÷ $5.636 = 4.44  →  5 Living Apps
```

**Five paying Living Apps cover the entire new fixed cost line.** The Phase-2 gate G2 target is fifty.
At G2 the ops plane runs at roughly **11× its own fixed cost**; at G3 (150 apps) roughly **34×** —
with marginal substrate cost still $0.00 (§2.3).

## 2.6 What this model deliberately excludes

Not substrate cost, and therefore not in the numbers above — listed so the founder is not surprised:
Resend email volume (form notifications + weekly reports scale linearly with living apps);
Keeper-2 diagnosis tokens (Blueprint B6 estimates $0.02–0.07/incident — ASSUMPTION, measured in
Phase 9); pre-deploy scan classifier tokens (ledger line M-A1, authored at Phase 3); B2 storage for app
snapshots; and any Enterprise-tier Cloudflare product. **No ledger line is authored by this document —
Phase 0 is paper and changes no consumption** (standing rule §5 satisfied vacuously and stated
explicitly).

---

# U0.3 — ABUSE SOP (DRAFT)

## 3.0 The premise change that forces this section

Until D1, Goblin's abuse posture had a genuine structural advantage, stated in both
`ACCEPTABLE_USE_POLICY.md` and `ABUSE_RESPONSE.md`: **Goblin never hosted user content publicly.**
Apps went to the user's own Vercel account; Vercel's trust-and-safety machinery carried the hosting
layer. **D1 = GO deletes that advantage.** From the first `name.goblin.app`, Goblin is a public host
of third-party content, with everything that follows: phishing subdomains, DMCA notices, registrar and
browser-vendor blocklisting risk against the *shared* `goblin.app` apex, and a duty to act on reports.

This section is the draft SOP for that world. **It is a design, not an implementation** — no code is
written in Phase 0.

## 3.1 Pre-deploy scan — extend, do not rebuild

**The scanner already exists.** `apps/api/src/services/safety/publish-scan.ts` (201 lines) and
`scan-rules.ts` (105 lines) already implement `scanFiles()` and `runPublishGuard()` with brand-imitation
tokens (`BRAND_TOKENS`), miner signatures (`MINER_SIGNATURES`), credential-field and card-field regexes
(`CREDENTIAL_FIELD`, `CARD_FIELD`), `MAILTO_ACTION`, `HIDDEN_MARKER`, `OBFUSCATED_EVAL`, a per-area
`BLOCK_MESSAGE` map of honest German copy, and byte budgets (`MAX_FILE_BYTES` 512 KB,
`MAX_TOTAL_BYTES` 4 MB). Tests exist (`publish-scan.test.ts`, 143 lines). `signals.ts` adds the
behavioural K4 layer.

**Master-Plan Phase 3 unit 3.2 should therefore be re-scoped from "build a scan" to "extend the scan for
public hosting".** The delta that public hosting actually requires:

| # | Extension | Why it is new under hosting |
|---|---|---|
| E1 | **External form-action targets** — flag `<form action>` pointing off-origin, especially to known credential-collection endpoints | Under Vercel-hosting this was the user's own problem; on `*.goblin.app` a harvesting form wears *our* domain |
| E2 | **Crypto-drainer signatures** — wallet-connect + `eth_sendTransaction`/`personal_sign` patterns paired with brand imitation | Explicitly named in Blueprint C2; not in current `scan-rules.ts` |
| E3 | **Subdomain-name × content coherence** — an app named `sparkasse-login` whose content scores any credential hit is auto-review regardless of individual confidence | The name is now part of the attack surface (§3.4) |
| E4 | **Swift-class content classifier on extracted text** — the non-deterministic second opinion, verdict `pass` / `review` / `block` | Blueprint C2; ledger line M-A1 at Phase 3 |
| E5 | **Re-scan on every republish**, not only first publish | A clean app can be weaponised by its second deploy |

**Standing rule inherited from the AUP and not weakened here:** the deterministic layer decides;
the classifier advises. A `block` never rests on the model alone, and every block carries the honest
German `BLOCK_MESSAGE` plus a human appeal route. *"False Positives sind unsere eigene
Ehrlichkeits-Niederlage"* (ABUSE_RESPONSE §2) survives the transition verbatim.

## 3.2 `report-abuse` endpoint — specification

```
POST /api/abuse/report          (public, unauthenticated, Turnstile-protected)
```

| Field | Type | Notes |
|---|---|---|
| `url` | string, required | Must resolve to a `*.goblin.app` host or a connected custom domain; otherwise 400 with an honest "das ist keine von Goblin gehostete Seite" |
| `category` | enum, required | `phishing` · `malware` · `illegal_content` · `impersonation` · `spam` · `other` |
| `description` | string ≤ 2,000 chars | Free text |
| `reporter_email` | string, optional | Optional by design — anonymous reports are accepted; an email only enables the outcome notice |
| `evidence_url` | string, optional | Screenshot or third-party reference |

**Behaviour.** Turnstile verify → resolve `url` → `ops_apps` row (fail closed: unknown host = accept the
report anyway, queue as `unmatched`) → insert into `abuse_reports` (migration **AUTHORED** at the phase
that builds this, never applied by CC) → immediate acknowledgement to the reporter with a case ID →
founder notification via Resend **and** PWA push, because the 24-hour clock (§3.3) starts at receipt.

**Rate limiting and honesty.** Turnstile + per-IP cap, with the standing honest-429 pattern
(German message + `Retry-After`, never a silent drop) already used across Wave-D. **Never** disclose
back to a reporter whether an app was actioned beyond "geprüft" — that is the app owner's data.

**Discoverability is a legal requirement, not a nicety.** The endpoint needs a public page
(`/missbrauch-melden`), a link in every Living App's footer or status badge, and a published contact
address. An abuse channel nobody can find does not count as having one.

## 3.3 24-hour takedown runbook

Extends `ABUSE_RESPONSE.md` rather than replacing it — same five-layer model, same founder-decides
principle, new hosting reality.

| Clock | Step | Actor | Output |
|---|---|---|---|
| **T+0** | Report received (endpoint, email, registrar/browser-vendor notice, or K4 signal) | system | `abuse_reports` row, case ID, founder push |
| **T+0 → T+1h** | **Triage.** Open the live URL. Classify: `clear_abuse` · `grey` · `false_report` | founder | Triage note on the case |
| **T+1h** | **Emergency suspend** — for `clear_abuse` only: phishing, malware, drainer, illegal content | founder | App unrouted at the dispatch Worker (see below); owner notified with reason + appeal route |
| **T+1h → T+24h** | **Grey path:** contact the owner, request context, hold routing unless the risk is active credential harvesting | founder | Owner correspondence on the case |
| **T+24h** | **Decision deadline.** Every case is `resolved`, `suspended`, or `escalated-to-counsel`. No case sits open past 24h. | founder | Case closed with a written reason |
| **T+24h →** | **Repeat-offender review** → account action per AUP; account actions remain founder-only, never automatic | founder | Audit-log entry |

**The suspend mechanism must be reversible and instant.** Preferred: the **dispatch Worker refuses to
route** a suspended app (a status flag read at dispatch), serving an honest German suspension page.
Deleting the tenant script (`DELETE /accounts/{id}/workers/dispatch/namespaces/{ns}/scripts/{name}`) is
the *nuclear* option and destroys the owner's deployment — reserve it for confirmed illegal content, and
only after the app snapshot in B2 is verified present, so a wrongly-suspended user loses nothing.
**A false suspension must be undoable in one action.** Build the flag, not the delete, in Phase 2.

**Rehearsal is a gate, not a hope.** Master-Plan Phase 15 unit 15.5 already requires *"abuse SOP
rehearsal (one simulated takedown, timed)"*. That rehearsal should move **earlier** — the first Living
App on a public domain is the moment the runbook must work, not Phase 15.

## 3.4 Subdomain naming rules

The subdomain is a security surface: `sparkasse-login.goblin.app` is a phishing asset created for free
by a name-claim form. Rules for the Phase-2 name-claim flow (2.4):

1. **Reserved names** — `www`, `api`, `admin`, `status`, `mail`, `smtp`, `mx`, `ns1`/`ns2`, `app`,
   `dashboard`, `login`, `signin`, `auth`, `account`, `billing`, `pay`, `secure`, `verify`, `support`,
   `help`, `goblin`, `cdn`, `assets`, `static`, `test`, `staging`, `dev`. Phase 2 already lists a
   partial set; this is the fuller one.
2. **Brand-token block** — reuse `BRAND_TOKENS` from `scan-rules.ts` (already maintained) against the
   requested name, including separator-stripped matching so `spar-kasse` and `sparkasse` collide.
3. **Financial/authority keyword + auth keyword = block**, e.g. `*bank*`+`*login*`, `*wallet*`+
   `*connect*`, `*steuer*`/`*amt*`/`*gov*` in any combination with credential words.
4. **Homoglyph and confusable normalisation** — normalise Unicode confusables and punycode before
   matching; reject names that normalise onto a reserved or brand token.
5. **Shape rules** — 3–63 chars, `[a-z0-9-]`, no leading/trailing hyphen, no `xn--` prefix from users.
6. **Names are released, not recycled instantly** — a released name enters a cooldown before reuse, so
   a rebuilt reputation cannot be inherited by a stranger.
7. **Every rejection is honest and specific** in German ("Dieser Name ist reserviert" ≠ "Dieser Name
   ist vergeben") — no phantom errors, per the Feeling invariants.

## 3.5 "No free hosting tier" — the rationale, stated once and properly

Blueprint C6 asserts it; this is the argument, so it survives the first request to relax it.

- **Payment is identity.** A card (or SEPA mandate) attaches a hosted app to a verified, chargeable,
  traceable human. It is the single cheapest, strongest abuse filter available, and it costs no
  engineering.
- **Free hosting is the phishing economy's preferred input.** Free subdomains on a shared apex are
  bulk-registered and burned; the cost of the attack must exceed its yield, and $6/month with a real
  payment instrument does that at negligible friction for a genuine Max.
- **The shared apex is a collective asset.** Every Living App's deliverability, SEO and browser-safety
  reputation rides on `goblin.app`. One blocklisting event damages *every* customer. Free tiers put a
  common asset at the mercy of an anonymous stranger.
- **It is consistent with the thesis, not a contradiction of it.** Goblin is generous where generosity
  compounds — *building* is cheap and anxiety-free (Thesis §7 principle 1). *Hosting* is where the
  liability lives. Free building, paid hosting is the honest split.
- **The endowment mechanism already covers the "first taste".** Build/Pro/Power include 1/3/10 Living
  Apps (Blueprint B1), so no paying user meets a paywall to publish their first app. "No free tier"
  means no *unpaid account* hosting — not "hosting costs extra for everyone".

**Founder-decision hook:** if D3 (pricing) ever introduces a free hosted tier, this SOP's threat model
must be re-derived. That is a decision-table item, not an implementation detail.

## 3.6 Blocking documentation work (F4)

Before the first public Living URL ships (Phase 2), these must land:

1. `ACCEPTABLE_USE_POLICY.md` — remove the "Goblin hostet Nutzer-Inhalte NIE öffentlich" structural
   argument; add hosted-content rules, the abuse-report route, the suspension policy and the appeal
   path. **Its own rule requires pulling `/acceptable-use` and the K3 block copy along with it.**
2. `ABUSE_RESPONSE.md` — replace the "route it to Vercel" intake path with the §3.3 runbook; add the
   emergency-suspend mechanism and the 24-hour clock.
3. **New:** subprocessor list (Cloudflare joins Supabase, Railway, Vercel, B2, Resend, Stripe,
   DeepInfra) + DPA template — Blueprint A8 puts the DPA at DATA-1/Phase 4, and Cloudflare's addition
   is a Phase-1 fact.
4. **New:** a DMCA/abuse contact of record, published.

**These are Steven/founder documents, not CC code.** They are listed here so they are not discovered
late, and they belong in §6.2.

---

# U0.4 — CREDENTIALS ARCHITECTURE

## 4.1 Where the tokens live

**Railway environment variables only.** Three variables, named by Master-Plan Phase 1:

| Variable | Contains | Secret? |
|---|---|---|
| `CF_ACCOUNT_ID` | Cloudflare account identifier | Not a secret, but env-configured for parity |
| `CF_API_TOKEN` | The scoped API token | **Secret** |
| `CF_DISPATCH_NAMESPACE` | Dispatch namespace name | Not a secret |

**The rule, stated as a standing law:** the token is read by `apps/api` at runtime via `process.env`
and is never logged, never returned by an endpoint, never written to the database, never placed in a
`.env` file that git can see, and never echoed in an error. The Phase-1 health probe
(`GET /api/ops/health`) reports **presence and scope-validity as booleans** — never a value, never a
prefix, never a length.

**Blast radius by design.** The token is account-scoped to the *user-app plane* only. It grants nothing
over Supabase, Stripe, B2, Resend or DeepInfra. A full compromise of `CF_API_TOKEN` costs Goblin the
Cloudflare tenancy — bad, bounded, and recoverable by rotation — and reaches **zero** platform-plane
user data. That is the entire point of the two-plane split (Blueprint C0).

## 4.2 Token scopes — least privilege, named exactly

All permissions below are **Account-level**, taken from the live permissions reference and the WfP API
reference (retrieved 2026-07-25):

| Permission (dashboard name) | Needed for | Phase |
|---|---|---|
| **Workers Scripts Edit** (API-side: `Workers Scripts Write`) | Upload/delete tenant Workers in the dispatch namespace; dispatch-namespace and script-settings operations | 1–2 |
| **D1 Edit** | Create per-app databases, run migrations, trigger exports | 4 |
| **Workers R2 Storage Edit** | App asset/upload buckets | 4+ |
| **Queues Edit** | Error-ingest pipeline | 6 |
| **Account: SSL and Certificates Edit** | Cloudflare-for-SaaS custom hostnames | 12 |
| **Zone: DNS Edit** *(zone-scoped, `goblin.app` only)* | Wildcard record for `*.goblin.app` | 2 |

Sources: [fundamentals/api/reference/permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/) ·
[api: WfP dispatch namespaces](https://developers.cloudflare.com/api/resources/workers_for_platforms/subresources/dispatch/subresources/namespaces/methods/create/) ·
[wfp/reference/platform-examples](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/platform-examples/)

> **Honest gap.** The live permissions reference does **not** list a Workers-for-Platforms-specific
> permission group; WfP dispatch operations are documented as covered by the Workers Scripts
> write/edit permission. The exact permission-group list is also queryable at runtime via Cloudflare's
> *List permission groups* endpoint. **The founder should confirm the exact checkbox names in the
> dashboard at creation time (§6.1 step 4) and report back any divergence** — this is the one place in
> U0.4 where dashboard reality may be finer-grained than the docs.

**Grant scopes in phases, not all at once.** Phase 1 needs only *Workers Scripts Edit* (+ *Zone: DNS
Edit* for the wildcard at Phase 2). D1, R2, Queues and SSL permissions are added to the token when the
phase that uses them lands. A token that can do only what today's code does is worth strictly more than
a convenient one.

**Two tokens, not one — recommended.** A **deploy token** (Workers Scripts, D1, R2, Queues) used by the
API at runtime, and a **bootstrap token** (namespace + DNS creation) used once by the founder and then
deleted. Never let the long-lived runtime token hold namespace-creation power.

## 4.3 Rotation plan

| Trigger | Action | Target |
|---|---|---|
| **Scheduled** | Rotate `CF_API_TOKEN` every **90 days** | Routine |
| **Staff/role change** | Immediate rotation | Same day |
| **Suspected exposure** (log leak, screenshot, third-party paste, unexplained CF audit-log entry) | **Roll immediately, ask questions after** | < 1 hour |
| **Phase adds a permission** | New token with the widened scope; old token deleted, not edited | Per phase |

**Zero-downtime rotation procedure** (Cloudflare permits multiple concurrent valid tokens):
1. Create the new token with identical scopes.
2. Set the new value in Railway → Railway redeploys the API.
3. Verify `GET /api/ops/health` reports CF reachable + namespace present (booleans only).
4. **Delete** the old token in the Cloudflare dashboard — do not merely stop using it.
5. Record date and reason in the ops log. Never record the value.

**Founder-only.** Every step is a founder action in the Cloudflare and Railway dashboards. CC neither
performs nor witnesses any of it.

## 4.4 Why CC cloud sessions never hold these credentials — explicitly

Required by the phase prompt; stated plainly rather than by reference.

1. **A cloud CC session is not a trusted vault.** It runs in an ephemeral third-party container, its
   transcript is retained and reviewable, and its output is pasted into PRs, reports and chat. Anything
   a session *sees* must be assumed to have escaped it.
2. **CC never needs the value.** CC writes code that *reads* `process.env.CF_API_TOKEN`. Writing that
   code requires knowing the variable's **name**, never its content. There is no task in Phases 1–15
   where holding the secret would enable work that its absence blocks.
3. **The verification story stays honest without it.** Phase 1's gate is a health probe returning
   booleans and a round-trip integration test executed **by the deployed API** — which does hold the
   secret — with CC reading only the result. GREEN = SEEN is satisfied by the artifact, not by the key.
4. **Blast radius.** A key in a session transcript is a key in an unknown number of logs, forever.
   A key only in Railway is revocable in one click with a known blast radius.
5. **It is already the standing law.** Master-Plan Absolute Rule 5 and Blueprint C2 both state it; this
   section exists so the *reasoning* survives, not just the rule.

**Corollary for every future Act-2 phase prompt:** if a unit appears to require a live CF token in the
session, that unit is mis-specified. The correct response is **HALT + BLOCKED-ON-FOUNDER with exact
dashboard steps** — never "paste me the token".

---

# U0.5 — THE DECISION TABLE

## 5.1 D1 — Hosting go / no-go

**The question.** Does Goblin become a public host of user applications, reversing the 2026-07-07
ruling ("Goblin does not host user deploys") that the founder reopened on 2026-07-11?

| Option | What it means | Cost | Evidence | Consequence |
|---|---|---|---|---|
| **A. GO — hosted publish on Cloudflare, static-first, capped** | `name.goblin.app` becomes the default publish path; Vercel-connect stays as the "graduate" option | $25–35/mo fixed; ≈$0.01/app/mo marginal | §1.1 (a)/(d) VERIFIED · §2.2 · §2.3 | Unlocks the entire Act-2 arc. Accepts hosting liability and the abuse duty (U0.3), and obligates the AUP/runbook rewrite (F4) |
| **B. NO-GO — stay Vercel-connect only** | Status quo | $0 | — | The Living App SKU cannot exist; Keeper degrades to a watch-only tier over apps Goblin cannot fix or redeploy; Thesis §5.3 K2/K3 become unbuildable. **This ends Act 2**, not just Phase 1 |
| **C. DEFER — decide after G1** | Paper stays paper until cohort numbers land | $0 | Thesis §11 | Costs nothing and loses ~2–6 weeks of lead time on Wedge 1 (Orphan Rescue), whose whole premise is speed against incumbents (Blueprint A3) |

**Recommendation: A — GO, with the reversal made conditional in one respect.**

The evidence supports it on every axis the founder set: the substrate meets (a)–(e) with no FAILED
verdict; the cost is an order of magnitude below the price of the SKU it enables; the fixed line is
absorbed by five paying Living Apps; and the break-even moves by three to four users.

**But note what GO actually costs, honestly:** it is not the $25. It is that Goblin becomes a public
host, and hosting liability is the one thing in this plan that cannot be reverted with `git revert`.
Option C is genuinely defensible on that basis alone — the sequencing law already gates Phases 1–15
behind G1, so a GO now is a *preparation* decision, not a build decision. **The recommendation is GO
specifically because GO costs nothing until Phase 1 starts, while NO-GO or DEFER costs lead time.**

**One condition attaches to the GO:** it presumes `goblin.app` is obtainable (§2.4). If it is not, the
naming architecture changes and Phase 2 must re-plan before it starts.

## 5.2 D2 — Substrate + fixed-cost sign-off

**The question.** Is Cloudflare the substrate, and is the new monthly fixed line approved?

| Option | Fixed cost | Evidence | Assessment |
|---|---|---|---|
| **A. Cloudflare — WfP + D1 + R2 + Turnstile + Cron + Queues** | **$25–35/mo** | §1.2 (all rows) | Only option verified against live docs this session. Per-tenant isolation, per-tenant caps, $0 egress, per-app DB, EU jurisdiction at the data layer, custom hostnames free to 100 |
| **B. Container PaaS (extend existing Railway)** | Higher, and *per-app* rather than pooled | **Not evaluated this session** | Contradicts Blueprint A4 mitigation 2 ("no servers of ours to reboot") — the solo-founder on-call risk is the one attack that can kill the thesis alone |
| **C. Hybrid (static on CF, dynamic on Railway)** | $25 + Railway growth | **Not evaluated this session** | Splits the blast radius the two-plane design exists to unify; two abuse surfaces, two runbooks |
| **D. Vercel multi-tenant** | Not evaluated | — | Re-introduces the dependency the ops plane is meant to make optional |

**Recommendation: A — Cloudflare, fixed line approved at $35/month planning / $25/month committed.**

Grounds: §2.3 shows the $25 subscription covers **every Living App through Gate G3 and up to roughly
1,000 apps at zero marginal cost** — the fixed line is not merely affordable, it is flat across the
entire planned horizon. §2.5 shows five paying Living Apps absorb it entirely.

**Three caveats that ride along with the sign-off** (none blocks D2):
1. **F6(i)** — if Workers Paid is additionally required, the line is $30, not $25. Resolved at §6.1
   step 3 by looking at the checkout screen. Either way the recommendation is unchanged.
2. **A1 (5 CPU-ms/request)** is the model's largest unverified input. The Phase-2 E2E gate must measure
   real CPU-ms and this cost model must be re-run. If real CPU is 5× the assumption, the ceiling moves
   from ~1,127 apps to ~225 — still comfortably past G3, but the flat-cost claim would need restating.
3. **EU posture is partial** (§1.1 c). D1/R2 `eu` jurisdictions give data residency; full network-layer
   localization needs Enterprise. This is adequate for a Max-class booking page and **must not be
   over-claimed** to users or in the DPA.

## 5.3 Decisions this document explicitly does NOT make (Rule 6)

Escalated, not decided: D3 pricing adoption · D4 diagnosis-token billing side · D5 payments entry ·
whether a free hosted tier may ever exist (§3.5) · whether `.sql`-vs-SQLite changes the export *promise*
or the export *implementation* (F1) · the legal review of the rewritten AUP/DPA (Blueprint Part D
requires counsel, and the AUP already carries an "KI verfasst, nicht anwaltlich geprüft" warning).

---

# 6. FOUNDER EXECUTION LIST

## 6.1 If D1 = GO and D2 = A — the one-sitting setup

Laptop recommended (the Cloudflare dashboard's token UI is awkward on iPhone). **Nothing here is done
by CC; every step is a founder action** (Rule 4).

| # | Step | Where | Result to record |
|---|---|---|---|
| **F-0** | **First — verify `goblin.app`.** Check availability/ownership. If unavailable, **stop and re-plan the naming architecture before anything else** (§2.4) | Registrar / Cloudflare Registrar | Domain owned, or a decided alternative |
| 1 | Create (or sign in to) the Cloudflare account for the **user-app plane**. Use a Goblin role address, not a personal one. **Enable 2FA immediately.** | dash.cloudflare.com | Account exists, 2FA on |
| 2 | Add `goblin.app` as a zone; point its nameservers at Cloudflare | Dashboard → Add a site | Zone active |
| 3 | Subscribe to **Workers for Platforms — $25/month**. **Note whether checkout also requires the $5 Workers Paid plan** and report it — this resolves F6(i) | Dashboard → Workers & Pages → Plans | Subscription active; F6(i) answered |
| 4 | Create the **dispatch namespace**. Suggested name: `goblin-living-apps` | Dashboard → Workers for Platforms | Namespace name |
| 5 | Create the **bootstrap token** (namespace + DNS). Use it once, then delete it | My Profile → API Tokens | Used and deleted |
| 6 | Create the **deploy token** with **Account · Workers Scripts Edit** and **Zone · DNS Edit** scoped to `goblin.app` only. Add D1/R2/Queues/SSL scopes later, per phase (§4.2). **Confirm the exact checkbox names and report any divergence from §4.2** | My Profile → API Tokens → Create Token | Token created; copied **once**, straight into step 8 |
| 7 | Note the **Account ID** from the dashboard sidebar | Dashboard overview | Account ID |
| 8 | Set the three variables in Railway on the **API** service: `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_DISPATCH_NAMESPACE`. Paste the token here and **nowhere else** — not into chat, not into a note, not into a CC session | Railway → API service → Variables | Three variables set; API redeployed |
| 9 | Create the **Turnstile widget** for the fleet: hostname **`goblin.app`** (one entry covers every subdomain — §F5). Keep site key + secret for Phase 4 | Dashboard → Turnstile | Widget created |
| 10 | Leave `OPS_HOSTING_ENABLED` **false** / unset. Phase 1 ships behind the flag; real users must see nothing | Railway | Flag off |

**Wildcard DNS + SSL for `*.goblin.app` is deliberately NOT in this list.** Master-Plan Phase 2 makes it
an explicit HALT condition with its own founder steps, and it should be configured when Phase 2 needs
it — not months earlier on a domain with nothing behind it.

**Do not do in this sitting:** create D1 databases, upload Workers, or configure custom hostnames. Those
are phase work, behind G1.

## 6.2 Founder/Steven work items this spike surfaced (not setup)

1. **Rewrite `ACCEPTABLE_USE_POLICY.md` + `ABUSE_RESPONSE.md`** — blocking precondition for Phase 2 (F4, §3.6).
2. **Publish an abuse contact of record** and the `/missbrauch-melden` page (§3.2).
3. **Subprocessor list + DPA template** — Cloudflare joins the list at Phase 1 (§3.6).
4. **Resolve the CFO-dashboard gap (S4)** — `GOBLIN_CFO_DASHBOARD_DE.html` is named as the financial
   source of truth and is not in the repo. Phase 8 unit 8.4 HALTs without CFO v2.
5. **Decide the F1 export question** — convert `.sql` → SQLite server-side, or change the copy.
6. **Move the abuse-SOP rehearsal earlier than Phase 15** (§3.3).

## 6.3 After the decision

Read this table → decide D1 and D2 → if GO, execute §6.1 → then say **"Phase 1"** in a fresh session.
**Phase 1 does not start in this session** (one phase per session, standing law).

---

# 7. HONEST LIMITATIONS

**Mandatory section. "None" would be a lie.**

1. **`goblin.app` was never verified.** Availability, ownership and price are unknown (§2.4). The entire
   naming architecture of Phases 2 and 12 rests on a domain this spike could not check without taking a
   commercial action it is forbidden to take. This is the largest single unknown in the document.
2. **The 5 CPU-ms assumption (A1) is unmeasured** and drives every CPU figure, including the ~1,127-app
   ceiling. It is a judgment, not a measurement. Phase 2 must measure it and this model must be re-run.
3. **Traffic profiles are invented, not observed.** "500 visits/month, 50 form submissions" is a
   plausible Max-app shape with **zero** empirical backing — no Goblin app has ever been hosted by
   Goblin. Real cohort data (Thesis §11, question 2) will move these numbers.
4. **Three live-doc questions remain unresolved** (F6): whether Workers Paid is required alongside WfP
   ($5/mo); whether static-asset requests inside a dispatch namespace stay free; and whether a
   dispatch-namespace invocation is billed as one request or two. All three are handled conservatively;
   none changes a recommendation. The third is the only one that touches the "flat cost through G3"
   headline, and it survives even the pessimistic reading.
5. **No Cloudflare dashboard was opened, no account exists, no price was seen in a checkout.** Every
   figure is list price from public documentation. Blueprint Part E anticipated exactly this
   ("SPIKE-0 re-verifies against the live dashboard before D2") — **that re-verification is only
   partially satisfied: documentation is live, the dashboard is not.** Step 3 of §6.1 is where the real
   checkout price gets confirmed.
6. **Options B/C/D under D2 were not evaluated.** The phase objective was to test the Cloudflare
   recommendation, not to run a bake-off. The D2 recommendation is therefore "Cloudflare meets the
   requirements", **not** "Cloudflare beat the alternatives" — no alternative was measured.
7. **The break-even is a delta, not a derivation** (§2.5, S3/S4). The ~13-user base is inherited from
   `GOBLIN_THESIS_v3_DRAFT.md:154` and could not be reproduced from repo artifacts, because the
   declared financial source of truth is not in the repository. Only the **+3 to +4 user delta** is
   reproducible from this document's own arithmetic.
8. **The abuse SOP is a draft that has never been rehearsed.** §3.3 asserts a 24-hour clock that no one
   has run once, against a suspension mechanism that does not exist yet. Its timings are intentions.
9. **No legal review.** §3 and §4 touch hosting liability, GDPR processor status and takedown duty. CC
   is not counsel; the existing AUP already carries that warning and it extends to everything here.
10. **Citations are single-source.** Each fact rests on one Cloudflare page, fetched once, on
    2026-07-25. Cloudflare prices and limits change; the retrieval date is on every claim precisely so a
    later reader can tell how stale this is.
11. **Nothing here was executed.** No account, no token, no deploy, no cost incurred, no migration
    authored, no ledger line changed. This document is paper, as the phase required.

---

*OPS-SPIKE-0 · Phase 0 of 16 · The spike is finished when the founder decides — not when CC stops typing.*
