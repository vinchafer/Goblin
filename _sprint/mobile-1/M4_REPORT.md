# M4 — Diff sheet elevation + "Live stellen" — REPORT

**Branch:** `mobile-1-2026-07-07` · **2026-07-07** · Status: **DONE, gate green — incl. one REAL Vercel deploy.**

Spec §2.4 + §4.

## What shipped
- **`DiffSheet.tsx`** — spec §4 three actions: **"Sieht gut aus"** (dismiss, the change stays in the
  draft), **"Ganze Datei"** (→ Reader), **"Diese Stelle ändern lassen"** (re-anchor → Tier 2). The Diff
  sheet is already the default change-consumption path (every GEÄNDERT card opens it first, M2).
- **`SessionPane.tsx`** — the two-button `Sichern | Veröffentlichen` bar is replaced by **one "Live
  stellen"** primary (= Sichern + Veröffentlichen in one flow) plus a **⋯ menu** holding **"Nur sichern"**
  and the **GitHub push** pill (demoted per spec). New `liveStellen()` orchestrates save→deploy and drives
  an **inline truth-gated status stream** (`publishStream` state) instead of a toast: it mirrors the
  server's progress and only flips to **"Live"** on the server's `success` event — never a completion claim
  before the checks pass (the deploy is truth-gated server-side by `verifyDeployment`). The confirm dialog
  reads "Live stellen?" and spells out "Erst nach bestandener Prüfung gilt es als live."

## Gate (375px real viewport, local stack, ONE REAL Vercel deploy — authorized)
Harness `.e2e-tmp/mobile1-m4.mjs`:
- `liveStellenBtn: true` — one primary "Live stellen"; `confirmShown: true`.
- `menuOpened: true`, `menuHasSave: true` ("Nur sichern"), `menuHasGitHub: true` (GitHub push in the ⋯
  menu). Screenshot `shots/m4-more-menu.png`.
- **Inline truth-gated stream (German), exactly spec §2.4 "Wird geprüft n/6 → Live":**
  ```
  Veröffentliche …
  Dateien werden vorbereitet…
  Veröffentlichung wird erstellt…
  Veröffentlichung wird öffentlich geschaltet…
  Wird veröffentlicht… (wird geprüft, 1/6)
  Wird veröffentlicht… (wird geprüft, 2/6)
  Live gestellt
  ```
  `hadCheckStream: true` — the n/6 verification stream showed; **no "Live" before the checks** (the label
  becomes "Live gestellt" only on the server success event).
- **Real deploy succeeded:** `reachedLive: true`, `reachedError: false`. The test account has a Vercel
  connector, so this was a genuine Vercel deploy verified by the truth-gate. Screenshot
  `shots/m4-publish-stream.png`. This satisfies "truth-gated Live with real deploy on the test account".

## Verification
- `npx tsc --noEmit` (apps/web): clean. Legacy `publishNow` (toast-based) removed — superseded by `liveStellen`.
