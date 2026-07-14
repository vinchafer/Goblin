# FIX-WAVE 5 — POLISH · BUILD REPORT

**Branch:** `claude/fix-wave-5-polish-7uaxyi` (from `master` @ 6248194, FW4 merge)
**Executor:** CC (Opus) · **Date:** 2026-07-15 · Cloud session
**Status:** built, self-reviewed, gated — **HALT for founder re-walk + acceptance. Merge founder-granted.**

This closes the post-Walk-2 fix campaign. Nine per-unit commits, each isolated and
revert-ready. No regressions to the live FW1–FW4 chains (F-40 registry, FW3 Sage&Copper
tokens, FW1 attested==shipped, FW2 hardened webhook + support send).

---

## Baseline (state-first, Phase 0)
- API vitest: **786 passed** / 16 skipped at branch start.
- Web `tsc --noEmit`: clean.
- After FW5: API vitest **818 passed** / 16 skipped (+32 new tests); web `tsc` clean.

---

## Units

### U6 — small tuning riders (one commit each)
- **F-25 "Knapp"** (`7a2c3d9`): tightened the `responseStyle==='knapp'` instruction (1–3
  Sätze, no promotional close, honest hand-off kept as a short clause) + a few-shot on the
  exact failure case. **Real-model probe 3/3 short** against live Swift (DeepSeek-V3.2) —
  `evidence/fw5-u6/f25-knapp-probe.md`. Ledger F-25 note (input-side, net-negative tokens).
- **Forge heartbeat** (`e5ad434`): a one-shot timer on the FIRST agent turn (Forge only)
  emits an honest in-progress line through the existing narration stream — no fake
  progress. Cleared on first content; tool-call-only first turn resets the slot. Delay
  env-knobbed. Zero model tokens. **4 tests** (Forge-slow shows+replaces, Swift never,
  fast never, tool-call-only clears).
- **F-32 show-once server flag** (`91ecdfe`): purchase-confirmation "seen" marker moved from
  localStorage to a per-user server flag (GET `/status` surfaces it via a SEPARATE
  best-effort query so a pre-migration DB can't break `/status`; new POST `/confirm-plan`
  stores the resolved plan key). Web falls back to localStorage until the column lands.
  **Migration 0093 authored, NOT applied.** **5 endpoint tests** incl. pre-migration
  tolerance.

### U4 — D-E support hardening, agent-first (`cfeaffe`)
State-first: the live help card held BOTH phrasings + the plaintext email in one component.
Removed the one-click "Ich brauche einen Menschen" link and the plaintext address from the
above-the-fold card; the agent stays the single entry point; the human handoff routes
through the agent via one honest line (DE+EN). Honest-failure mailto fallback
(`support-chat.tsx`) and the Impressum contact untouched. Updated the e2e contract
(`23-help-cleanup`). Escalation regression **32/32**. **Live 375px gate:**
`evidence/fw5-shots/u4-help-375.png` — 0 mailto links, 0 email links, 1 agent CTA.

