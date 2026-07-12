# MERGE REPORT — Launch-Readiness Audit (Runbook 3)

**Branch:** `claude/launch-readiness-audit-spr8at` · **Base:** `origin/master` @ `326a298` (WAVE-K)
**Date:** 2026-07-12 · **Model session:** Opus · **Posture:** PR opened, **HALT** — merge is founder-granted (CLOUD RIDER rule 1).

## Context (3 lines)
The last audit before strangers arrive. Every prior walk used the founder's populated account;
this one reads the product as an empty stranger would hit it. Because the sandbox can't drive an
external browser or hold live keys, Part 1 was run as a **code/copy audit** (CLOUD ADAPTATION A):
every first-run surface read in source, strings quoted with `file:line`. The lived cold-walk on a
fresh account is handed to the founder as a wifi-gate.

## Per-unit table

| Commit | Unit | What | Evidence | Status |
|---|---|---|---|---|
| `c820939` | **L1** | Demo model label `claude-sonnet-4-6` → `Goblin Swift` (white-label) | `SendToCode.tsx:53` re-read; build ✓ | landed |
| `014017f` | **L3** | `~34 seconds`/`every time` deploy claims → `in seconds` | `Hero.tsx:30`, `IslandFlow.tsx:67` | landed |
| `a1b41b4` | **L6** | `Native desktop apps coming in 2026` → `on the roadmap` | `Footer.tsx:80` | landed |
| `ec48829` | **L5** | Model FAQ: add sufficiency framing ("more than enough… frontier one tap away") | `Faq.tsx:14` + `faq.tsx:18` (both surfaces) | landed |
| `bf136af` | **L4** | Builds figure labelled a complexity-dependent estimate (single-source atom, DE+EN) | `lib/plan-builds.ts`; build ✓ | landed |
| `561c034` | **L2** | Lead with the agent as headline capability; manual flow = "take control at any step" | `Hero.tsx`, `HowItWorks.tsx`; agent verbs verified against `agent/orchestrator.ts` + `tools.ts` | landed |
| `d317f35` | **F1** | Remove German lockout toast from the English signup screen | `login/page.tsx:194` re-read | landed |
| `a80d0b3` | **F2** | Empty chat-history now teaches the next action (bilingual hint → dashboard) | `chats/page.tsx`, `labels.ts`; token `--text-meta` verified real | landed |
| `99118b2` | **F3** | Explainer step `Du shipst`/`You ship` → `Du bringst es live`/`You go live` (de-jargon) | `welcome/_components/i18n.ts:186/448`; build ✓ | landed |

**Deliverable docs (this commit):** `COLD_WALK/COLD_WALK.md` (Part 1 evidence), `LAUNCH_DECISIONS.md` (Part 2 tabled), `GO_LIVE_CHECKLIST.md` (Part 3), this report.

**L7** (dedicated agent landing *section*) — **tabled**, not built: it is design work this sandbox can't visually verify. See LAUNCH_DECISIONS D-1 (recommend Option A gated on the 375px beauty check). L2 already surfaces the agent on the two most-read surfaces.

## Mandatory Part-2 checks (verdicts, re-read directly)
- **First-run guidance is the visual focus** — HOLDS. `dashboard/page.tsx:319–338`: the hero `ChatInput` under "Sag Goblin, was du bauen willst." is the always-present focus; the "Bau dein erstes Projekt" card sits below. **[re-read]**
- **Vercel moment is welcoming (P1.11 JIT)** — HOLDS. `VercelConnectSheet.tsx` ("Noch ein Schritt bis live") is a bilingual step-by-step setup path; `SessionPane.tsx` opens it instead of erroring on a token-less publish. **[re-read]**
- **No stranger-hostile jargon in first-run** — PARTIAL. Fixed the worst (F3 explainer). Remaining `deployst`/`pushen`/`BYOK` glosses tabled (D-2).
- **Every disabled affordance honest** — HOLDS. All `Bald`/`Soon` elements are `aria-disabled`/`disabled`, non-focusable; no clickable-fake, no dead `href="#"` in any first-run surface.
- **Upgrade path honest (TRIAL-7 card)** — HOLDS. `AchievementUpgradeCard` fires on a verified publish; copy claims only true things.

