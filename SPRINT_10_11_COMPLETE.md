# Sprint 10.11 — Make the Loop Actually Work — COMPLETE

> Date: 2026-06-04/05. Branch: master. Quality bar 9.5. Evidence in
> `sprint-10-11/`. Two critical correctness bugs fixed before any polish.

## TL;DR
Both critical bugs are **root-caused with proof** and **fixed in code**:
1. **Conversation memory** was dead in the standalone (default) chat because the
   `standalone_messages` table does not exist in prod. Migration `0065` creates
   it; the route now surfaces the failure instead of faking amnesia. *Proven
   live on prod.*
2. **Onboarding key never persisted** because the save POSTed to
   `/api/byok-keys/` (trailing slash → 404 under strict Hono) and swallowed the
   error. Now posts to the exact working Settings endpoint. *Root cause proven
   with a local Hono test.*

Step-01 restructured to A/B/C with an honest COMING-SOON "Goblin model" teaser;
the false "20 requests left" banner is gated off. Six re-walk fixes landed,
five visually verified on a local prod-data build (incl. the mobile toggle at
390px in both states). **One blocker for the founder: apply migration 0065 +
redeploy** (this session's DB password is stale; no management token).

Commits (all pushed): `7b7c64b` (0), `2122a3d` (A), `0c683b2` (B),
`48ec419` (C), `85782ed` (C.4 root-cause fix + evidence).

---

## PHASE 0 — Conversation context (CRITICAL) — DONE, prod-proven
**Root cause (file:line):** `public.standalone_messages` missing in prod. It
lived only in the manual `scripts/migrate-chat-sessions.sql` (10.7), never
promoted to a formal migration; `chat_sessions` reached prod, the messages
table did not. `routes/chat-sessions.ts` did not check insert/select errors, so
every turn silently lost history → the model saw only the latest message.
Assembly itself is correct (`model-router.ts:316`). Full write-up:
`sprint-10-11/PHASE_0_ROOTCAUSE.md`.

**Prod table probe:** standalone_messages = 404; chat_messages (61),
code_session_messages (8), code_session_files (8) all present.

**Live proof (prod, vinc.hafner3, Groq):**
- Standalone chat: "build a newsletter landing page" → "make the heading bigger"
  → model: *"which heading? …more context?"* — **NO memory**
  (`context-3turn/turn1.png`, `turn2.png`).
- Code tab (tables present): "mach den Hintergrund blau" on the open newsletter
  session → understood context, wrote `styles.css` with `background-color:
  #0000ff` as a reviewable draft — **memory + edit-in-place WORK**
  (`context-3turn/code-blue-result.png`, `code-styles-css.png`).
  → Phase 0.3: the code-tab edit applies; the founder's edit-failure was the
  standalone-chat amnesia and/or a Gemini-model failure, not the edit mechanic.

**Fix:**
- `supabase/migrations/0065_standalone_messages.sql` — creates the table
  (+ chat_sessions IF NOT EXISTS) with index + RLS. Idempotent.
- `routes/chat-sessions.ts` — insert/select errors now surface; a user-message
  persistence failure returns 503 instead of a memory-less reply.
- `routes/chat.ts` — fixed a latent duplicate (project-chat history included the
  just-inserted user turn AND the router re-appended it). Now `.slice(0,-1)`.

**Status:** code DONE; **migration apply BLOCKED on founder** (stale prod DB
password in `.env.local`, no Supabase management token — verified both rejected).
After apply + Railway redeploy, repeat the 3-turn standalone build.

## PHASE A — Onboarding key persistence (CRITICAL) — DONE (code-verified)
**Root cause (proven):** onboarding `saveKey` POSTed `/api/byok-keys/` (trailing
slash). API is strict-mode Hono; `byokKeys.post('/')` registers as
`/api/byok-keys`, so the trailing-slash URL 404s. The call was wrapped in a
try/catch that swallowed the error and set `saved:true` anyway → key never
persisted but the UI advanced. Local Hono test (exact mount):
`POST /api/byok-keys → 200`, `POST /api/byok-keys/ → 404`,
`POST /api/byok-keys/test → 200`. Write-up: `PHASE_A_KEYPERSIST.md`.

**Fix:** `app/welcome/provider/page.tsx` `saveKey` now posts to `/api/byok-keys`
(identical to the working Settings add), checks `res.ok`, surfaces errors on the
card, and only marks `saved` on real success.

**Status:** code DONE, code-path-equivalent to the proven Settings path. Live
round-trip deferred (no spare valid Groq key this session). Founder: with a
throwaway key, walk onboarding and confirm the key lands in Settings → My Keys.

## PHASE B — Step-01 A/B/C + hide false banner — DONE, locally verified
- Step-01 now A/B/C, A shown first as the promise (`step01-abc.png`):
  - **A** "Ohne Key starten / Goblins eigenes Modell" + **COMING SOON** badge,
    KEIN-KEY/BALD tags, dashed non-clickable teaser — never starts a keyless
    session (Rule 1). Becomes the hero when `FREE_POOL_ENABLED` flips. DE+EN.
  - **B** guided free key — **EMPFOHLEN** (green) — the working entry path.
  - **C** already have a key.
- `SoftLimitBanner` (the "{n} Anfragen heute übrig" + trial/blocked variants) is
  gated behind `NEXT_PUBLIC_FREE_POOL_ENABLED` (default off) → hidden now, a
  single env flip on invite day. No explanatory copy added.
- Also fixed two soft false promises in Step-01 explore copy ("soft limits on").

## PHASE C — Re-walk fixes — DONE
- **C.1 dual-key UX** (`welcome/provider`): saved card now reads as a calm
  "Verbunden ✓"; "add another" demoted to a quiet optional link (no big green
  CTA, even on the hero). Persistent Weiter stays in the bottom bar.
  *(code+build verified; saved-state needs a key to screenshot.)*
- **C.2 settings logos** (`keys-list.tsx`): real `ProviderLogo` marks restored
  (was a letter-avatar regression) — verified live: Anthropic/OpenAI/Google/
  Groq/DeepSeek render brand SVGs (`settings-keys-logos.png`).
- **C.3 mobile toggle** (`IOSToggle.tsx`): geometry locked (min/max-width,
  aspect-ratio, box-sizing, appearance:none, flex-grow:0). **Verified at 390px:
  measured w:51 h:31 ratio:1.65**, green-on/gray-off, circular knob, both states
  (`toggle-mobile-on.png` / `toggle-mobile-off.png`).
- **C.4 layers** (`welcome/routing`): **real root cause found** — the layer CTAs
  render on a Next `<Link>`, which receives no styled-jsx scope class here, so
  the scoped rule never matched (that was the original "faint text"). Fixed with
  `:global(.layer-cta)`. All three layers now show consistent real buttons —
  Layer 1 outline-green continue, Layer 2 filled-green waitlist, Layer 3 outline
  (`step02-layers.png`).
- **C.5 integrations** (`welcome/integrations`): (a) removed the
  "vercel.com → Settings → Tokens" placeholder from the token input; (b) added a
  GitHub account-creation explainer mirroring the Vercel one
  ("Noch kein GitHub? … Kostenloses GitHub erstellen →", github.com/signup).
  DE+EN. Verified live (`step05-integrations.png`).
- **C.6 chat code chip** (`standalone-chat.tsx`): replaced the literal "</>" mono
  glyph with a Lucide `Code2` icon + clean 32px control. *(code+build verified;
  chip needs a code-bearing message to screenshot.)*

## PHASE D — Verify on prod
- Phase 0: prod-proven (standalone no-memory vs code-tab memory+edit). ✅
- Phase A: code-path-equivalent; live deferred (no spare key). ⚠️
- Phase B/C: verified on a local prod-data build (web not yet deployed to prod;
  Vercel had not picked up the pushes at session end). Screenshots in
  `sprint-10-11/`. Toggle measured at 390px. ✅ (local) / ⏳ (prod after deploy)

## PHASE F — Self-test
- **typecheck**: web + shared PASS (`pnpm -r typecheck`); api PASS (`tsc -p`). ✅
- **prod build**: web `next build` PASS — all routes compiled incl. every changed
  welcome route + /settings (exit 0). ✅
- **E2E**: see "E2E status" below.
- No green-wash: no `.skip`/`.only`/timeout-bump/matcher-loosen introduced.

### E2E status
**108 passed / 0 failed (4.7m)** — projects: public-desktop, public-mobile,
auth-desktop, auth-mobile, run against the local prod-data build (web :3000 +
api :3001), env from `.env.local`. Includes `27-toggles.spec.ts` (IOSToggle:
green-when-on + persists-across-reload) — **passes with the C.3 hardened toggle**.
No spec was modified; no `.skip`/`.only`/timeout-bump/matcher-loosen. Command:
`dotenv -e .env.local -- playwright test --project=public-desktop
--project=public-mobile --project=auth-desktop --project=auth-mobile`. Log:
`sprint-10-11/.e2e.log`.

## Known / out of scope (Sprint 11)
- Dashboard mixes DE/EN (e.g. chat composer placeholder English under DE) —
  scoped to Sprint 11 dashboard i18n, untouched here.
- Code-tab beautification — Sprint 11.
- Pre-existing: Next `<Link>` elements don't receive styled-jsx scope on the
  onboarding pages (also affects `.back`); only the in-scope `.layer-cta` was
  fixed (via :global). Broader audit deferred.

## Founder action items
1. **Apply migration `0065_standalone_messages.sql`** to prod (`npx supabase db
   push` or Studio) — fixes standalone-chat memory. CRITICAL.
2. **Redeploy** Railway API (chat.ts/chat-sessions.ts) + ensure Vercel deploys
   web (Phase B/C UI + Phase A key fix).
3. With a throwaway Groq key: walk onboarding → confirm key persists to Settings
   (Phase A live round-trip).
4. After apply+deploy: repeat the 3-turn standalone build to confirm memory.
