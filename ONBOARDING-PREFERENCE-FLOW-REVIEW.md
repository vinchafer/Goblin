# Onboarding → Preference Flow — Abend-Review (HELD für Merge)

**Branch:** `feat/onboarding-preference-flow` (3 Commits, auf `master` aufgesetzt)
**Status:** Fertig gebaut, lokal end-to-end getestet, **NICHT gemerged, NICHT deployed.**
**Gates:** web `tsc` ✓ · api `tsc` ✓ · `next build` ✓ (alle 9 welcome-Routen).
**Datum:** 2026-06-29 · autonom gebaut, gehalten für deine Freigabe heute Abend.

---

## 0 · TL;DR
Die Onboarding-Lüge ist weg. Goblin Swift ist jetzt der **lebende, key-lose Erst-Build-Pfad** — kein „COMING SOON", kein erzwungener Groq-Key. Neuer ehrlicher, erfahrungs-bewusster Flow mit korrektem Counter, voll DE **und** EN, beide Branches getestet. Tools-Step versteckt (Code behalten). Flow ist aus den Settings **wiederholbar** ohne Account-Reset. Eine Migration (0074) muss **vor dem Merge** manuell angewendet werden.

---

## 1 · NEUER FLOW (Design wiederverwendet, neu geordnet)

Linearer Pfad (Reihenfolge wie im Brief):

| # | Route | Schritt | YES-Branch | NO-Branch |
|---|-------|---------|:---:|:---:|
| 1 | `/welcome/language` | Sprache | 01/05 | 01/06 |
| 2 | `/welcome` | **Experience-Fork** (neu) | 02/05 | 02/06 |
| – | `/welcome/explainer` | Vibe-Coding-Erklärer (neu, **nur NO**) | — | 03/06 |
| 3 | `/welcome/routing` | Wie Goblin arbeitet (ehrlich überarbeitet) | 03/05 | 04/06 |
| 4 | `/welcome/models` | **Modelle & Verbrauch** (neu) | 04/05 | 05/06 |
| 5 | `/welcome/build` | **Erster Build mit Swift** (neu) | 05/05 | 06/06 |
| → | `/dashboard` | Done | — | — |

**Counter ist jetzt ehrlich pro Branch** (single source: `flow.ts`): YES sieht 5 Schritte, NO sieht 6. Header **und** Footer stimmen immer überein → der Off-by-one ist tot.

**Optional / aus dem Flow genommen:** `/welcome/provider` (BYOK, optional, **kein** Counter), `/welcome/tools` (feature-flagged off → redirect), `/welcome/integrations` (nicht mehr im Pflicht-Flow; per URL + Settings→Konnektoren erreichbar). Code aller drei bleibt erhalten.

### Schritt-für-Schritt (verifizierte Wortlaute)

**1 · Sprache** — unverändert. „Willkommen bei Goblin" · English / Deutsch. Counter 01/0N.

