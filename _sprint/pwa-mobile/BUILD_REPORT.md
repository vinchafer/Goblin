# BUILD REPORT — PWA Safe-Area & Mobile-Kontrollgang + Install-Anleitung

**Wave:** `pwa-safearea-mobile` · **Branch:** `claude/new-session-xyartf` · **Base:** `a10aced` (Merge PR #39) · Ausführer: CC/Opus · 2026-07-15

## Branch-Hinweis (State-first, Gesetz 10)
Der Prompt nennt Branch `pwa-safearea-mobile`; die Session-Infrastruktur ist auf `claude/new-session-xyartf` verdrahtet, und meine stehende Anweisung ist, ohne ausdrückliche Bestätigung auf keinen anderen Branch zu pushen. Eine Rückfrage konnte technisch nicht zugestellt werden. Entscheidung: Entwicklung auf `claude/new-session-xyartf` (was der Cloud-PR-Flow trackt), Namensabweichung hier offen dokumentiert. Umbenennen/retarget ist trivial, falls der Founder `pwa-safearea-mobile` bevorzugt.

## Units (je 1 isolierter Commit)

| Unit | Commit | Inhalt |
|---|---|---|
| U1 | `4139376` | Safe-Area-Insets: App-Header (P0) + Offline-Banner |
| U2 | `dc16011` | Sidebar in Landscape ausklappbar (toter Toggle) |
| U4 | `f22af41` | „Als App installieren" — Artikel DE+EN + diskreter Hinweis |
| U3 | `b7715b3` | Mobile-Kontrollgang-Matrix (Doku, Findings + Tickets) |

## Gates — numerische Erfolgsraten (alle deterministisch, neu geöffnet-geprüft)

- **U1 Safe-Area:** `evidence/pwa-safearea/assert-safe-area.mjs` → **16/16** PASS (viewport-fit cover auf beiden Layouts; theme-color #1A3A2A; Header top/L/R-Inset + Höhe; Offline-Banner ×2; Regressions-Guard auf bereits abgedeckte Bottom/Drawer-Insets). Render: `header-before-after.png` (geöffnet-geprüft: Vorher kollidiert, Nachher frei).
- **U2 Sidebar:** `evidence/pwa-safearea/assert-sidebar-landscape.mjs` → **11/11** PASS (reproduziert Alt-Bug „Toggle tot in Landscape" + beweist Fix expandiert/kollabiert; Desktop unverändert; Source-Guard auf den echten Code).
- **U4 Install:** `apps/web/lib/pwa-install.test.ts` → **13/13** PASS (UA-Klassifikation, Standalone-Erkennung, iPadOS-Desktop-Mode, Show/Dismiss, `showNativeInstallButton` beweist: iOS bekommt NIE einen Knopf). Help-Corpus: `apps/api/.../help-content*.test.ts` → **9/9** (inkl. 10-Artikel-Count, DE+EN je Section). Render: `install-hint-states.png` (geöffnet-geprüft: iOS=nur „Anleitung", Android=echter „Installieren"-Knopf).
- **Typecheck (tsc --noEmit):** web **0**, api **0**, shared **0** Fehler.

## Selbst-Review-Checkliste
1. **Evidenz-Audit:** beide PNGs geöffnet und mit den Behauptungen abgeglichen ✓
2. **Diffstat vs. Scope:** 17 Dateien, jede durch eine Unit gerechtfertigt; keine Fremd-Änderung ✓
3. **Regression:** U1 ist env()-guarded (0 im Browser/Desktop → identisch); U2 beweist Desktop unverändert; U4 fügt neue Komponente hinzu, einmal gemountet, rendert null wenn installiert/Desktop/dismissed ✓
4. **Ehrlichkeits-Sweep:** neue Strings DE+EN, Push-Behauptung gegen SW-Code + NotificationsPage verifiziert, kein English-Leak, keine erfundene Zeit, **keine Phantom-Affordanz** (iOS-No-Button deterministisch bewiesen) ✓
5. **Ledger:** keine neuen Token-/API-/Modell-Kosten (Install-Hinweis nutzt Browser-`beforeinstallprompt`; Artikel ist statisch) → keine Ledger-Zeile nötig ✓
6. **Report-Vollständigkeit:** Base-SHA, Unit-SHAs, Evidenz-Refs, Honest-Limitations, Founder-Action, numerische Raten ✓
7. **Steven-Frage:** Ein skeptischer Prüfer käme mit den deterministischen Asserts + tsc + Unit-Tests zu meinem Urteil; die Renders sind ehrlich als Simulation gekennzeichnet ✓

## Honest-Limitations
- Emulierte Renders approximieren `env()` (Harness fest 47px) — **On-Device-Blick des Founders ist das finale Safe-Area-Gate**.
- Keine Live-authentifizierten Geräte-Renders je Matrix-Zelle (Dashboard auth-gated, kein Test-Login/`env` im Sandbox). Kontrollgang-Verdikte sind Code-Audit-basiert + durch Header-/Hint-Harness gestützt — als solche gekennzeichnet (Gesetz 2).
- Sidebar-Fix per State-Machine bewiesen, nicht per Live-Interaktions-Trace.
- U3 fixt nur die klaren Fälle (U1/U2); 3 P2-Findings sind getickt, nicht drive-by gefixt (Gesetz 1).

## Founder-Action (On-Device nach Merge)
Siehe `_sprint/pwa-mobile/KONTROLLGANG.md` §Founder-Action: iPhone Portrait (Header/Offline-Banner frei), iPhone Landscape (Sidebar ausklappbar), Android (Install-Knopf) bzw. iOS (nur Anleitung), Notch/Home-Indicator (Composer frei).

**Status: HALT** — bedingter Merge, alle Gates grün belegt; das Safe-Area-Urteil bestätigt der Founder on-device.
