# WAVE-B B3 — The Proof (full-stack: Datenbank + Login)

**Verbatim task:**
> `Baue eine Aufgabenliste mit Login — jeder sieht nur seine Aufgaben. Stell sie live.`

This wave adds real persistence + login to Goblin's generated apps (Supabase, user-connected).
The **mechanism and its guarantees are verified deterministically in-session** (mocked, no
network, green here). The **one live proof run is founder-gated** on the prod test account — it
provisions a real backend and must NOT be run or faked in the build session (CLOUD RIDER: no
accounts created by the session; the founder provisions per the setup list).

---

## What the proof does (the path)
1. Agent calls **`provision_backend`** with a structured `tasks` schema → the server creates a
   real Supabase project **inside the user's own account** (D-B1), fetches its public URL + anon
   key (attested), and applies the **RLS-always** schema (`tasks` + owner-scoped select/insert/
   update/delete policies).
2. Agent **generates** the client (`proof-app/index.html`): supabase-js from CDN, login, and
   per-user task CRUD that **relies on RLS** (no client-side `where user_id = me`).
3. Agent **publishes** (existing Vercel pipeline) → deploy truth-gate VERIFIED.
4. **Adversarial RLS probe** (`rls-probe.mjs`): two app-level users A + B in the one provisioned
   project — B **attempts** to read/update/delete A's rows and to forge-insert as A, and every
   attempt must be **DENIED**. Attempted-and-denied, evidenced — not assumed.
5. **Runtime smoke** (`runtime-smoke.mjs`): the published app renders, login works, a task adds,
   zero uncaught JS errors.

---

## Claim ledger

| Claim | Status | Evidence |
|---|---|---|
| Provisioning is attested (ref/keys/latency from real API responses, never fabricated) | **VERIFIED (in-session)** | `supabase-provider.test.ts` (8 tests) — attests ref/keys, measures latency, `keys_unavailable` tags `partialRef` |
| Provisioning tool: idempotent, never throws, JIT signal, trial cap, no service_role leak | **VERIFIED (in-session)** | `provision-tool.test.ts` (10 tests) |
| **RLS is ALWAYS generated with every table** (R2) | **VERIFIED (in-session)** | `schema-sql.test.ts` (6 tests); `wave-b-proof.test.ts` asserts the exact `tasks` SQL has enable-RLS + 4 owner policies |
| Generated client wires anonKey + auth + RLS; **no secret key in client** | **VERIFIED (in-session)** | `wave-b-proof.test.ts` on `proof-app/index.html` |
| Capability map teaches the agent (present only when enabled; not in cached prefix) | **VERIFIED (in-session)** | `wave-b-provision-capability.test.ts` (5) + `prefix-stability.test.ts` green |
| Teardown wired into the FW6 blocking purge (GDPR) | **VERIFIED (in-session)** | `account-deletion*.test.ts` green with the new block; `supabase-provider.test.ts` teardown idempotency |
| Adversarial probe attempts real cross-user access and asserts denial | **VERIFIED — logic (in-session)** | `wave-b-proof.test.ts` asserts `rls-probe.mjs` is secretless + attempts read/update/delete/forge-insert with fail-on-leak |
| **Live proof: real project provisioned + published, A cannot read B's rows, smoke green** | **FOUNDER ACTION (live)** | run the steps below on the prod test account |

---

## Founder live-gate steps (prod test account `vinc.hafner3@gmail.com`)
> Respects D-B2 (1 backend for this one proof project ≤ the trial cap of 2). No service_role key
> is ever needed or entered.

1. **Enable + wire** (see the founder-action list in the merge report): register the Supabase
   OAuth app, set the Railway env vars, apply migration `0096`, set `GOBLIN_FULLSTACK_ENABLED=true`.
2. From the Goblin test account, **connect one Supabase account** (Einstellungen → Konnektoren →
   Supabase → Verbinden). This is the only account connected.
3. In a project, send the **verbatim task** above. Confirm the run: `provision_backend` reports
   `Datenbank angelegt: 1 Tabellen, RLS aktiv (<measured> ms)`, then the app is generated and
   published (`Live ✓ <url>`).
4. In the published app, **sign up two users A and B** (two app-level emails — NOT two Supabase
   accounts). As A, add a task; as B, add a different task.
5. **Adversarial RLS probe:**
   ```
   PROOF_SUPABASE_URL=https://<ref>.supabase.co \
   PROOF_SUPABASE_ANON_KEY=<public anon key> \
   RLS_USER_A_EMAIL=<A> RLS_USER_A_PASSWORD=<…> \
   RLS_USER_B_EMAIL=<B> RLS_USER_B_PASSWORD=<…> \
   node evidence/wave-b/rls-probe.mjs
   ```
   Expect `✅ PASS — all 5 cross-user accesses denied by RLS.` (exit 0). Any `LEAK ‼` = stop.
6. **Runtime smoke:**
   ```
   SMOKE_EMAIL=<A> SMOKE_PASSWORD=<…> node evidence/wave-b/runtime-smoke.mjs <published-url>
   ```
   Expect `"ok": true` (renders, login, add-task, zero JS errors).
7. Capture both outputs into `evidence/wave-b/` (e.g. `rls-probe-result.txt`,
   `runtime-smoke-result.json`) as the live evidence.

---

## Files in this folder
- `proof-app/index.html` — the reference generated app (what step 2 produces; placeholders
  `__SUPABASE_URL__` / `__SUPABASE_ANON_KEY__` filled from the provision result).
- `rls-probe.mjs` — the adversarial cross-user RLS probe (secretless; exit 0/1/2).
- `runtime-smoke.mjs` — the published-app runtime smoke (secretless; exit 0/1/2).
- `PROOF.md` — this file.

## Honest note
The provisioning, RLS-always guarantee, client wiring, teardown, and the probe's *logic* are
proven here with deterministic tests. The **live** provisioning + publish + two-real-user RLS
denial + runtime smoke are founder-gated because they create a real backend and publish to prod
— the session neither runs nor fakes them. **Provisioning latency is MEASURED at runtime**
(`supabase_backends.provision_latency_ms`, surfaced in the tool summary); the spike could not
verify a figure and none is invented here. The Management API SQL-application endpoint
(`POST /v1/projects/{ref}/database/query`) is used for schema apply and is confirmed against the
live API in step 3 of the founder gate.
