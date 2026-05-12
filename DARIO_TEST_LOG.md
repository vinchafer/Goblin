# DARIO_TEST_LOG.md — Session 4 Self-Test Audit

**Methode:** Code-Audit aller kritischen Pfade + Analyse bekannter Bugs.
**Datum:** 2026-05-12

---

## 🔴 Trust-Breaking (Vertrauen bricht)

### 1. Preview-Tab immer deaktiviert
**Datei:** `components/app-shell/dashboard-shell.tsx` + `components/layout/Header.tsx`
**Problem:** `DashboardShell` übergibt `previewUrl={undefined}` an `Header`, weil `DashboardLayout` die `previewUrl` nicht kennt. Header zeigt Preview-Tab als disabled wenn `!previewUrl` — also immer. User kann Preview-Tab NIE per Klick aktivieren.
**Fix:** `previewUrl` aus `AppContext` lesen (ProjectWorkspace speichert es dort), dann an Header weitergeben.
**Status:** FIXED ✅

### 2. `useSearchParams` ohne Suspense in Onboarding
**Datei:** `app/onboarding/page.tsx`
**Problem:** `useSearchParams()` direkt in Client-Component verwendet — ohne Suspense-Boundary. Exakt das gleiche Problem das in Commit 5486ab4 für `dashboard-shell.tsx` gefixt wurde. Kann Vercel-Build-Fehler oder statische Rendering-Fehler auslösen.
**Fix:** Ersetze mit `window.location.search` in useEffect.
**Status:** FIXED ✅

### 3. Onboarding "Go to dashboard"-Button — dead code, nie sichtbar
**Datei:** `app/onboarding/page.tsx` Zeile 546
**Problem:** Condition `step >= 4 && step < TOTAL_STEPS - 1` = `step >= 4 && step < 4` = IMMER FALSE. TOTAL_STEPS = 5. Button wird nie gerendert. Step4Done hat aber bereits 2 Navigation-Buttons.
**Fix:** Dead-Code-Block entfernen.
**Status:** FIXED ✅

### 4. Sidebar-Navigation fehlt "API Keys"-Link
**Problem:** Layout/Sidebar Bottom-Nav hat nur "Billing" und "Settings". Neuer User findet API Keys nicht ohne Settings zu öffnen und manuell zu suchen. Das ist der kritischste Onboarding-Block für neue User mit BYOK.
**Fix:** "API Keys" als direkten Link in Sidebar-Bottom-Nav hinzufügen.
**Status:** FIXED ✅

### 5. Sidebar Dark Mode komplett kaputt
**Datei:** `components/layout/Sidebar.tsx`
**Problem:** `background: '#F2EDE4'`, `borderRight: '1px solid #DDD7CC'`, `background: '#C8C0B4'` — hardcoded Hex-Werte statt CSS-Variablen. Bei Dark Mode bleiben Sidebar-Hintergrund, Borders, und Drag-Handle hell → Sidebar sieht aus wie ein Fremdkörper im Dark Interface.
**Fix:** Ersetze Hex-Werte mit `var(--subtle)`, `var(--border)` etc.
**Status:** FIXED ✅

---

## 🟡 Störend

### 6. "Send to Code"-Button schlechter Kontrast
**Datei:** `components/workspace/CodeBlock.tsx` Zeile 82
**Problem:** Weißer Text (`color: '#fff'`) auf Ochre-Hintergrund (`var(--ochre)` = `#D4A94A`). Kontrastverhältnis ~2.5:1 — WCAG-Fail (muss ≥4.5 sein für normalen Text). Das Design-System nutzt sonst dunklen Text auf Ochre.
**Fix:** `color: '#1a1200'` (sehr dunkel) statt `#fff`.
**Status:** FIXED ✅

