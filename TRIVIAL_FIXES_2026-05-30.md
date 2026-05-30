# Goblin — Trivial Fixes Applied (2026-05-30)

## None applied — and why (no hedging)

Per §3a a trivial fix must be ≤10 lines, defect-only, **and verifiable with build PASS**. I did **not** apply any code fixes this run, deliberately:

1. **I could not run a build to verify.** A trivial fix I can't prove compiles is not a trivial fix — it's an unverified edit, which §3a forbids. The environment time was consumed by a flaky tool pipeline, and I would not leave unbuilt changes in the tree.
2. **I had not located the exact source components** for the two strongest candidates (the build only ever ran the dev server; component files were not opened during this pass). Blind edits to unknown files violate "defect-only, no business-logic risk."

This is the honest call: better to hand the team a precise, pre-diagnosed list than to leave speculative diffs behind.

## Applied during Sprint 1 (B3 run)

| Fix | File | What | Lines | Verified |
|---|---|---|---|---|
| Type-narrowing defect blocking `tsc --noEmit` | `apps/api/src/routes/billing.ts:145` | `formatted[formatted.length - 1].id` → `formatted.at(-1)?.id ?? null` (pre-existing; surfaced because apps/api has no `typecheck` script so it was never checked, and tsup/esbuild skips type errors). Defect-only, no behaviour change (guard `length > 0` already present). | 1 | typecheck PASS, build PASS, 65/65 tests PASS |

## Ready-to-apply candidates (each ≤10 lines, pre-diagnosed)
Apply + `pnpm --filter @goblin/web build` to verify, then move each into this file's "Applied" section.

| Candidate | Where to look | Fix | Lines |
|---|---|---|---|
| Mobile hero whitespace "workshop​for" at ≤390px | `apps/web/components/landing/*` hero `<h1>` | the line-break/`<br>` or `whitespace`/`text-balance` rule collapses the space at small widths — add a non-breaking space or fix the responsive `<br>` | ~1 |
| Icon-only buttons missing `aria-label` | `apps/web/components/{app-shell,sidebar,header,chat}/*` | add `aria-label` to the 2 (dashboard) / 3 (chat) / 4 (settings) icon buttons | ~9 |
| `<title>` case mismatch | `apps/web` root layout vs auth layout `metadata.title` | make both "The cloud workshop for builders" (or both Title Case) | ~1 |
| `/dashboard/settings` → login | route/redirect config | add redirect `/dashboard/settings` → `/settings` | ~3 |
| Dead `href="#"` footer links | `apps/web/components/landing/*` footer | point Imprint→`/imprint` (create), About→`/about`, or remove until real | ~4 |

> The `/dashboard/settings` redirect and the Imprint link are also tracked as P1 backlog items (B7, B13) because they carry product/legal weight beyond "trivial."
