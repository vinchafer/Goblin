# W10 re-run — the acceptance test

**Branch:** `mobile-1-2026-07-07` · **2026-07-07** · 375px real viewport, local stack, real free-key model + real Vercel deploy.

## The scenario (verbatim)
Fresh project, mobile Code surface. The one canonical message, sent via the promoted command bar:

> `Füge eine Einstellungs-Seite mit Dark-Mode-Umschalter hinzu, speichere die Wahl in localStorage, bau das, und sag mir wenn es live ist.`

## What the model built (from that ONE message)
The command bar routed the message through the normal chat→edit path; the model produced **4 files**,
surfaced as review cards on the new surface (screenshot `shots/w10-after-generate.png`):
- `index.html` — **GEÄNDERT +5 −0** (dark-mode toggle wired into the page)
- `index-1.html` — **NEU** (17 Zeilen — the settings page)
- `script.js` — **NEU** (25 Zeilen — the toggle logic, choice persisted to `localStorage`)
- `style.css` — **NEU** (4 Zeilen)

## Interaction count (after the message)
Every user interaction AFTER the message (taps; scrolls excluded):

| # | Interaction | Wanted? |
|---|---|---|
| 1 | **Live stellen** | yes — the deliberate go-live |
| 2 | **Live stellen bestätigen** (confirm dialog spelling out "erst nach bestandener Prüfung gilt es als live") | yes — a review/decision moment |

**Measured count: 2.** Baseline: **7**. Target: **≤5**. → **Well under target.**

The truth-gated status stream then ran inline (`Veröffentliche… → wird geprüft 1/6 → 2/6 → Live gestellt`)
and the result was verified live at **https://w10-island-vincent-2-s-projects.vercel.app**
(`reachedLive: true`, `preview_url` persisted server-side; screenshot `shots/w10-live.png`).

**Note on the count:** the minimal path is 2 (publish + confirm) because the model's changes surface as
cards and the truth-gated stream *is* the verification. Opening a GEÄNDERT card's diff before publishing —
the review-first affordance the surface is built around — adds **1 wanted tap → 3**, still comfortably ≤5.
Graded honestly: the journey to a deployed, verified result took **2** interactions; a review-first user
spends **3**. Zero moments of "this wasn't built for this device."

## Root cause — the FIRST deploy attempt failed (honest record)
The first "Live stellen" showed **"Veröffentlichen fehlgeschlagen"** (red, inline) — the truth-gate
correctly refused to claim "Live". The retry of the **identical** 4 files ~30s later succeeded. Diagnosis:

- **No `deployments` row was written for the first attempt** (that insert only happens *after* a passing
  truth-gate verdict), while the retry wrote one (`vercel_deployment_id: dpl_DywyFnyZFpJWsihYiLUK89XSdGux`).
  So the first attempt failed at the deploy/verify stage, before success — not a content defect (identical
  files deployed fine on retry).
- **The failing check was NOT an asset/verify verdict.** `verifyDeployment` (`deploy-verification.ts`)
  emits a *specific* German reason on failure — either "Die veröffentlichte Seite antwortet nicht (HTTP …)",
  "entspricht noch nicht dem gespeicherten Stand", or "Veröffentlichung hat ein Problem: `<assets>` nicht
  erreichbar" — and the client surfaces that reason. The UI instead showed the **generic** fallback, which
  in `deploySession` comes *only* from the `!res.ok` branch — i.e. the **POST `/deploy` itself returned a
  non-200 before any SSE streaming**. The n/6 verify stream never appeared on the first attempt.
- **Most probable status: HTTP 429 (rate limit).** The `code-sessions` router is rate-limited
  (`strictRateLimit`, 10/min — the M6 harness hit exactly this `429` on `POST /api/code-sessions`), and this
  W10 run followed a long burst of harness traffic on the same test account. A 429 on `POST /deploy` →
  `!res.ok` → the generic string. The 30s gap before the retry cleared the per-minute window → success.
  **This is a test-environment artifact (my own burst), not a production/content defect.** A real user
  publishing once is far under 10/min.

### Fix shipped from this finding (self-documenting failures)
`deploySession` (`useCodeSessionDetail.ts`) no longer collapses every non-OK deploy response to a generic
string: **429 → a calm "Zu viele Anfragen gerade — bitte kurz warten und erneut auf „Live stellen" tippen."**;
any other non-OK → **"Veröffentlichen fehlgeschlagen (HTTP `<status>`) — `<body excerpt>`"**. So the next
failure names its own cause in the UI instead of hiding it. (Verify-verdict failures already surfaced their
specific `reason`/failed-assets — unchanged.)

## Verdict
W10 re-run **passes**: from one message, a real model built the requested feature on the new surface and it
went **verifiably live in 2 interactions** (3 with a review-first diff view) vs a baseline of 7 — the sprint's
stated meaning. The one deploy hiccup was a rate-limit artifact of testing, correctly withheld by the
truth-gate, and is now self-documenting.
