# SPEED & HAPTIK — BUILD REPORT (cheap-wins tier)

**Wave:** Speed & Haptik ("Weltklasse") · **Date:** 2026-07-13 · **Branch:** `claude/speed-haptics-spike-mak70d` (cut from `master` @ `516526e`) · **PR:** #33 · **Founder authorization:** "go" (this session) → cheap-wins tier only.

This is Part 3 of the spike wave. Part 1 (`DIAGNOSIS.md`) + Part 2 (decision table) shipped first; the founder authorized the **cheap-wins tier**. The **architectural tier stays unbuilt** (F-40 resumable runs, agent streaming, TTFT pipeline, nav caching) — its own future waves per D-S3/D-S5/D-S7/D-S8. The gray-zone step-stream (D-S6) was also **not** built (recommended B — keep the cheap tier pure).

## Units shipped (one isolated, revert-able commit each — Gesetz 1)

| Unit | Symptom | Commit | Files | Evidence |
|------|---------|--------|-------|----------|
| **CW-1** | F-41 dead buttons (systemic) | `7cf28de` | `app/globals.css` | `evidence/CW-1_global-press.md` |
| **CW-2** | F-41 worst offender: chat back button | `4b8e152` | `chat/standalone-chat.tsx` | `evidence/CW-2_back-button.md` |
| **CW-3** | F-41 publish inert before pre-check | `7cee77d` | `code/SessionPane.tsx` | `evidence/CW-3_publish-optimistic.md` |
| **CW-4** | F-41 sidebar new-chat dead tap | `785fea1` | `layout/Sidebar.tsx` | `evidence/CW-4_sidebar-newchat.md` |
| **CW-5** | latency: wrong/absent route skeletons | `61294dc` | 6× `dashboard/**/loading.tsx` | `evidence/CW-5_route-skeletons.md` |
| **CW-6** | F-41 nav controls kill native feedback | `eafea3b` | `globals.css`, `layout/Sidebar.tsx`, `app-shell/bottom-tab-bar.tsx` | `evidence/CW-6_nav-tap-tint.md` |

Diagnosis commit: `7e8f767`.

## What each does (one line)

- **CW-1** — one global rule gives every `button`/`[role=button]` an instant `scale(0.97)` on `:active` + `touch-action: manipulation`. Covers ~137 button sites at once; the two pre-existing `.btn`/`.btn-press` `:active` rules were opt-in dead code for the inline offenders. Respects `prefers-reduced-motion`.
- **CW-2** — the "← {projectName}" back button prefetches the `force-dynamic` project route on mount, so its `router.push` resolves instantly (paints the project skeleton, then hydrates). Chose prefetch over `router.back()` to keep the guaranteed destination (no back-stack ambiguity).
- **CW-3** — `liveStellen` flips to the publishing state on the same tick as the confirm, before the Vercel pre-check round-trip; honest "Wird vorbereitet …" copy; not-connected path reverts cleanly before the connect JIT.
- **CW-4** — the sidebar "+" shows a spinner + goes inert instantly (before `getSession`+`POST`); a guard + `disabled` blocks the double-tap the dead button invited.
- **CW-5** — layout-matched `loading.tsx` for the 6 missing dynamic routes (chat thread, workspace, editor, file list, redirect, chats list). Import-free server components using the global `.skeleton` class — zero client bundle. Pairs with CW-2.
- **CW-6** — keeps the clean no-native-box look on the sidebar-close and bottom-tab controls but adds a `.tap-press-tint` `:active` background flash, since a 3% scale is a weak cue on a transparent-bg nav item.

## Gates (deterministic — seen, not assumed; Gesetz 2)

- **Typecheck:** `pnpm --filter @goblin/web typecheck` → **exit 0, clean** (after `pnpm install`, no `node_modules` in a fresh sandbox).
- **Lint (no new debt):** ESLint on the master baseline of the three modified `.tsx` = **11 errors** (standalone-chat 1 / SessionPane 7 / Sidebar 3); ESLint on the branch versions = **11 errors** — **identical**, so the changes introduce **zero new lint errors**. The 6 new `loading.tsx` files lint **clean**. (Those 11 are pre-existing `react-hooks` violations in untouched code — pre-existing lint debt, out of scope per Gesetz 1, not touched.)
- **Per-unit CSS/DOM proof:** each `evidence/CW-*.md` records the before/after selector/handler-order proof. Full "does-it-feel-instant" is **founder-felt** on the deploy (a device render/screenshot is impossible in this secretless sandbox).

**Success rate:** 6/6 units shipped and committed in isolation; 6/6 with evidence artifacts; typecheck 1/1 green; lint 0 new errors.

## Honest-Limitations (mandatory)

1. **Deterministic gates are CSS/DOM + typecheck, not device-felt.** I cannot screenshot or feel a tap in this sandbox. "Do taps now feel instant?" is the founder's gate on the deployed build — CC's gates prove the *mechanism* is present (pressed state resolves, prefetch effect present, skeletons render, publish state precedes the pre-check), not the *sensation*.
2. **CW-1 caveat (documented in-code):** a control that sets an **inline** `transform` (only the DS `<Button>` hover does, `ui/button.tsx:85`) won't take the scale; it keeps its own hover cue. All audited inline offenders set no inline transform, so they get the press cue.
3. **CW-2 is prefetch, not `router.back()`** — a deliberate deviation from D-S2 option A for correctness (no back-stack ambiguity). Realizes the same "instant back" intent via a warmed route.
4. **Pre-existing lint debt untouched.** 11 `react-hooks` errors exist on master in these files; fixing them is a separate concern (Gesetz 1 — no drive-by fixes), flagged here for visibility.
5. **The architectural tier is untouched.** F-40 (the highest-value finding — runs still die with the tab) is **not** addressed by this tier; it remains open pending D-S3. These cheap wins improve *felt* responsiveness, not run durability.

## Founder action list

- **Walk the deploy** and answer the real gate: *do taps now feel instant?* (esp. the chat back button, publish, sidebar "+", and any button press.)
- **Decide D-S3** (F-40 resumable runs a/b/c) to authorize the next, architectural wave — the run-persistence gap is unchanged by this tier.
- Optional: decide D-S6 (step-stream) and D-S7 (TTFT safe-subset) for a follow-up.
- **No migrations, no new services, no spend** in this tier. Nothing to apply.
