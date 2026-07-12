# LAUNCH DECISIONS — larger findings tabled for the founder

**Runbook 3 · Launch-readiness audit · branch `claude/launch-readiness-audit-spr8at`**
These are the Part-1 findings too large for a ≤1-commit friction fix. Each is presented as
an OS-§4 escalation class + options + a recommendation. **I do not decide these** — they wait
on founder word. The cheap fixes (L1–L6, F1–F3) are already committed; see `MERGE_REPORT.md`.

Steven-criteria per item: which OS-§4 class · Option A / Option B · recommendation · why.

---

## D-1 — L7: dedicated "agent" selling section on the landing

- **Class:** Product philosophy / Scope expansion (OS-§4).
- **Finding:** the landing had **no** section selling the autonomous agent (build → verify → ship, the claim competitors can't copy). L2 (committed) now surfaces the agent in the hero + "How it works", which covers the *absence*, but there is still no dedicated visual section.
- **Why not auto-fixed:** a net-new landing section is design work (new component + `landing.css` classes + 375px + light/dark theming) that this sandbox **cannot visually verify** (no browser). Shipping an unrenderable section would violate "design tokens only / no half-baked."
- **Option A (recommend):** add a compact agent section reusing the existing `how-card` / `problem-card` grid pattern (no new CSS), copy only, placed after `SendToCode`. Content = the four verified agent steps (plan → write → verify/self-heal → publish) + "you watch every step, take control anytime". One commit, low risk, but still wants a founder eyeball at 375px before merge.
- **Option B:** leave the L2 hero/how-it-works treatment as sufficient for launch; revisit a full section post-launch with real design attention.
- **Recommendation:** **A**, gated on the founder's A-2 beauty check at 375px. The agent is the single differentiator; giving it one honest section is high-value and cheap. If the founder can't eyeball it pre-launch, ship B and add A in the first post-launch pass.

## D-2 — first-run jargon pass (Deploy / Push / Repo / token / BYOK)

- **Class:** Product philosophy (stranger-hostile jargon) — mandatory check, partially failing.
- **Finding:** `du deployst` (dashboard empty state), `pushen`/`Deployen`/`Auto-Deploy` (preview tab), `BYOK-Key` (onboarding tour step 3) appear **before definition** to "Max". Others are explained in place (Vercel JIT token steps; the tour's Send-to-Code).
- **Why not auto-fixed:** doing it right means a consistent micro-gloss / tooltip convention across ~5 surfaces, not a one-string edit — and the wording is a brand-voice call.
- **Option A (recommend):** one commit that adds a short parenthetical gloss at each first-encounter (`live stellen (deployen)`, `zu GitHub sichern (pushen)`, and expand `BYOK-Key` → `eigener KI-Schlüssel (BYOK)` on first use). Copy only, low risk.
- **Option B:** a proper first-run glossary tooltip component (larger; post-launch).
- **Recommendation:** **A** before first invite — it's the difference between a beginner feeling lost vs. guided on the exact surfaces they hit first. B is a nice post-launch upgrade.

## D-3 — i18n single-language surfaces

- **Class:** Product philosophy (honesty invariant: user's language) / Scope.
- **Finding:** login (EN-only), upgrade page (DE-only), preview-tab (DE-only), first-chat-tip (DE-only), EmptyChat (DE-only), build-status-bar (EN-only fallback labels) are hardcoded single-language while the rest of the app is bilingual.
- **Why not auto-fixed:** threading `lang` + authoring the missing half for six surfaces is multi-commit and needs product sign-off on which locale each surface should default to at launch.
- **Option A:** full bilingual parity for all six before launch (several commits).
- **Option B (recommend):** decide the **launch locale**. If the first cohort is DE (Swiss/DACH), the DE-only surfaces are fine and only the **EN-leak on login** matters (already fixed, F1) plus the EN-only build-status-bar fallback. If the first cohort is mixed, prioritise login + upgrade parity only.
- **Recommendation:** **B** — pick the launch audience, then only the mismatched surfaces need work. Full parity (A) is a post-launch cleanup, not a blocker, provided no surface shows the *wrong* single language to the *target* cohort.

## D-4 — `friendly-error.ts` leaks a raw model name

- **Class:** Product philosophy (white-label) / User-facing honesty.
- **Finding:** the model-unavailable error names `Llama 3.3 70B` to the user (`lib/friendly-error.ts:10`) — a raw upstream model id on a white-labelled product, the same class of issue as L1.
- **Option A (recommend):** replace the concrete model with the Goblin-branded guidance (`Wähle oben ein anderes Modell und versuch es nochmal.`) — one commit, copy only.
- **Option B:** leave it; the string only appears on a specific provider outage.
- **Recommendation:** **A** — it's the same white-label rule L1 enforced; cheap and consistent. I did **not** auto-fix it because it sits outside the landing scope this prompt handed me and deserves a founder nod that the branded phrasing is right. Trivial to land on the word.

## D-5 — "What's new" links to `/help` instead of a changelog

- **Class:** Product honesty (phantom affordance-adjacent) — low severity.
- **Finding:** dashboard `Alle Updates →` points at `/help` as a documented stand-in (TODO, `app/dashboard/page.tsx:551`). Not dead, but not what it says.
- **Recommendation:** acceptable at launch. Either relabel to `Hilfe & FAQ →` (one commit) or wire the real `/changelog` (already linked from the footer) — founder's call. Non-blocking.

---

### Not tabled — accepted as-is at launch (evidence in COLD_WALK)
- Dashboard 0-project first-action focus — **holds** (hero ChatInput is the visual focus).
- Vercel JIT first-publish — **holds** (welcoming sheet, no token-less dead-end).
- Disabled `Bald`/`Soon` affordances — **holds** (all honestly disabled, none clickable-fake).
- TRIAL-7 achievement card — **holds** (fires on verified publish; claims only true things).
- `SoftLimitBanner` — inert by design; no false promise reaches a cold user.