**2 · Experience-Fork** (neu, ersetzt den alten „Wie soll Goblin mit der KI sprechen?"-Hero mit der COMING-SOON-Karte):
- DE: „**Kennst du dich mit Vibe Coding aus?**" → „Ja, kenne ich / Bring mich direkt rein." · „Noch nicht / Zeig mir kurz, wie es funktioniert."
- EN: „**Are you familiar with vibe coding?**" → „Yes, I am" · „Not yet".

**Explainer** (nur NO): „Du sagst, was du willst. Goblin baut es." + 3 Punkte (beschreiben → KI schreibt Code → du shipst). EN: „You say what you want. Goblin builds it."

**3 · Wie Goblin arbeitet** — ehrlich, 3 Ebenen:
- Ebene 1 **STANDARD**: „Goblins eigene Modelle — kein Key. Goblin Swift und Goblin Forge sind eingebaut und laufen in der Cloud … das ist der Standard und funktioniert sofort."
- Ebene 2 **OPTIONAL**: kostenlose Drittanbieter-Modelle (Groq/Gemini).
- Ebene 3 **OPTIONAL**: BYOK, bis zu 2 Keys/Provider, beliebig viele Provider.
- **Kein „BALD"/„COMING SOON"/Waitlist mehr.**

**4 · Modelle & Verbrauch** (neu): „Zwei Modelle. Ein Budget." — **Goblin Swift** (STANDARD, 1×) vs **Goblin Forge** (MEHR POWER, ~3×). Echte Zahlen aus `plan-builds.ts`: „In deiner Testphase: **33 Builds**" · „Bezahlte Pläne: Build 116, Pro 200, Power 411." Nur Zwei-Ebenen-Namen, **nie** eine rohe Provider-Model-ID.

**5 · Erster Build** (neu): „Goblin Swift ist startklar — kein Key, keine Karte." Primär: **„Ersten Build starten"** → Dashboard. Sekundär (klar optional): „Eigene Keys? Optional, jederzeit später → Key hinzufügen (optional)".

---

## 2 · HONESTY/KORREKTHEIT-FIXES (vorher → nachher)

| # | Vorher (Lüge/Fehler) | Nachher |
|---|---|---|
| 1 | Step 02 „Ohne Key starten … **COMING SOON / BALD** … Wir bringen es gerade online" | Swift ist **STANDARD, live**, key-loser Erst-Build-Pfad |
| 2 | Step 03 Ebene 2 „**BALD** laufen Goblins eigene Modelle" | Ebene 1 STANDARD „läuft sofort"; kein „bald" |
| 3 | Tools „Die 8 Werkzeuge, die **84% der Goblin-Nutzer** anlassen" | „Eine ausgewogene Auswahl fürs schnelle Bauen" (kein erfundener Prozentsatz) |
| 4 | Provider „**Sechs Provider**" / FAQ-Mismatch | „**BYOK optional** — Swift läuft schon ohne Key" + echte Caps (2/Provider, ∞ Provider) |
| 5 | Provider-Pro „Wo die **meisten Goblin-Nutzer** landen" | „Beste Qualität für komplexe Builds" |
| 6 | Step-Counter off-by-one (Header 0X/06 ≠ Body 0(X-1)/06) | Eine Quelle (`flow.ts`), Header = Footer, pro Branch korrekt |
| 7 | Englische „COMING SOON"-Badge in deutschem UI | Badges DE/EN durchgängig; keine Mischung |
| 8 | Step-Nummern in i18n-Strings einbetoniert | Aus allen Eyebrows entfernt; Counter nur noch in der Chrome |

**Provider-Count-Wahrheit:** Die echte `ProviderId`-Enum = anthropic, openai, google, groq, mistral, xai, deepseek, together, fireworks, openrouter (+ custom) → **10**. Die Landing-Page-Statistik „10 providers" ist also korrekt; das alte „Sechs"/„6" im Onboarding/FAQ war die Untertreibung. Onboarding nennt jetzt keine widersprüchliche Zahl mehr. (Landing-Inkonsistenz 7 Logos vs. 10 Stat ist außerhalb dieses Branch — siehe offene Punkte.)

---

## 3 · TOOLS-STEP — VERSTECKT, NICHT GELÖSCHT
- Flag: **`NEXT_PUBLIC_ONBOARDING_TOOLS_STEP`** (Default off) in `flow.ts`.
- Solange off: `/welcome/tools` rendert nicht (redirect → `/welcome/build`), und nichts im Live-Pfad verlinkt dorthin. **Verifiziert:** Aufruf von `/welcome/tools` landete sofort auf `/welcome/build`.
- Sämtlicher Code/Komponenten (Presets, Toggles, TOOL_COPY) bleibt erhalten.
- **Wieder einschalten:** `NEXT_PUBLIC_ONBOARDING_TOOLS_STEP=true` setzen. (Die „BALD"-Tools sind dann aber wieder default-on — vor dem Live-Schalten Wortlaut/Defaults nachschärfen.)

---

## 4 · PREFERENCE FLOW (aus Settings wiederholbar)
- Neue Settings-Section **„Einrichtung & Tour" / „Setup & Tour"** (Gruppe Goblin), registriert in **Desktop** (`sections.ts`) **und Mobile** (`SettingsRoot.tsx`).
- Zwei Optionen: **„Durch den Flow führen lassen"** (spielt die Tour neu ab) · **„Manuell einstellen"** (→ Settings/Keys).
- **Kein Account-Reset:** Re-run setzt ein einmaliges `localStorage('goblin:rerun-flow')`-Flag, das die Onboarding-Chrome respektiert: ein bereits abgeschlossener User darf den Flow erneut sehen, das Flag wird sofort gelöscht, **es werden keine Daten zurückgesetzt** (completed bleibt completed; nur die Schritte zeigen sich neu).
- **Verifiziert:** Mit gesetztem completed-Status blieb der User dank Flag auf `/welcome/language` (statt Bounce zu `/dashboard`), Flag wurde geleert.
- **Working name:** „Preference Flow" (intern). **User-facing Label „Einrichtung & Tour / Setup & Tour" → bitte bestätigen** (Alternativen unten).

---

## 5 · MIGRATION (vor Merge anwenden!)
**`supabase/migrations/0074_onboarding_experience_level.sql`** — fügt `onboarding_steps.experience_level text check(in 'new','experienced')` hinzu. Additiv, nullable, reversibel (drop column). Das Projekt führt Migrations **nicht** automatisch aus → **manuell im Supabase-SQL-Editor anwenden, bevor du mergst/deployst.**
- Bis dahin degradiert die Persistenz best-effort (non-blocking): die Experience-Wahl wird clientseitig (localStorage) gespeichert und treibt den Flow; die DB-Spalte wird erst nach Migration geschrieben.
- API-Schema (`apps/api/src/routes/onboarding.ts`) akzeptiert bereits `experience_level`.

---

## 6 · TESTS (autonom, lokal, beide Branches × beide Sprachen)
Getestet gegen lokalen `next dev` mit echter Session (Test-Account „Vincent Hafner") — Screenshots im Scratchpad `…/scratchpad/rebuild/`.

| Szenario | Ergebnis |
|---|---|
| **DE · NO** (kennt Vibe Coding nicht) | Sprache→Experience→Explainer→How→Models→Build→**Dashboard**, Counter **01–06** durchgängig konsistent ✓ |
| **DE · YES** (kennt es) | Explainer **übersprungen**, How = **03/05** (Total 05) ✓ |
| **EN · NO** | Experience/Explainer/How/Models/Build **vollständig Englisch**, Counter 0X/06, **keine Leaks** ✓ |
| Re-run aus Settings-Flag | Completed-User bleibt im Flow, **kein Reset**, Flag gelöscht ✓ |
| Tools versteckt | `/welcome/tools` → redirect `/welcome/build` ✓ |
| Provider optional | erreichbar, **kein** Step-Counter, „BYOK ist optional"-Wortlaut ✓ |
| Erster Build → Dashboard | landet auf Dashboard (Trial-Gate, no-card, unverändert) ✓ |

**Hinweis Test-Account:** Beim Build-Schritt habe ich auf dem prod-Test-Account `onboarding_completed=true` gesetzt (die lokale UI sprach via kopierter Session mit der prod-API). Wie vereinbart: **Test-Profil danach löschen/zurücksetzen.**

**Playwright-E2E nicht ausgeführt:** Die Suite zielt auf die **deployte** Seite (prod), die noch den alten Code fährt — gegen einen ungemergten Branch nicht aussagekräftig. Empfehlung: in einem Preview-Deploy / CI nach dem Merge laufen lassen. `tsc` (web+api) und `next build` sind grün; der manuelle End-to-End-Walk oben deckt die neuen Pfade ab.

---

## 7 · AUTONOME ENTSCHEIDUNGEN — bitte bestätigen
1. **User-facing Name** „Einrichtung & Tour / Setup & Tour" (intern „Preference Flow"). Alternativen: „Geführte Einrichtung", „Tour & Setup", „Erste Schritte".
2. **Forge-Verbrauch „~3×"** als illustrative Gewichtung im Models-Step. Die echte Gewichtung lebt server-seitig (`goblin-cap.ts`, ein Build ≈ 0,15M Units „reines Swift"). „~3×" ist eine ehrliche, runde Annäherung — falls du eine präzise Zahl willst, nenn sie, ich verdrahte sie.
3. **Integrations aus dem Pflicht-Flow genommen** (nur noch optional/Settings). Der Brief listete sie nicht im neuen Pfad; GitHub/Vercel bleiben unter Settings→Konnektoren erreichbar. Falls du sie als optionalen letzten Schritt zurück willst, sag Bescheap.
4. **Provider/BYOK** als optionaler, sekundärer Pfad vom Build-Step + Ebene-3-Link — nie erzwungen.
5. **Swift-„live"-Framing** gekoppelt an `NEXT_PUBLIC_GOBLIN_HOSTED_API` (siehe Risiko unten).
6. **Wortlaute** Experience/Explainer/Models/Build (DE+EN) komplett neu — starke, ehrliche Defaults; gerne nachschärfen.

---

## 8 · WICHTIGES RISIKO / KLÄRUNG (Swift „live")
Der bestehende Code (`goblin-hosted-models.ts`, i18n-Kommentar) ging davon aus, der no-key-Pfad sei **nicht** live (deshalb „COMING SOON") — getrieben von `NEXT_PUBLIC_GOBLIN_HOSTED_API` (Default off). **Dein Brief + mein erster prod-Walk beweisen aber das Gegenteil:** Goblin Swift (slug `goblin/efficient`) baute live eine komplette Seite, kein Key, kein Card, auf Trial.
- Ehrliche Auflösung im neuen Flow: Swift ist eingebaut und zieht vom **Plan-/Trial-Build-Budget** — „kein Key nötig" ist wahr, **solange ein Trial/Abo aktiv ist** (genau das liefert das Dashboard-Gate: 3-Tage-Trial ohne Karte).
- **Bitte bestätigen:** dass `NEXT_PUBLIC_GOBLIN_HOSTED_API=true` in prod gesetzt ist (sieht so aus — Swift lief im Walk). Falls in irgendeiner Umgebung off, zeigt die Chrome-Logik dort weiter neutral, statt fälschlich „live" zu behaupten.

---

## 9 · OFFENE PUNKTE (außerhalb dieses Branch)
- **Landing-Page** ist weiterhin **English-only** (`/de` = 404) und zeigt 7 Provider-Logos vs. „10 providers"-Statistik + 03/05-Mockup mit roher `claude-sonnet-4-6`-ID. Separater Sprint.
- `onboarding.ts` seedet bei Abschluss eine BYOK-Fallback-Kette (anthropic/google) — nur relevant, wenn der User solche Keys hinzufügt; der no-key-Swift-Default ist davon unabhängig. Unverändert gelassen (Routing-Detail, Risiko).

---

## 10 · DATEIEN, COMMITS, GATES, REVERT

**Commits (Branch `feat/onboarding-preference-flow`):**
- `8c88bad` feat(onboarding): restructure into honest, experience-aware Preference Flow
- `76cfd27` feat(settings): re-runnable Preference Flow + experience_level persistence
- `fbfb5ef` fix(onboarding): explainer back-label + SetupTourPage uses useOnbLang

**Neu:** `app/welcome/_components/flow.ts`, `app/welcome/explainer/page.tsx`, `app/welcome/models/page.tsx`, `app/welcome/build/page.tsx`, `components/settings/SetupTourPage.tsx`, `supabase/migrations/0074_onboarding_experience_level.sql`
**Geändert:** `app/welcome/page.tsx` (→ Experience-Fork), `app/welcome/routing/page.tsx`, `app/welcome/provider/page.tsx`, `app/welcome/tools/page.tsx`, `_components/chrome.tsx`, `_components/i18n.ts`, `_components/onboarding-state.ts`, `components/settings/sections.ts`, `components/settings/SettingsRoot.tsx`, `apps/api/src/routes/onboarding.ts`

**Gates:** web `tsc` 0 · api `tsc` 0 · `next build` 0 (9/9 welcome-Routen). Lint: das `react-hooks/set-state-in-effect`-Muster feuert auf der localStorage-Hydration — **identisch zum bereits ausgelieferten `useOnbLang`**, kein neuer Fehlertyp; `next build` grün.

**Revert (falls gewünscht):**
- Ganz verwerfen: `git checkout master` (Branch ungemergt) bzw. Branch löschen.
- Einzelnen Commit zurücknehmen: `git revert <sha>`.
- Migration 0074: nur anwenden, wenn du mergst; rückgängig per `alter table public.onboarding_steps drop column experience_level;`.

**HOLD:** Nicht gemerged, nicht deployed. Wartet auf deine Freigabe.
