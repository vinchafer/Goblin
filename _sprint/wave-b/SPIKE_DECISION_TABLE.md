# WAVE B — SPIKE DECISION TABLE (Full-Stack backend provisioning)
**Session 1 (Spike-only) · Runbook 4 · Repo `vinchafer/Goblin` · Branch `claude/wave-b-ubk7rq`**
**Produced: 2026-07-18 · All external numbers verified against official docs/pricing pages, each cited with URL + access date. This is a research artifact for the founder gate — NO code, NO accounts, NO architecture chosen here. The founder chooses D-B1 + D-B2 from this table.**

> **Honesty note on the numbers.** Every figure below carries its official source URL and was accessed **2026-07-18**. Where a dollar total at 100/1k/10k is my arithmetic from official per-unit prices (not an official bundled quote), it is labeled **(computed)**. Anything I could not confirm from an official page is labeled **UNVERIFIED** and must be re-checked before it is relied on in build. Pricing pages move; treat every number as "as-of 2026-07-18."

---

## 0. How to read this against the spec requirements
The spec (§2) makes several requirements **hard gates**, and two of them decide the table before cost even matters:

- **R6 — generated-code shape:** v1 is **client-side apps using the provider's JS client with RLS, no custom server runtime to host** (keeps the own-Vercel static-deploy model intact). → An option only qualifies cleanly if it supports **safe direct-from-browser access** (public/anon key + row-level isolation the browser cannot bypass).
- **R2 — per-project isolation:** **RLS or equivalent mandatory.**
- **R4 — own-account philosophy:** price **both** shapes — (a) platform-owned, (b) user-connected (mirrors Vercel, presumed favorite).

Read the "R6 fit" and "Isolation" columns first: they eliminate options regardless of price.

---

## 1. THE TABLE

### 1a. Provisioning, auth, isolation, connector shape

