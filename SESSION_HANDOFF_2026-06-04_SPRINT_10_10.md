# Session Handoff — 2026-06-04 — Sprint 10.10 (Onboarding Truth & Flow Fix)

## What shipped (all pushed: f2795fb · 6a6177a · e04ee1b)
The `/welcome/*` onboarding is now honest, fully bilingual, and flow-correct —
verified live on PROD in both languages via CDP.

- **HERO-B (honest):** prod truth-test proved a no-key generation FAILS, so the
  hero/layers tell the "you choose how far you go; most start free with one key"
  story. No unreachable promise.
- **Full DE/EN i18n** for all 6 steps (`app/welcome/_components/i18n.ts`,
  `useOnbLang()`). DE walk = all German, EN walk = all English, zero mixing.
- **iOS toggle** (`components/ui/IOSToggle`) now on Step-4 tools; app-wide.
- **Flow fixes:** dual-key save→add-another; Vercel **inline** save (no more
  Step-0 bounce); **step counter** consistent; CTAs are **real filled buttons**
  (fixed a `.btn-primary` global collision); clean **post-onboarding landing**
  (no auto New-Project modal); gold-on-light removed; dead explore link fixed.

## Gates
- typecheck web/shared/api ✓ · `next build` ✓ · `@public` e2e 41/0 vs prod ✓.
- `04-onboarding.spec.ts` is `@local-only` legacy (removed `/onboarding` route)
  — fails vs prod by design, not a regression, not in the green CI suite.

## Founder TODO
1. **Re-walk** onboarding on iPhone, both languages — `vinc.hafner4` is reset to
   a clean, incomplete, no-keys state. Should be a confirmation, not a bug hunt.
2. **Decide on the free-pool banner** ("20 requests left today"): it currently
   over-promises for no-key users (the default model can't generate without a
   key). Hide it until a key exists, or wire a real no-key pool.
3. **Dashboard i18n** (New-Project modal + project overview still mix DE/EN) is a
   scoped follow-up — onboarding (`/welcome/*`) was done fully this sprint.

## Evidence
`sprint-10-10/` — PHASE_0.md, R5_FEEDBACK.md, walk-de/ (00–06), walk-en/
(00–05), toggle-on.png, toggle-off.png, truth-test + auto-modal proofs.
Full report: `SPRINT_10_10_COMPLETE_2026-06-04.md`.
