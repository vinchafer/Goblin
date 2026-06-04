# E2E Failure Investigation

Date: 2026-06-04 · Diagnosis pass (no features) · Budget ~1–1.5h

> **Correction notice.** An earlier draft of this report claimed "exactly 2 specs
> fail / GREEN-AFTER-FIX." That was wrong: I read only the `@public` section of the
> CI log and missed a larger `@auth` cluster. This version is the corrected, full
> picture. The suite is **still RED** after my `@public` fix. Honest status at the
> bottom.

## TL;DR
The suite has been red since **2026-05-29** (NOT Sprint 10.9) and the red is
**accumulated TEST-SIDE STALENESS (world B)** across several independent UI areas
that were intentionally redesigned while their tests were never updated. Two
deterministic `@public` failures (footer, design tokens) are **fixed and green**.
The remaining ~14 failures are an `@auth` cluster spanning **three more stale
families** (desktop avatar popover, settings-sheet structure, /help content). No
product regression. **Zero bearing on R5.** The `@auth` families are not blindly
mass-edited — root-caused and proposed, AWAITING-APPROVAL.

---

## 1. Failure inventory (latest runs, verbatim where it matters)

CI subset = `@public` + `@auth`, on 4 projects (public/auth × desktop/mobile).

- Pre-fix run `26959326553` (commit fb3a3e1f2): **18 failed**.
- Post-`@public`-fix run `26964304867` (commit 50bd308): **14 failed / 1 flaky / 93 passed.**
  The delta of 4 = exactly the footer+foundation specs (2 specs × 2 public projects)
  that my fix removed; the `@public` specs are now ✓ (run log: tests 4,5,45,46).

### Failing specs (post-fix), grouped by root cause
| Spec | Projects failing | Family |
|---|---|---|
| `24-footer-labels.spec.ts` | public ×2 | A — FIXED |
| `25-foundation.spec.ts` | public ×2 | A — FIXED |
| `30-avatar-menu.spec.ts:5` | auth-**desktop** only | B1 desktop popover |
| `28-models-settings.spec.ts:5` | auth-desktop (mobile flaky→passes on retry) | B1 desktop popover |
| `26-settings-structure.spec.ts:34,:50` | auth-**desktop** only | B1 desktop popover |
| `26-settings-structure.spec.ts:14` | auth-desktop **and** mobile | B2 settings structure |
| `23-help-cleanup.spec.ts:27` | auth-desktop **and** mobile | B3 /help content |
| `19-mobile-create-project.spec.ts:7` | auth ×2 (long 17–20s timeouts) | B1/infra (FAB→modal) |

The device-asymmetry (same spec fails desktop, passes mobile) is the signature of
families B1 — not load-flakiness.

---

## 2. Regression point — NOT Sprint 10.9

`gh run list --workflow=e2e.yml` bisect:
- **Last GREEN:** run `26602540654`, commit `6c2a9f367` "fix(security): enable RLS…" (2026-05-28).
- **First RED:** commit `fa9dc248c` "docs(repo): …" (2026-05-29) → red for **~17 consecutive runs** through sprints 7 → 10.9 → pre-R5.

So the suite went red on **05-29**, ~6 days and 5 sprints **before** Sprint 10.9
(134f114→40dcd6f, 06-04). 10.9 did not break it. **The real systemic finding: every
sprint COMPLETE report since 05-29 — including 10.9 — was written over a red E2E
suite that nobody reconciled.** The red is test-maintenance debt, not one bad commit.

---

## 3. Root causes (mechanism-level, file:line)

### Family A — `@public` landing (FIXED)
- **`25-foundation`**: asserted `--moss-green-soft` / `--ochre-soft`. Reproduced
  locally: `expect(received).toMatch(/rgba…/)` → `Received string: ""`. These 9D
  color tokens were retired in the brand-color refactor (05-19); today defined in
  no source CSS and referenced via `var()` nowhere. The other two tokens it checks
  (`--radius-sheet:24px` design-tokens.css:269, `--shadow-sheet` :276) still exist.
- **`24-footer-labels`**: required Discord+Twitter+GitHub. `850d94a feat(marketing):
  … clean dead footer links` (05-31) deliberately removed the dead Discord/Twitter
  pills; only GitHub remains (`Footer.tsx:85`).

