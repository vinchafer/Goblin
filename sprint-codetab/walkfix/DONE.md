# WALKFIX — founder walk fixes · DONE

Date: 2026-06-08 · Branch: master · Caveman build, normal-mode report.

Verdict legend: GREEN = done + verified buildable; AMBER = code done + traced, prod
walk pending; RED = not done / blocked.

---

## Phase 1 (P0) — the deployed site must reflect the edit — **AMBER** (code GREEN, live-walk pending)

**1.1 MAP** → `sprint-codetab/walkfix/DEPLOY_TRACE.md`. Save→deploy is path-coherent
(`/save` uploads the draft to S3 key `projects/{id}/{path}`; `/deploy` lists+ships
the same keys). The break is UPSTREAM: where the edit is *written*.

**Root cause:** `apps/api/src/lib/parse-code-blocks.ts:86-89` infers a
language-default name (`html→index.html`, `css→styles.css`) when the model returns
the edited file WITHOUT a filename comment. In edit-in-place mode the server then
persisted the draft at that default name, NOT at `activePath`
(`code-sessions.ts:435`). If the open file is named anything else, the edit lands in
a SIBLING file → editor foregrounds the new draft (looks applied) → save/deploy ship
the untouched original. Matches the founder repro exactly.

**1.2 FIX (surgical, loop shape unchanged):**
- `apps/api/src/lib/parse-code-blocks.ts` + `apps/web/lib/parse-code-blocks.ts`:
  `ParsedBlock.inferred` flag (true only on the language/scratch fallback).
- `apps/api/src/routes/code-sessions.ts:430-450` — in edit-in-place mode, retarget
  the first `inferred` block whose extension matches the active file to `activePath`
  before the draft upsert. Explicit names + new-project sends untouched.
- `apps/web/components/code/SessionPane.tsx` `buildReviews()` — same retarget so the
  review card + foreground match the persisted draft.

**1.3 VERIFY:** typecheck + prod build GREEN. **Live prod walk NOT run** (needs a
working publish → GitHub/Vercel connection, a logged-in vinc.hafner3 browser, real
taps; can't be done headless this pass). Per the standard, Phase 1 is GREEN only
with the live-edited-page screenshot → **flagged for founder walk**. No loop
restructuring was needed; fix is the lost-edit break only.

## Phase 2 (P1) — kill old settings · GitHub OAuth · keys — **AMBER** (code GREEN, OAuth round-trip pending)

**2.1 Retire old surface** — the English `SettingsLayout` pages now redirect into
the canonical sheet (can't resurface):
- `app/dashboard/settings/integrations/page.tsx` → `?settings=connectors`
- `…/keys` → `?settings=models` · `…/hosted` → `?settings=models`
- `…/appearance` → `?settings=appearance` · `…/notifications` → `?settings=notifications`
- `…/billing` + `…/billing/success` → `?settings=billing` · root `…/settings` → `?settings=profile`
- Left `…/local` + `…/routing` (advanced/dev, no sheet section — not the founder's
  consumer surface).
- New deep-link reader: `components/app-shell/dashboard-shell.tsx` reads
  `?settings=<sectionId>` on mount → opens the sheet/modal at that section (+ `#hash`
  for the desktop modal), strips the param.

**2.2 GitHub OAuth → NEW settings + connected:** `components/settings/ConnectorsPage.tsx`
`returnTo` changed `/dashboard/settings/integrations` → `/dashboard?settings=connectors`.
The callback (`apps/api/src/routes/github.ts:132`) already appends `&github=connected`
and honours `return_to`; it now lands on the sheet's Konnektoren, which re-reads
`/api/github/status` → shows Verbunden. (OAuth env is founder-managed; live
round-trip = founder walk.)

**2.3 Keys page slow + wrong:** `components/settings/ModelsPage.tsx` read connected
keys via a **client-side supabase** query (slow, RLS-dependent → "kein Key" though
Groq connected). Switched BOTH the Modelle connected-state read and the "Meine Keys"
tab to the authoritative `GET /api/byok-keys` (same source as the rest of the app).
A stored key = connected; liveness stays with the health gate/probe (a dead Gemini
key still shows connected, as specified).

## Phase 3 — close-the-loop verification + AMBER-7 preview — **RED (deferred)**
Requires the Phase-1/2 prod walk (live deploy + in-app preview render). Founder walk.

## Phase 4 (P2) — polish — **GREEN (code)**
- **4.1 `</>` code chip alignment:** `components/ui/icon.tsx` — Icon now renders with
  `vertical-align: middle` (SVGs default to baseline → sat low). Harmless in flex
  rows, corrects inline icon+text chips. `standalone-chat.tsx` `</>` glyph set
  `display:block`. (Verify against the founder screenshot on the walk.)
- **4.2 Picker auto-switch to dead Gemini:** `components/chat/ChatInput.tsx`
  `openHub()` no longer auto-selects the first BYOK model just on opening — Groq
  Llama (DEFAULT_MODEL) stays until the user picks. Also hardened
  `components/app-shell/model-switcher.tsx` mount default to prefer Groq Llama over a
  blind first-BYOK.

## Phase 5 — test recon — **GREEN** → `sprint-codetab/walkfix/TEST_INVENTORY.md`
41 Playwright specs (16 @public / 7 @auth / 22 @local-only), `loginAsTestUser` via
`/api/test-auth` (returns a provisioned projectId), vitest **70/70 GREEN** this pass,
CI = ci/e2e/performance/catalog-cron. **Build-flow gap confirmed:**
`full-flow-sprint7.spec.ts` asserts the Veröffentlichen *confirm dialog* only — no
test verifies the deployed page reflects the edit (the P0 path). Next pass: unit-test
the retarget + extend the @local-only flow to a real deploy assertion.

---

## Gates
- typecheck: web + api GREEN. Prod build: web `✓ Compiled` (exit 0), api tsc clean.
- vitest: 70/70. Playwright: NOT run this pass (needs running app + secrets);
  inventoried instead (Phase 5).
- Guards: loop fixed surgically, not rewired (DEPLOY_TRACE §fix). No invented data.
  vinc.hafner3 only (no walk performed here). Commits `WALKFIX-*`.

## For the founder walk (what to prove)
1. P0: edit a file → Übernehmen → Sichern → Veröffentlichen → open link → edit IS
   live (screenshot). 2. GitHub connect from settings → lands back in the sheet,
   shows Verbunden. 3. Keys page fast + Groq shows connected. 4. `</>` chip straight
   @390 + desktop. 5. Open the composer model picker with a Gemini key → stays Groq.
