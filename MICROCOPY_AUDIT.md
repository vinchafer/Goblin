# MICROCOPY_AUDIT.md — Session 4

---

## Fixes umgesetzt

### 1. ConnectGitHubModal komplett überarbeitet
**Vorher:** Tailwind-Chaos, `bg-white` (dark mode broken), "Failed to start GitHub connection"
**Nachher:** Inline styles, `var(--panel)`, klare Fehlermeldung mit Handlungsanweisung, "Not now" statt "Cancel"

### 2. PushToGitHubModal komplett überarbeitet
**Vorher:** Tailwind, `bg-white`, "Failed to push to GitHub", "Something went wrong"
**Nachher:** Inline styles, `var(--panel)`, "Push failed — check your GitHub connection", Success-State mit "Pushed to GitHub!"

### 3. Chat-Streaming Error Messages
**Vorher:** `'Streaming error'` / `'Failed to send'` — komplett nichtssagend
**Nachher:** `'Something went wrong — try again. Your message was not sent.'` / `'Could not reach the server — check your connection and try again.'`

### 4. Sprachkonsistenz Settings
**Vorher:** "Standard-Model für Chat" (Deutsch mitten in englischer UI)
**Nachher:** "Default Chat Model" / "Default Code Model"

---

## Top-20 Microcopy-Probleme (Priorisiert)

| # | Datei | Problem | Status |
|---|-------|---------|--------|
| 1 | `chat-tab.tsx` | 'Streaming error' / 'Failed to send' | ✅ FIXED |
| 2 | `connect-github-modal.tsx` | 'Failed to start GitHub connection' | ✅ FIXED |
| 3 | `push-to-github-modal.tsx` | 'Failed to push to GitHub' / 'Something went wrong' | ✅ FIXED |
| 4 | `settings/page.tsx` | "Standard-Model für Chat" (DE in EN context) | ✅ FIXED |
| 5 | `trial-banner.tsx` | "Trial ends today" / "Day X of Y" — verwirrende Formel | OFFEN |
| 6 | `chat-tab.tsx` | Empty state "What are we building?" — OK (konsequent EN) | AKZEPTIERT |
| 7 | `code-tab.tsx` | File switch dialog "Save changes to [file]?" — gut, bleibt | OK |
| 8 | `code-tab.tsx` | Buttons: "Save", "Discard", "Cancel" — gut | OK |
| 9 | `file-tree.tsx` | "Delete [filename]?" — gut (enthält spezifischen Namen) | OK |
| 10 | `sidebar.tsx` | "Noch keine Projekte" (DE) in Layout-Sidebar (EN) — leichte Inkonsistenz | OFFEN |
| 11 | `push-to-github-modal.tsx` | Hint "Letters, numbers, hyphens..." hinzugefügt | ✅ NEU |
| 12 | `connect-github-modal.tsx` | Erklärung "minimal permissions" präzisiert | ✅ NEU |
| 13 | `push-to-github-modal.tsx` | Success: "Pushed to GitHub!" — klar, positiv | ✅ NEU |
| 14 | `onboarding/page.tsx` | Step 0 "What do you want to build first?" — klar | OK |
| 15 | `onboarding/page.tsx` | Step 4 "You're ready to build." — energetisch, gut | OK |
| 16 | `trial-banner.tsx` | "+2 days" Extension Button — klick, minimal | OK |
| 17 | `chat-tab.tsx` | No-model Banner: "Add an API key to start chatting." — klar | OK |
| 18 | `chat-messages.tsx` | Error: "No model connected. Add an API key →" — gut | OK |
| 19 | `onboarding/page.tsx` | "Skip for now" — sanft, kein Druck | OK |
| 20 | `settings/keys-page.tsx` | "Your keys are encrypted at rest and never stored in plaintext." — Vertrauen aufbauend | OK |

---

## Sprachstrategie: EN als Hauptsprache

Nach Code-Analyse: Goblin nutzt Englisch als Primärsprache in der App-UI.
- Layout/Sidebar: English (New Project, Billing, Settings, API Keys)
- Settings Pages: English
- Chat UI: English
- Onboarding: English
- Error Messages: English

Vereinzelte DE-Texte (z.B. "Noch keine Projekte" in old-sidebar, "Standard-Model für Chat" in settings) wurden bereinigt.
