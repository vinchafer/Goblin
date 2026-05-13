# Bug Registry — Session 5

Generated: 2026-05-12 (Phase V2 — Test Run Local)

**Test Suite:** 88 tests total | **Result:** 88/88 green (chromium, local)

---

## 🔴 CRITICAL

None found — all main paths functional.

---

## 🟡 MAJOR

### BUG-001: Login page defaults to "Create account" mode instead of "Sign in"
**Status:** OPEN  
**Found by:** Auth test + screenshot inspection  
**Description:** Navigating to `/login` shows "Create your account" heading and "Create account with Email" button. New/returning users both land on signup mode. Most returning users would expect to "sign in", not "create account". This creates friction.  
**Impact:** UX confusion for returning users  
**Root cause:** Login page probably initializes `mode` to `'signup'` by default  
**Fix:** Default mode to `'signin'`, or detect via URL param `?mode=signup`  
**Repro:** Navigate to `/login`

### BUG-002: FirstRunTour modal blocks all UI interactions
**Status:** OPEN (by design, but has UX problem)  
**Found by:** Project workspace tests  
**Description:** FirstRunTour shows for all first-time users (isFirstLogin = no projects + no keys). While the tour is showing, the backdrop intercepts ALL pointer events including navigation buttons. User can't click "New Project" or anything else until they dismiss the tour.  
**Impact:** First-time users may feel stuck if they miss that they can click the backdrop  
**Root cause:** Tour backdrop has `pointer-events: auto` → blocks sidebar buttons  
**Fix:** Either add a visible "X" close button, OR make the "New Project" button z-index above the tour  
**Test:** `03-project-workspace.spec.ts` line 93

### BUG-003: "N 1 Issue" badge appears on all authenticated pages (dev mode)
**Status:** OPEN  
**Found by:** All screenshot captures  
**Description:** Every authenticated page shows the Next.js dev overlay "N 1 Issue ×" badge in the bottom left. This indicates a runtime error caught by Next.js error tracking.  
**Impact:** In development — could mask real errors. No production impact.  
**Root cause:** Unknown — likely a hydration mismatch or runtime error in a client component  
**Fix:** Investigate root cause, fix underlying error  
**Priority:** Medium (dev-only, but real underlying error exists)

---

## 🟢 MINOR

### BUG-004: Privacy link strict mode — two elements match `/privacy/i`
**Status:** FIXED in tests (use `.first()`)  
**Found by:** `auth.spec.ts` Privacy link test  
**Description:** The login page has two `<a>` links matching `/privacy/i`: "Privacy Policy" (in footer) and "Privacy" (in consent text). While functionally fine, it indicates duplicate links.  
**Impact:** Minor — slightly redundant DOM  
**Fix:** Consolidate to single link per context, or accept current state  

### BUG-005: Dev server ECONNRESET under parallel auth load
**Status:** FIXED (workers=1 in playwright config)  
**Found by:** Parallel test runs  
**Description:** When 2 Playwright workers run simultaneously, both hitting `/api/test-auth` which calls Supabase admin API, the dev Next.js server occasionally resets connections.  
**Impact:** Test flakiness only — no production impact  
**Fix:** Set `workers: 1` in playwright.config.ts ✅

### BUG-006: Outdated tests for renamed login buttons
**Status:** FIXED  
**Found by:** `auth.spec.ts` and `mobile.spec.ts`  
**Description:** Tests checked for "Sign in with Google/GitHub/Apple" but buttons were renamed to "Continue with Google/GitHub/Apple" in a previous session.  
**Fix:** Updated all test locators ✅

---

## Pre-existing Bugs (from memory, not verified this session)

### BUG-007: WelcomeModal not triggered
**Status:** Unverified — no test written  
**Source:** Session 1-2 FINAL_STATUS.md  

### BUG-008: Sidebar URL navigation
**Status:** Claimed fixed in Session 4 (U1) — not verified by test  
**Source:** Known bugs from session 2  
**Suggested test:** Click project in sidebar → verify URL is `/dashboard/project/{id}`, not `/project/{id}`

### BUG-009: Push GitHub without GitHub connection check
**Status:** Unverified  
**Source:** Known bugs from session 2  

---

## Test Infrastructure Added This Session

- `apps/web/app/api/test-auth/route.ts` — Magic link session creation (DEV-only, token protected)
- `apps/web/app/auth/test-callback/page.tsx` — Client-side auth callback for hash-based magic links
- `tests/e2e/helpers/auth.ts` — Playwright auth helper (loginAsTestUser, dismissTour, cleanupTestUsers)
- `tests/e2e/02-dashboard.spec.ts` — 12 authenticated dashboard tests
- `tests/e2e/03-project-workspace.spec.ts` — 8 project workspace tests
- `tests/e2e/04-onboarding.spec.ts` — 5 onboarding flow tests
- `tests/e2e/05-settings.spec.ts` — 10 settings page tests
- `tests/e2e/06-empty-errors.spec.ts` — 8 empty state + error tests
- `tests/e2e/07-mobile-auth.spec.ts` — 4 mobile authenticated tests
- Updated `playwright.config.ts` — serial workers, configurable base URL
- Updated `auth.spec.ts`, `dashboard.spec.ts`, `mobile.spec.ts` — fixed outdated locators

---

## Verified Functional (Green Tests Prove It)

- Auth flow: Magic link → /auth/test-callback → cookies set → /dashboard ✅
- Dashboard loads with projects and empty states ✅  
- Settings pages: main, keys, local, integrations, billing, routing — all load ✅
- API Keys inline expansion works ✅
- Project workspace: loads, chat input works, code tab switch works ✅
- 404 for invalid project: handled gracefully ✅
- Onboarding page: renders, shows goal selection ✅
- Redirect behavior: unauthenticated → /login ✅
- Mobile: no horizontal overflow, settings usable ✅
- Landing page: loads, pricing visible, footer links ✅
- Login page: OAuth buttons ("Continue with Google/GitHub/Apple") ✅
