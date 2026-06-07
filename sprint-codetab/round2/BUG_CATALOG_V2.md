# Goblin — Round 2 Phase-2 Re-Audit (BUG_CATALOG_V2)

**Walked:** 2026-06-07, prod `https://goblin-web.vercel.app`, real taps, mobile **390×844**,
logged in as **vinc.hafner3** (greeting "GUTEN MORGEN / ALOHA, VINC.HAFNER3" — never personal).
Screenshots in `sprint-codetab/round2/screens/` and `audit/out/`.

**Method:** skeptical first-time-user walk, every surface tapped, real Groq build driven
end-to-end (generate → Send-to-Code → edit → review → apply). Phase-1 fixes re-confirmed
live (not assumed). **Nothing here is fixed** — this is the surface for the next prompt.

Guards held: publish loop (`hydrateSessionFiles`/`/save`/`/deploy`) untouched and not
triggered (no real deploy created); no invented data; walked as vinc.hafner3.

---

## A. Severity summary

| Sev | Count | Headline |
|-----|-------|----------|
| P0  | 0     | Core build flow works end-to-end. No hard blockers found this round. |
| P1  | 3     | Model rankings steer to proven-dead Gemini; STC→new-project detour; pricing/feature contradiction. |
| P2  | 6     | Lang mix (EN public / DE app), preview CTA, random display names, toolbar clip, paid-plan request cap, project-count claim. |

Honest re-rating (strict): **Code tab 8/10**, **Core build flow 7.5/10** (see §D).

---

## B. Phase-1 fixes — re-verified LIVE (regression check)

| Item | State | Evidence |
|------|-------|----------|
| 1.1 Imprint | **GREEN** | `/imprint` renders "Impressum / Goblin / Alte Bahnhofstrasse 3, 7250 Klosters, Schweiz / vincent@justgoblin.com / Verantwortlich: Goblin". No "[YOUR NAME]", no "being finalised", no invented VAT. `screens/r2-imprint-new.png` |
| 1.3 Usage one-source | **GREEN** | Nutzung now "Goblin-Anfragen **46 / 200**" + "Über deine Keys (BYOK) **22 Anfragen**" (honest count, no fake %). Matches sidebar 23% (=46/200) and reset "6 Tagen". `screens/r2-nutzung4.png` |
| 1.4 Plan label | **GREEN** | "Vollzugriff" consistent across ProfileCard, Abrechnung, profile pill, and (after follow-up fix 4b) the Verbrauch widget. Was "Build" (settings) vs "Trial" (sidebar) before. `screens/r2-settings-open.png`, `screens/p2-sidebar-comped.png` |
| 1.5 Code overflow | **GREEN** | 2-block Groq answer at 390: block stays 305px, an **11,856px** line scrolls *inside* `.cb-body`, page `scrollWidth==390` (no clip). `screens/r2-cb-chat.png` |
| 1.6 Connectors spinner | **GREEN** | Konnektoren → Vercel subtitle resolves to account name "vinchafner2-1996", never stuck on "Lade…"; 8s abort-timeout added. `screens/r2-konn-settled.png` |
| 1.2 Preview | **AMBER / founder** | Proposal delivered (`PREVIEW_PROPOSAL.md`). Live bypass not built — the deploy loop already disables protection (public-by-default); a true fix touches the loop. Preview empty-state is clean. |

---

## C. New issues (Phase 2)

### P1

**V2-P1-1 · Model rankings recommend proven-dead Gemini as the default choice**
- Surface: Settings → Modelle → Rankings (`components/settings/ModelsPage.tsx`).
- Repro: open Modelle. Top "Coding" ranks are **#4 gemini-2.5 (Score 95, MEIN KEY)**, #8
  gemini-2.5 (91), #12 Gemini 2.5 (88), #17 Gemini 2.5 (82) — each with a **"Standard
  setzen"** button. "Nur nutzbare Modelle" toggle is **ON** yet all four Gemini entries
  show. The working default (Groq Llama 3.3 70B) is not visible in the top ranks.
- Why it matters: yesterday proved **Gemini is dead on prod** and the default was moved to
  Groq for exactly this reason. A user optimizing by the ranking will click "Standard
  setzen" on Gemini #4 and set a **failing default** — re-introducing the Sprint-8/9 dead-loop
  for themselves. The ranking sorts by benchmark score, blind to prod routing reality.
