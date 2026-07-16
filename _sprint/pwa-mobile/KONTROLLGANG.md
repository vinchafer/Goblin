# Mobile-Kontrollgang — PWA / Safe-Area / Landscape

**Wave:** `pwa-safearea-mobile` · Branch `claude/new-session-xyartf` (spec named `pwa-safearea-mobile`; see MERGE note) · Ausführer: CC/Opus
**Auslöser:** Founder-Befund on-device (iPhone, installierte PWA): App-Header unter der iOS-Statusleiste; Sidebar in Landscape nicht ausklappbar.
**Methode:** Struktureller Durchgang über die Kernflächen an einer festen Viewport-Matrix. Evidenz-Basis: **Code-Audit** (jede Fläche im Repo gelesen) + **emulierte Harness-Renders** (`evidence/pwa-safearea/`). **Ehrliche Grenze:** Live-authentifizierte Geräte-Renders je Matrix-Zelle brauchen die Founder-Umgebung (Dashboard-Routen sind auth-gated; `env(safe-area-inset-*)` ist im Headless-Chromium 0). Das On-Device-Bild des Founders bleibt das finale Gate.

## Viewport-Matrix

| Kürzel | Gerät (Profil) | Portrait | Landscape |
|---|---|---|---|
| SE   | iPhone SE            | 375×667 | 667×375 |
| Notch| iPhone 14 (Notch)    | 390×844 | 844×390 |
| Max  | iPhone 14 Pro Max    | 430×932 | 932×430 |
| Andr | Android-typisch      | 412×915 | 915×412 |

Plus `display-mode: standalone`-Emulation, wo sie das Layout ändert (Safe-Area).

Landscape-Band-Regel (relevant für die Sidebar): jede **Landscape-Phone**-Breite (667/844/915/932) liegt **≥ 768px** außer SE (667). D.h. 844/915/932 fallen in das Desktop-Sidebar-Band (768–959) → dort saß der Landscape-Bug (U2).

## Legende Severity
- **P0** — kaputt/blockierend für PWA-Nutzer · **P1** — sichtbar falsch/unbequem · **P2** — kosmetisch/Randfall · **OK** — geprüft, unauffällig.

---

## Befund-Tabelle (je Fläche × Achse)

| # | Fläche | Portrait (SE/Notch/Max/Andr) | Landscape | Standalone (Safe-Area) | Verdikt | Status |
|---|---|---|---|---|---|---|
| 1 | **App-Header** (`layout/Header.tsx`) | Inhalt in 56/60px-Reihe, Flex, kein Overflow — OK | Tab-Pills statt Mode-Tile, reachable — OK | **Header lag UNTER der Statusleiste** (Uhr/Akku über Logo) | **P0** | **FIXED U1** — `padding-top: env(safe-area-inset-top)` + Höhe reserviert Inset; L/R-Inset für Notch |
| 2 | **Sidebar** (`layout/Sidebar.tsx`) | <768 = Drawer von links, Hamburger sichtbar — OK | **768–959: Strip erzwungen, Ausklapp-Toggle tot** | Drawer hat top/bottom-Inset (Zeile 423/424) — OK | **P1** | **FIXED U2** — `narrowOverride`: Toggle übersteuert Zwangs-Collapse |
| 3 | **Offline-Banner** (`mobile/offline-banner.tsx`) | fixed top:0, zentriert — OK | OK | **lag unter der Statusleiste** | **P1** | **FIXED U1** — `padding-top: calc(8px + env(...top))` in beiden Varianten |
| 4 | **Dashboard-Home** (`app/dashboard/page.tsx`) | Hero + Composer, `@media ≤480` Padding-Reduktion, Grid→Liste — OK | Hero skaliert, kein Off-Screen-Control — OK | Header darüber jetzt safe (U1) | **OK** | + Install-Hint (U4) diskret, dismissbar |
| 5 | **Projekt-Chat** (`chat/standalone-chat.tsx`) | Composer hat `padding-bottom: env(...bottom)` (Zeile 718) → Home-Indicator frei — OK | Composer mit Tastatur nutzbar (dvh-Shell) — OK | Bottom-Inset vorhanden | **OK** | — |
| 6 | **Code/Datei-View** (`code/SessionPane.tsx`, `SessionTabs.tsx`, `SessionPromptInput.tsx`) | Composer + Tab-Sheet haben Bottom-Inset; Sheets von unten — OK | Datei-Nav absolut, erreichbar — OK | Bottom-Insets vorhanden | **OK** | Confirm-Modale `maxWidth:380` → siehe TICKET-1 |
| 7 | **Explorer** (`files/FileExplorer.tsx`) | Move/Del-Modale `minWidth:320, maxWidth:420, width:90%` → passt auf 375 — OK | OK | n/a | **OK** | — |
| 8 | **Settings** (Sheet `settings-sheet.tsx` / `BottomSheet.tsx`) | Full-Sheet `calc(100vh−48px)`, 48px-Top-Gap ≈ Statusleiste → Header frei; Bottom-Inset vorhanden — OK | Sheet nutzbar | Top-Gap deckt Notch grob ab; `100vh` statt `dvh` → TICKET-2 | **OK/P2** | — |
| 9 | **Help** (`app/help/page.tsx`, `[slug]`) | `padding` + `maxWidth:720`, `100dvh` — OK | OK | kein fixed-top-Element | **OK** | + Artikel „als-app-installieren" (U4) |
| 10 | **Billing** (`billing/*Panel.tsx`) | fixed inset:0 Overlay, zentrierte Karte — OK | OK | zentriert, kein Statusleisten-Kontakt | **OK** | — |
| 11 | **Publish-Sheet** (`code/StcPreviewSheet.tsx`) | fixed inset:0, Bottom-Sheet-Muster — OK | OK | — | **OK** | — |

