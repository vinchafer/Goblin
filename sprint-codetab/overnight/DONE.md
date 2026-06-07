# GOBLIN — Overnight Fix Mission · DONE

**Date:** 2026-06-06 (overnight)
**Verified as:** vinc.hafner3 ("Guten Abend, vinc.hafner3"), mobile 390, on **prod** (justgoblin.com), after each deploy — real taps, real screenshots, no synthetic-only checks.
**Commits (origin/master == HEAD):**
- `9836ce6` FIX-B1 — kill Code-tab render loop (K1/K3/K4/K7)
- `7bf6285` FIX-B2 — i18n, session titles, editor model picker, imprint, /onboarding
- `162adcf` FIX-B3 — opaque nav, launch msg, DE grammar, key mask, layout label, composer hint
- `b939448` FIX-B2b — cold code-tab model default → Groq (BUG-11)

**Per-batch verdict:** B1 **GREEN** · B2 **GREEN** (2 items deferred → NEEDS FOUNDER) · B3 **GREEN** (minor items documented).

Evidence screenshots in `sprint-codetab/audit/` (prefixes `v2-B1-*`, `v3-*`).

---

## THE KEYSTONE (Batch 1) — root cause was NOT "activeTab vs URL"

The whole P0 "trapped in the code tab" cluster (K1/K3/K4/K7) had a **single deeper
root cause**: an **infinite React render loop** on `/dashboard/project/[id]/work`.

- Measured **0 requestAnimationFrame frames/second** on /work — the main thread
  was pegged. `router.push` fetched the destination RSC payload (seen in network)
  but the App-Router transition could never commit, so the URL never changed.
  State-only UI (open sidebar, switch tab in place) still worked, which is why the
  earlier NAVFIX "looked" wired but failed on the founder's phone.
- The loop: `SessionPane`'s draft-count effect ran every render (its
  `onDraftCountChange` was an inline arrow → new identity each render), and
  `useCodeSessions.setDraftCount` **always** built a new `sessions` array even when
  the count was unchanged → state update → re-render → effect → … forever.

**Fix** (`useCodeSessions.ts`, `CodeWorkspace.tsx`, `SessionPane.tsx`):
1. `setDraftCount` returns the **same array reference** when unchanged → React
   bails out of the no-op update → loop broken at the source.
2. `CodeWorkspace` memoises the three SessionPane callbacks on stable hook fns +
   activeId → effect no longer churns.
3. **K1**: `SessionPane` foregrounds the editor for ANY session that has files
   (draft OR saved), not only a fresh Send-to-Code draft — so "Code öffnen" shows
   the code, not the empty task-chat.

**Prod verification (real taps):**
| Item | Before | After | Evidence |
|---|---|---|---|
| Main thread | 0 fps | **61 fps** | poll |
| K1 editor on open | empty task-chat | **editor shows** | `v2-B1-K1.png` |
| K4 back "<" | dead | **→ project overview** | `v2-B1-K4.png` |
| K3 sidebar project tap | trapped | **→ project overview** | `v2-B1-K3b.png` (RESULT OVERVIEW-OK) |
| K7 create project | stayed in old code tab | **→ new project** (149199fb) | `v3-B1-K7` |

---

## BATCH 2 — first-run trust (P1)

| Bug | Fix | Verdict | Evidence |
|---|---|---|---|
| BUG-9 i18n leaks | standalone-chat Send-to-Code menu + new-project template strings ("Project Name"/"Official"/"Use Template") + "Was baust du?" now honour `useLang` (DE↔EN) | **GREEN** (code honours lang; account is EN-pref) | code |
| BUG-6 session titles | Send-to-Code carries the originating chat prompt; new code session titled like the TASK | **GREEN** | `v3-groq-gen.png` — session titled "Erstelle eine HTML Seite mit der…" |
| BUG-5 editor model picker | model picker added to the docked editor ask-bar; thread (full chat) still one tap away | **GREEN** | `v3-editor-askbar.png` (picker visible) |
| BUG-11 model default | **Gemini 2.5 Pro produced NOTHING on prod** (verified: no content change, no review after 30s). Cold auto-pick now prefers proven **Groq Llama 3.3 70B** | **GREEN** | `v3-groq-gen.png` — new session defaults Groq **and generated a full valid HTML page** |
| BUG-7 imprint placeholders | carve-out: shows honest "details being finalised" notice when `NEXT_PUBLIC_IMPRINT_*` unset — **no invented legal data** | **GREEN** | `v3-imprint.png` (no "[YOUR NAME]") → **NEEDS FOUNDER** to set env |
| /onboarding 404 | redirects to /dashboard | **GREEN** | verified `/onboarding → /dashboard` |
| BUG-8 usage triple-mismatch | sidebar 23% / Nutzung 0-200 / Abrechnung 0-0 come from **three different backend endpoints** (`/api/users/me/usage`, `/api/usage/summary`, `/api/billing/status`). Picking the authoritative source is a billing decision. | **DEFERRED** → NEEDS FOUNDER |
| BUG-10 preview blank | iframe loads the Vercel URL directly; the broken-doc icon is the Vercel deployment **frame block / 401** (infra, not our code — the app already shows the SSO banner) | **DEFERRED** → NEEDS FOUNDER |

