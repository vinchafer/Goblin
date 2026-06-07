# Goblin — Round 3: BUG_CATALOG_V2 fixes — DONE

**Walked:** 2026-06-07, prod `https://goblin-web.vercel.app`, mobile **390**, logged in as
**vinc.hafner3** (greeting "GUTEN MORGEN, VINC.HAFNER3" — never personal). Real taps,
real screenshots in `sprint-codetab/round3/screens/`.

**Deployed:** `origin/master == HEAD == 9acc965`. Web on Vercel, API on Railway (auto-deploy).
Typecheck (web + api) PASS, prod build (web + api) PASS.

**Guards:** publish loop (`hydrateSessionFiles`/`/save`/`/deploy`) untouched and **not
triggered** (no real deploy created — see FIX 7). No invented data. Groq Llama 3.3 70B
remains the working default (verified — pill + every chat shows it). Walked as vinc.hafner3.

---

## Per-fix verdicts

| Fix | Item | Verdict | Evidence |
|-----|------|---------|----------|
| FIX 1 | Model-ranking health-gate | **AMBER** | gate shipped; breaker reports google healthy so Gemini still listed — Gemini liveness unconfirmable (see below). `screens/r3-fix1-rankings.png` |
| FIX 2 | STC → Neues Projekt one-step | **GREEN** | "Alle senden" → new project code tab in ~2s, no form; both files present. `screens/r3-stc-sheet.png`, `screens/r3-stc-reload.png` |
| FIX 3 | Build/Pro = Unbegrenzte Projekte | **GREEN** | pricing shows "Unlimited projects" ×3, no "10/50 projects". `screens/r3-fix3-pricing.png` |
| FIX 4 | One display name everywhere | **GREEN** | Profil: heading + Vollständiger Name + Anzeigename all "Vincent 476" (was 418 vs 286). `screens/r3-desk-picker2.png` |
| FIX 5 | Preview CTA reflects connection | **GREEN** | empty-state shows single "GitHub verbinden →" (Vercel already connected → no add-token). `screens/r3-fix5-preview.png` |
| FIX 6 | Code-tab toolbar fits 390 | **GREEN** | filename min-width:0 + labels→icons + overflowX:auto; nothing extends past 390, actions scroll. `screens/r3-fix6-after.png` |
| FIX 7 | Preview graceful (no broken icon) | **AMBER** | honest "In Vercel öffnen" panel shipped; public-render path needs a deployed project (account has GitHub disconnected → can't publish). |

E2E: **@public 82/82 passed vs prod** (`public-desktop` + `public-mobile`). Honest gap
**unchanged**: the code-tab / build-flow surfaces still have **no spec coverage** — verified
by hand this round (STC, editor, ask-bar, diff-apply), not by tests.

---

## FIX 1 — Gemini liveness outcome (the verify-first)

**Honest result: UNCONFIRMED this pass.** I could not obtain a clean Gemini-via-BYOK
generation on prod:

- Earlier attempts returned **"Deine Sitzung ist abgelaufen"** (an *auth* error, pre-routing)
  with no model output, while Llama-via-BYOK answered "Pong" in the same session — so those
  Gemini failures were **auth-level, not model-level**, and did **not** prove Gemini dead.
- Clean retries were blocked by **two real UI bugs found this round** (see new findings):
  the mobile **model-picker won't close**, and the **settings sheet persists over
  navigation** — both made it impossible to reliably fire a Gemini send + read the result.

**What shipped (correct mechanism, currently dormant):**
- `RankingsTab` now consumes `/api/models/health` (the circuit-breaker). A provider the
  breaker reports **'down'** is filtered from "Nur nutzbare", badged **"Nicht verfügbar"**,
  and its **"Standard setzen" is disabled** — a user can no longer one-tap into a model the
  system knows is dead.
- `/api/models/health` now **merges the last persisted `provider_health_events` state**
  (6h window) so a known-down provider stays gated across cold restarts.

**Why it's AMBER, not GREEN:** the breaker requires ~10 routing failures / 5 min to trip,
and Gemini isn't exercised enough on this low-traffic beta to trip it (and my own failed
sends were auth-level, so they didn't register as model failures). So the live signal says
**google = healthy** → the ranking still shows Gemini #4 with "Standard setzen"
(`screens/r3-fix1-rankings.png`). The gate is sound for **sustained** real failures; it is
simply dormant while the signal is clean.

**The cold-default — the most important protection — is safe:** a new chat defaults to
**Groq Llama 3.3 70B**, never Gemini (verified on every chat this round).

**Recommendation (founder decision):**
1. If Gemini-via-BYOK is in fact dead → add a **liveness preflight on "Standard setzen"**
   (a 1-token probe; refuse + explain on failure). Deterministic, not hardcoded — the only
   way to gate a low-volume dead model regardless of breaker warmth.
2. If Gemini-via-BYOK actually works → no further action: the ranking listing it is correct,
   and the cold auto-default is already Groq.

---

## New findings this round (NOT in scope; surfaced honestly)

- **NEW-1 (P1) · Mobile model-picker won't close.** In a chat at 390, opening the composer
  model picker and selecting a model (or pressing Esc, or re-tapping the pill) leaves the
  picker overlay open, covering the composer — you can't type/send until you navigate away.
  Blocked the Gemini test repeatedly. `screens/r3-gemini-final2.png`.
- **NEW-2 (P2) · Settings sheet persists across navigation.** Opening Settings then
  navigating (URL or in-app) keeps the sheet stacked over the destination; a fresh tab is
  needed to clear it. Same class as the old SheetStack-state issue.
- **NEW-3 (P2) · STC files render one beat late.** After STC→Neues Projekt lands in the
  code tab, the editor briefly shows the empty state; the files appear after the view
  settles / a reload. Files are correctly created server-side (verified) — purely a
  first-render hydration timing nit.

---

## Deferred (founder decisions pending — untouched, as instructed)

- V2-P2-1 public-pages language (EN vs DE) — strategy call.
- V2-P2-5 Build $9 / 200 requests value — pricing call.
- V2-P2-6 "Letzte Chats: keine Chats" — project-scoped, behaviour unchanged.

---

## Commits (all pushed, origin/master == HEAD == 9acc965)

- `0fa2cb3` FIX3-1 health-gate rankings (web) + persisted health read (api)
- `25aab45` FIX3-2 STC Neues Projekt one-step
- `9280d3f` FIX3-3 Unbegrenzte Projekte (pricing)
- `5c3b8bc` FIX3-4 canonical display name
- `3cc292f` FIX3-5+7 preview CTA + honest "In Vercel öffnen" panel
- `e265981` FIX3-6 toolbar fit (min-width / icon labels)
- `9acc965` FIX3-6b toolbar overflowX scroll + flex-shrink (no clip)
