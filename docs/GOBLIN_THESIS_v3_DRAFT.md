# GOBLIN — THESIS v3 (DRAFT) · THE OPERATIONS PLATFORM
**"Shopify for software" — Build → Ship → Keep**

v3-DRAFT · 2026-07-11 · Author: Steven (architect) · Status: **FOUNDER-DIRECTION DRAFT, NOT CANON**

> **Discipline block (read first):**
> - This document is a strategy draft, not an executed plan. It authorizes **zero** builds, zero paid services, zero live-money actions (Law 8).
> - Every number marked `PROPOSED` or `ASSUMPTION` is exactly that. **No figure in this document may enter the pitch, the CFO dashboard, or any user-facing surface** until reconciled per §14.
> - The locked sequence is **unchanged**: FEEL-4 → Wave J → user-go. Everything in §10 is gated behind the validation results of the first real user cohort (§11).
> - Supersedes nothing yet. `GOBLIN_THESIS_v2.txt` remains canon until the founder promotes v3.
> - Founder decision reversal recorded: the 2026-07-07 ruling "Goblin does not host user deploys" was **reopened by the founder on 2026-07-11** in favor of this thesis. Formal go falls at the OPS-SPIKE-0 decision table (§13).

---

## 1. THE ONE LINE

**Goblin is where software built by non-developers lives.** Anyone with a browser — including only a phone — describes what they want, gets real working software, and Goblin keeps it alive: hosted, watched, patched, and honestly reported on, for the price of lunch.

The v2 one-liner sold the *building*. The v3 one-liner sells the *living*. Building becomes the free-flowing entrance; operations become the business.

---

## 2. WHAT CHANGED — v2 → v3 (July 2026 reality)

Three facts, all verified 2026-07-10/11, force the update:

**(a) The frontier came down-market.** On 2026-07-09 OpenAI shipped GPT-5.6, ChatGPT Work, and **ChatGPT Sites** — build, preview, publish and host interactive websites and lightweight apps from chat, custom domains included, public beta on paid plans. v2's "the frontier labs are racing upmarket, vacating the bottom" is **partially falsified**. Generation-from-chat is now a feature of the world's largest consumer app. Selling *generation* alone is a losing position against a company with 800M users.

**(b) The category's problem moved.** Adoption is solved — Lovable at ~$500M ARR run-rate and ~8M users, Replit targeting $1B ARR, a ~$4.7B vibe-coding market. What is demonstrably *not* solved is what happens after generation: a ~76% traffic collapse across AI-coding tools over 12 weeks in spring 2026; the documented "complexity wall" (apps reach 60–70% functionality, then enter debugging hell); ~45% of AI-generated code carrying OWASP-class vulnerabilities; apps that die silently after the prototype high. Every incumbent monetizes the *moment of creation*. Nobody owns the *lifetime of the artifact* for non-developers.

**(c) Mobile got structurally harder for everyone but us.** Apple blocked Replit and Vibecode updates and removed Anything (twice) under Guideline 2.5.2. Goblin's PWA-first + external-browser-preview architecture is compliant by design. The phone-only builder — v2's Island Flow user — is now the *worst-served* customer in the category, at the exact moment the category's biggest players are legally hobbled on that surface.

**Conclusion:** the defensible position is not "cheaper/friendlier generation." It is the position Shopify took against website builders: *don't sell the tool, sell the outcome staying alive.* Shopify's own revenue proves where the money settles — roughly three quarters of it comes from merchant solutions (payments, operations), not from the subscription to the builder. The builder is customer acquisition; the operating relationship is the company.

---

## 3. THE CONTRARIAN TRUTH v3

Every player in this category — OpenAI Sites, Lovable, Replit, Bolt, v0 — shares one unexamined assumption:

> **The job is done when the app is generated and a URL exists.**

For a developer, that's true; they can maintain what they made. For Max — and for the 98% of the planet that builds like Max — the URL is where the *actual* job begins: Will it still work next month? Who notices when it breaks at 2 a.m.? Who applies the security patch? Who renews the domain, keeps the form submissions from vanishing, tells me honestly that the login is broken *before my customer finds out*?

Today the honest answer, on every platform, is: **nobody.** The category ships orphans. The retention crisis is not a marketing problem — it is the product-shaped hole where operations should be.

