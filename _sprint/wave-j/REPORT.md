# WAVE-J — Hilfe, Support-Agent & Feedback — REPORT

**Branch:** `claude/wave-i-insight-cw85pk` (the session's designated dev branch) · **Base:** `master` (`2ae43a9`, WAVE-I merged) · **Date:** 2026-07-10
**Standing:** All four units + the rider landed, gated, evidenced. Conditional merge is **founder-granted** — this report **HALTs before merge** (and the prod smoke needs credentials this session does not hold — see limitations).

Founder vision realised: AI-first support like Anthropic's — a user talks to a capable, honest agent first; a human (the founder) is the escalation, never the front line. **The honesty invariants apply DOUBLE here:** a support agent that invents features or promises actions it cannot take is the worst possible lie in the product — so grounding, no-invention, and no-fake-promises were the design center.

---

## Phase 0 — state-first findings (repo trusted over prompt)

- **WAVE-I is already merged** (PR #19, `2ae43a9`); this branch is based on it. The rider (`agent_run_started`) closes WAVE-I honest-limitation #2.
- **A partial support scaffold already existed on `master`** (from commit `a73d152`): `routes/support.ts`, `services/support-agent.ts`, `support-email.ts`, `support-knowledge.ts`, `prompts/support-agent-system.md`, web `support-chat.tsx` + `support-bubble.tsx`. Per state-first doctrine I **extended it to spec rather than duplicating**. It had real defects the wave required fixing:
  - **Billing-unsafe:** ran on `resolveModel(user)` + a raw SDK stream → could spend the user's BYOK key / allowance, **no platform-COGS path, no ledger row**.
  - **Dishonest facts:** the knowledge base asserted **"$9/month, one plan"** and **"Goblin-hosted models (coming)"** — both contradict the ledger (three plans Build/Pro/Power; Swift/Forge are LIVE). The route said **"drop us a line on Discord"** while the prompt said "Do NOT say Discord"; the escalation promised a fake **"24–48h"** response time.
  - **Dead cap:** the 30/hour rate-limit queried a `support_tickets` table **that no migration ever created** → every insert silent-failed and the cap never fired.
- `platform_events` already reserved `support_chat_started/escalated`, `feedback_submitted`, `help_opened`; `POST /api/events` whitelist already had `help_opened`/`feedback_submitted`. `@goblin/shared` is imported by BOTH apps → the correct single-source home for help content. Resend (`lib/email`) + in-process cron exist → no new service needed.
- Highest migration was `0085` → new ones are `0086`/`0087`.

---

## Units (one unit = one revertable commit)

| Unit | Commit | What |
|---|---|---|
| Rider | `780f91c` | `agent_run_started` twin → Pulse started-vs-finished |
| I1/J1 | `e9ce1c0` | Verified DE/EN help corpus (single source) + Hilfe section |
| J2 | `67487ee` | Goblin Hilfe agent → platform COGS, grounded, honest escalation + ledger **M12** |
| J3+J4 | `1df4a8b` | Feedback everywhere + JIT support discoverability |
| J3/I3 | `f5138a2` | Support tickets + feedback join the purge + Datenschutz copy |
| fix | `7b211b9` | Dark-mode contrast for Hilfe + support surfaces + evidence |

### J1 — Help content (the ground the agent stands on)
Nine articles, DE+EN, anchor-linkable sections, authored as **`@goblin/shared/help-content.ts`** — imported by BOTH the web Hilfe section and the support agent's grounding, so **docs and the agent's facts cannot drift**. Every claim verified against product code (a verification subagent fact-checked all seven flows): Vercel is **paste-token, not OAuth**; Goblin does **not host** deploys (your Vercel does); the deploy truth-gate = HTTP 200 + byte-match + all referenced assets 200 (6 attempts); agent multi-step is **flag-gated + test-account** (most users get the classic single-turn path today — described honestly); **three plans** (prices live on `/pricing`, geo-adjusted); **7-day** trial; **no** self-serve account export (project ZIP only); **no** global undo (transient discard-undo only; history via GitHub); Supabase/Stripe/Custom-domain connectors are "coming soon". Web: `/help` indexes the articles, `/help/[slug]` renders one with anchored headings.
**Gates:** `help-content.test.ts` (7) locks 9-article structure, DE+EN parity, unique anchors, agent-render — AND fails the build if the retired false claims (`$9/month one plan`, `Discord`) ever return. 375px dark+light render evidenced.

### J2 — Goblin Hilfe agent (billing-safe, grounded, honest)
- **Platform COGS (HARD RULE):** pinned `goblin/efficient` + `internalBilling: true` → skips the user allowance gate, suppresses the `completion_costs` write, logs `platform_cogs`. The route is **pre-resolved and hard-gated to `route.layer === 'goblin_hosted'`** — if hosting is unavailable it degrades honestly and **never** spends a user's BYOK key. New per-call `maxTokens` bounds the per-message output. **Ledger M12** added same commit (+ WAVE-J NOTE).
- **Grounding:** system prompt = persona + read-only user context (plan/counts/last-error string — no chat/file bodies) + the full help corpus (`renderHelpForAgent`). `support-knowledge.ts` now delegates to the corpus so the false claims can't return.
- **Escalation (honest):** `[[ESCALATE:reason]]` (stripped from the reply) or an explicit human request → `support_tickets` row (0086) + founder email (Resend) + `support_chat_escalated` event + honest closing "**Ich habe alles an einen Menschen übergeben — du hörst per E-Mail von uns.**" No fabricated response time.
- **Cap:** per-user daily message cap (`SUPPORT_DAILY_CAP=30`, in-memory abuse guard mirroring M8/M11) with an honest 429; `support_chat_started` on first turn.
**Gates:** `support-agent.test.ts` (9) — billing safety (COGS + pinned + never-BYOK), escalation handoff, marker stripping, cap, PII/injection guards. **Real-model probes** (`support-probe.mts`) against the LIVE Swift model — verbatim transcripts in `evidence/wave-j-support/support-probes.txt`:
  - ① "Wie stelle ich meine Seite live?" → correct Vercel-token→save→"Live stellen"→truth-check steps + `Siehe: Live stellen & Vercel verbinden`.
  - ② "GitLab-Export?" (doesn't exist) → *"…erfinde ich dir nichts"* + honest alternatives + escalation offer.
  - ③ "Deploy schlägt immer fehl" → asks for the error message, gives the article-8 path.
  - ④ "Ich will mit einem Menschen sprechen" → immediate escalation with `[[ESCALATE:human_requested]]`, **no fake ETA**.

### J3 — Feedback, everywhere it matters
`POST /api/feedback`: persists to `feedback` (0087, pre-migration tolerant), emits metadata-only `feedback_submitted`, and — for **Fehler/bug** — sends an **immediate** founder email; ideas/other ride a **daily digest** (cron 07:05 UTC, env-gated `GOBLIN_FEEDBACK_DIGEST`, silent no-op otherwise). **`sanitizeContext` enforces metadata-only server-side** — only `page`/`project_id`/`last_error` survive; a smuggled message/file/code key is dropped. `FeedbackModal` (BottomSheet): category + free text + a **visible consent line** ("Wir senden mit: aktuelle Seite, Projekt-ID, letzte Fehlermeldung — keine Chat-Inhalte") + honest post-submit thanks (no fake "reply in 24h"). Reachable from the **account menu**, the **Hilfe section**, and **every agent report card**.
**Gates:** `feedback.test.ts` (10) incl. the **content-free payload audit** (evidence `feedback-payload-audit.txt`) and HTML-escaping of the body; email builders + digest gating.

### J4 — Wiring & discoverability
Hilfe + Feedback rows in the account menu (global → reachable from the chat AND code surfaces via the header). Two quiet, honest JIT offers, one per pain moment, no popups: a **"Hilfe dabei?" → Goblin Hilfe** offer at the **failed-publish** moment, and a **"Brauchst du Hilfe dabei? → Goblin Hilfe"** offer on a **limit/allowance error** (today's trial/limit wall is that inline error — there is no dedicated wall component). Both open the support chat.

### Rider — `agent_run_started`
Emitted the instant an agent run begins (metadata only); surfaced in `computePulse` + the `/admin/insight` dashboard as "Gestartet → fertig" so a run that starts and never finishes is visible.

---

## HARD RULES compliance
- **Support = platform COGS, capped, ledgered same-commit** — M12 in `67487ee`; pinned Swift + `internalBilling`; hard-gated so it never spends a user's BYOK key.
- **Zero token consumption elsewhere** — help corpus is static data; feedback is a DB write + email; escalation is a non-model render; new events are metadata-only `platform_events`. Stated in the ledger WAVE-J NOTE.
- **Events/flows never block or slow UX** — `trackEvent` fire-and-forget; feedback insert + emails are best-effort/silent-fail; the support daily-cap check is O(1) in-memory.
- **No new paid services** — reuses goblin-hosted (Swift), Resend, in-process cron, Supabase.
- **Migrations authored, NOT applied** — 0086 (support_tickets), 0087 (feedback).
- **All new surfaces:** design tokens, 375px-first, dark+light (a pre-existing `--paper`/hardcoded-hex dark bug on the Hilfe + support surfaces was caught by the 375px dark render and fixed), DE+EN via `t(lang, …)`.
- **Privacy:** transcripts + feedback join the deletion purge (gated); feedback context is metadata-only (audited); Datenschutz DE+EN copy added.
- **Test-account traffic filterable** — inherited from WAVE-I insight (`includeTest`); the rider's `agent_run_started` flows through the same filter.

## Test status
`apps/api`: **497 passed / 16 skipped** (the 16 skips are the pre-existing Stripe-key-gated suites). `apps/api`, `apps/web`, `packages/shared` `tsc --noEmit` all clean.

## Honest limitations
1. **Migrations 0086/0087 must be applied** before support tickets / feedback persist. Until then both degrade to no-op (silent-fail insert) — escalation still emails the founder, feedback still emits its event and (for bugs) emails; they just aren't also stored. No crash either way.
2. **No email actually sent this session** — `RESEND_API_KEY` is unset here (and sending is outward-facing), so the escalation email + immediate-bug email + digest are builder-tested + rendered, not delivered. First real send is founder-side (set the keys below).
3. **The real-model probes ran against the model directly**, not the full HTTP stack — `SUPABASE_*` is unset in this sandbox, so the DB-touching paths (ticket row, cap counter, user-context load) are covered by unit tests with a mocked Supabase, and the *model behaviour* by the live probes. A full end-to-end run needs a booted API with Supabase.
4. **Prod smoke NOT performed** — the conditional-merge prod steps (both `/api/version`, a live mini-journey, non-admin 403) require prod credentials / a deploy this session does not hold. Left for the founder (below). No merge was performed.
5. **J3 and J4 share `SessionPane.tsx`**, so they landed in one commit (`1df4a8b`); each offer/entry-point is independently removable, but they are not two separate commits (no interactive staging available here).
6. **JIT trial/limit-wall offer** attaches to the inline limit-error surface (matched on the error text), because there is no dedicated trial-wall component today — flagged so the founder can point it at a purpose-built wall if one is later added.
7. **The support daily cap is in-memory per instance** (resets on deploy, per-replica) — an abuse guard, not a billing ledger, exactly like M8/M11. Promote to a persisted counter if support volume grows.
8. **`support-bubble.tsx`** (a floating "?" FAB) remains unmounted dead code as found; Wave J routes discovery through the account menu + JIT offers instead. Left as-is (not in scope to delete).

## Founder action list
1. **Apply migrations** `0086_support_tickets.sql` + `0087_feedback.sql` (Supabase SQL Editor).
2. **Configure escalation/feedback email** (optional but recommended): `RESEND_API_KEY` (+ `RESEND_FROM`), and a recipient via `ADMIN_EMAIL` (already used by the WAVE-I digest) — the support escalation and feedback both fall back to it. Set `SUPPORT_EMAIL_TO`/`FEEDBACK_EMAIL` to override.
3. **Optional feedback digest:** `GOBLIN_FEEDBACK_DIGEST=true` (+ `ENABLE_CRON=true`) for the daily ideas/other summary; bugs email immediately regardless.
4. **Optional knobs:** `SUPPORT_DAILY_CAP` (default 30), `SUPPORT_MAX_TOKENS` (default 600).
5. **Prod smoke after merge:** both `/api/version`; one real support exchange on prod (probe ①) appears correctly; one feedback submission arrives; non-admin/anon cannot reach founder-only surfaces.

## Migration flags
- `supabase/migrations/0086_support_tickets.sql` — **authored, NOT applied.**
- `supabase/migrations/0087_feedback.sql` — **authored, NOT applied.**

## Proposed standing rule for the methodology file (`docs/GOBLIN_ARBEITSMETHODIK.md`)
> **Docs ride with features.** A feature sprint updates the relevant help article in the SAME wave. Docs that drift are phantom affordances in prose — and a support agent grounded on a phantom affordance is the worst product lie. WAVE-J structurally enforces this by making the help corpus (`@goblin/shared/help-content.ts`) the single source for BOTH the user-facing Hilfe section and the support agent's grounding: one edit updates both, so they cannot diverge.

**HALT — awaiting founder review. No merge performed.**