---

## Diese Welle behoben (mit Evidenz)

- **U1 — Safe-Area (P0/P1):** App-Header + Offline-Banner unter der Statusleiste. `evidence/pwa-safearea/assert-safe-area.mjs` (16/16), `header-before-after.png`.
- **U2 — Landscape-Sidebar (P1):** toter Ausklapp-Toggle im 768–959-Band. `evidence/pwa-safearea/assert-sidebar-landscape.mjs` (11/11, reproduziert Alt-Bug + beweist Fix).
- **U4 — Install-Erklärung (P1):** Hilfe-Artikel DE+EN + diskreter, plattform-erkannter Hinweis. `apps/web/lib/pwa-install.test.ts` (13/13), Help-Corpus-Tests (10 Artikel), `install-hint-states.png`.

## Getickt (nicht in dieser Welle — kein Drive-by, Gesetz 1)

- **TICKET-1 (P2):** Confirm-Modale im Code-Editor (`SessionPane.tsx` Deploy/Discard, `code-tab-classic.tsx`) nutzen `minWidth:320, maxWidth:380` **ohne** `width:90%`. Auf Screens < 380px (SE=375) kann die zentrierte Karte ~2–3px je Seite überstehen. Fix-Skizze: `width:"90%"` ergänzen (analog FileExplorer-Modal). Isoliert, 1 Commit — aber eigene Unit, da mehrere Code-Flächen betroffen und Editor-Regression getrennt zu prüfen.
- **TICKET-2 (P2):** `BottomSheet` full-size = `calc(100vh − 48px)`. `100dvh` verhält sich auf iOS bei ein-/ausfahrender Browser-Leiste ruhiger. In der installierten PWA (keine Browser-Leiste) irrelevant; nur im Safari-Tab minimal. Kein P0.
- **TICKET-3 (P2):** ~21 `minHeight:100vh` auf Marketing/Auth/Legal-Seiten (nicht App-Shell). `minHeight` (nicht `height`) → kein Layout-Bruch; Umstellung auf `100dvh` ist Politur, kein Muss.

## Honest-Limitations

- Emulierte Renders approximieren `env()` (im Harness fest auf 47px simuliert) — der **On-Device-Blick des Founders ist das finale Safe-Area-Gate**.
- Kein Live-authentifizierter Geräte-Render je Matrix-Zelle in dieser Umgebung (Dashboard ist auth-gated, kein Test-Login/`env` im Sandbox). Die Matrix-Verdikte oben sind **Code-Audit-basiert** + durch die Harness-Renders für Header und Install-Hint gestützt — nicht durch 44 Live-Screenshots. Als solche gekennzeichnet (Gesetz 2).
- Landscape-Sidebar-Fix ist per State-Machine deterministisch bewiesen (nicht per Live-Interaktions-Trace, s.o.).

## Founder-Action (On-Device nach Merge)

1. iPhone **Portrait** (installierte PWA): Header-Logo/Konto klar **unter** Uhr/Akku? Offline-Banner (Flugmodus kurz) ebenfalls frei?
2. iPhone **Landscape**: Sidebar-Strip → Ausklapp-Pfeil tippen → klappt sie auf? Erneut → klappt sie ein?
3. **Android** (falls verfügbar): Chrome bietet „App installieren"? Hinweis-Karte zeigt „Installieren"-Knopf; iPhone-Safari zeigt nur „Anleitung".
4. Notch/Home-Indicator: Composer im Chat frei über dem Home-Indicator?
