# E2E Failure Investigation

Date: 2026-06-04 · Diagnosis pass (no features) · Budget ~1–1.5h

## TL;DR
Both CI failures are **world (B) — TEST-SIDE STALENESS**. Two `@public`
landing-page specs (footer social links, 9D design tokens) still assert the
pre-redesign world; the brand/footer redesign deliberately removed what they
check. No product regression. **No bearing on R5.** Product-safe test-only
updates applied per §2(e); local run is green (4/4). The premise "turned red
around Sprint 10.9" is **disproven** — see history below.

---

## 1. The 2 annotations / failing specs (verbatim)

Failing run `26959326553` (commit `fb3a3e1f2`, 2026-06-04). Every other spec ✓;
exactly two specs ✘ (×2 projects = desktop+mobile):

**Spec A — `tests/e2e/24-footer-labels.spec.ts:4`**
`9C — Footer social labels not single letters › Footer shows full text labels Discord/Twitter/GitHub @public`
Locator `footer a[target="_blank"]` filtered by `Discord` / `Twitter` never becomes visible (only `GitHub` exists).

**Spec B — `tests/e2e/25-foundation.spec.ts:4`**
`@public 9D-0 Foundation › Tokens loaded — 9D additive tokens resolve in both themes`
Verbatim (reproduced locally, identical to CI):
```
Error: expect(received).toMatch(expected)
Expected pattern: /(rgba?\([^)]+\)|#[0-9a-fA-F]{8})/
Received string:  ""
  > 18 |     expect(tokens.mossSoft).toMatch(rgbaOrHex8);
     at tests/e2e/25-foundation.spec.ts:18:29
```

---

## 2. Regression point (challenge: NOT 10.9)

`gh run list --workflow=e2e.yml` bisect:
- **Last GREEN:** run `26602540654`, commit `6c2a9f367` "fix(security): enable RLS…" (2026-05-28).
- **First RED:** commit `fa9dc248c` "docs(repo): commit plan execution report" (2026-05-29).
- Then **red for ~17 consecutive runs** through every sprint 7 → 10.9 → pre-R5.

So the suite went red on **2026-05-29**, ~6 days and 5 sprints **before** Sprint 10.9
(134f114→40dcd6f, 06-04). 10.9 did not break it. The real systemic finding: **every
sprint COMPLETE report since 05-29 — including 10.9 — was written over a red E2E
suite that nobody reconciled.**

### Offending diffs (per spec — both predate 10.9)
- **Spec B (tokens):** `--moss-green-soft` / `--ochre-soft` were 9D additive color
  tokens, retired in the brand-color refactor (`refactor(brand): migrate hardcoded
  colors`, 2026-05-19 and follow-ups). Today they are **defined in no source CSS**
  and **referenced via `var()` nowhere** (`grep var(--moss-green-soft|--ochre-soft)`
  = empty). `getComputedStyle` → `""` → assertion fails. The other two tokens it
  checks — `--radius-sheet: 24px` (design-tokens.css:269), `--shadow-sheet`
  (:276) — still exist and still pass. This first turned the suite red on 05-29.
- **Spec A (footer):** `feat(marketing): … clean dead footer links` (`850d94a`,
  2026-05-31) deliberately removed the Discord + Twitter pills (placeholder links
  with no destination), leaving only the real GitHub link
  (`apps/web/components/landing/sections/Footer.tsx:85`). This is why Spec A joined
  the failures on 05-31 (after the 05-29 token break).

---

## 3. Local reproduction

`npx playwright test 24-footer-labels 25-foundation --project=public-desktop`
→ both FAIL, identical errors to CI (Spec B "Received string: \"\""; Spec A footer
locators not visible). Deterministic across the built-in retry → **not flaky, not
env/infra**. CI builds the web app locally (`pnpm --filter @goblin/web build` +
playwright `webServer`), so these reflect **current repo code**, confirming a
code↔test mismatch rather than a deployed-prod difference.

---

## 4. CLASSIFICATION — (B) TEST-SIDE STALENESS (both)

Mechanism-level root cause:
- The landing/brand was intentionally redesigned (LP-2 promotion 05-22 → brand
  color refactor 05-19 → marketing footer cleanup 05-31). Two 9C/9D-era `@public`
  specs were never updated to the new brand, so they assert UI that was
  deliberately removed: 3 social links (now 1) and 2 color tokens (now 0).
- Not (A): the failing surface is cosmetic landing markup; no generation/auth/model
  behavior is touched. The prompt's prime suspects (Gemini model availability,
  /admin/catalog, catalog read-path, missing ADMIN_API_KEY) are **not** involved —
  these are unauthenticated, model-free landing assertions.
- Not (C): reproduces deterministically from a local build; no secret/timeout/external
  dependency is implicated.

---

## 5. Bearing on R5

**NONE.** Both specs are `@public` landing cosmetics (footer link count, names of
removed CSS tokens). They do not exercise login, model routing, generation, the
Code Tab, or the convergence. R5 (manual iPhone walk of the generate flow) is
unaffected. This investigation also positively rules out a world-(A) regression in
the failing surface, so it raises no new R5 risk.

---

## 6. Recommendation + what was applied (§2e — test files only)

Applied two **product-safe test updates**. No product code touched. Original test
INTENT preserved in both; no assertion that guards real behavior was weakened.

**`tests/e2e/25-foundation.spec.ts`**
- Before: asserted `--moss-green-soft`, `--ochre-soft` (removed/dead), `--radius-sheet`, `--shadow-sheet`.
- After: asserts the two **surviving** 9D sheet tokens `--radius-sheet === '24px'` and `--shadow-sheet` non-empty (these still back the BottomSheet UI). Dropped the two retired tokens with a comment explaining why. Asserting nonexistent tokens guarded nothing.

**`tests/e2e/24-footer-labels.spec.ts`**
- Before: required Discord + Twitter + GitHub social links.
- After: asserts the one real social link (GitHub) renders as a **full-text label**
  (`toHaveText(/GitHub/)`) — preserving the original 9C intent ("not a single
  letter"). Dropped Discord/Twitter with a comment pointing at `850d94a`.
- **⚠ Founder decision to confirm:** this update encodes "footer is GitHub-only by
  design." The commit `850d94a` calls Discord/Twitter "dead links," so this reads as
  intentional. **If you actually want Discord/Twitter in the footer, that is a
  PRODUCT change (re-add the links in `Footer.tsx`) and the test should then
  re-assert all three.** Say the word and I revert the test + add the links instead.

Post-fix local run (both projects):
```
4 passed (38.9s)
  ok [public-desktop] 24-footer-labels …
  ok [public-desktop] 25-foundation …
  ok [public-mobile]  24-footer-labels …
  ok [public-mobile]  25-foundation …
```

---

## STATUS

**GREEN-AFTER-FIX (local proven; CI run pending on push).** Two product-safe
test-only updates align two stale 9C/9D specs with the deliberate brand/footer
redesign — not a green-wash: no `.skip`/`.only`/timeout bump/matcher loosening, and
the surviving real assertions (radius/shadow tokens, full-text GitHub label) were
kept. The pushed commit triggers a fresh `E2E Tests` run; its result is appended
below.

> CI confirmation: <pending — fill with run id/result after push>
