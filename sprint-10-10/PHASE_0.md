# Phase 0 — Truth-test + Flow Trace (Sprint 10.10)

Run on PROD (`www.justgoblin.com`) via CDP, logged in as a fresh no-keys user
(`vinc.hafner4`, minted magic link). Chrome :9222 launched per
CLAUDE_CODE_GOBLIN_RULES.md.

---

## 0.1 — Does a NO-KEY generation work today?  → **NO. HERO-B.**

Walked as a fresh no-keys user, completed onboarding via "Skip all" (the only
way to reach the dashboard — see 0.2), created a blank project, opened a chat,
sent "Write a haiku about goblins" with the default preselected model
**Llama 3.3 70B**.

**Result: generation FAILS.** The assistant turn returned an error:

> "Für dieses Modell fehlt ein gültiger KI-Schlüssel. Füg in den Einstellungen
> einen Schlüssel hinzu oder wähle ein anderes Modell."
> (= "This model is missing a valid AI key. Add a key in settings or choose
> another model.")

Evidence: `PHASE_0_truthtest_nokey_fails.png`.

Note a **misleading** banner sits at the top of the chat for no-key users:
**"20 Anfragen heute übrig. Eigenen Key für unbegrenzt →"** (20 requests left
today). It implies a free pool, but the default model cannot actually generate
without a key. This is precisely the Sprint-9 trap ("a beautiful funnel into a
dead model"). The hero copy must NOT promise no-key generation.

**DECISION: HERO-B (honest, no-promise version).** Step 1 + the layers tell
the "you choose how far you go; most start free with one key" story. No copy
may say or imply "models are already provided, just start."

(Out of scope but logged: the 20-requests free-pool banner is a broken promise
for a no-key user. Either wire a real no-key pool or stop showing the banner
until a key exists. Recommend the latter as a fast follow.)

---

## 0.2 — The Vercel/GitHub → Step-0 bounce  → **ROOT CAUSE FOUND**

**Cause:** `apps/web/app/dashboard/layout.tsx` (lines ~54–68). For a *new*
user (account created < 10 min) whose `onboarding_steps.completed` is not yet
true, the dashboard layout **`redirect('/welcome/language')`**.

How each path hits it:
- **Vercel card** (`welcome/integrations/page.tsx`): its CTA is
  `href="/dashboard/settings/keys"` — it navigates *out of onboarding into
  `/dashboard/*`*. The user is still new + not completed → the dashboard guard
  fires → bounce to `/welcome/language`. (Confirmed live: navigating to
  `/dashboard` as fresh user bounces to `/welcome/language`.)
- **GitHub card**: `connectGithub()` → external OAuth round-trip → full page
  load back to `/welcome/integrations` → `OnboardingChrome` remounts → its
  returning-user guard checks `byok-keys/has-any`; if the user already added a
  provider key in the provider step, `exists=true` → `router.replace('/dashboard')`
  → dashboard guard (new + not completed) → `/welcome/language`. Double bounce.

**Also broken by the same guard:** the Step-1 "Explore first — no key needed"
link points to `/dashboard`; a fresh user clicking it is bounced straight back
to `/welcome/language`. The no-key explore path is effectively dead.

**Fixes (Phase C.2):**
1. Vercel: replace the "Add token in Settings" navigation with an INLINE token
   panel (save via API, show connected, stay on step 5). Stop leaving the flow.
2. `OnboardingChrome` returning-user guard: only redirect to `/dashboard` when
   onboarding is **completed**, not merely when a key exists — so a new user
   who just added a key mid-flow is not kicked out on remount.
3. (Explore path) acceptable once #2 lands + completed-gating is correct; the
   explore link can mark a lightweight "exploring" state or the guard can allow
   `/dashboard` for users who chose explore. Minimum: it must not bounce to
   language.

---

## 0.3 — Step-counter mismatch  → **MAPPED**

**Single source of truth for the rendered header chip:**
`apps/web/app/welcome/_components/chrome.tsx` → `STEP_BY_PATH`:
```
'/welcome/language': 0,
'/welcome': 1,
'/welcome/provider': 2,   // ← STALE
'/welcome/routing': 3,    // ← STALE
'/welcome/tools': 4,
'/welcome/integrations': 5,
```

But the ACTUAL visit order (after the 10.7-6 swap) is:
`language(0) → welcome(1) → routing(2) → provider(3) → tools(4) → integrations(5)`
— Step 1 (`page.tsx`) links to `/welcome/routing` first, routing links to
`/welcome/provider`.

The other two render sites already agree with the TRUE order:
- `routing/page.tsx`: eyebrow + footer say **"STEP 02 OF 06"**; `patchOnboardingState({current_step: 2})`.
- `provider/page.tsx`: eyebrow + footer say **"STEP 03 OF 06"**; `patchOnboardingState({current_step: 3})`.

So only the **header chip** (chrome.tsx `STEP_BY_PATH`) is wrong — it shows
"03" on the routing screen and "02" on the provider screen, the reverse of the
in-page eyebrow/footer.

**Fix (Phase C.4):** in `STEP_BY_PATH`, set `'/welcome/routing': 2` and
`'/welcome/provider': 3`. All three render sites then agree.

---

## Extra findings (logged)
- DE/EN mixing leaks into the **dashboard** too (New-Project modal: EN labels
  "Project Name"/"What are you building?" + DE type-cards "Was baust du?";
  project overview mixes EN tabs with DE body). Beyond `/welcome/*` scope per
  the stop-condition → scoped follow-up, not done this sprint.
- The Vercel "own-note" banner on Step 5 renders as a **gold fill on light**
  (design-system v1.1 flags gold-on-light). Tone down in Phase C.
- Post-onboarding lands on `/dashboard` with the New-Project modal AUTO-OPEN +
  a coach-mark tour. Evidence: `PHASE_0_dashboard_automodal.png` (Phase C.5).
