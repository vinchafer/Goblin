# Session Handoff — after Sprint 10.11 (2026-06-05)

## State
Sprint 10.11 "Make the Loop Actually Work" complete. Two CRITICAL correctness
bugs root-caused + fixed before any polish, plus the Step-01 restructure and 6
re-walk fixes. 5 atomic commits pushed: `7b7c64b`, `2122a3d`, `0c683b2`,
`48ec419`, `85782ed`. typecheck (web+shared+api) green. Web prod build green.
Full report: `SPRINT_10_11_COMPLETE.md`. Phase write-ups:
`sprint-10-11/PHASE_0_ROOTCAUSE.md`, `PHASE_A_KEYPERSIST.md`.

## The two critical fixes
1. **Conversation memory was dead in the standalone (default) chat.** Root
   cause: `public.standalone_messages` does not exist in prod — it lived only in
   the manual `scripts/migrate-chat-sessions.sql`, never a formal migration.
   `routes/chat-sessions.ts` swallowed the resulting insert/select errors, so
   every turn lost history. Proven live: standalone chat had zero memory; the
   code tab (its tables exist) had full memory + working edit-in-place.
   Fix: migration `0065` + error surfacing + a chat.ts dedupe.
2. **Onboarding key never persisted.** Root cause: `welcome/provider` saved to
   `/api/byok-keys/` (trailing slash → 404 under strict Hono) and swallowed the
   error while marking the card saved. Fix: post to `/api/byok-keys` (the exact
   working Settings endpoint), check res.ok, surface failures.

## 🔴 Founder action items (blockers)
1. **Apply `supabase/migrations/0065_standalone_messages.sql`** to prod
   (`npx supabase db push` or Studio). This session could NOT apply it — the DB
   password in `.env.local` is stale (auth rejected) and there is no Supabase
   management token. Idempotent; safe to re-run.
2. **Redeploy Railway API** (chat.ts + chat-sessions.ts) and confirm **Vercel
   deployed the web** (Step-01 A/B/C, Phase A key fix, Phase C UI). At session
   end prod still served pre-deploy HTML.
3. **Phase A live round-trip** (needs a throwaway Groq key): walk onboarding →
   add key → finish → confirm it appears in Settings → My Keys → generate.
4. After apply+deploy: repeat the 3-turn standalone build
   ("newsletter page" → "heading bigger" → "background blue").

## What else shipped
- Step-01 → A/B/C. A = "Ohne Key starten / Goblins eigenes Modell" + COMING SOON
  badge (honest teaser, never starts a keyless session; the moat, shown first).
  B = guided free key, EMPFOHLEN. C = already have a key.
- False "{n} Anfragen heute übrig" banner gated behind
  `NEXT_PUBLIC_FREE_POOL_ENABLED` (off) → hidden until the hosted pool is live.
- C.1 calm "Verbunden ✓"; C.2 real provider logos in Settings (was a
  letter-avatar regression); C.3 mobile toggle locked to a 51×31 pill (390px,
  both states); C.4 layer CTAs are real buttons (Next <Link> gets no styled-jsx
  scope → :global fix); C.5 GitHub create-account explainer + removed the Vercel
  "Settings" placeholder; C.6 chat code chip → Lucide Code2.

## Verification posture
- Phase 0: prod-proven (CDP, vinc.hafner3).
- Phase A: root cause proven (local Hono test); code-path-equivalent to Settings;
  live deferred (no spare key).
- Phase B/C: verified on a LOCAL prod-data dev build (web not yet deployed);
  screenshots in `sprint-10-11/`. Toggle measured at 390px.

## Known / Sprint-11 scope
- Dashboard mixes DE/EN (chat composer placeholder English under DE).
- Code-tab beautification.
- Pre-existing: Next <Link> elements miss styled-jsx scope on onboarding pages
  (also affects `.back`); only the in-scope `.layer-cta` was fixed.

## E2E
See "E2E status" in SPRINT_10_11_COMPLETE.md (CI projects, local prod-data).
No green-wash.
