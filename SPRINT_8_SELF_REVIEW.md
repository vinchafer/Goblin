# Sprint 8 — Self-Review (Phase B)

Date: 2026-06-02. Reviewer: me, pretending to be Vincent reading the report and re-walking the app.

Honest stance: 4 of 6 items are verified end-to-end in the live app. 2 items (the AI-streaming-dependent halves of 5.5 and 5.6) could **not** be exercised against a real model because the test account has no working model ("Model not found in LiteLLM"). Those are verified by component logic + isolated tests, and I say so plainly below rather than claiming a green I didn't earn.

---

## Per-item review

### 5.1 Logo Sweep — confidence: HIGH
- **Built:** Deleted `components/ui/goblin-mark.tsx` (the old crude goblin-head SVG) and migrated all 12 callers to the canonical animated `GoblinLogo` with correct states (save/deploy/build→working, stream/stop→thinking, route/workspace loading→breath, headers/404/avatars→idle).
- **Tested:** 404 page re-rendered with the new gold g-mark (was the old head). typecheck clean. grep confirms zero `GoblinMark` refs remain (only the canonical sprite `<use href="#goblin-mark">` + the `goblin-mark--{state}` animation classes, both correct).
- **Edge not fully closed:** the *save/deploy/build* moments show the new logo only while that async op runs; I verified the components compile + render but the live save/deploy spinner frames were not screenshotted at the exact sub-second (deploy needs a real Vercel push). The code path is unambiguous (same `GoblinLogo state="working"`).
- **Vincent's complaint resolved?** Yes. The old logo no longer exists in the tree.

### 5.2 Persistent Vercel Link — confidence: HIGH
- **Built:** Session live-URL card (link + Copy + Open + dismiss) seeded from `detail.deployUrl` so it survives reopen; hub `DeployUrlList` (per-URL copy + relative timestamp). Backend: GET detail returns `deployUrl`; new `GET /api/projects/:id/deployments`; deploy logs to `deployments` (migration 0056); both fall back to `preview_url`.
- **Tested:** Live — session card renders "LIVE test-vincent-…" seeded from the project's existing deploy; hub URLs card shows the clickable pill + Kopieren. Backend verified via authed calls (deployUrl present, /deployments returns the fallback row). 
- **Edge not closed:** a *fresh* deploy writing a new `deployments` row needs migration 0056 applied + a real Vercel deploy; verified the read/fallback path, not a brand-new insert end-to-end.
- **Resolved?** Yes — the URL no longer vanishes; it persists in-session and on the hub.

### 5.3 Daily Dashboard — confidence: HIGH
- **Built:** Two-column hub. Left: Letzte Deploys + Letzte Chats + Letzte Code-Sessions. Right: Aktivität + Dateien + URLs. Server-side queries (chat_sessions, code_sessions). Empty-state CTAs. Responsive collapse at 820px.
- **Tested:** Live desktop (cards render; "Session 2 · vor 12 min" appears) + mobile 390×844 (single-column stack, no horizontal scroll). Recent-chats empty-state CTA verified.
- **Edge noticed:** "Letzte Code-Sessions" header + "ALLE SESSIONS →" link sit tight at narrow column widths (cosmetic). Code-session card links include `?session=<id>` but the Code Tab does not yet select that specific session on load (opens the tab; SessionTabs shows all). Logged for Sprint 9.
- **Resolved?** Yes — the hub is now a working dashboard, not a static page. No token-usage display (deferred per Vincent).

### 5.4 File Explorer — confidence: HIGH
- **Built:** `/dashboard/project/[id]/files` — Finder-style: breadcrumb, folder drill-down, file list (type icon + size + modified), read-only CodeMirror preview for text, inline image preview, upload (any type ≤10MB), single-file download, delete with confirm. Mobile single-column. Hub Dateien card → Explorer (Editor kept secondary).
- **Tested LIVE end-to-end:** list (index.html), code preview (syntax-highlighted readonly), **image preview** (uploaded PNG → `<img>`), **upload** (backend 200, file appears with image icon), **delete** (browser confirm → DELETE 200 → list refreshes to just index.html), mobile single-column.
- **Edge:** intercepted + fixed an infinite-render loop (`useEffect` dep churn) before commit. Programmatic file-input upload couldn't be triggered via CDP (React ignores synthetic change) — verified the upload through the real multipart endpoint instead.
- **Resolved?** Yes — clicking Dateien now opens a real explorer, not the editor.

### 5.5 Undo/Redo — confidence: HIGH (manual) / MEDIUM (AI-edit, unverified live)
- **Built:** Visible Rückgängig/Wiederherstellen buttons wired to CodeMirror history; editor stays mounted across the AI boundary (live stream → overlay) so an AI generation lands as ONE undoable transaction.
- **Tested LIVE:** typed "MANUAL-EDIT" → undo button enabled + state→Entwurf → **Undo removed it** → **Redo restored it**. Ctrl+Z/Y intact.
- **NOT verified live:** undo *after an AI generation* — blocked by model unavailability. The architecture guarantees it (the persisted AI content flows through the editor's external-content effect = one history entry), but I did not watch it happen. Flagging honestly.
- **Resolved?** The Word-style buttons exist and work for manual edits; AI-undo is built but unproven live.

### 5.6 Live Diff — confidence: MEDIUM (logic verified, live visual unverified)
- **Built:** `StreamingDiffView` (jsdiff `diffLines` + CodeMirror line decorations) renders in the streaming overlay when the AI edits an existing file (green added / red strikethrough removed); new files stream plain. Guarded (try/catch → plain fallback) so it can never break streaming (stop cond. h).
- **Tested:** diff line-classification verified deterministically in node (removed=[1,2], added=[3,4,5] for a representative edit). 
- **NOT verified live:** the rendered diff during a real stream — blocked by (a) no model, (b) a bare isolation route that wouldn't hydrate under Next-16 dev. Component is wired into the proven-hydrating SessionPane overlay.
- **Resolved?** Built + logic-verified; visual-on-real-stream is the open item.

---

## Full-journey walk (what I could traverse)
Login (session retained) → dashboard → project hub (deploys/chats/sessions/URLs) → Code Tab (Sprint-7 SessionTabs render, not classic fallback) → seed file → manual edit → undo/redo → persistent live-URL card → hub URLs card → File Explorer (preview/upload/delete) → mobile (hub + explorer). 

Blocked at: chat→AI→send-to-code→AI-edit→diff→deploy, because **no model is available to the test account**. This is the single biggest gap in this sprint's verification and the #1 thing for the three-persona audits.

## Things I noticed but did NOT fix (deliberate, for prioritization)
1. **No working model for the trial account** — the headline promise ("Tell it what you want, it ships") is dead-on-arrival for a fresh user without BYOK. Highest priority.
2. The **KEYBOARD SHORTCUTS overlay** persistently covers the lower-right of the Code Tab / hub and did not auto-dismiss across navigations — real UX clutter.
3. **58 [E2E-TEST] projects** pollute the sidebar (test-data hygiene, not code).
4. **EN marketing ↔ DE app** language switch (landing is English, app is German).
5. Code-session `?session=` deep-link not yet honored.
6. Explorer lacks rename/move/folder-ops (MVP scope, deferred).
7. Next-16 dev hydration warnings / "1 Issue" badge (dev-only; prod build is clean, exit 0).