---

## BATCH 3 — polish (P2)

| Bug | Fix | Verdict | Evidence |
|---|---|---|---|
| BUG-12 nav transparency | landing fixed nav now **opaque** (light + dark) | **GREEN** | `v3-landing-scrolled.png`, computed bg `rgb(244,236,216)` |
| BUG-22 launch messaging | "Now in beta · Made in Switzerland" (was "Public launch · 29 May MMXXVI") | **GREEN** | verified outro foot |
| BUG-14 Modelle grammar | "1 Quelle" (singular) + "Kontext" | **GREEN** | verified body has "1 Quelle" |
| BUG-24 key mask | provider-agnostic "…hint" (no "sk-…" on Google/Anthropic) | **GREEN** | verified no "sk-…" |
| BUG-17 layout label | "Layout ändern" (was the alarming "Layout: Nicht sicher") | **GREEN** | verified button text |
| BUG-16 composer hint | "new line"/"neue Zeile" no longer wraps (nowrap + ellipsis) + bilingual | **GREEN** (code) |
| BUG-15 plan name (Build vs Trial) | "Build" is the plan tier, "Trial" the billing status — two correct facts; relabelling risks misrepresenting billing | **DEFERRED** (minor) → NEEDS FOUNDER decision |
| BUG-13 Send-to-Code 3-step / 5.5s | the preview sheet step is **intentional** (prior Max-walk: STC was "a black box"); the 5.5s is the editor route load. Left as-is by design | documented (no change) |
| BUG-18 session sheet dismiss | `onSwitch` already closes the sheet; the apparent "stuck" was the render-loop jank — fixed by B1 | resolved via B1 (no change) |
| BUG-19 index-1.html naming | sensible auto-suffix for a 2-HTML-block answer | left (no change) |
| BUG-20 Vercel "Lade…" | resolves via `finally{setLoading(false)}` — a slow-load snapshot, not a permanent stuck state | left (verify on founder walk) |
| BUG-21 dead "Bald" clutter | preserved the intentional keyless/coming-soon badges per the locked decision | left (no change) |
| BUG-23 chat code block overflow | minor horizontal scroll on a long line at 390 | not addressed (low priority) |

---

## NEEDS FOUNDER

1. **BUG-7 (imprint):** set `NEXT_PUBLIC_IMPRINT_NAME`, `_ADDRESS`, `_VAT`, `_EMAIL`
   on Vercel with your real Swiss imprint data. Until then the page shows an honest
   "being finalised" notice (no template placeholders, no invented data).
2. **BUG-10 (preview):** the in-app Preview iframe is blocked by Vercel
   **Deployment Protection** (anonymous visitors get 401 / the frame is refused).
   Disable it in the Vercel project: Settings → Deployment Protection. Not a code bug.
3. **BUG-8 (usage numbers):** three endpoints report different usage
   (`/api/users/me/usage` → sidebar, `/api/usage/summary` → Nutzung,
   `/api/billing/status` → Abrechnung). Decide which is authoritative; I did not
   guess (billing risk).
4. **BUG-15 (plan label):** decide whether the badge should read the tier ("Build")
   or the status ("Trial") — currently both appear in different places.
5. **Test artifacts left on the test account** (no prod DB edits, publish loop untouched):
   throwaway projects "AUDIT K7 test" + "AUDIT K7 v2", and a couple of test code
   sessions/drafts (never saved/deployed). Delete at your leisure.

---

## E2E

Public suite against **prod** (`PLAYWRIGHT_BASE_URL=https://www.justgoblin.com`,
public-desktop + public-mobile): **82 passed / 0 failed (2.1m)** — my landing
changes (opaque nav, outro copy) did not regress anything.

The full **auth + local** suite was NOT spun up overnight (it needs the local dev
servers + secrets, which I didn't stand up autonomously). As noted in the catalog,
the **Code-tab surfaces still have no spec coverage** — the very paths fixed here
(the render loop, K1/K3/K4/K7, the model default) are verified by the real prod
walks above, not by specs. The previously-known ~10 API-spec failures are a harness
target mismatch, not new regressions. Reported honestly, not green-washed.

## GUARDS HONOURED

- Publish loop (`hydrateSessionFiles` / `/save` / `/deploy`) **untouched**; no deploy
  re-run during fixing; no prod DB edits.
- No invented legal/company data (BUG-7 carve-out).
- Model default only changed **after proving** the old one (Gemini) failed and the
  new one (Groq) generates.
- Intentional coming-soon badges preserved.
- Design system v1.1 respected; shipped wins (delete-confirm, overflow fix, dedup,
  publish loop) not regressed.