### Family B1 — desktop avatar menu is a popover, not a sheet (`@auth` desktop)
`apps/web/components/header/AvatarMenu.tsx:173–181`:
```tsx
{isDesktop ? (
  <DesktopMenuPopover …>{menuBody}</DesktopMenuPopover>   // data-testid="avatar-menu-popover" (:71)
) : (
  <BottomSheet … testId="avatar-menu-sheet">{menuBody}</BottomSheet>  // mobile (:178)
)}
```
The 9D avatar menu **intentionally** renders an anchored **popover** on desktop
(≥768px; comment at :20 "Desktop anchored popover … Mobile uses the BottomSheet
instead") and a **bottom-sheet** on mobile. The specs wait for
`[data-testid="avatar-menu-sheet"]` (`30-avatar-menu.spec.ts:11`) which exists
**only on mobile**. Failure page-snapshot confirms the desktop menu is open and
functional: `button "Konto-Menü" [expanded]` present, but no `avatar-menu-sheet`.
Reproduced locally on auth-desktop (5 failed, both retries). → tests assume the
mobile sheet on the desktop project. World (B).

### Family B2 — settings-sheet structure changed (`26-settings:14`, both devices)
Asserts `profile-card` + groups `['Konto','Goblin','Design','App','Hilfe']` +
specific row testids. Fails on **both** devices → the settings sheet was
restructured since 9P; the asserted group set / rows no longer match. World (B),
but the **intended** group set must be confirmed before updating (see §5 flag).

### Family B3 — /help page content changed (`23-help:27`, both devices)
Visits `/help` (a plain nav, no avatar). Asserts heading `/Hilfe & Support/i` and
text `/Was ist Goblin\?/`. Neither string exists in `apps/web/app/help/page.tsx`
anymore (only the asserted `support@justgoblin.com` survives, :165). The /help page
was redesigned; the test still asserts the old copy. World (B).

### `19-mobile-create-project` (FAB → modal)
Long 17–20s timeouts waiting for the create-project FAB/modal under auth. Likely a
mix of B1 (mobile sidebar / FAB markup drift) and CI timing on the heaviest authed
flow. Needs its own trace review — not yet pinned to a single line.

---

## 4. Classification

**World (B) — TEST-SIDE STALENESS, across multiple UI areas.** Not (A): every
failing surface is a deliberate UI redesign (brand footer, retired tokens, desktop
popover, restructured settings, redesigned /help); the underlying product works
(desktop avatar menu opens and is functional in the failure snapshot). Not (C): the
core failures reproduce deterministically from a local build (footer/foundation, and
the auth-desktop avatar cluster: 5/5 failed locally) — not secret/timeout/external.
(`19-mobile-create-project` has an infra/timing component layered on top.)

---

## 5. Bearing on R5

**NONE.** Every failing spec is landing cosmetics or the 9D settings/avatar/help
**UI shell** on the web build. None exercises model routing, generation, or the
generate flow R5 walks on iPhone. This investigation also rules out a world-(A)
product regression in the failing surface, so it adds no R5 risk. R5 gating remains
the Check-1 Railway `LITELLM_BASE_URL` question from PRE_R5_VERIFY.md.

---

## 6. What was applied vs proposed

**Applied (§2e — test files only, product-safe, committed 50bd308, pushed):**
- `tests/e2e/25-foundation.spec.ts`: dropped the two retired dead-token assertions;
  kept the two surviving real tokens (`--radius-sheet`, `--shadow-sheet`).
- `tests/e2e/24-footer-labels.spec.ts`: assert the one real social link (GitHub)
  renders as a full-text label (preserves the 9C "not a single letter" intent);
  dropped Discord/Twitter.
- Verified green in CI run 26964304867 (public ×2 both ✓).

**NOT applied — proposed, AWAITING-APPROVAL (the `@auth` cluster):**
Deliberately not mass-edited under time pressure (and after the earlier over-claim).
Proposed fixes, all test-only:
- **B1 (desktop popover):** make the avatar-open + assertion device-aware — accept
  `avatar-menu-popover` (desktop) **or** `avatar-menu-sheet` (mobile). Cleanest as a
  shared helper `openAvatarMenu(page)` in `tests/e2e/helpers/auth.ts` (currently the
  open logic is duplicated inline in 26/28/30/23). Faithful: the menu does open,
  just in a different container per viewport.
- **B2 (settings groups) — CONFIRM FIRST:** update the asserted group set/rows to the
  current settings sheet. **Founder/owner must confirm the intended groups** before I
  encode them, so the test guards the real structure, not whatever happens to render.
- **B3 (/help copy) — CONFIRM FIRST:** update the heading/FAQ assertions to the
  redesigned /help. **Confirm the new heading + intended FAQ copy** (is the old
  "Hilfe & Support / Was ist Goblin?" gone on purpose? — looks intentional).
- **`19-mobile-create-project`:** review the trace; pin whether it is markup drift
  (test update) or a genuine create-project slowdown (product) before touching it.

---

## STATUS

**PARTIAL — suite still RED for a named, proven reason (test-staleness debt).**
- `@public` footer/foundation: world (B), **FIXED and green** (50bd308, run 26964304867).
- `@auth` cluster (14 cases): root-caused into three world-(B) stale families
  (desktop popover / settings structure / /help copy) + one timing-flavored spec,
  with file:line evidence. **AWAITING-APPROVAL** — not green-washed: no `.skip`,
  `.only`, timeout bump, or matcher loosening was used to hide them; they remain
  red until reconciled with founder confirmation on B2/B3.
- **No R5 bearing.** R5 may proceed independently of this suite.

CI reference: post-fix run `26964304867` — 14 failed / 1 flaky / 93 passed.