- Suspected cause: rankings come from external benchmarks; no liveness/health gate is
  applied to what's marked "nutzbar" or surfaced for "Standard setzen".
- Screenshot: `screens/p2-modelle.png`
- Note to verify before fixing: these are "MEIN KEY" (user's own Gemini BYOK). Confirm
  whether Gemini-via-user-key actually generates on prod, or fails like the hosted path —
  that decides whether to hide/deprioritize vs. health-gate.

**V2-P1-2 · Send-to-Code → "Neues Projekt" detours into the full creation form**
- Surface: StandaloneChat → "Code-Aktionen" → "An Code senden" → target "+ Neues Projekt"
  → "Alle senden" (`components/chat/standalone-chat.tsx`, intent/new-project flow).
- Repro: from a quick chat with code, Code-Aktionen → An Code senden → preview sheet shows
  "2 Dateien" correctly → "Alle senden" routes to `/dashboard?start=1` then pops the **full
  New-Project form** (name, "Was baust du?", colour, "Projekt erstellen"). The user clicked
  "send code", not "create a project from scratch".
- Why it matters: the STC promise ("send to code") doesn't directly deliver into a code tab
  when no project exists; the user lands in an unrelated-feeling form and it's not obvious
  the 2 files are pending. (They *do* materialise as a code session when you later open Code
  in a project — verified — but the path is confusing and easy to abandon.)
- Screenshots: `screens/p2-stc-3.png` (preview), `screens/p2-newproj-state.png` (form).

**V2-P1-3 · Pricing/feature contradiction for the Build plan**
- Surface: `/pricing` vs `components/settings/BillingPage.tsx` PLAN_FEATURES.
- Repro: pricing page Build = "**10 projects**"; BillingPage Build features = "**Unbegrenzte
  Projekte**". Same plan, opposite claims.
- Why it matters: a paying user sees two different promises for the same tier — trust hit,
  and a support/refund risk.
- Screenshot: `screens/p2-pub-pricing.png`

### P2

**V2-P2-1 · Public/footer pages English while the app is German**
- Landing, Pricing, Terms, Privacy, Help all render in English; the in-app shell (dashboard,
  settings, code tab) is German for vinc.hafner3. Public pages don't follow `preferred_lang`.
- Likely intentional for marketing, but the help/legal pages reading EN under a DE app is a
  jarring seam. Screenshot: `screens/p2-pub-help.png`.

**V2-P2-2 · Preview empty-state CTA wrong for already-connected Vercel**
- Surface: `components/preview/preview-tab.tsx` (no-previewUrl branch).
- For a user with Vercel already connected (we saw "Trennen"), the empty state still leads
  with "**Vercel-Token hinzufügen →**". The real next step is push/deploy, not adding a token.
- Screenshot: `screens/p2-preview.png`.

**V2-P2-3 · Random display-name suffix is inconsistent across surfaces**
- Profile pill shows "**Vincent 418**"; Settings → Personalisierung → ANZEIGENAME shows
  "**Vincent 286**". Different random numbers in the same session → looks broken/unstable.
- Suspected: a randomised fallback display name generated per-surface instead of once.

**V2-P2-4 · Code-tab secondary toolbar clips at 390**
- Surface: code session toolbar (the row of menu/search/undo/redo/copy/close icons).
- At 390 the rightmost control is cut off at the screen edge (a partial "○"/icon past the
  "×"). Functional but visibly clipped. Screenshot: `screens/p2-code-applied.png` (top row).

**V2-P2-5 · Build plan ($9) advertises only "200 AI requests / month"**
- `/pricing` lists the paid Build plan with "200 AI requests / month" — identical to the
  free 3-day trial allowance. Reads as poor value for a paid tier (product decision, not a
  bug, but worth a deliberate call). Screenshot: `screens/p2-pub-pricing.png`.

**V2-P2-6 · Project overview "Letzte Chats: Noch keine Chats" may under-report**
- On AUDIT K7 test overview, "Letzte Chats — Noch keine Chats" though chats exist elsewhere
  for the account. Possibly correct (project-scoped) but worth confirming the scoping is
  intended vs. a missed join. Low confidence.

---

## D. Content / flow / settings judgement (quality, not just bugs)

**What feels finished and good**
- **Core build flow is real and satisfying.** Drove a true Groq build: chat → 2 code blocks
  → Send-to-Code preview ("2 Dateien", correct file types) → opened in the code editor →
  ask-bar "Füge eine H1 hinzu" → ~20s → a clean **diff sheet** ("index.html · +2 −1",
  red/green) → "Übernehmen" → editor updated with `<h1>Hallo Welt</h1>`, multi-file tabs
  (app.js, index.html) with unsaved dots. This is the heart of the product and it works.
  (`screens/p2-code-edit.png`, `screens/p2-code-applied.png`.)
- **Code editor on mobile is genuinely good**: line numbers, soft-wrap of long lines (no
  page overflow), file tabs, search/undo/redo, ask-bar, Groq model pill, GitHub/Save/Run.
- **Plan/usage is now coherent** after Phase 1 — sidebar, Nutzung, Abrechnung, profile all
  say the same true thing ("Vollzugriff", 46/200, 22 BYOK). Big trust win vs. yesterday.
- **Landing & pricing are on-brand and confident** ("Tell it what you want. It ships.").
- **Help/FAQ content is clear** and the "help agent" hook is a nice touch.
- **Empty states are calm and instructive** (Preview 3-step guide, Code "Noch keine Session").

**Where it still feels unfinished / loses trust**
1. **Model guidance contradicts product reality (V2-P1-1).** The single most trust-eroding
   thing: the app's own ranking tells the user the best model is Gemini and offers a
   one-tap "Standard setzen", when Gemini is the known-dead path. The product is steering
   users into the failure it just fixed.
2. **Send-to-Code's "no project yet" path is muddy (V2-P1-2).** The strongest feature
   (turn chat into code) has its weakest moment exactly when a first-time user would use it
   (no project yet) — it detours into a form instead of just landing the code.
3. **Cross-surface inconsistency** (pricing vs billing features; random display names;
   EN public vs DE app) makes the product feel assembled rather than authored. Individually
   minor, collectively they read as "not quite finished".
4. **Preview is still a dead-end for most projects** — without a deploy there's nothing to
   show, and the path to a first deploy is the unresolved BUG-10 area (see proposal). A
   first-time user "builds" something but can't *see* it in-app until they push+deploy.

**Settings judgement**
- Structure is sensible (Konto / Goblin / Design groups; Profile card on top).
- Modelle is powerful (Rankings / Meine Keys / Erweitert, benchmark-driven) but its power is
  also the V2-P1-1 trap.
- Nothing pointless spotted; "Bald verfügbar" connectors are honest about scope.

**Strict re-rating**
- **Code tab: 8/10** — the editor + ask-bar + diff-apply loop is real, fast, mobile-correct.
  Docked for the toolbar clip (P2-4) and that Preview can't render most projects in-app.
- **Core build flow: 7.5/10** — generate→edit→review→apply is solid; docked for the STC
  new-project detour (P1-2) and that the model guidance can send users into a dead model
  (P1-1) before they ever reach "apply".

---

## E. Recommended fix order (Round 3)

1. **V2-P1-1** — health-gate the model rankings: hide/deprioritise non-generating models, or
   badge them "derzeit nicht verfügbar"; never offer "Standard setzen" on a dead model. Keep
   Groq Llama visible as the safe default. (First — it's the active trust+function risk.)
2. **V2-P1-2** — make STC "Neues Projekt" create the project and land the files in the code
   tab in one step (or a 1-field name prompt), not the full creation form.
3. **V2-P1-3** — reconcile Build-plan claims (pick one: "10 Projekte" or "unbegrenzt") across
   `/pricing` and BillingPage.
4. **V2-P2-3** — generate the display-name fallback once (server/profile), not per surface.
5. **V2-P2-2** — Preview empty-state CTA reflects actual connection state (push/deploy vs add
   token).
6. **V2-P2-4** — fix code-tab toolbar clip at 390.
7. **V2-P2-1 / P2-5 / P2-6** — lang strategy for public pages; paid-plan request cap call;
   confirm project-scoped chat reporting.
8. **BUG-10 / Preview** — founder decision on `PREVIEW_PROPOSAL.md` (visibility dialog +
   private-preview proxy) — the real "see what I built" fix.
