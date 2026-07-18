# GOBLIN FULL-STACK — Apps mit Datenbank & Login
**Spec v1.0 · 2026-07-09 · Author: Steven · Design source for Wave B. THIS WAVE IS SPIKE-GATED: no architecture is chosen in this document — it defines requirements, the option space, and the decision protocol. The founder picks from the spike's table.**

## 1. What this is (and the honest stakes)
Today Goblin ships static/client-side apps (localStorage). Wave B is the category jump: **the agent builds apps with real persistence and real login** — a booking page that keeps bookings, a todo app with accounts. This is Bolt/Lovable territory, entered with Goblin's differentiators intact (honesty invariants, mobile-first, real code, own-Vercel model). It is also the wave with genuine unknowns — provisioning costs, security surface, per-project infra economics — which is why it runs **Spike → Founder-Gate → Build**, never straight to code.

## 2. Requirements (any chosen architecture must satisfy ALL)
R1 **Agent-provisionable:** backend resources created programmatically during a run (a `provision_backend` tool), no manual founder steps per project.
R2 **Per-project isolation:** one project's data/keys can never touch another's. RLS or equivalent mandatory.
R3 **Economics trace:** per-project infra cost model MUST land in the ledger + a CFO-dashboard assumption row BEFORE build; Trial must remain within its budget philosophy (a trial user provisioning 3 backends may not cost dollars). Free tiers are a starting point, not a plan — the table must show the cost at 100 / 1'000 / 10'000 projects.
R4 **Own-account philosophy compatible:** consistent with the founder's Vercel decision — evaluate BOTH shapes per option: (a) platform-provisioned (Goblin's org owns the DB, user gets it managed), (b) user-connected (user brings their own Supabase/Neon account via connector, Goblin provisions inside it). The founder chooses the shape per the table; (b) mirrors the Vercel model and is the presumed favorite — say so in the table but price both.
R5 **Secrets flow:** anon/public keys may enter generated client code; service/admin keys NEVER appear in generated code, agent context, step logs, or reports (D-wave scrubbing applies). Storage: existing pgcrypto envelope pattern.
R6 **Generated-code shape:** v1 targets client-side apps using the provider's JS client with RLS (no custom server runtime to host) — keeps the own-Vercel static deploy model intact. Server functions are explicitly v2.
R7 **Honesty:** the agent must know (prompt capability map) exactly what it can and cannot provision, and report attested facts ("Datenbank angelegt: 2 Tabellen, RLS aktiv" from tool results).

## 3. Option space for the spike (research these, add any you find better)
| Option | Known upsides | Known risks/questions for the spike |
|---|---|---|
| **Supabase, user-connected** (user's account, Management API inside it) | mirrors Vercel model; user owns data; free tier per user; auth+DB+RLS in one | connector UX (PAT? OAuth?); org/project limits per free account (2 active projects!); provisioning latency; API stability |
| **Supabase, platform org** | zero user setup | cost scaling per project; Goblin owns user data (philosophy conflict, GDPR weight); free-tier limits per org |
| **Neon Postgres (user- or platform-)** | serverless PG, branching, generous free | no built-in auth (needs separate auth story — Supabase Auth alone? custom?); RLS manual |
| **Turso/SQLite-class** | cheap at scale, fast provisioning | no auth story; client-side SDK maturity; RLS-equivalent? |
| **Convex/Firebase-class** | integrated auth+data | vendor lock-in feel vs "real code" positioning; pricing cliffs |

## 4. Spike protocol (Wave-B prompt, phase 1)
For each option: verify from official docs/pricing pages (web research allowed): provisioning API existence + auth model, free-tier and paid limits, cost at 100/1k/10k projects (both shapes where applicable), auth capability, RLS/isolation mechanism, provisioning latency, EU-data options. Output: **decision table + a one-page recommendation** (Steven's prior: Supabase user-connected fits the philosophy; verify it survives the numbers). Then **HALT — founder decision D-B1 (option+shape) and D-B2 (Trial policy: how many backends may a trial provision — recommendation: 1).**

## 5. Build phases (after the gate; each its own prompt section)
**B1 — Connector & provisioning:** the chosen connector flow (JIT at first backend-needing build, mirroring the Vercel JIT), `provision_backend` tool (idempotent, attested results), secrets storage, teardown on project delete (GDPR — extend the H1 purge). Ledger row M12 + CFO assumption row (founder applies to dashboard).
**B2 — Agent capability:** prompt update (capability map, few-shots: schema design → RLS policies → client wiring), generation templates for the auth+CRUD baseline, `run_sql`-class tool ONLY if the spike showed it's needed and safe (else provisioning presets).
**B3 — The proof:** E2E: `Baue eine Aufgabenliste mit Login — jeder sieht nur seine Aufgaben. Stell sie live.` → agent provisions, generates, publishes; two test users verified isolated (RLS probe: user A cannot read B's rows — adversarial test, not assumption). Runtime smoke (Wave A-3) must pass on it.
**B4 — Honest edges:** trial caps (D-B2), failure copy (provisioning down, quota hit), connectors page entry, docs.

## 6. Non-goals (v1)
No custom server code hosting, no cron/jobs, no file-upload storage in generated apps, no payments-in-generated-apps, no migrations UI for end users. Each is a named v2 candidate, nothing more.