Goblin's secret: **the Feeling architecture we built for quality reasons is, economically, an operations product.** Truth-gated deploys, never-claim-an-unverified-state, honest degradation in the user's language, verification loops that check every asset before saying "Live" — for a generation tool these are virtues. For an operations platform they are *the load-bearing walls*. A competitor can clone a builder UI in a quarter. A culture of "we never tell you your app is fine when we haven't looked" cannot be bolted on — and it is the only thing a non-developer can actually buy trust with.

---

## 4. THE CUSTOMER — MAX, AT WEEK 8

v2 defined Max at minute 0 (builds from a phone in Santorini). v3 defines Max at **week 8**, because that's where the money is:

- Max built a booking page for his side business. It worked. He showed people. He *stopped opening the builder* — the category calls this churn; we call it **success that nobody is monetizing**.
- Week 5: a dependency broke the contact form. Nobody knew for 9 days. He lost inquiries.
- Max cannot read a stack trace, will never open a server dashboard, and does not know what a DNS record is. He does not want a tool. **He wants a guarantee expressed in his own language.**

Segments, in order of attack:
1. **The evening builder with a live artifact** (existing wedge, extended past deploy day).
2. **The micro-business** — the barber, the coach, the club: a booking page, a form, a small tool. Today they pay Wix/Shopify $17–39/mo for less flexibility. This is where "Keep" is a *known, already-budgeted* expense.
3. **The agency-of-one** — freelancers building for clients on Lovable today, who currently have no answer when the client asks "and who maintains it?" Reselling Goblin Keeper *is* their answer (→ §7.6).
4. **The next billion** (v2's horizon, unchanged): Tier-3 pricing + bundled open models remain the only economics that reach it. Nothing in v3 abandons this; operations revenue *funds* it.

NOT the customer: pro devs as primary (welcome, never the target), enterprises (Lovable's fight, not ours), anyone needing regulated-workload guarantees (§12 — we will say so honestly).

---

## 5. THE PRODUCT — THE GOBLIN LIFECYCLE

Three verbs, one platform. The first exists, the second is a founder-reopened decision, the third is the new company.

### 5.1 BUILD (live today)
Chat-first creation, Layer 1 bundled models (Swift/Forge), Send-to-Code with integrity manifests, mobile-first three-tier interaction, truth-gated everything. Unchanged, already ahead of the category on honesty. Build remains generous — it is the top of the funnel, priced to remove anxiety, never to maximize extraction.

### 5.2 SHIP (decision reopened 2026-07-11)
**Goblin-hosted publish**: one tap, "Live stellen," app runs on Goblin's substrate at `name.goblin.app`, custom domain attachable. The Vercel-connect path *remains* as the "graduate" option — real repo, real export, no lock-in, the anti-Lovable guarantee "your code is always yours, take it anywhere" stays a moat property. But the default path requires connecting **nothing**.

Substrate: **decided at OPS-SPIKE-0, not here.** Requirements the spike must satisfy: (a) static + serverless-dynamic tiers, (b) hard per-app resource caps (cost blowout protection), (c) EU-storage compatibility with the existing B2/Supabase posture, (d) marginal cost per idle app ≈ $0.00x (ASSUMPTION to verify; edge platforms are in that class today), (e) abuse controls (subdomain phishing is a *day-one* threat, §12).

### 5.3 KEEP (the new company) — **Goblin Keeper**
The Keeper is the FEEL agent pointed at *runtime* instead of *build time*. FEEL-3's deliberately deferred "runtime smoke" (Arch v7 §6) is not a leftover — it is the seed of the entire business. Capability ladder, each rung a shippable wave:

- **K0 — Heartbeat & honest status.** Scheduled checks: entry URL 200, assets 200, cert valid, domain not expiring, form endpoint answering. Surface: a status card in the app + a weekly German/EN plain-language report ("Deine App war diese Woche 99.7% erreichbar. Am Dienstag war sie 12 Minuten offline — Ursache: X. Behoben: automatisch."). *Deterministic, near-zero token cost.* The Feeling invariant applies with full force: **we never report a state we did not measure.** No fake green dashboards — the category is full of them; ours is the honest one or it is nothing.
- **K1 — Error capture & plain-language incident reports.** Runtime error hook in every Goblin-hosted app; console/network failures collected; the Keeper translates "TypeError: cannot read properties of undefined" into "Der Buchen-Knopf reagiert seit 14:02 nicht. Ich habe die Ursache eingegrenzt: …". Notification via email (Resend) / PWA push.
- **K2 — Diagnosis & fix proposal.** On incident: Keeper runs a bounded diagnosis loop (reuses the FEEL-3 orchestrator + STC manifests), produces a diff with a change manifest, and asks: "Goblin schlägt einen Fix vor — anschauen und live stellen?" One tap approves; truth-gated deploy verifies; honest report closes the loop. **The user always decides** (unchanged law) — until they opt into…
- **K3 — Self-heal (opt-in).** Pre-authorized fix classes (dependency patch, broken asset, cert/domain renewal) applied autonomously overnight, every action logged and reported in the morning digest. "The platform walks at night." Scope-limited by explicit user policy, never silent.
- **K4 — Care beyond code.** Backups with one-tap restore ("dein Stand von Dienstag"), security scanning of generated code against the documented 45%-vulnerability base rate (this is a *headline marketing number*: "Goblin checks what the others ship"), performance watch, dependency currency, uptime history the user can show *their* customers.

### 5.4 DATA (the brochure→tool jump) — managed primitives
An app that can't remember anything is a brochure. Ship the three primitives that turn 80% of Max-class apps into tools, with zero configuration: **Forms** (submissions → viewable table + email notification), **Auth** ("meine Kunden können sich einloggen"), **Simple data** (key-value / table the app reads and writes). Multi-tenant on the existing Supabase posture (RLS), hard quotas per plan. This is also the strongest lock-in in the stack — data gravity — which is precisely why the export guarantee (§5.2) must stay absolute to keep the lock-in *earned* rather than coercive.

---

## 6. WHY FEELING IS THE MOAT (restated for v3)

| Moat claim | Why it holds against a fast follower |
|---|---|
| **Truth architecture as product** | Ops promises are only worth what the platform's honesty is worth. Goblin's invariants (never claim unverified state, honest degradation, no phantom affordances) are enforced in code and culture since FEEL-1. A competitor retrofitting this must fight its own dashboard-optimism DNA. |
| **The keeper speaks Max's language** | Incident communication for non-developers is a *writing and honesty* problem, not a monitoring problem. Datadog exists; Datadog-for-Max does not. |
| **Mobile compliance by design** | PWA + external preview + review-and-command surface (MOBILE-1) is Apple-proof today; the biggest competitors are provably not. |
| **Substrate independence** (carried from v2) | Open models via wholesale APIs mean quality and margin rise together as the open ecosystem improves; Keeper diagnosis runs on Swift-class economics. |
| **Aim** (carried from v2, sharpened) | Everyone sells creation to creators. We sell *sleep* to owners. Different sport, structurally unattractive for incumbents whose metric is generation volume. |
| **Data gravity, honestly held** | Forms/auth/data make leaving costly — while the export guarantee keeps the relationship voluntary. "You stay because it works, not because you're trapped" is itself a marketing weapon in a category Apple and users increasingly distrust. |

What is **not** a moat and must never be claimed as one: hosting itself (commodity), model quality (rented), price alone (z.ai proves someone will always subsidize harder).

---

## 7. REVENUE ARCHITECTURE (all figures PROPOSED — §14 before any external use)

Design principles: (1) building stays cheap and anxiety-free — the funnel is sacred; (2) money concentrates where value concentrates: the *live, working, earning* artifact; (3) every charge maps to something the user can see working — the "no invisible features billed" anti-pattern is a standing law; (4) three regional tiers apply to everything, carried from canon pricing.

### 7.1 Build subscriptions (exists — canon: CFO dashboard)
Trial · Build · Pro · Power, unchanged as the entrance. v3 adjustment PROPOSED: each paid plan *includes* one Keeper-covered app (Pro: K0–K1; Power: K0–K2) so the first taste of "it's being watched" is free — the endowment mechanism that made the achievement-triggered upgrade card work, applied to ops.

### 7.2 Keeper subscriptions — per live app (the Shopify "plan" analog)
- **Keeper** (K0–K2): PROPOSED T1 $6 / T2 $4 / T3 $2.50 per app/mo.
- **Keeper Pro** (K0–K4 + backups + security scan + self-heal): PROPOSED T1 $19 / T2 $12 / T3 $7 per app/mo.
- Stacks per app → a user with three living tools pays 3×; MRR grows with the user's *success*, not their prompting volume. This inverts the category's economics: incumbents earn most from users who thrash (token burn); Goblin earns most from users whose things *work*. Incentive alignment is itself retention.

### 7.3 Goblin Payments (the Shopify profit engine analog)
Stripe Connect under the hood; the user's app takes bookings/payments with zero Stripe knowledge. PROPOSED platform fee: 1.5% (T1) / 1.0% (T2/T3) on transaction volume, on top of pass-through processing. Even tiny merchants move real volume: 20 micro-businesses × $2k/mo GMV × 1.5% = $600/mo — from *usage of their success*, invisible until it isn't. Long-run this line, not subscriptions, is the venture case; it is also the line that demands the most compliance care (§12, §13).

### 7.4 Infrastructure add-ons (metered, honest, capped)
Custom domains (at-cost + PROPOSED $9/yr handling incl. auto-renew + honest expiry warnings — renewal neglect is a real Max pain), storage/bandwidth beyond generous included quotas, extra environments ("Testversion deiner Live-App"), email sending (transactional, via Resend margin). All governed by the consumption ledger; every meter gets an M-line the day it exists (§10).

### 7.5 Forge compute packs (exists conceptually)
Heavier builds/diagnoses on Forge class as top-up packs. Unchanged logic, now with a second consumer: Keeper Pro diagnosis runs.

### 7.6 Agency / white-label ("Goblin for the agency-of-one")
Freelancers manage N client apps under one roof: client-facing honest status pages with *their* branding, consolidated Keeper billing, PROPOSED $49–99/mo + per-app Keeper at volume discount. Solves the freelancer's "who maintains it?" objection and recruits a salesforce we don't pay. Later, not first.

### 7.7 Template & component marketplace (later)
Working, *kept* templates ("this booking flow is maintained by Goblin") with 80/20 creator split. Deferred until real inventory of proven apps exists; do not build marketplaces before there is a market.

### 7.8 What we will NOT monetize (public commitments)
No ads. No selling user data. No charging for invisible mechanisms. No punitive egress on export — leaving is free, always. These are written down because they are cheap now and priceless later.

### 7.9 Revenue-quality note
The v2 model earns once per user per month regardless of outcomes. The v3 model earns per *living artifact* plus per *transaction* — compounding, success-correlated, churn-resistant (canceling Keeper = consciously orphaning your working thing; canceling a builder = forgetting an app icon). This difference is the entire multiple-expansion argument.

---

## 8. UNIT ECONOMICS SKETCH (ASSUMPTION — every line requires measurement)

Illustrative "Year-2 shape" per 100 paying users (mid-tier blend), *not* a forecast:
- 100 Build-side subs @ blended gross ARPU $16.20 (canon) → $1,620/mo
- 60 living apps beyond included ones, 70/30 Keeper/Keeper-Pro @ T-blend → ~$500/mo (PROPOSED prices)
- 10 payment-active apps @ $1.5k avg GMV @ ~1.3% blend → ~$195/mo
- Add-ons (domains, storage, email) → ~$80/mo
→ ops-side revenue ≈ **+48% on top of the builder base**, at COGS that are mostly deterministic checks (≈$0), pennies of hosting per app, and Swift-class diagnosis tokens (order $0.02–0.07 per incident at canon $0.35/M blended — ASSUMPTION, measure in week 1 of KEEPER-1).
- Floor discipline carries over: the 66.3% minimum-margin rule extends to every ops SKU; any SKU that can't clear it at 100% quota exhaustion doesn't ship.
- Break-even stays ~13 payers at ~€80/mo fixed (canon) *until* the substrate adds fixed cost — OPS-SPIKE-0 must state the new fixed-cost line explicitly before the founder signs.

---

## 9. COMPETITIVE MAP (honest version)

"Nobody occupies the niche" is too strong; precision is the defense:
- **OpenAI ChatGPT Sites** — hosts, but inside metered plans, no ops guarantee, no code ownership, no export, not in EEA/CH/UK (temporary gift, not a moat). Watches nothing after publish.
- **Lovable** — generation king, going enterprise; hosting exists, honest non-dev *operations* do not. Its 8M users' orphaned apps are, bluntly, our TAM.
- **Replit** — has deployments *and* monitoring, but for developers, in developer language, and is Apple-hobbled on mobile.
- **Wix/Base44, Durable, Hostinger Horizons** — closest in spirit (site + hosting + "we handle it"), weakest in real-code flexibility and agentic keeping; Wix's Base44 acquisition confirms the direction is valuable.
- **Shopify** — the model, not the rival (commerce-only).
- **The unowned square, exactly:** *agentic, honest, mobile-first operations of real (exportable) software for non-developers, on bundled open-model economics.* Every neighbor holds at most two of those five properties.

---

## 10. ENGINEERING ROADMAP POST-FEEL-4

**Unchanged and untouchable:** FEEL-4 (context/personality + settings audit, Steven regrades Feeling) → Wave J (Help & Support) → **user-go** with the open-items list (Feeling Walk 2, webhook live gate, FEELING_SPEC housekeeping, monitoring consolidation). Nothing below starts building before user-go signals arrive, except the two paper items marked ✎.

- **✎ OPS-SPIKE-0 (paper/spike, may run during validation weeks).** Substrate evaluation (edge-serverless vs. container PaaS vs. hybrid with existing Railway), cost model incl. new fixed line, abuse/moderation design (subdomain phishing, DMCA path, egress caps), EU-data posture. Deliverable: decision table for the founder. *Spike before build; evidence before verdict.*
- **✎ CONCIERGE-K (no code — runs during user-go weeks).** Steven+founder manually "keep" cohort apps: weekly honest health email, hand-checked. At week 3, the $5 question. **This validates the entire thesis for zero build cost** and produces the exact German sentences K0's reports will later use.
- **OPS-1 — Goblin-hosted publish** (gated on §11 signals + SPIKE-0 sign-off). Feature-flagged parallel path to Vercel-connect; static first; `name.goblin.app`; hard caps from day one. Ledger: new M-lines for hosting COGS class (platform-COGS, not user quota).
- **KEEPER-1 — Runtime truth** (K0+K1). Extends the deploy-time verification loop to scheduled runtime checks + error hook + status card + weekly Resend report. Mostly deterministic; label it as such in every gate report. Ledger: M-K1 (heartbeat, ≈$0), M-K2 (report generation tokens, formula, platform-COGS). Absorbs and closes the standing "monitoring consolidation" thread — Goblin's own health and users' app health become one instrument.
- **KEEPER-2 — Diagnosis & proposal** (K2). Reuses FEEL-3 orchestrator, bounded loop budget, STC manifests as the fix-preview surface, truth-gated redeploy. Flakiness law applies: measure fix-success rate as a number (≥4/5 on a defined incident battery before any headline claim). Ledger: M-K3 (diagnosis run, token formula, **founder decision: user quota vs. platform-COGS**).
- **DATA-1 — Managed primitives** (forms → auth → simple data), RLS multi-tenant, hard quotas, export always. Sequenced early because it multiplies what "an app worth keeping" even is.
- **KEEPER-3 — Self-heal opt-in** (K3) + morning digest. Policy engine for pre-authorized fix classes; every action logged; honest-by-construction.
- **MONEY-1 — Domains + Goblin Payments** (Stripe Connect). Heaviest compliance unit; own decision table; never before real Keeper traction proves the trust relationship.
- **KEEPER-4 / MARKET-1 / AGENCY-1** — backups+scan+perf; marketplace; white-label. Horizon items, listed so nothing is invisible, all behind their own gates.

Methodology notes binding all waves: one unit = one revert-ready commit; migrations authored-never-applied; every consumption-relevant mechanism gets its ledger line in the same commit; CC prompts standalone; cloud sessions get no live keys — Keeper credentials design (it will eventually touch prod-adjacent surfaces) is itself a SPIKE-0 section.

---

## 11. VALIDATION PLAN & KILL CRITERIA (the honest part)

The first cohort (~20 users, post user-go) answers four questions; the thesis lives or dies on numbers, not vibes:
1. **W4 unprompted return** — do they come back without a nudge? (Builder-thesis health.)
2. **W8 artifact survival** — is the app reachable, functioning, *used* (any real traffic)? (Ops-thesis precondition: there must be something worth keeping.)
3. **Concierge conversion** — of users with a living app, how many say yes to $5/mo "wir passen drauf auf"? Target ≥3/10 asked. This is the single most information-dense number in the company.
4. **Incident reality** — how many real breakages occur in 8 weeks, of which classes? (Feeds KEEPER-1/2 scope; if nothing ever breaks, K0 honesty is still sellable but K2/K3 scope shrinks.)

**Kill criteria (pre-committed):** if at W8 fewer than ~20% of cohort apps show any real usage **and** concierge conversion is 0/10, the ops thesis is dead as a business (people don't keep what they build) → Goblin remains the honest builder niche, and we have spent ~zero build budget finding out. If W4 return is strong but W8 survival is weak, the problem is *artifact value*, not keeping → DATA-1 jumps the queue ahead of all Keeper waves.

---

## 12. RISKS & HONEST LIMITATIONS

1. **Solo-founder on-call.** "We keep your software alive" implies someone is awake. Unmitigated, this is the thesis-killer. Mitigations: static/serverless-first substrate (no servers of ours to crash), deterministic checks doing 95% of the work, honest *tiered* promises ("watched and honestly reported" ≠ "five-nines SLA" — we sell truth, not uptime theater), self-heal for the boring 80%, and the explicit understanding that K-ladder height follows team size. **We never sell a promise a solo founder cannot keep; the Feeling invariants forbid it.**
2. **Abuse & legal.** Hosted user content = phishing subdomains, DMCA, NIS2-adjacent questions, Stripe-Connect platform liability. All solvable, none optional, all priced into SPIKE-0. Payments last for a reason.
3. **Cost blowout / hostile workloads.** Hard caps, egress limits, kill-switches per app, %-circuit-breaker thinking applied to infra.
4. **The giants add "keep" too.** Plausible eventually. Defense: they will do it for their hosting lock-in and in dashboard language; our combination (honesty culture + Max language + export freedom + open-model cost floor + mobile) is the five-property square of §9. Also: their incentive is generation volume; ours is artifact longevity — incentives shape roadmaps.
5. **Two-front execution.** Builder polish *and* ops platform can exceed one founder + AI team. The gate structure (§11) exists precisely so we never fight both fronts on hope.
6. **This document's own bias.** It was written at high enthusiasm, hours after the founder embraced the idea. §11 is the antidote: the market, not the mood, promotes v3 to canon.

---

## 13. FOUNDER DECISION TABLE (nothing here is Steven's call)

| # | Decision | When | Default recommendation |
|---|---|---|---|
| D1 | Hosting reversal — formal go | at OPS-SPIKE-0 review | Go, static-first, capped |
| D2 | Substrate + new fixed-cost line | OPS-SPIKE-0 | per spike evidence |
| D3 | Keeper pricing & what Pro/Power include | before KEEPER-1 ships | §7.1/7.2 PROPOSED as starting point |
| D4 | Diagnosis tokens: user quota vs platform-COGS | KEEPER-2 prompt | platform-COGS at launch (simplicity + trust), revisit at scale |
| D5 | Payments (Stripe Connect) entry | after Keeper traction | not before ~50 kept apps |
| D6 | Thesis v3 → canon; pitch/Arch v8 rewrite | after §11 gates | only with numbers in hand |
| D7 | Concierge-K participation (founder time, weekly) | at user-go | yes — highest ROI hours in the plan |

---

## 14. CFO-DASHBOARD RECONCILIATION CHECKLIST (before any external number)

☐ Keeper SKUs modeled in `GOBLIN_CFO_DASHBOARD_DE.html` across all nine regional cells · ☐ 66.3%-floor test per SKU at full quota exhaustion · ☐ substrate fixed+variable costs as new cost lines · ☐ payments take-rate net of Stripe pass-through · ☐ break-even recomputed with new fixed line · ☐ ledger M-K1/K2/K3 + hosting-COGS lines authored · ☐ blended ARPU restated (builder + ops) · ☐ only rendered dashboard values enter the pitch (standing law).

## 15. OPEN QUESTIONS (tracked, unanswered by design)

Dynamic/full-stack hosting tier scope? · Keeper for *externally* hosted (Vercel-connected) apps — watch-only tier as bridge? · GDPR processor role for user-app end-customer data (DPA template needed at DATA-1)? · naming ("Keeper" is working title; brand pass later) · does Wave J's support agent share the Keeper's incident-language engine (likely yes — one honesty voice)?

---

*This methodology paragraph intentionally last: this draft cost zero build-days. Its promotion to canon costs real user evidence. That order — thesis, then proof, then build — is the whole reason the ten laws exist.*
