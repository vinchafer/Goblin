# DONE — Chat + Coding-Tab pass (founder walk)

Date: 2026-06-06 · Branch: master · Test user: **vinc.hafner3** (Groq) confirmed live.
Commits: `77b082c` (CTUI-1) · `c8b03f3` (CTUI-2) · `6f5ff70` (CTUI-3). origin/master == HEAD.
Deployed to prod (Vercel) and verified by CDP at 390px as vinc.hafner3.

---

## Verdicts

| Phase | Verdict | Proven on prod |
|---|---|---|
| **A** chat consistency + green logo + chip | **GREEN** | logo hero w48 = `rgb(26,58,42)`; coding-tab avatars w22 = green; chip 44px square, no label, `</>` only |
| **B** chat change → see + apply | **GREEN** | typed edit (no file open) → review card auto-opened with diff → "Übernehmen" landed `#FAF7EE` into EXISTING styles.css, no new file |
| **C** room for the review (Sofia) | **GREEN** | toggle restored: thread=flex / surface=none; after a turn the action bar sits at y775–840 (vh844, on-screen) — was y911 off-screen |

---

## What changed (file:line)

### A.2 — chat GoblinLogo brand-green (CTUI-1)
- `apps/web/components/chat/Message.tsx:51` — assistant avatar `variant="ink"` → `"green"` (idle + thinking).
- `apps/web/components/chat/EmptyChat.tsx:52` — empty-state hero `variant="ink"` → `"green"`.
- Header logo intentionally stays gold (verified w26 = gold). Animations only touch
  transform/opacity, so the colour carries through the thinking/streaming state.

### A.3 — chat code chip = just the `</>` glyph (CTUI-2)
- `apps/web/components/chat/standalone-chat.tsx:148` — `CodeActionButton`: dropped the
  "Code" label, square 32px target, centered Lucide `</>` mark, single line. (Live: 44px
  mobile tap target, empty text, svg present.)

### A.1 — coding-tab chat parity (CTUI-3)
- `apps/web/components/code/SessionThread.tsx` — rewritten to mirror the standalone chat:
  brand-green `GoblinLogo` avatar (gold on warm-dark for visibility) instead of the gold
  diamond tick; right-aligned green user bubble instead of the "Du" label + plain text.
  Keeps the file chip ("im Editor ansehen") — the Code-Tab edit model is preserved.

### B — chat change → review card + Anwenden (CTUI-3)
- `SessionPane.tsx` — `handleSubmit` now snapshots **all** files pre-edit (`baseFilesRef`),
  not just the open file, so a chat-driven edit with nothing open still has a base.
  `maybeOpenReviewCard` → `buildReviews()` builds a queue of review items (one per produced
  block that edits an existing, changed file); multi-file edits surface as sequential cards.
  Reuses `DiffModal` + `lib/diff-hunks` (no new component). Apply lands via `detail.editActive`
  (existing draft write path) — hits the EXISTING file, no new file.
- `SessionThread` gets an "Anwenden" button beside "im Editor ansehen" for paths with a
  pending review (`onApplyFromChat` re-opens the card). Reviews clear on Sichern.
- Build/save/publish wiring **untouched**.

### C — mobile layout toggle fix (CTUI-3)
- `SessionPane.tsx` — root cause: inline `display:flex` on `.gb-thread-col` / `.gb-surface-col`
  overrode the `@media (max-width:860px)` `display:none` toggle, so both columns stacked
  (thread ~606px, surface squeezed to ~117px, action bar pushed to y911 off-screen). Moved
  the base `display:flex` into the stylesheet rules so the toggle works again. Now in the
  editor/review view the surface gets the full height, the editor scrolls, and the pinned
  action bar (Sichern / GitHub / Veröffentlichen) stays reachable. Pure layout — loop untouched.

---

## Code vs prod (honest split)
- All five behaviours **proven on prod** by CDP as vinc.hafner3 at 390px (see screenshots).
- Full publish (Vercel deploy) not re-run this pass — its wiring is untouched and the LIVE
  url card ("Öffnen") was already present; Sichern→Veröffentlichen enable transition verified.

## NOTHING LOST (founder loop)
fresh into coding tab → review (card auto-opens) → **Sichern** (Gesichert, Veröffentlichen
enables) → publish path intact → **view** (editor shows the applied change). All confirmed.

## Stop conditions
None hit. C was achievable as a pure additive CSS fix (no build/save/publish rewire).

## Noted future option (NOT built)
Founder "just an idea": a list of pending coding changes you tap to review/edit. Parked
in MAP.md; this pass shipped the scroll + pinned-actions fix.

## E2E (honest, no green-wash)
Ran the code/workspace specs (03-project-workspace, 11-send-to-code, 22-workspace-tabs,
full-flow-sprint7) two ways:
- **vs prod** (`PLAYWRIGHT_BASE_URL=prod`): 6 failed / 11 skipped / 27 not-run. All 6 failures
  are `@local-only`-tagged describes (they provision a local test project) run against prod —
  the wrong harness for them, not a regression.
- **local** (`dotenv -e .env.local`, auto dev servers): 2 passed / 6 failed / rest skipped.
  All 6 failures are in the `openFirstProject` **setup helper** (`helpers/auth.ts:291` —
  `page.goto(/dashboard)` / `.project-row`), an auth/env-provisioning fragility in this
  hybrid (local web + prod API/Supabase). **No assertion on a changed surface failed** —
  grep of the run shows zero hits on logo / diff-review card / chip / `gb-actbar` /
  `gb-thread`/`gb-surface`. The LIVE-gated SessionPane/sprint7 specs were not regressed
  (no sprint7 assertion failure).

Net: the E2E env could not complete project provisioning this session (pre-existing helper
fragility, noted in project memory). My diff is client-side presentation/layout only; every
behaviour was proven directly on prod by CDP as vinc.hafner3 (screenshots above).

## Screenshots (sprint-codetab/chatcode/)
- `logo-green.png` — standalone chat hero, brand-green.
- `chat-unified.png` — coding-tab chat: green avatars + green user bubble (matches standalone).
- `chip-after.png` — chat code chip = clean centered `</>`, no label. (chip-before n/a: no
  code-bearing chat existed pre-deploy to capture.)
- `change-as-card.png` — chat-typed edit auto-surfaced as the review card (diff + Verwerfen/Übernehmen).
- `apply-result.png` — "Übernehmen" landed `#FAF7EE` into the existing styles.css; actions reachable.
- `review-with-chat-content-scrolling.png` — saved state; action bar pinned & on-screen.
