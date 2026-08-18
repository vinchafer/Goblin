# Builder-Flow P0-Reparaturwelle — Bericht

**Basis:** `origin/master` = `6b7c718` (PR #106) · **Branch:** `claude/builder-flow-p0-repair-yrwqsp`
**Diagnose:** `docs/BUILDER_FLOW_DIAGNOSIS_2026_08_18.md` (U1, vor jedem Fix committet)

---

## 1. Zustand vor der Welle (U0)

| | Stand | Quelle |
|---|---|---|
| `origin/master` | `6b7c718` | `git rev-parse` |
| Web (Vercel) | `6b7c7180aa42…` = `6b7c718` | `GET www.justgoblin.com/api/version`, 2026-08-18 11:03 UTC |
| API (Railway) | `33ad3a82` = PR-#104-Merge | `GET goblinapi-production.up.railway.app/health` |
| PR #97–#101 in master? | **ja** (`e822c37` und darunter) | `git log` |

Die API läuft drei Merges hinter master — `adc95b5` (#105) und `6b7c718` (#106) waren docs-
bzw. web-only, die API ist inhaltlich also aktuell. `api.justgoblin.com` antwortet **nicht**;
der erreichbare Host ist `goblinapi-production.up.railway.app` (so auch in `/api/version`
hinterlegt). Das ist kein Defekt dieser Welle, aber es steht in FINDINGS.

**Pfad-Abweichungen gegenüber dem Auftrag** (der Plan gegen das Repo geprüft, Gesetz 10):

| Im Auftrag genannt | Tatsächlich |
|---|---|
| `apps/web` „dashboard shell / sidebar" | Die Seitenleiste ist `components/layout/Sidebar.tsx`. `components/app-shell/projects-list.tsx` existiert, wird aber **nirgends importiert** — toter Code (FINDINGS). |
| `ChatInput` „hält openHub und Send-to-Code" | `components/chat/ChatInput.tsx` enthält weder. Send-to-Code liegt in `components/chat/standalone-chat.tsx` (`stashAndRouteToCode`, `CodeActionButton`). |
| `apps/api/src/lib/parse-code-blocks.ts` | Existiert, war an keinem der sieben Defekte beteiligt — nicht angefasst. |
| `SessionPane` „inkl. buildReviews" | Existiert (`buildReviews`), an keinem Defekt beteiligt — nicht angefasst. |
| Publish-Sheet „Live stellen" | `components/code/HostedPublishSheet.tsx` — bestätigt. |
| `apps/api/src/routes/code-sessions.ts` `/messages` | Bestätigt. |
| `POST /api/ops/apps/publish` | Bestätigt (`routes/ops.ts:257`). |

---

## 2. Units und Commits

| Unit | Defekt | Commit | Falsifikation (vorher/nachher) |
|---|---|---|---|
| U1 | Diagnose, 7/7 | `8a6e6bf` | — (Diagnose-only) |
| U2 | D-A · Send-to-Code | `884b03c` | API **3/3 fallen** → 3/3 grün · Web **1/6 fällt** → 6/6 grün |
| U3 | D-C · Dateiliste | `98efdb4` | **2/4 fallen** → 4/4 grün |
| U4 | D-D · Editor-Hydration | `272fa90` | **4/4 fallen** → 4/4 grün |
| U5 | D-B · Turn-Persistenz | `4c74e0d` | **4/4 fallen** → 4/4 grün |
| U6 | D-E · Navigation | `b9ee102` | **5/5 fallen** → 5/5 grün |
| U7a | D-F1 · Fehler-Ehrlichkeit | `289583f` | Web **5/7 fallen** → 7/7 grün · API **4/4 fallen** → 4/4 grün |
| U7b | D-F2 · Diagnostizierbarkeit | `7e5e8ff` | **1/1 fällt** → 1/1 grün |
| U8 | D-G · Code-Lesbarkeit | `6980730` | **13/22 fallen** → 22/22 grün |
| U9 | Sweep, Probes, Ledger | `a2de815` | Sweep 27/27 · Probes 4/4 |
| U5b | D-B · die Garantie meldet sich | (Founder-Einwand) | **3/4 fallen** → 4/4 grün |

**Ehrliche Einordnung der Falsifikationszahlen.** Nicht jede Zahl oben ist gleich viel wert:

* **U2 Web (1/6):** die fünf übrigen prüfen `lib/stc-outcome.ts`, ein Modul, das es vorher
  nicht gab — sie *können* auf dem Vorher-Stand nicht fallen. Die Falsifikation trägt die
  API-Seite (3/3) und der eine Hook-Test.
* **U6 (5/5):** nur **2** fallen wegen der Verhaltensänderung. Die anderen 3 fallen, weil
  `resolveProjectHref` vorher nicht exportiert war und der Import scheitert. Sie sichern
  die Fälle, die sich *nicht* bewegen dürfen, und behaupten die Vorher-Werte.
* **U7a API (4/4):** dasselbe Muster — `publishFailureStatus` ist neu extrahiert. Nur der
  erste Test kodiert die Änderung; drei sichern die unveränderten Klassen.
* **U3 (2/4)** und **U7a Web (5/7):** die nicht fallenden Tests sind Absicht — sie sind die
  Sicherung gegen eine Überkorrektur (ein leeres Projekt muss „keine Dateien" bleiben; ein
  4xx muss die Servermeldung weiterhin durchreichen).
* **U8 (13/22)** ist gegen den **echten** Vorher-Zustand gemessen: ein Light-Theme auf beiden
  Oberflächen, rekonstruiert aus `git show HEAD:…goblin-light.json` in beide Theme-Dateien.

---

## 3. Gates

| Gate | Ergebnis |
|---|---|
| U1: Ursache oder ehrliches UNGEKLÄRT für alle sieben | **7/7** |
| U2–U8: falsifizierter Test je Unit | **8/8 Units** (Zahlen oben) |
| Web-Suite grün | **55 Dateien / 693 Tests** |
| API-Suite grün | **180 Dateien / 2429 Tests** |
| Typecheck Web + API | grün |
| Lint (Web) | **160 Probleme (139 Fehler / 21 Warnungen) — identisch mit `origin/master`.** Die Welle fügt kein einziges hinzu. Die 139 sind Altbestand und ausserhalb dieses Auftrags. |
| Honesty-Sweep über neue Strings | **24 Strings** (12 DE + 12 EN), 27 Assertions grün |
| D-G: Kontrastwerte als Zahlen, beide Themes | unten, 18 Messwerte |
| Cohort-Exposure-Tabelle | **7/7** |
| Gerenderter Walk | **FOUNDER-PENDING** — kein Browser in dieser Umgebung |

### D-G — Kontrast, gemessen (WCAG 2.1, `lib/contrast.ts`)

Oberfläche = `--surface-1` (aus `styles/design-tokens.css` gelesen, nicht im Test wiederholt).
`globals.css` entfernt den Theme-Hintergrund, deshalb ist `--surface-1` der reale Grund.

| Scope | hell vorher | hell nachher | dunkel vorher | dunkel nachher |
|---|---|---|---|---|
| editor.foreground | 10.59 | **10.59** | 1.23 ❌ | **8.63** |
| keyword | 11.66 | **11.66** | 1.11 ❌ | **6.64** |
| constant / numeric | 3.80 ❌ | **5.71** | 3.42 ❌ | **8.67** |
| string | 6.25 | **6.25** | 2.08 ❌ | **5.79** |
| entity.name.function | 13.00 | **13.00** | **1.00** ❌ | **6.74** |
| entity.name.type | 3.80 ❌ | **5.71** | 3.42 ❌ | **8.67** |
| variable | 10.59 | **10.59** | 1.23 ❌ | **8.63** |
| comment | 5.06 | **6.78** | 2.57 ❌ | **5.43** |
| punctuation | **2.16** ❌ | **10.59** | 6.01 | **5.43** |

Minimum nachher: **5.71:1 hell, 5.43:1 dunkel** — alle über AA (4.5:1).
`entity.name.function` stand im Dark-Theme bei **1.00:1**: exakt die Hintergrundfarbe.

Keine Farbe erfunden. `goblin-dark.json` benutzt ausschliesslich Werte, die im
`[data-theme="dark"]`-Block von `design-tokens.css` bereits stehen und dort gemessen sind
(`--ink-1/2/3`, `--success`, `--warning`, `--danger`, `--info`). Die zwei durchgefallenen
Light-Werte gehen auf `--gold-800` (`#7E5C1B`) und `--ink-2`/`--ink-3`. JetBrains Mono
unverändert (`.cb-body`).

---

## 4. Cohort-Exposure — kann ein normales Testnutzer-Konto das heute treffen?

„Normal" = kein Beta-Flag, kein Founder-Konto, Act-1-Kohorte auf Produktion.

| # | Defekt | Trifft die Kohorte? | Begründung |
|---|---|---|---|
| **D-A** | Send-to-Code öffnet leere Session | **JA** | Der Pfad ist ungegated: `standalone-chat.tsx` → `sessionStorage` → `CodeWorkspace`. Kein Flag. **Aber:** der Defekt schlägt nur zu, wenn das Entwurfs-Insert fehlschlägt — Häufigkeit unbekannt (siehe HONEST LIMITATIONS). Die *Blindheit* traf jeden, der ihn traf. |
| **D-B** | Nutzer-Turn verschwindet | **JA** | Der Code-Tab-Thread hatte für **jeden** Nutzer keinen optimistischen Turn. Die Sichtbarkeit der eigenen Nachricht hing an einem Netzaufruf — das ist keine Konto-Eigenschaft. |
| **D-C** | „keine Dateien" trotz Dateien | **JA** | `list_files` läuft in jedem Agent-Lauf. Agent-Läufe brauchen ein Goblin-Tier-Modell (`agentEligibility`), aber das haben Kohortenkonten. Der klassische `/messages`-Pfad war über `hydrateSessionFiles` genauso exponiert. |
| **D-D** | Editor erst nach Umweg | **JA** | Jeder erste Eintritt in den Code-Tab. Der auslösende 429/5xx betrifft die Kohorte sogar **stärker** als den Founder: dasselbe Rate-Limit, dieselbe Request-Salve. |
| **D-E** | Sackgasse aus dem Code-Tab | **JA, beide Hälften** | (1) Smart-Resume liest `goblin:wsTab` — kein Flag. Jeder, der im Code-Tab auf sein eigenes Projekt klickt, bekam ein No-Op. (2) Der Ausgang fehlte auf **Desktop** komplett; auf Mobile war er da. |
| **D-F1** | „Server kurz nicht erreichbar" | **JA, weit über Publish hinaus** | `friendlyError` sitzt in `lib/api.ts` und bedient **alle** `apiGet/apiPost/apiPut/apiPatch/apiDelete`-Aufrufe der App. Jeder 5xx auf jedem Screen bekam die erfundene Ursache. Das Publish-Sheet selbst ist Beta-gated — die *Lüge* war es nicht. |
| **D-F2** | Der eigentliche Publish-Fehlschlag | **NEIN** | Das Hosted-Publish-Sheet mountet nur nach `GET /api/ops/eligibility` (Allowlist); ein nicht freigeschaltetes Konto lädt den Chunk nicht einmal. Kohortenkonten sehen den Vercel-Pfad. |
| **D-G** | Code kaum lesbar | **JA** | Jeder Codeblock im Chat, jedes Konto. Im Dark-Theme war generierter Code faktisch unlesbar (1.00–2.57:1); im Light-Theme war die Interpunktion bei 2.16:1. |

**Was der Founder daraus ableiten kann:** sechs von sieben Defekten lagen auf der Fläche der
Kohorte, und **D-F1 lag auf jedem Screen der App**, nicht nur auf dem Publish-Sheet. Ob
den Testern etwas mitzuteilen ist, ist eine Founder-Entscheidung — die Tabelle ist die
Grundlage dafür, keine Empfehlung.

---

## 5. HONEST LIMITATIONS

1. **Kein Browser. Kein Walk.** Nichts in dieser Welle ist gerendert überprüft. Jede
   Aussage über *Aussehen* — der neue Hinweis in `CodeWorkspace`, der Desktop-Zurück-Knopf,
   die Codeblock-Farben — ist aus Code und Zahlen abgeleitet, nicht gesehen. Die
   Kontrastwerte sind rechnerisch exakt; ob der Block nach dem Fix *gut aussieht*, hat
   niemand geprüft. → FOUNDER ACTIONS.
2. **D-A: die Ursache des konkreten Fehlschlags ist nicht belegt.** Belegt ist, dass die
   Antwort einen Entwurf bestätigte, den sie nie geprüft hatte, und dass ein fehlgeschlagenes
   Insert genau das beobachtete Bild erzeugt. Ob es im Lauf des Founders wirklich fehlschlug
   — und wenn ja, warum — kann nur ein Blick in die Supabase-Logs sagen. **Der Fix macht den
   Fehlschlag sichtbar; er beseitigt nicht bewiesenermassen dessen Auslöser.** Wenn der
   Founder nach dem Merge dieselbe leere Session sieht, aber *ohne* den neuen Hinweis, dann
   war meine Hypothese falsch und der Payload geht früher verloren.
3. **D-B bleibt UNGEKLÄRT.** Ich habe drei Kandidaten ausgeschlossen (serverseitige
   Persistenz, die Einklappregel, eine Regression der Lock-Screen-Behebung — das ist ein
   anderer Pfad, `lib/chat-recovery.ts`). Welcher Refresh den Turn entfernte, weiss ich
   nicht. U5 erfüllt den Vertrag („die Nachricht bleibt stehen"), ohne die Ursache zu
   kennen. Das ist eine Symptomabsicherung, und sie ist als solche benannt.
   **U5b (Founder-Einwand vor dem Merge):** die Garantie war *still* — sie hätte D-B
   dauerhaft undiagnostizierbar gemacht, weil der Moment, in dem sie greift, der
   einzige ist, der die Ursache je klären kann. Sie schreibt jetzt eine
   `console.warn`-Zeile mit `survivedRefreshes`; ab zwei überlebten Refreshes ist es
   D-B und nicht mehr ein Rennen mit dem Insert. Der Einwand war berechtigt: ich hatte
   einen Fix gebaut, der seine eigene Evidenz verbirgt.
4. **D-F2 ist nicht behoben, weil nicht diagnostiziert.** Die Hauptvermutung
   (`empty_artifact`, weil im Chat gebauter Code bis zum „Sichern" nur Entwurf ist) ist
   plausibel und unbelegt. Ich habe nichts auf Verdacht gepatcht. U7b sorgt dafür, dass der
   nächste Versuch die Antwort liefert.
5. **D-E(1) stand zuerst falsch in der Diagnose.** Ich hatte `app-shell/projects-list.tsx`
   als Fundstelle vermutet und „UNGEKLÄRT" geschrieben. Beides war falsch; die Korrektur
   steht sichtbar im Diagnosedokument. Ein Leser, der nur den ersten Commit liest, liest
   eine falsche Aussage.
6. **Die Ledger-Zeile kam zu spät.** Regel: „in demselben Commit". M18 betrifft U3 (weniger
   Tokens) und U4 (bis zu 3 zusätzliche GETs) und ist erst in U9 gelandet, nicht in U3/U4.
   Sie ist im selben PR, aber die Regel sagt Commit, und die habe ich verfehlt.
7. **`empty_artifact` 502 → 422 ist ein Vertragswechsel.** Kein Test im Repo hing daran (die
   Suite blieb grün, und ich habe die Zuordnung nachträglich getestet) — aber ein externer
   Konsument, den ich nicht kenne, könnte auf 502 gehört haben. Innerhalb des Repos ist
   `classifyPublishOutcome` statusunabhängig für diesen Fall (`apiPost` wirft bei jedem
   non-2xx), also unkritisch.
8. **U3 verweigert jetzt Läufe.** Wenn `hydrateSessionFiles` in Produktion häufiger
   fehlschlägt als gedacht, tauscht diese Welle „falsche Antwort" gegen „gar keine Antwort".
   Das ist die richtige Richtung — aber es ist eine Verhaltensänderung mit unbekannter
   Frequenz, weil `session_hydrate_failed` geloggt und nie gezählt wird.
9. **Nur eine `highlight()`-Fundstelle.** Ich habe verifiziert, dass es genau eine gibt
   (`components/chat/CodeBlock.tsx`). `components/workspace/CodeBlock.tsx` rendert Code mit
   **fest verdrahteten** GitHub-Dark-Farben (`#0d1117`/`#e6edf3`) — lesbar (~14:1), aber
   ausserhalb des Designsystems. Nicht angefasst (FINDINGS).

---

## 6. FINDINGS — gefunden, nicht behoben

1. **`components/app-shell/projects-list.tsx` ist toter Code.** Wird nirgends importiert.
   Enthält eine eigene, abweichende Projekt-Navigation und englische UI-Strings
   („Projects"). Ein Leser (oder ein Agent) kann ihn für die echte Seitenleiste halten —
   ich habe genau das getan. Löschen oder als tot markieren.
2. **`api.justgoblin.com` antwortet nicht.** Der erreichbare API-Host ist
   `goblinapi-production.up.railway.app`. Wenn irgendwo Dokumentation oder ein Runbook
   `api.justgoblin.com` nennt, führt es ins Leere.
3. **`readSessionFile` verwirft den Supabase-Fehler** (`services/agent/tools.ts`,
   `maybeSingle()` ohne `error`). Dieselbe Fehlerklasse wie D-C: ein fehlgeschlagener Read
   sieht aus wie „Datei existiert nicht" und `toolReadFile` meldet `not_found`. Bewusst
   nicht in U3 mitgenommen (D-C ist das *Listing*), gehört aber in die nächste Welle.
4. **`components/workspace/CodeBlock.tsx` benutzt fest verdrahtete Nicht-Token-Farben**
   (`#1e1e1e`, `#0d1117`, `#e6edf3`, `#161b22`). Lesbar, aber theme-blind und ausserhalb
   des Designsystems. Ausserdem unklar, ob die Fläche noch lebt: sie hängt an
   `workspace/chat-tab.tsx`, während der Projekt-Chat inzwischen `StandaloneChat` rendert.
5. **`session_hydrate_failed` wird geloggt, aber nie gezählt.** Ohne Zähler ist die
   Frequenz von D-C/D-D in Produktion nicht bestimmbar — und damit auch nicht die Ersparnis
   aus U3 (siehe Ledger M18).
6. **Der Code-Tab feuert beim Betreten sechs Requests parallel** gegen eine API mit 60/min.
   U4 härtet den einen, der D-D auslöste. Die anderen fünf (Verfügbarkeitssonde,
   Session-Liste, Projekt, `fetchAllTextFilesWithStatus`, Hosted-Eligibility) sind
   unverändert exponiert. Die Sonde in `code-tab.tsx` ist ausserdem redundant: sie fragt
   dieselbe Liste ab, die `useCodeSessions` unmittelbar danach erneut holt.
7. **Der Code-Tab ist überwiegend deutsch-only.** Ich habe alle Strings dieser Welle
   zweisprachig gemacht, aber die Nachbarschaft (`SessionThread`, `CodeWorkspace`-Leerzustand,
   „Neue Session") ist es nicht. Ein englischer Nutzer sieht eine gemischte Fläche.
8. **Der Entwurfs→Projektspeicher-Übergang ist unerklärt.** Im Chat gebauter Code liegt bis
   zum „Sichern" nur in der Session; `publishHostedApp` und `listFiles` lesen den
   Projektspeicher. Für den Nutzer sieht es aus, als wäre der Code „im Projekt". Das ist
   keine Fehlfunktion, sondern eine fehlende Erklärung — und die wahrscheinlichste Wurzel
   von D-F2. Produktentscheidung, deshalb hier und nicht im Diff.

---

## 7. FOUNDER ACTIONS

### A. Der gerenderte Walk (ersetzt kein Gate, schliesst es)

Nach dem Merge, auf Produktion, mit **offener Browser-Konsole**. Zwei Zeilen sind es,
auf die es dabei ankommt — `[goblin] code-tab user turn not acknowledged…` (D-B) und
`[goblin] hosted publish failed…` (D-F2):

1. Neues Projekt, im Chat bauen lassen (derselbe Prompt wie am 18.8.).
2. **„An Code senden"** → erwartet: Code-Tab, *diese* Session offen, Datei sichtbar, **in
   einem Schritt**. Erscheint stattdessen der neue Hinweis „Die Session wurde angelegt, aber
   der Code aus dem Chat ist nicht darin angekommen" — dann ist D-A reproduziert **und
   sichtbar**, und die Ursache liegt im Entwurfs-Insert (Supabase-Logs, `code_session_initial_file_failed`).
   Erscheint eine leere Session **ohne** Hinweis: meine Hypothese war falsch, bitte melden.
3. Im Code-Tab „stell mir das live" schreiben → erwartet: die Blase **bleibt** stehen.
   In der Konsole: erscheint `[goblin] code-tab user turn not acknowledged` mit
   `survivedRefreshes: 1`, war es ein Rennen mit dem Insert. Mit **2 oder mehr**
   (`likelyDefect: true`) ist D-B reproduziert — dann bitte die Zeile schicken, sie
   ist die Evidenz, die der Welle gefehlt hat. Gar keine Zeile heisst: sauber.
4. Projekt verlassen, zurück, Editor öffnen → erwartet: Dateien beim **ersten** Mal da.
5. Im Code-Tab links in der Seitenleiste auf **dasselbe** Projekt klicken → erwartet:
   Projektübersicht. Zusätzlich: der neue Knopf „‹ Projekt" oben links im Code-Tab.
6. Codeblock im Chat ansehen, **Theme umschalten** (hell ↔ dunkel) → erwartet: in beiden
   lesbar. Das ist der eine Punkt, den ich nicht messen konnte: dass es *gut* aussieht.

### B. D-F2 — die eine Zeile, die die Frage beantwortet

„Live stellen" **einmal** mit offener Konsole. Seit U7b steht dort:

```
[goblin] hosted publish failed { projectId, name, status, code, message }
```

`code` ist die Antwort. Erwartete Werte und was sie bedeuten:

| `code` | Bedeutung | Nächster Schritt |
|---|---|---|
| `empty_artifact` (422) | Der Projektspeicher ist leer — der Code liegt noch als Entwurf in der Session | **Hauptvermutung.** Dann ist die nächste Welle „Entwurf → Projekt sichtbar machen", nicht Publish |
| `not_verified` (502) | Hochgeladen, aber nicht als erreichbar bestätigt | Die bekannte Verifikations-Baustelle |
| `d1_unavailable` (503) | Cloudflare D1 | Ausserhalb der App — Token/Account prüfen |
| `upload_failed` / `route_failed` (502) | R2 / Routing | Ausserhalb der App |
| `scan_review` (202) | Gehalten, kein Fehler | Kein Fehlschlag |

Falls in der Konsole **nichts** steht: der Fehlschlag kam nicht aus `apiPost` — dann bitte
den vollen Konsolen-Auszug schicken.

### C. Entscheidungen, die bei dir liegen

1. **Den Testern etwas sagen?** Sechs von sieben Defekten lagen auf der Kohortenfläche
   (Tabelle §4). D-F1 lag auf jedem Screen. Das ist deine Entscheidung, nicht meine.
2. **FINDINGS 1 und 4** (toter Code, theme-blinder Codeblock): löschen oder stehen lassen?
3. **FINDINGS 8** (Entwurf vs. Projektspeicher): das ist eine Produktfrage, keine Bugfrage.
   Wenn D-F2 sich als `empty_artifact` bestätigt, ist sie die wichtigste offene Frage der
   Welle.

**Keine neuen Env-Variablen. Keine neue Abhängigkeit. Keine Migration. Kein neues Konto.
Keine Aktion mit Geldbezug.** Diese Welle brauchte nichts davon.

---

## 8. Selbstprüfung

**Evidence-Audit.** Jede Ursachenaussage in der Diagnose trägt Datei + Zeile. Drei Aussagen
sind ausdrücklich *keine* Ursachenaussagen (D-A konkret, D-B, D-F2) und stehen als
Vermutung bzw. UNGEKLÄRT. Die Kontrastzahlen kommen aus `lib/contrast.ts` über die echten
Theme-Dateien und die echte `--surface-1` aus dem Stylesheet.

**Diffstat gegen Scope.**

```
15 Produktionsdateien geändert, 8 Testdateien + 3 Module + 2 Docs neu
```
Angefasst wurden ausschliesslich Dateien, die in der Diagnose als Fundstelle benannt sind,
plus `lib/theme.tsx` (der nicht-werfende Theme-Zugriff, den U8 braucht) und
`components/code/StatusStrip.tsx` (der `unknown`-Zustand, den U4 braucht). **Kein**
Abuse-Scanner, **kein** Act-2-Phasencode ausser der in D-F genannten Fehlerbehandlung,
**kein** Layout-Redesign, keine Migration, keine neue Abhängigkeit.

**Regression-Probe.** Drei Probes auf nicht angefassten Pfaden
(`lib/wave-regression-probe.test.tsx`, 4/4): eine gewöhnliche Session ohne Send-to-Code zeigt
keinen Hinweis; ein Codeblock **ohne** ThemeProvider fällt auf hell zurück statt zu werfen;
`apiGet` auf 200 liefert unverändert den Body. Zusätzlich die bestehenden
PR-#97–#101-Regressionstests plus der Dark-Kontrast-Audit: **89/89 grün**
(`useCodeSessions` 2, `code-tab` 4, `publish-sheet-regression` 3, `hosted-publish-sheet` 19,
`dark-contrast` 61).

**Honesty-Sweep.** 24 Strings (12 DE + 12 EN), maschinell geprüft gegen erfundene Ursache,
erfundene Zeitangabe, Rohdaten, Selbstbezeichnung und untranslated leak
(`lib/wave-honesty-sweep.test.ts`, 27/27). Entfernt: „Server kurz nicht erreichbar – bitte
gleich nochmal versuchen." und die Verwendung von „Sitzung abgelaufen" für 403.

**Ledger.** M18 ergänzt. Nicht neutral: U3 spart Tokens (unbeziffert, weil
`session_hydrate_failed` nie gezählt wird), U4 kostet bis zu 3 zusätzliche GETs pro
fehlgeschlagenem Detail-Load gegen die eigene API. Kein Drittanbieter, keine neue Klasse.
**Regelverstoss:** die Zeile gehört in U3/U4, sie steht in U9 (Limitation 6).

---

## 9. Die Skeptikerfrage

> „Käme ein skeptischer Reviewer mit nur meinen Belegen zu meinem Urteil?"

**Ja — für D-C, D-D, D-E, D-F1 und D-G.** Dort ist die Ursache eine benannte Codezeile, der
Fehlschlag ist vor dem Fix reproduzierbar und die Zahlen sind nachrechenbar (D-G sogar aus
den eingecheckten Theme-Dateien mit einem Dreizeiler).

**Nein — für D-A, D-B und D-F2**, und ich habe die Behauptungen entsprechend abgeschwächt:

* **D-A:** Ich behaupte *nicht*, den Auslöser gefunden zu haben. Ich behaupte, die
  Antwort bestätigte einen ungeprüften Zustand — das ist bewiesen (3/3 API-Tests) — und
  dass diese Blindheit exakt das beobachtete Bild erzeugt. Ein Skeptiker käme zu demselben
  Urteil über die *Blindheit* und zu keinem Urteil über die Ursache. Genau so steht es da.
* **D-B:** als UNGEKLÄRT deklariert, mit drei ausgeschlossenen Kandidaten. Der Fix ist als
  Symptomabsicherung benannt, nicht als Ursachenbehebung.
* **D-F2:** nicht behoben. Die Vermutung ist als Vermutung markiert, und das Artefakt, das
  sie entscheidet, ist gebaut statt geraten.

**Wo ein Skeptiker mich schlagen würde:** an den Falsifikationszahlen. „13/22" und „5/5"
klingen stärker als sie sind, wenn ein Teil nur fällt, weil ein neues Modul fehlt. Deshalb
steht die Aufschlüsselung in §2 und nicht in einer Fussnote — und deshalb ist U2s echte
Falsifikation die API-Seite, nicht die Web-Seite.