## Self-review checklist (OS §3)
1. **Evidence audit** — every claim in COLD_WALK is tagged `[v]` (re-read this session) or `[a]` (read-audit); PASS-verdicts (dashboard focus, Vercel JIT) are `[v]`.
2. **Diffstat vs scope** — `git diff origin/master..HEAD`: 12 files, +38/−14, each justified by an L/F unit above. No drive-by edits. Branch merge-base = `326a298` = current origin/master.
3. **Regression** — non-targeted paths: the landing renders for logged-out users (copy-only, no logic); `plan-builds` change is display-only across all consuming surfaces. `next build` GREEN (env present) covers `/`, `/welcome/*`, `/dashboard/chats`.
4. **Honesty sweep** — every new/changed string checked: L2 agent verbs each map to a live orchestrator capability (plan/write → publish+read_deploy_status verify + bounded self-heal → publish ship, narrated per step); no fake timing, no self-label, DE+EN parity kept on every bilingual surface touched.
5. **Ledger** — no change alters tokens or external API cost. L4 relabels a display figure only; the underlying `COST_UNITS_PER_BUILD`/allowances are untouched. **No ledger row required** (recorded here explicitly).
6. **Report completeness** — per-unit SHAs above; evidence refs inline; Honest Limitations below; founder actions = `GO_LIVE_CHECKLIST.md`.
7. **Steven question** — a skeptical reviewer seeing only `git diff origin/master..HEAD` + COLD_WALK would reach these verdicts: the fixes are self-evident copy honesty changes; the PASS verdicts cite re-read line numbers.

## CI ground truth (verified locally, not from cached status)
- **Web typecheck** — GREEN (`tsc --noEmit`, EXIT 0).
- **Web build (`next build`)** — GREEN with env present (EXIT 0, all 41 pages incl. `/`, `/welcome/explainer`, chats). The sandbox's first build failed only on `/demo-preview` prerender for **absent Supabase env** (a secret this environment lacks, an untouched route) — not a code defect; re-run with placeholder env passed.
- **Shared typecheck / API vitest** — unaffected (zero shared/api files changed).
- **e2e** — pre-existing red per `docs(wave-d)` CI-ground-truth record; unrelated to these web copy changes. Not introduced here.
- **Lint** — CI runs no eslint step; two pre-existing eslint errors (`SendToCode.tsx:97`, `i18n.ts:32`) exist verbatim on `origin/master` and are on lines this branch did not touch.

## Honest Limitations (mandatory)
- **Part 1 is a code/copy audit, not the lived walk.** I read the strings a stranger *would* see; I did not sign up, click, or deploy as a fresh account. The real cold-start on `vinc.hafner4@` at 375px/prod is a founder wifi-gate (checklist §G) — the single most important item this session could not perform.
- **No visual verification.** L1–L6, F1–F3 are validated by typecheck + `next build`, not by eyeballing rendered pixels. The L2 hero lead grew longer; a 375px check is advisable (checklist A-2 gate). L7 was tabled precisely because I can't verify a new section visually.
- **`[a]`-tagged evidence** in COLD_WALK (Vercel sheet body, dashboard empty card exact lines, error-copy inventory) came from a read-only sub-audit of the real files; I independently re-read the load-bearing ones (login leak, chat empty state, explainer, dashboard hero focus, Vercel sheet header) but not every quoted string.
- **Prod state unverified.** Which migrations are applied, whether env keys are set, `/api/version`, Stripe live-mode, and monitoring are all BLOCKED here (no prod URL, no secrets) — enumerated as founder actions, not asserted as done.
- **L2 editorial trade-off:** the hero's trailing "Bring your own key" clause was dropped to make room for the agent headline. BYOK remains in Pricing (3×), FAQ, and Problem. Flagged in case the founder wants it restored.

## Founder actions
→ **`_sprint/launch/GO_LIVE_CHECKLIST.md`** is the full tickable list (env keys, migrations through `0090`, monitoring, Stripe live sanity, known-defect triage, support-surface verification, and the §G wifi-gate list: cold-start walk, /admin/insight, Goblin-Hilfe escalation, webhook live upgrade, D+K adversarial probes, 375px beauty check, Walk-2, Act-II pitch).
→ **`_sprint/launch/LAUNCH_DECISIONS.md`** — D-1 (agent section), D-2 (jargon gloss), D-3 (i18n locale), D-4 (model-name white-label), D-5 (changelog link): each with options + recommendation, awaiting founder word.
→ **Merge:** rebase if needed, `--no-ff` merge is founder-granted. This session HALTs with the PR open.

## Acceptance figures
- Landing findings actioned: **6/7 fixed** (L1–L6), **1/7 tabled** (L7, with recommendation).
- Additional cold-walk cheap fixes: **3** (F1–F3). Larger findings tabled: **5** (D-1…D-5).
- Mandatory Part-2 checks: **4 HOLD, 1 PARTIAL** (jargon — worst fixed, rest tabled).
- Build/typecheck: **2/2 GREEN** locally.

**HALT — standing by for founder feedback.**