### 7. Error-Messages generisch und unhilfsbereit
**Datei:** `components/workspace/chat-tab.tsx`
**Problem:** Fehler-Fallback zeigt "Streaming error" und "Failed to send" — keine konkreten Hinweise was schief lief oder was User tun soll.
**Fix:** Bessere Error-Texte mit Kontext.
**Status:** FIXED ✅

### 8. ChatMessages EmptyState = dead code
**Datei:** `components/workspace/ChatMessages.tsx`
**Problem:** `EmptyState` in ChatMessages wird nie gerendert — `ChatTab` fängt den leeren Zustand selbst ab und rendert seinen eigenen Empty State (englisch). Die EmptyState-Komponente in ChatMessages (deutsch) ist damit unerreichbar.
**Status:** OFFEN (kein User-Impact, nur code smell)

### 9. Trial-Banner Day-Counter unverständlich
**Datei:** `components/app-shell/trial-banner.tsx` Zeile 84
**Problem:** `Day ${3 - days + ...} of ${...}` — Formel schwer lesbar, Edge Cases möglich. "Day 3 of 3" wenn trial fast vorbei ist, aber "Trial ends today" wenn daysLeft=0. Logik ist korrekt aber verwirrend im Code.
**Status:** OFFEN (funktional korrekt, nur Lesbarkeit)

---

## 🟢 Polish (Nice-to-have)

### 10. CodeBlock-Hintergrund immer dunkel (auch in Dark Mode)
`background: '#0d1117'` hardcoded. Gewollt (Terminal-Look), aber könnte in manchen Designs irritieren.
**Status:** AKZEPTIERT (bewusste Entscheidung)

### 11. Zwei parallele Sidebar-Implementierungen
`components/app-shell/sidebar.tsx` (alt, nicht verwendet) und `components/layout/Sidebar.tsx` (aktiv).
**Status:** OFFEN (technische Schulden, kein User-Impact)

### 12. Header-Höhe inkonsistent
`components/layout/Header.tsx`: 56px. `components/app-shell/topbar.tsx` (ungenutzt): 48px.
**Status:** KEIN PROBLEM (topbar.tsx nicht genutzt)

---

## Befunde aus bekannten Bugs (Memory)

### Bug 1: WelcomeModal nicht getriggert
**Check:** `components/onboarding/welcome-modal.tsx` existiert, `components/onboarding/first-run-tour.tsx` ersetzt es. `DashboardShell` nutzt FirstRunTour korrekt. WelcomeModal ist deprecated, nicht mehr genutzt.
**Status:** OBSOLET (FirstRunTour ersetzt es korrekt)

### Bug 2: Sidebar URL falsch
**Check:** `components/layout/Sidebar.tsx` navigiert zu `/dashboard/project/${p.id}` — KORREKT.
`components/app-shell/sidebar.tsx` (ungenutzt) navigiert auch zu `/dashboard/project/${p.id}` — KORREKT.
**Status:** BEREITS GEFIXT

### Bug 3: Push GitHub ohne GitHub-Check
**Check:** `hooks/useCodeTab.ts` `openPushModal()` — prüft `/api/github/status` korrekt, zeigt `ConnectGitHubModal` wenn nicht verbunden.
**Status:** BEREITS GEFIXT

---

## Session 4 Fix-Zusammenfassung

| # | Kategorie | Was | Zeit |
|---|-----------|-----|------|
| 1 | 🔴 U1 | Preview-Tab immer disabled → AppContext fix | 15min |
| 2 | 🔴 U1 | useSearchParams in Onboarding → window.location fix | 10min |
| 3 | 🔴 U1 | Onboarding dead-code Button → remove | 5min |
| 4 | 🔴 U1 | API Keys fehlt in Sidebar | 10min |
| 5 | 🔴 U1 | Sidebar Dark Mode → CSS vars | 20min |
| 6 | 🟡 U1 | Send to Code Kontrast → color fix | 5min |
| 7 | 🟡 U1 | Error Messages → verbessern | 10min |

**Gesamtzeit geschätzt:** ~75min für alle kritischen Fixes.
