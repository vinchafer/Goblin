# Row 1 — DiffModal → Multi-Hunk Thumb Review Card · DONE report

Scope: ROW #1 only (IMPROVEMENT_PLAN.md). DiffModal reshaped **in place** into a
multi-hunk review card; apply path made hunk-aware. No new component, no agent
path, no new store. Commits `ROW1-1` (bdd791e), `ROW1-2` (fd0405b) — pushed,
`origin/master == HEAD`.

## What changed (file:line)
- **`apps/web/lib/diff-hunks.ts`** (new) — `splitHunks(diff,lang)` parses the
  existing unified diff (`createTwoFilesPatch`, `apps/api/src/routes/projects.ts:761`)
  into hunks via `diff.parsePatch`; `reconstructWithHunks(current,diff,acceptedIdx)`
  rebuilds content from base + accepted-subset hunks via `diff.applyPatch`,
  returns `null` on unclean apply.
- **`apps/web/components/project/diff-modal.tsx`** — same export/name/props
  (+ optional `onApplyContent`). Was: 800px centred modal, all-or-nothing.
  Now: responsive review card — mobile bottom sheet + thumb bar, desktop centred
  card; file = one card; >1 hunk → labelled hunk sections with per-hunk ✕/✓;
  whole-file accept + discard always present; resolving all hunks auto-commits
  the accepted subset; fail-safe banner if a subset can't apply.
- **`apps/web/hooks/code/useCodeInjections.ts:106+`** — added
  `handleDiffApplyContent(content)`: writes a reconstructed subset via the
  **same** `applyInjectionDirect` → `applyExternalEdit` (`PUT files/:path`) path
  (sets undoPayload, same as whole-file). `handleDiffApply` (whole file) intact.
- **`apps/web/hooks/useCodeTab.ts`**, **`code-tab-classic.tsx:69`** — expose +
  pass `onApplyContent={tab.handleDiffApplyContent}`.

## Hunk split + labels (variant a — mechanical, locked)
- Hunks come straight from `parsePatch` `@@` boundaries. No model call.
- Label is honest: CSS custom-property (`--accent`) or a `{`-block selector when
  unambiguous; **otherwise** `Änderung N · Z. x–y` / `Change N · ln x–y` (DE/EN).
  Never invents a label that could mislead.
- Single-hunk renders as one clean card (no fake splitting).

## Partial-apply logic
- accepted = hunks marked ✓. `0` → discard. `all` → whole-file path
  (`onApply`, writes proposedContent — robust default). `subset` →
  `reconstructWithHunks` → `onApplyContent`. `null` → fail-safe banner, file
  untouched. Never writes corrupt content.

## Verification — honest split

**GREEN (functional correctness, proven):**
- Lib logic unit-checked in node: accept-one/reject-other → only accepted lands;
  both === proposed; none === unchanged.
- `pnpm --recursive typecheck` PASS (web + shared; api has no typecheck script,
  untouched). `pnpm @goblin/web build` PASS.
- **Real component** exercised in an isolated local harness (throwaway page,
  deleted, never committed) on `localhost`, real `diff-modal.tsx` + real
  `diff-hunks.ts`:
  - multi-hunk card, labels `--accent` (heuristic) + `Änderung 2` (honest) —
    `card-mobile-multihunk.png`
  - **partial apply**: reject accent + accept grid → reconstructed content
    `accent=orange grid=2col` (correct subset) — `card-partial-result.png`
  - whole-file accept → writes proposedContent (logged)
  - single-hunk clean render — `card-single-hunk.png`
  - desktop = same card, clicked — `card-desktop.png`

**AMBER (prod end-to-end NOT proven) — and why (no green-wash):**
1. **The DiffModal surface is dormant on prod.** `CodeTab` (`code-tab.tsx`)
   probes `/api/code-sessions`; prod returns **401** → treated as *available* →
   it renders **`CodeWorkspace`/`SessionPane`** (multi-session: SessionThread +
   `StreamingDiffView`), **not** `CodeTabClassic`/`DiffModal`. The live 390px
   look confirms this (`../_live-code-390.png`: "Aus dem Chat", "im Editor
   ansehen" — those strings live in `CodeWorkspace.tsx`/`SessionThread.tsx`).
   So a prod phone user reviewing a change today does **not** hit this card; it
   improves the **classic fallback** path (code-sessions 404/5xx).
2. **Account safety.** The open Chrome session's account could not be confirmed
   as the test user `vinc.hafner3` (Supabase session is httpOnly-cookie, email
   not readable client-side). Per the non-negotiable, I did **not** perform any
   write action (real edit / publish) on a possibly-personal account.

→ Net: the row is correct, in-place, regression-free, and proven functionally on
the real component; it is **not** proven through the live prod flow because that
flow doesn't render this surface, and writes weren't safe to attempt.

## E2E
No existing spec asserts on `DiffModal`. `tests/e2e/full-flow-sprint7.spec.ts`
is LIVE-gated and targets `SessionPane` (different surface) — not touched, not
regressed. typecheck + build green. No new heavy spec added (the surface needs a
live injection to exercise; covered by the real-component harness instead).

## Nothing lost (parity with old DiffModal)
whole-file apply ✓ · discard ✓ · `+/−` content ✓ · filename + draft dot ✓ ·
wiring via `useCodeInjections.diffData` ✓ · InjectedBanner / Send-to-Code arrival
routes into the same surface ✓ · undo via `undoPayload` ✓.

## Recommended next (founder's call — NOT done here)
**Row 1b:** bring this same card + `diff-hunks` lib to the **live** surface
(`CodeWorkspace`/`SessionPane`'s diff+apply), so the phone user actually feels
it. That is the in-place follow-up that makes Row 1 visible on prod. It's a
different surface than Row 1's locked scope, so it's a separate row.
