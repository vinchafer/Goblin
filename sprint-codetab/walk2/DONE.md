# WALK2 — DONE (attempt 3 at deploy-stale + 4 follow-ups)

Date: 2026-06-10 · prod justgoblin.com · vinc.hafner3 (greeting confirmed, never
personal) · mobile 390 via CDP. Build: web `next build` PASS, api `tsc` clean,
api vitest **78 passed** (70 + 8 new). Guards: loop fixed surgically (path
reconciliation only, /save + /deploy shapes untouched); no invented data; Groq
stays default (prod default = Llama 3.3 70B Groq, confirmed); design system v1.1.

IMPORTANT — verification scope: the diagnosis is proven on REAL prod bytes. The
WALK2 code fixes are NOT yet deployed (prod runs origin e564815), so the FIXED
behaviour is proven locally (build + unit tests on the exact captured scenario);
the final live-URL render is the founder's check, clearly marked per item.

---

## PHASE 1 (P0) — deploy-stale: diagnosed on real bytes, root-fixed — **GREEN (content half)**

Decisive finding (full trace: `DEPLOY_TRACE_2.md`): for project **test 322r42**
the deploy-source `index.html` links `<link href="style.css">` (singular), but S3
holds only `styles.css` + `styles-1.css`. Live: `GET /style.css → 404`,
`getComputedStyle(body).backgroundColor → rgba(0,0,0,0)` (UNSTYLED — green never
showed, blue never would). The model writes css to `styles.css`; the page loads
`style.css`. Branch = **edit not in the file the page consumes**. WALKFIX-1 (attempt 2)
never fired (block explicitly named + activePath was `.html`).

Fix (surgical, loop shape unchanged) — `reconcileBlockPaths`:
- `apps/api/src/lib/asset-reconcile.ts` (new) — `linkedLocalAssets` + `reconcileBlockPaths`.
- `apps/api/src/routes/code-sessions.ts:~447` — after parse, retarget a css/js block
  to the asset the session HTML links when they diverge (exactly-one-linked guard).
- `apps/api/src/services/project-generator.ts:~145` — same reconcile at generation,
  so new projects never start orphaned.
- web mirror: `apps/web/lib/parse-code-blocks.ts` (`linkedLocalAssets`) +
  `apps/web/components/code/SessionPane.tsx` `buildReviews` (review card targets the
  linked file).

Proof (content half): `apps/api/src/lib/asset-reconcile.test.ts` — 8 tests GREEN,
incl. the exact prod scenario: model emits `styles.css` → reconciled to `style.css`,
`#0000FF` preserved. Founder check (live render): edit blue → Veröffentlichen → open
live link → blue (needs deploy; founder's Vercel token).

## PHASE 2 — publishing legible — **GREEN (local)**
`apps/web/components/code/SessionPane.tsx`:
- `publishNow` — ONE action saves pending drafts then deploys (orchestration only;
  /save + /deploy untouched). Confirm dialog kept (nothing auto-deploys).
- Status line: `Nicht veröffentlichte Änderungen` (hollow dot) when drafts exist;
  `Live · zuletzt aktualisiert vor Xs` once deployed (`relTimeShort`).
- `Veröffentlichen` is the single primary (enabled whenever files exist); `Sichern`
  demoted to optional secondary.
- Live-URL card shows `Live · aktualisiert vor Xs`; same project alias updates
  (deploy uses `target:'production'` → prod alias re-points; verified in vercel-service).
Founder check: one-button publish on a real project at 390.

## PHASE 3 (P1) — GitHub connect — **GREEN (prod-verified) + mobile deep-link fix (local)**
Re-traced on prod: tapping GitHub **Verbinden** navigates to
`github.com/login?...return_to=/login/oauth/authorize...` — OAuth **does** start
(deployed walkfix already fixed it; `/api/github/connect` returns a valid authorize
URL with real client_id). Both entry points (settings `ConnectorsPage.connectGithub`
+ editor `SessionGitPill.connect`) share that working path.
Remaining miss fixed: on MOBILE the `?settings=connectors` deep-link (the OAuth
returnTo) opened the settings ROOT, not Konnektoren — so the user didn't land on the
"Verbunden" row. `apps/web/components/settings/SettingsRoot.tsx` now consumes
`settingsInitialItem` on mount and pushes the deep-linked section (WALK2-3).
Founder check: complete OAuth login → returns to Konnektoren showing Verbunden.

## PHASE 4 — model selector → icon at constrained width — **GREEN (local)**
`SessionModelPicker.tsx` + `SessionPromptInput.tsx`: the composer is a named query
container (`gb-composer`); `@container (max-width:360px)` hides the model label +
chevron, leaving an icon chip beside Send (full label kept via `title`). Full-screen
editor (wide container) unchanged; mobile composer (~366px) keeps the label, only
genuinely narrow split panes collapse. Founder check: split width = icon, full = label.

## PHASE 5 — re-verify earlier fixes on prod — **GREEN**
- Keys page loads promptly + Groq connected: ✅ `Meine Keys` shows Groq `…n6rc` +
  Verwalten (connected); `/api/models` → groq `keyConnected:true`. (07-keys-…png)
- Picker not auto-switching to Gemini: ✅ prod default = `Llama 3.3 70B (Groq)` on
  dashboard + editor; `SessionModelPicker` auto-pick prefers Groq Llama.
- `</>` chip alignment: ✅ now a `<Code2>` icon centered in a 32×32 flex button
  (`alignItems/justifyContent center`, `lineHeight:0`, icon `display:block`).

---

## Founder checklist (his walk after deploy)
1. edit blue → Veröffentlichen → open live link → blue (the P0 proof).
2. GitHub connect → completes OAuth → returns to Konnektoren showing Verbunden.
3. publishing = one clear deliberate button; same URL updates.
4. split-screen model selector is an icon next to Send.

## Files touched
- api: `lib/asset-reconcile.ts` (new), `lib/asset-reconcile.test.ts` (new),
  `routes/code-sessions.ts`, `services/project-generator.ts`
- web: `lib/parse-code-blocks.ts`, `components/code/SessionPane.tsx`,
  `components/code/SessionModelPicker.tsx`, `components/code/SessionPromptInput.tsx`,
  `components/settings/SettingsRoot.tsx`
