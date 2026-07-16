# BUILD REPORT — PWA Bottom Safe-Area Fix

**Wave:** `pwa-bottom-inset` · **Branch:** `claude/pwa-bottom-safe-area-sftws4` · **Base:** `f916d33` (Merge PR #42) · Ausführer: CC/Opus · 2026-07-16

## Branch-Hinweis (State-first, Gesetz 10)
Der Prompt nennt Branch `pwa-bottom-inset`; die Session-Infrastruktur ist auf `claude/pwa-bottom-safe-area-sftws4` verdrahtet, und meine stehende Anweisung ist, ohne ausdrückliche Bestätigung auf keinen anderen Branch zu pushen. Entscheidung: Entwicklung auf `claude/pwa-bottom-safe-area-sftws4` (was der Cloud-PR-Flow trackt), Namensabweichung hier offen dokumentiert. Retarget ist trivial, falls der Founder `pwa-bottom-inset` bevorzugt.

## Problem
Der Top-Fix (PR #41, `safe-area-inset-top`) sitzt. Im installierten iPhone-PWA (viewport-fit=cover) wird aber der **untere** App-Rand von der Home-Indicator-Zone abgeschnitten: der Sidebar-Fuß (Guthaben-/Quota-Karte + Account-/„Vincent"-Pill) und der Chat-Composer sitzen unter dem Indicator. Diese Welle padded jedes bottom-verankerte fixed/sticky/absolute-Element um `env(safe-area-inset-bottom)`, sodass nichts mehr geklippt wird. `env()` ist 0 im normalen Browser-Tab → Desktop/Tab bleibt bitgleich.

## Behandelte Bottom-Elemente (jedes durch `assert-safe-area-bottom.mjs` belegt)

| # | Surface | Datei | Fix |
|---|---|---|---|
| 1 | **Sidebar-Rail (Desktop)** — Fuß = Quota-Karte + Account-Pill; in **Landscape** (≥769px) rendert diese Rail, nicht der Drawer | `components/layout/Sidebar.tsx` | `paddingBottom: env(safe-area-inset-bottom)` auf `<aside>` |
| 2 | **Chat-Composer** — ChatInput non-hero-Root; ein Ort deckt standalone-chat **und** workspace-chat-tab ab | `components/chat/ChatInput.tsx` | `padding-bottom: calc(12px + env(…))` |
| 3 | DiffSheet — Aktions-Row des Bottom-Sheets | `components/code/DiffSheet.tsx` | `calc(10px + env(…))` |
| 4 | LineActionSheet — Bottom-Sheet | `components/code/LineActionSheet.tsx` | `calc(16px + env(…))` |
| 5 | StcPreviewSheet — mobiler Bottom-Dock | `components/code/StcPreviewSheet.tsx` | `padding-bottom: env(…)` (mobile @media) |
| 6 | SessionGitPill — mobiles Bottom-Panel | `components/code/SessionGitPill.tsx` | `padding-bottom: env(…)` (mobile @media) |
| 7 | CodeMobileFileSheet — vollhoher Drawer | `components/code/CodeMobileFileSheet.tsx` | `paddingBottom: env(…)` |
| 8 | SessionFileNav — vollhoher Drawer | `components/code/SessionFileNav.tsx` | `paddingBottom: env(…)` |
| 9 | SessionPane-Toast — `absolute bottom:16` | `components/code/SessionPane.tsx` | `bottom: calc(16px + env(…))` |
| 10 | FileExplorer-Toast — `fixed bottom:20` | `components/files/FileExplorer.tsx` | `bottom: calc(20px + env(…))` |

**De-Dup:** Der Composer-Inset wurde aus dem `standalone-chat`-Wrapper **nach ChatInput** verschoben (Single Source of Truth). Ein doppelter Inset hätte einen toten `--surface-2`-Streifen unter dem Composer hinterlassen — `assert-safe-area-bottom.mjs` prüft explizit, dass der Wrapper den Inset **nicht** mehr dupliziert.

## Gates — numerische Erfolgsraten (deterministisch, neu geöffnet-geprüft)

- **Bottom-Sweep:** `evidence/pwa-safearea/assert-safe-area-bottom.mjs` → **18/18** PASS — 10 behandelte Surfaces + 7 Regressions-Guards (bereits vor der Welle abgedeckte Bottom-Insets bleiben erhalten) + 1 De-Dup-Guard.
- **Top-Regression:** `evidence/pwa-safearea/assert-safe-area.mjs` → **16/16** PASS — der Composer-Guard zeigt jetzt auf ChatInput (neue Quelle), sonst unverändert.
- **Render:** `evidence/pwa-safearea/bottom-before-after.png` (geöffnet-geprüft): Portrait-Composer + Landscape-Sidebar-Fuß, jeweils Vorher (unter dem Indicator) / Nachher (frei), Home-Indicator-Zone als Overlay simuliert (`env` ≈ 34px).

## Honest-Limitations
- Der Render approximiert `env()` (Harness fest 34px) — **der On-Device-Blick des Founders ist das finale Safe-Area-Gate.**
- Kein Live-Auth-Geräte-Render pro Surface (Dashboard auth-gated, kein Test-Login im Sandbox). Verdikte sind Source-Audit-basiert + durch den Harness gestützt, als solche gekennzeichnet.
- Kein lokaler `tsc`-Lauf möglich (Dependencies im Sandbox nicht installiert); die Änderungen sind reine Inline-Style-String-Werte (padding/bottom), type-sicher per Konstruktion.

## Founder-Action (On-Device nach Merge)
iPhone **Portrait**: Composer sitzt frei über dem Home-Indicator (nicht dahinter). iPhone **Landscape**: Sidebar-Fuß (Quota-Karte + „Vincent"-Pill) frei über dem Indicator; im Code-Editor Bottom-Sheets/Toasts frei.

**Status: HALT** — Fix + Gates grün belegt; das Safe-Area-Urteil bestätigt der Founder on-device.