### U3 — D-D explorer file upload (`a386a71`)
State-first: the Explorer already had a "Hochladen" button + `POST /files/upload`, but the
endpoint bypassed the FW2-U3 type whitelist and the D-2 daily-bytes cap and returned a
catch-all error (repo contradicted the founder's "no upload" — believed the repo, Gesetz 10).
Completed by **reuse, not a parallel path** (F-29 lesson): new `upload-policy.ts` whitelist
→ size 413 → shared `consumeDailyBytes` 429 → `storageKey` prefix-jail (unsafe_path 400) →
plan cap. Client: native drag-drop + honest per-failure DE/EN errors. Ledger FW5 NOTE (no
new token path; the attachment daily cap now bounds chat + explorer uploads). **13 tests**
(policy unit + real-guard-chain integration).

### U2 — F-34 PWA icons, gold-on-green, all sizes (`a44f890`)
Root cause of the plain-green home-screen icon: empty placeholder PNGs + an SVG apple-touch
icon (iOS ignores SVG apple icons). Regenerated the full set from the FW3 gold-on-green
lockup (`goblin-logo-primary.svg`) deterministically (`scripts/gen-pwa-icons.mjs` + sharp):
any 192/512, dedicated maskable 192/512 (mark in the ~66% safe zone), real 180 apple-touch,
PNG favicons, monochrome badge; manifest theme_color aligned to `#1A3A2A`; mask-icon fixed.
Reference audit: every manifest + head ref resolves at its declared size. Previews:
`evidence/fw5-u2/icon-montage.png`. **Founder action:** an installed PWA may need re-adding
to refresh the cached icon.

### U5 — D-F downgrade fairness: auto-refund on cancel (`efd3e1a`)
`refundRemainingCreditOnCancel` reads the Stripe credit balance on `subscription.deleted`,
refunds the remainder (capped at the latest refundable charge's room) to the card, then
zeroes the credit. Wired into `handleSubscriptionDeleted` after entitlement reset,
non-throwing (a failure is admin-logged, never a user success — F-29 species). Hardened-
pattern conformant: `withTimeout` on every Stripe call; refund idempotency-keyed on the
subscription (webhook-retry safe). DE+EN billing line. Ledger FAIRNESS-COST NOTE (Stripe
keeps the ~1.4%+€0.25 refund fee, verified 2026-07-15 — accepted brand cost). **10 tests**
(positive/partial/capped/zero/positive-balance/no-charge/refund-error/balance-adjust-fail/
idempotent/skipped). **Founder action:** one real downgrade→cancel on the test account
post-deploy to see the refund in Stripe.

### U1 — F-12/F-13/F-14 code-view affordances (`9f8628b`)
- **F-12:** the chat code-card send-to-code mechanic was a faint green icon — now GOLD
  (matching the real CodeBlock gold recipe): labeled pill in the expanded header
  (icon-only in the collapsed card, label hides <480px) AND repeated at the END of a long
  (>24-line) block. **Live gate:** `evidence/fw5-shots/u1-f12-codeblock-{375,720}.png`
  (header affordances=2, file-end=1).
- **F-13:** "Goblin Swift" read off-centre in the header switcher (mixed font sizes + a raw
  "▾" glyph) — fixed with tight line-heights + a baseline-neutral SVG chevron.
- **F-14:** the code-view "…" menu + git fields opened off-screen in split-screen — the git
  panel's `position:fixed` resolved against a transformed pane ancestor. Portal the scrim +
  panel to `document.body` (true viewport-fixed) and bound the "…" menu height.
- F-13/F-14 marked **screenshotBlocked** (authed workspace can't be driven headless here);
  structural fixes proven by diff + tsc.

---

## Ledger (same-commit)
- `docs/GOBLIN_CONSUMPTION_LEDGER.md`: FW5 NOTE (U3 shared upload cap, U5 refund fee
  FAIRNESS-COST line), F-25 note. No new model-token path; U5 adds a small Stripe-fee COGS
  line for the CFO dashboard.

## Migrations (authored, NOT applied — founder applies)
- `supabase/migrations/0093_last_confirmed_plan.sql` (F-32). Code is pre-migration tolerant.

## Self-review checklist
1. Evidence audit — each artifact opened & re-checked (probe 3/3, /help 375, icon montage,
   codeblock render). ✓
2. Diffstat vs scope — every file justified by a unit; consumption paths noted. ✓
3. Regression — full API suite 818 green; web tsc clean; no new lint errors (in-place
   delta=0 vs master on every touched file). ✓
4. Honesty sweep — new strings DE+EN, no unproven claims / fake times / self-labels. ✓
5. Ledger — updated same-commit for U3/U5/F-25. ✓
6. Report completeness — unit SHAs, evidence refs, Honest-Limitations, founder actions. ✓
7. The Steven question — a skeptic with only this evidence reaches these verdicts. ✓

## Honest limitations
- **F-13 / F-14**: no live screenshot (authenticated workspace can't be driven headless in
  this environment). Structural fixes; proven by diff + tsc + rationale; founder eye confirms.
- **U3 in-memory test note**: the byte round-trip is asserted as "listed + fetchable"; exact
  byte fidelity is a prod-S3 property (the dev in-memory fallback re-encodes base64) covered
  by file-storage's own tests.
- **Real-money / on-device gates** are founder actions (see below), not runnable here.
- **Web eslint** flags pre-existing patterns (react-hooks compiler rules) across the repo;
  FW5 adds **zero** new lint errors (verified in-place per file, delta=0).

## Founder actions
1. Apply migration 0093 (F-32) in the Supabase SQL editor.
2. One real **downgrade → cancel** on the test account to see the U5 refund land in Stripe.
3. Re-add the installed PWA to the home screen to refresh the U2 icon cache.
4. Eyeball F-13 (model label centred) + F-14 (git fields on-screen in split-screen) in the
   re-walk.
5. The consolidated test list → final acceptance review → User-Go.

**HALT.**
