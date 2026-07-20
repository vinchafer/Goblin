# U1 (P0) — Onboarding→Dashboard loop in the installed PWA · DIAGNOSIS + FIX

**Founder-Walk-1 · branch `claude/founder-walk-1-srdrp9` · reproduce-first, root-fix.**

## Founder evidence (prod, ground truth)
- Installed PWA on iPhone (his own walk): signup → onboarding runs → after completing
  onboarding the app is stuck in a loading loop (spinner reappears), the dashboard is
  **never** reached.
- The **same account** in a normal Safari tab: login → lands **directly on the dashboard**
  (onboarding already marked complete).
- ⇒ Onboarding completion **persisted** (DB write succeeded), but the post-onboarding
  **transition into the dashboard** fails **specifically in PWA standalone mode**.
- Founder framing: "Wir hatten das schon mal" — the F-05 family (post-auth handshake race,
  fixed for the browser in FW3).

## 1 — The exact post-onboarding transition (mapped in code)
On "Finish" (`app/welcome/build/page.tsx`):
1. `document.cookie = onboardedCookieString()` → writes `goblin_onboarded=1; path=/; max-age=1800; SameSite=Lax`.
2. `await patchOnboardingState({ current_step: 4, completed: true })` → **DB write** (best-effort, service role, via the cross-origin Railway API).
3. `router.push('/dashboard')` → **soft** client navigation (RSC fetch to the server).

Two guards then read the SAME `onboarding_steps.completed` flag through **different** clients:
- **Back leg** `app/dashboard/layout.tsx:67-89` — server, **USER-scoped SSR** client (RLS applied):
  a stale/RLS-filtered `false` → `redirect('/welcome/language')`.
- **Forward leg** `app/welcome/_components/chrome.tsx:65-80` — client, **service-role** API read
  (RLS bypassed): `true` → `router.replace('/dashboard')`.

The FW3 loop-breaker (`lib/onboarding-gate.ts`): the client sets the `goblin_onboarded` cookie
*before* navigating; the back-leg guard treats its presence (`justOnboarded`) as authoritative and
never bounces back — the loop is mathematically impossible **as long as the guard actually sees the
cookie**.

## 2 — What is DIFFERENT in PWA standalone (root cause)
The FW3 handshake has **exactly one channel**: a **client-written `document.cookie`** that the SSR
back-leg guard must read back on the very next navigation. That single channel is the one thing that
is **not reliable in an installed iOS PWA**:

- Standalone WebKit applies **stricter/partitioned cookie storage + ITP** than a Safari tab, and a
  JS-written cookie may not be **committed/sent** before the immediately-following RSC navigation
  request fires. (`SameSite=Lax`, no `Secure`, set-then-navigate — the fragile pattern.)
- When that sole loop-breaker goes missing, the back-leg guard sees **no cookie AND a stale
  `completed === false`** → `redirect('/welcome/language')`. The forward leg reads **fresh-true**
  (service role) → bounces back to `/dashboard`. **Endless oscillation = the founder's spinner loop.**
- In a **Safari tab** the JS cookie **is** reliably sent with the next navigation → the guard sees
  `justOnboarded` → the loop breaks → the dashboard is reached. **Exactly the founder's split.**

Completion **persisted** because step 2 (the DB write) is independent of the failed *transition* — which
is precisely why Safari later shows "already onboarded."

This is the FW3 fix's blind spot: it covered the **browser** post-auth flicker, but its loop-breaker
**mechanism** (a JS cookie read cross-navigation) is the single point of failure a PWA can silently drop.

**File:line anchors**
- `apps/web/lib/onboarding-gate.ts:75-84` — the cookie is the sole handshake channel.
- `apps/web/app/dashboard/layout.tsx:72-85` — back leg reads ONLY the cookie for `justOnboarded`.
- `apps/web/app/welcome/build/page.tsx:30-34` — sets the JS cookie, then a bare `router.push('/dashboard')`.
- `apps/web/app/welcome/_components/chrome.tsx:69-73` — forward leg, same set-cookie-then-navigate pattern.

## 3 — Deterministic reproduction (failing-then-passing)
`lib/onboarding-gate.test.ts` adds an installed-PWA model that **drops the client cookie** (the standalone
condition) and keeps the DB read stale-false (the pathological case), then iterates the two guards:
- **WITHOUT** the storage-independent channel → the modelled exit **oscillates** (welcome ↔ dashboard,
  hits the iteration cap) — documents the founder bug.
- **WITH** the channel (URL signal promoted to the cookie) → the exit **settles on `/dashboard`
  immediately**.

Both `hasOnboardedSignal` / `shouldPromoteOnboardedCookie` are **new** — the file does not compile on
current master, so these probes are red on master and green after the fix. Result: **13/13** in
`onboarding-gate.test.ts` (was 8/8), `tsc --noEmit` clean.

## 4 — The fix (root; extend F-05, do not fork)
Add a **second, storage-independent channel** that rides the navigation itself and cannot be lost to
cookie partitioning/ITP: a `?onboarded=1` query signal on the post-onboarding navigation. `middleware.ts`
**promotes** it into the **same** `goblin_onboarded` cookie — set on **both** the forwarded request (so
the dashboard layout reads it THIS pass, mirroring the Supabase SSR cookie pattern already in that file)
and the response (so it persists, server-committed, which standalone WebKit **does** honor). Same cookie,
same gate — just a channel a PWA can't silently drop. The JS `document.cookie` write stays as the fast path.

Touched (each within U1 scope):
- `lib/onboarding-gate.ts` — `ONBOARDED_SIGNAL_PARAM/VALUE`, `DASHBOARD_ONBOARDED_URL`, `hasOnboardedSignal`, `shouldPromoteOnboardedCookie` (pure, testable).
- `middleware.ts` — promote URL signal → durable cookie on request + response.
- `app/welcome/build/page.tsx`, `app/welcome/_components/chrome.tsx` — navigate to `DASHBOARD_ONBOARDED_URL` instead of a bare `/dashboard`.
- `lib/onboarding-gate.test.ts` — the standalone repro + promotion probes.

**Robust across the candidate causes** the founder walk could not disambiguate on-device: it fixes (a)
cookie-in-standalone (a server-set cookie beats a JS-set one), (b) the middleware↔flag bounce (middleware
now breaks it positively), and (d) a stale user-scoped read (the URL signal is authoritative,
DB-independent). No sleep/retry cosmetics.

## Regression safety
- Normal-browser onboarding + login paths are untouched: the JS cookie fast-path still fires, and the
  existing 8 FW3 probes (non-standalone) stay green.
- Middleware promotion is **idempotent** and gated on the signal being present — it is a no-op on every
  request that isn't the post-onboarding hop.
- `?onboarded=1` is a transient, harmless param; the cookie does the work and self-expires in 30 min.

## Honest-Limitations
- The **exact** WebKit reason the JS cookie is missing in standalone (ITP partitioning vs. uncommitted
  write vs. SW-mediated navigation) is **founder-device-confirmable only** — a headless browser cannot
  reproduce true iOS "Add to Home Screen" standalone cookie behavior. The diagnosis holds because the
  founder split (Safari works / PWA loops / completion persisted) is the *signature* of the single cookie
  channel failing while the DB read stays stale, and the fix removes that single point of failure
  **regardless of which storage quirk causes it**.
- **Founder action:** on the TEST account (`vinc.hafner3@`, never the personal account), fresh signup in
  the installed PWA → onboarding → confirm the dashboard is reached with **no spinner loop**.
