# M1 — Command bar promoted + status strip — REPORT

**Branch:** `mobile-1-2026-07-07` · **2026-07-07** · Status: **DONE, gate green.**

Spec §2.1–2.2. Desktop untouched (HARD RULE 3).

## What shipped
- **`CommandBar.tsx`** (new) — the promoted command input. `"Goblin um eine Änderung
  bitten…"` moved from the buried footer to the TOP of the mobile Code surface, with the
  **mic beside it** (reuses `useDictation` — CHAT-IO C1; inserts at the field, never
  auto-sends). Model picker (icon) + 44px send. Routes through the SAME `handleSubmit`
  → reviewed GEÄNDERT draft path (no auto-apply). Includes a forward-compatible anchor
  chip prop (`file · Zeile a–b`) that M3 will drive. Font-size 16px on the input (prevents
  iOS focus-zoom). Not auto-focused — opening the surface never grabs the keyboard.
- **`StatusStrip.tsx`** (new) — spec §2.2. Draft state ("Nicht veröffentlichte Änderungen ·
  N Dateien"), **truth-gated** last publish ("Live · <url>" shown ONLY when `deployedAt`
  is on record — never a hopeful claim), and the JIT card slot (`jit` prop, empty until M6).
- **`SessionPane.tsx`** — renders `<CommandBar>` + `<StatusStrip>` at the top of the surface
  column inside a `.gb-mobile-surface-top` region (`display:none` by default, shown ≤860px).
  Removed the old bottom-docked `.gb-editor-ask` form (its role is now the top command bar).
  The bottom action-bar status line is hidden across the whole mobile band (the strip carries
  it), not just ≤640px. Desktop keeps the thread composer (`SessionPromptInput`) as the front
  door — the new region never renders ≥861px.
- Both new files use the editor-surface `--ed-*` tokens (track the light/dark editor theme)
  and design-system semantics; German-first strings with EN via `t()`.

## Gate (375px real viewport, local stack)
Harness `.e2e-tmp/mobile1-shot.mjs` — `/auth/test-callback` login, seeded code session with a
draft file, viewport 375×812, `NEXT_PUBLIC_API_URL=http://localhost:3001` so the browser talks
to the local API.
- `commandBarPresent: true`, `micPresent: true`, `statusStripPresent: true`.
- **No layout jump on focus:** status-strip boundingBox `y=180` identical before/after focusing
  the input (`layoutJump: 0`). Top placement means focusing never pushes the layout up behind
  the on-screen keyboard (the old bottom-docked bar's jump).
- Screenshot: `_sprint/mobile-1/shots/m1-after.png` (command bar on top, mic, model, send;
  status strip "Nicht veröffentlichte Änderungen · 1 Datei" beneath).

## Before → after
Before: the command input (`.gb-editor-ask`) was docked at the BOTTOM of the mobile editor
view, below the editor and above the action bar (SessionPane.tsx old lines 599–633). After: it
is the first element of the surface, with the mic added. Desktop is unchanged either way.

## Verification
- `npx tsc --noEmit` (apps/web): clean.
- `npx eslint` on the three files: the two new files clean; two warnings on SessionPane are
  pre-existing (`autoViewedRef` + `deployUrl` effects, lines 114/120 — untouched by M1).