| Option | Provisioning API (create backend programmatically) | Connector to provision inside **user's own** account (shape b) | Built-in auth | Isolation mechanism (R2) | **R6 fit** (safe static client-side + RLS) |
|---|---|---|---|---|---|
| **Supabase — user-connected** | `POST /v1/projects` Management API. [ref](https://supabase.com/docs/reference/api/v1-create-a-project) | **YES, self-serve OAuth2.** Redirect → `api.supabase.com/v1/oauth/authorize` → token; docs: "building a third-party app that needs to create or manage Supabase projects on behalf of your users." [oauth guide](https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration) | **Yes** — password, magic link, OTP, 19+ OAuth providers. [auth](https://supabase.com/docs/guides/auth) | **Postgres RLS** (policies), the recommended per-user mechanism; "RLS can be combined with Supabase Auth for end-to-end security from the browser to the database." [rls](https://supabase.com/docs/guides/database/postgres/row-level-security) | **✅ BEST.** Purpose-built: anon key + RLS + `supabase-js` in the browser is the documented pattern. |
| **Supabase — platform org** | same Management API, Goblin's org owns all projects | n/a (Goblin owns) | Yes (same) | Postgres RLS (same) | ✅ same client model, but Goblin owns user data (philosophy + GDPR weight, §R4/§4-escalation) |
| **Neon Postgres** | Full API for projects/branches/DBs. [api](https://api-docs.neon.tech/reference/authentication) | **OAuth exists but GATED** to "partners we have active commercial relationships with" — **not self-serve.** [oauth](https://neon.com/docs/guides/oauth-integration) | **Better Auth — BETA, not GA.** "The Managed Better Auth is in Beta." [auth](https://neon.com/docs/auth/overview) | Postgres RLS, but **auth→RLS wiring is manual** (write policies vs `auth.user_id()`). [rls](https://neon.com/docs/guides/rls-tutorial) | **⚠️ WEAK.** Neon exposes Postgres connection strings, not a browser-safe anon-key REST client like Supabase. Safe browser use is not the documented model → conflicts with "no custom server runtime." |
| **Turso / libSQL (SQLite-class)** | `POST /v1/organizations/{org}/databases`, DB-per-tenant. [api](https://docs.turso.tech/api-reference/databases/create) | **No documented OAuth** to provision in a user's account — token-only. **UNVERIFIED any connector flow.** [auth](https://docs.turso.tech/api-reference/authentication) | **No.** "Turso… does not want to specialize in… authentication"; starters use Clerk/Auth0. [ref](https://turso.tech/blog/why-we-transitioned-to-clerk-for-authentication) | **No RLS.** Isolation = **database-per-tenant** (physical) or app-level filtering. [multi-tenancy](https://turso.tech/multi-tenancy) | **❌ FAILS.** No RLS → a DB token in client code grants full scope; safe use needs a server tier to mint per-user tokens. Breaks the static-client model. |
| **Convex** | Management API (Beta) + **OAuth app tokens** (self-serve) "on behalf of… a user of a Convex integration." [api](https://docs.convex.dev/management-api) | **YES, self-serve OAuth app tokens** | **Yes** (Convex Auth Beta, or Clerk/Auth0/OIDC). [auth](https://docs.convex.dev/auth) | **Not RLS** — isolation enforced **in application code** (`ctx.auth` inside functions); docs: "doesn't need… RLS." [auth](https://docs.convex.dev/auth) | ⚠️ Works client-side via Convex SDK, but **proprietary function/document model — not portable Postgres** (conflicts with "real code" positioning). |
| **Firebase (Firestore)** | Cloud Resource Manager `projects.create` + Firebase Management API `addFirebase`. [mgmt](https://firebase.google.com/docs/projects/api/workflow_set-up-and-manage-project) | Google OAuth 2.0 user creds (provision in user's GCP account) | **Yes** (base Auth free; SAML/OIDC needs Identity Platform) [auth](https://firebase.google.com/docs/auth) | **Not RLS** — **Security Rules** over NoSQL documents. [auth](https://firebase.google.com/docs/auth) | ⚠️ Works client-side via Security Rules, but **NoSQL + proprietary** — not portable Postgres, against "real code" positioning. Each app = 1 GCP project (quota cliff). |

### 1b. Economics — cost at 100 / 1,000 / 10,000 projects, both shapes

| Option | Free tier (the trial-relevant limit) | **Platform-owned** cost @100 / @1k / @10k projects | **User-connected** cost to Goblin | Idle behavior (decisive for platform-owned) |
|---|---|---|---|---|
| **Supabase** | **2 active projects/org**; pause after **7 days** inactivity; 500 MB DB, 50k MAU, 5 GB egress. [pricing](https://supabase.com/pricing) · [pausing](https://supabase.com/docs/guides/platform/free-project-pausing) | **~$1,015 / ~$10,015 / ~$100,015 per month (computed)** — Pro $25/org + **~$10/project/mo Micro compute, billed 24/7**. [compute](https://supabase.com/docs/guides/platform/manage-your-usage/compute) | **≈ $0 marginal.** User's own account bears DB cost; free tier = 2 projects/user. | **Paid projects do NOT idle-pause** — "cannot be paused." [ref](https://supabase.com/docs/guides/troubleshooting/pausing-pro-projects-vNL-2a) → every project ≥ ~$10/mo forever. **Brutal at scale.** |
| **Neon** | **100 projects**, 0.5 GB + 100 CU-hrs each, scale-to-zero forced. [free limits](https://neon.com/faqs/free-plan-limits-and-quotas) | **~$0 (fits Free) / metered (Scale incl. 1,000) / ~$900+ capacity (computed, UNVERIFIED block price)** + compute $0.106–0.222/CU-hr (active only) + storage $0.35/GB-mo. [pricing](https://neon.com/pricing) | ≈ $0 marginal **only if** commercial-partner OAuth is granted (else platform-owned only) | **Scale-to-zero after 5 min idle** → idle project ≈ storage only (~$0.175/mo). [ref](https://neon.com/docs/introduction/scale-to-zero) **Cheapest platform-owned.** |
| **Turso** | **100 DBs**, 5 GB, 500M reads, 10M writes. [pricing](https://turso.tech/pricing) | Base fee + aggregate storage/rows; **per-DB marginal ≈ $0** (Developer $4.99 / Scaler $24.92 / Pro $416.58, unlimited DBs). [pricing](https://turso.tech/pricing) | n/a (no user-connector) | Idle empty DB ≈ free (billed on storage+rows). **Cheapest by DB count — but fails R6.** |
| **Convex** | 1M fn-calls, 0.5 GB, **40 deployments cap**. [pricing](https://www.convex.dev/pricing) | $25/dev + usage; **deployment caps 40 / 300 / unlimited** → 1k–10k needs **Business $2,500/mo min**. Aggregate $ **UNVERIFIED**. | ≈ $0 marginal (user's account) via OAuth | usage-based; deployment cap is the cliff, not idle cost |
| **Firebase** | Spark: 50k reads/day, 20k writes/day, 1 GiB, 50k MAU (3k DAU on Identity Platform). [pricing](https://firebase.google.com/pricing) | Pure usage; **each app = 1 GCP project** against an account **project quota** (default number **UNVERIFIED**, needs increase → abuse-screened). Aggregate $ **UNVERIFIED**. | ≈ $0 marginal (user's GCP) | usage-based; project-quota is the cliff |

### 1c. Latency + EU residency

| Option | Provisioning latency | EU data residency |
|---|---|---|
| **Supabase** | **UNVERIFIED** — no official project-creation time found. [checked](https://supabase.com/docs/guides/getting-started) | ✅ Frankfurt `eu-central-1`, Ireland, London, Paris, Zurich, Stockholm. [regions](https://supabase.com/docs/guides/platform/regions) |
| **Neon** | "**less than a second**" to deploy; branch ~1 s; cold-start <500 ms. [ref](https://neon.com/docs/get-started/dev-experience) | ✅ Frankfurt `aws-eu-central-1`, London. [regions](https://neon.com/docs/introduction/regions) |
| **Turso** | blog: create/delete <50 ms; "hundreds of ms" (not an SLA — **UNVERIFIED** as guarantee). [ref](https://turso.tech/blog/databases-will-be-free) | ✅ Ireland `aws-eu-west-1` confirmed; **Frankfurt UNVERIFIED** in fetched list. [locations](https://docs.turso.tech/api-reference/locations/list) |
| **Convex** | not stated | ✅ EU West (Ireland); EU pricing ~30% higher. [regions](https://docs.convex.dev/production/regions) |
| **Firebase** | not stated | ✅ `eur3` multi-region + Frankfurt `europe-west3` etc. (Firestore). **Auth EU residency UNVERIFIED.** [pricing](https://cloud.google.com/firestore/pricing) |

---

## 2. ONE-PAGE RECOMMENDATION — testing Steven's prior honestly

**Steven's prior: _Supabase, user-connected._ The numbers do not kill it — they strengthen it. Recommend it.**

**Why the field collapses to Supabase before cost is even considered.** Requirement **R6** (v1 = static, client-side apps using the provider's JS client with RLS, **no custom server runtime to host**) is a hard gate, and it is the whole game:

- **Turso is eliminated:** no RLS and no built-in auth. Without RLS, a database token in client-side code grants full scope, so safe use *requires* a server tier to mint per-user tokens — exactly the custom runtime R6 forbids. (It is the cheapest by DB count, but that is irrelevant if it can't ship a safe static app.)
- **Neon is weakened out:** its access model is Postgres connection strings, not a browser-safe anon-key REST client, and its built-in auth is **Beta, not GA**. Neon is excellent *server-side* infra (and by far the cheapest platform-owned option thanks to scale-to-zero), but it doesn't fit the static-client v1 shape without building the very backend R6 rules out. Its self-serve connector is also **gated to commercial partners**, killing the user-connected shape for us today.
- **Convex and Firebase work client-side but are proprietary** — Convex's function/document model and Firebase's NoSQL + Security Rules are **not portable Postgres**, cutting against Goblin's "real code" positioning (§1, R7). Firebase additionally hits a per-account GCP-project quota cliff; Convex a deployment-count cliff.
- **Supabase is the only mature option that is simultaneously: Postgres (real, portable code) + built-in auth + RLS + a documented safe direct-from-browser client.** It is purpose-built for exactly R6.

**Why the shape is user-connected, not platform-owned.** Both Supabase shapes clear R6 identically; the split is economics + philosophy (R3, R4):

- **Platform-owned is economically brutal:** paid Supabase projects **cannot idle-pause**, so every project costs **~$10/mo continuously** — **~$1,015/mo at 100, ~$10,015 at 1k, ~$100,015 at 10k (computed)**. Goblin would also own all user data (GDPR weight, philosophy conflict).
- **User-connected mirrors the founder's Vercel decision exactly:** the user brings their own Supabase account via the self-serve **OAuth2 connector** (confirmed, not gated — unlike Neon), Goblin provisions *inside it*, the **user owns the data**, and **Goblin's marginal infra cost is ≈ $0**. Cost sits with the user's own free/paid tier, precisely like own-Vercel.

**The honest costs of this recommendation (not hidden):**
1. **Connector friction:** the user must have or create a Supabase account and authorize it at first backend-needing build (JIT, mirroring Vercel JIT). This is real friction, but it is the *same* friction the founder already accepted for Vercel.
2. **Free tier = 2 active projects/user + 7-day idle-pause.** A "live" app that receives no traffic for a week **pauses** ("a few requests a day keeps it alive"). This is honest-limitation copy the B4 unit must ship (DE+EN): a published app that idles will sleep until next visit unless the user upgrades their Supabase. It directly informs **D-B2**.
3. **Provisioning latency is UNVERIFIED** — no official number. B1 must measure it on the real API and the agent must report only attested timing (no fabricated "~X Sekunden", per the anti-pattern catalog).

**Fallback worth recording (not recommended for v1):** if user-connected friction proves fatal in testing, the cheapest *platform-owned* path is **Neon** (scale-to-zero, ~$0.175/mo idle) — but only once its auth exits Beta and only by accepting a server-side access tier. That is a **v2 investigation**, not this wave.

**Bottom line:** Steven's prior survives the numbers on the merits, not by default. **Recommend D-B1 = Supabase, user-connected.**

---

## 3. THE TWO FOUNDER DECISIONS (framed — the founder decides, I do not)

### D-B1 — Option + shape
| Choice | For | Against |
|---|---|---|
| **Supabase, user-connected** ⭐ *(recommended)* | Only mature Postgres+auth+RLS+safe-browser-client option (R6); self-serve OAuth connector; mirrors Vercel; user owns data; **Goblin marginal cost ≈ $0**; EU/Frankfurt available | Connector friction; free tier 2 projects + 7-day pause; latency UNVERIFIED |
| Supabase, platform org | Zero user setup | **~$10/project/mo forever** (~$10k/mo @1k); Goblin owns user data (GDPR/philosophy) |
| Neon (platform-owned) | Cheapest infra (scale-to-zero); <1 s provisioning | Auth **Beta**; not a safe static-client model (needs server); self-serve connector **gated** |
| Turso / Convex / Firebase | (various) | Turso: no RLS/auth, fails R6. Convex/Firebase: proprietary, not "real code". |

**Recommendation: Supabase, user-connected.**

### D-B2 — Trial backend cap (how many backends may a **trial** user provision)
| Choice | Rationale |
|---|---|
| **1 backend / trial** ⭐ *(recommended)* | Fits within the user's Supabase free tier (2-project limit) with headroom; simplest honest cap; a trial provisioning 1 backend in **their own** account costs Goblin **$0** (satisfies R3: "a trial user provisioning 3 backends may not cost dollars"). Cost-protection from the first commit. |
| 2 backends / trial | Exactly the free-tier ceiling — no headroom; higher abuse surface |
| 0 (trial cannot provision) | Safest cost-wise but blocks the trial from experiencing the category-jump feature |

**Recommendation: 1 backend / trial.** (Note: in the user-connected shape the *dollar* exposure is already $0 because it's the user's account; the cap is primarily an **abuse/complexity** guard and a clean honest limit — still enforced from the first commit per CLOUD RIDER.)

---

## 4. M12 — LEDGER ROW SKELETON (draft for the founder; do NOT edit the CFO dashboard)
> To be committed to `docs/GOBLIN_CONSUMPTION_LEDGER.md` in the **same commit** as B1 (Law 5). Values below are the spike's draft; B1 confirms the attested numbers.

| Field | Draft value |
|---|---|
| **M-row** | **M12 — Full-stack backend provisioning** |
| **Trigger** | Agent calls `provision_backend` during a build that needs persistence/login (JIT at first backend-needing build). |
| **Cost components** | (1) **Model tokens** for the provisioning + schema + RLS-policy + client-wiring turn — falls under the existing agent-run allowance (user side). (2) **External infra**: **user-connected shape → $0 platform COGS** (user's own Supabase free/paid tier bears DB compute); **platform-owned shape → ~$10/active project/mo** (Supabase Micro, no idle-pause). |
| **Formula** | COGS_platform = active_projects × ~$10/mo (platform-owned) **OR** $0 (user-connected). Trial exposure = trial_users × D-B2_cap × per-backend-COGS = trial_users × 1 × $0 (user-connected). |
| **Knob + location** | Trial backend cap **D-B2** (recommend 1) — trial config; provisioned-project EU region default (Frankfurt) — provisioning tool config. |
| **Billing side** | User-connected: **user allowance** (tokens) + **user's own infra account** (DB). Platform-owned: **platform COGS** for DB compute. |
| **Dependent CFO figure** | COGS per active full-stack project (see CFO assumption row §5). |

---

## 5. CFO ASSUMPTION ROW TEXT (draft for the founder — for the CFO dashboard; I do not edit it)
> Numbers drawn from §1b of this table (official, accessed 2026-07-18).

> **Assumption — Full-stack provisioning COGS (Wave B).** Recommended architecture **Supabase, user-connected**: platform COGS per active full-stack project = **$0** — the user's own Supabase account (free tier: 2 active projects; or their paid tier) bears database compute, mirroring the own-Vercel model. **Trial infra exposure = $0** at the recommended D-B2 cap of 1 backend/trial (provisioned in the user's own free tier). Marginal Goblin cost per provisioning = the agent-run model tokens for one provisioning+generation turn (already inside the agent-run allowance; no new external line item). **Alternative for sensitivity analysis — platform-owned Supabase:** ~$10/active project/month, continuous (paid projects do not idle-pause) → ~$1,015/mo @100, ~$10,015/mo @1k, ~$100,015/mo @10k projects (computed from Supabase Pro $25/org + ~$10/Micro/project). Cheapest platform-owned alternative would be Neon (scale-to-zero, ~$0.18/idle project/mo) but it is not v1-viable (auth Beta, no safe static-client model). *All figures as-of 2026-07-18; re-verify before dashboard entry.*

---

## 6. FOUNDER SETUP STEPS for the chosen option (Supabase, user-connected) — to prepare BEFORE Session 2
> **No accounts or paid services are created in this spike.** These are the exact steps the founder performs before re-pasting the Session-2 build prompt. Nothing here spends money (Supabase OAuth apps + free-tier test projects are free).

1. **Create a Supabase OAuth application** (Supabase Dashboard → Organization → *OAuth Apps* → *Register application*). Set the **redirect URI** to Goblin's connector callback (e.g. `https://<goblin-host>/connectors/supabase/callback`). Configure scopes for project create/manage. → yields **`client_id`** + **`client_secret`**. Ref: [OAuth integration guide](https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration).
2. **Provide `client_id` / `client_secret` to Goblin's secret store** — B1 stores the secret under the existing **pgcrypto envelope** pattern (R5); the **service/admin key of any provisioned backend NEVER appears in generated code, logs, or reports** (D-wave scrubbing, adversarially tested).
3. **Confirm the default EU region** for provisioned projects: **Frankfurt `eu-central-1`** (recommended for EU-first). Ref: [regions](https://supabase.com/docs/guides/platform/regions).
4. **For the B3 proof on prod test accounts:** the founder connects **one** Supabase account (via the OAuth flow above) from the Goblin **test account** (`vinc.hafner3@gmail.com`). The proof's "two real test users, A and B" are **end-users of the generated todo app** (auth rows inside the provisioned project) — *not* two Supabase account owners. So: one connected Supabase account + two app-level signups (A, B) for the RLS probe. This respects D-B2 (1 backend for the one proof project) and the test-account law.
5. **Decide D-B1 and D-B2** (above), fill the Session-2 FOUNDER DECISIONS block, and re-paste the Wave-B prompt.

---

## 7. HALT
**Spike complete. No code written, no accounts created, no architecture committed.** Awaiting founder decisions **D-B1** (option + shape — recommend *Supabase, user-connected*) and **D-B2** (trial backend cap — recommend *1*), plus the founder setup steps in §6. On re-paste of the Session-2 build prompt with the FOUNDER DECISIONS block filled, Session 2 proceeds to units B1–B4 per spec §5.

### Honest limitations of this spike
- **Provisioning latency for Supabase is UNVERIFIED** (no official figure). B1 must measure and report only attested timing.
- **Dollar totals at 100/1k/10k are computed** from official per-unit prices, not official bundled quotes (labeled *(computed)* throughout).
- **Neon 10k-project capacity-block price ($50/500) is from a Neon blog, not the live pricing page — UNVERIFIED**; irrelevant to the recommendation (Neon not chosen for v1) but flagged for honesty.
- **Turso Frankfurt region and Firebase Auth EU residency are UNVERIFIED** from a definitive official list; irrelevant to the recommendation but flagged.
- I did **not** create any OAuth app, account, or project — all connector/provisioning behavior above is from documentation, to be confirmed against the live API in B1.
