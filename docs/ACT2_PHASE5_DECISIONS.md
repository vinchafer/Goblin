# AKT 2 · PHASE 5 — DIE FÜNF ENTSCHEIDUNGEN (P5-a … P5-e)

**Geschrieben: 2026-08-14 · Autor: CC · Branch `claude/keeper-1a-heartbeat-status-aa8wgj`**
**Grundlage: Master-Plan Phase 5, Thesis §5.3 (K0), Blueprint Red-Team A1, Spike-Befund F2 —
jeweils gegen den heutigen Code und gegen das Repo nachgeprüft.**

Unit 0 des Phase-5-Prompts verlangt, dass fünf Fragen **vor der ersten Zeile Code** fallen. Dieses
Dokument beantwortet sie, sagt bei jeder, **wer** sie entschieden hat und **womit** sie umkehrbar
ist, und benennt die Stellen, an denen der Prompt gegen das Repo verliert.

**Die Regel, unter der CC hier entschieden hat** (dieselbe wie in Phase 4): selbst entscheiden, wenn
die Antwort aus einer bestehenden Gründer-Entscheidung, einem dokumentierten Prinzip oder der
offensichtlich risikoärmeren Option folgt — und das Prinzip dabei benennen. Eskalieren nur, was
wirklich an Geld, Rechtsrisiko, Nutzerdaten oder ungeklärter Produktphilosophie hängt.

**Alle fünf sind entschieden. Nichts hält an.** Eine Eskalation an den Gründer steht unten (G-P5-1);
sie blockiert diese Phase nicht, weil sie erst fällig wird, wenn die Flotte wächst.

---

## VORAB — die Stelle, an der der Prompt gegen das Repo verliert

Der Phase-5-Prompt sagt: *„die dokumentierte Cron-Triggers-Decke ist 250 pro Konto"*. Das Repo sagt
etwas anderes, und der Unterschied ist nicht kosmetisch.

`docs/OPS_SPIKE_0_DECISION_TABLE.md` §2 (Zeile 104), abgerufen 2026-07-25 von
`developers.cloudflare.com/workers/platform/limits/`:

> **Cron Triggers** | **Account-level limit: 5 (Free) / 250 (Paid).**

**Goblin fährt den Workers-FREE-Plan** (Gründer-Entscheid D2-amended 2026-07-27; M-H1: *„Committed
fixed cost for this plane: $0.00/month"*). Die Decke, die für uns gilt, ist also **5**, nicht 250.

Das ändert die Schärfe von Spike-Befund **F2** erheblich: ein Cron pro Living App bricht nicht bei
250 Apps, sondern **bei fünf**. Der Befund selbst („K0 muss ein Fan-out über die App-Liste sein,
kein Trigger pro Tenant") wird davon nur bestätigt — aber wer die 250 im Kopf hat, hält das für ein
Skalierungsproblem von übermorgen. Es ist eines von nächster Woche.

*Gesetz 1 (State-first, Repo > Prompt): die 5 gilt. Im Bericht als Befund geführt.*

---

## P5-a — Prüftakt und was er kostet

### ENTSCHIEDEN: kein Cloudflare-Cron. Ein In-Process-Fan-out in der API, Takt aus einem festen Anteil des Tagesbudgets abgeleitet.

**Von CC unter stehenden Prinzipien; der Gründer kann es umkehren (ein Modul, ein Startaufruf).**

### Die Fan-out-Form (F2, verschärft)

Ein Tick treibt **alle** Apps. Nie ein Trigger pro App. Das ist F2s Konsequenz und mit der
Free-Decke von 5 Triggern ist sie nicht verhandelbar.

Die weitergehende Entscheidung: **es wird gar kein Cron-Trigger verbraucht — 0 von 5.** Der Läufer
lebt im Railway-API-Prozess, der ohnehin dauerhaft läuft. Begründung, in der Reihenfolge ihres
Gewichts:

1. **Ein Cloudflare-Cron-Worker bräuchte ein Geheimnis**, um Ergebnisse an die Plattform-API zu
   posten, und damit eine neue Vertrauensgrenze mit einem neuen Ding, das lecken kann. Der Läufer
   im API-Prozess steht bereits neben der Registry und der Datenbank und braucht keinen zweiten
   Ausweis.
2. **Ein Cron-Worker wäre eine zweite Deploy-Oberfläche**, die niemand aus einer CC-Sitzung
   deployen kann (keine Cloudflare-Zugangsdaten, stehendes Gesetz 4). Der Gründer müsste sie von
   Hand aufsetzen — eine Gründer-Aktion für etwas, das ohne sie funktioniert.
3. **0 von 5 ist strikt besser als 1 von 5**, solange die Decke 5 ist.

**Was das kostet, ehrlich:** der Läufer ist an den Lebenszyklus des API-Prozesses gebunden. Fährt
Railway die Instanz neu hoch, gibt es eine Lücke im Prüfraster — und genau dafür ist UNBEKANNT da
(P5-d). Fährt Railway **mehrere** Instanzen, läuft der Läufer mehrfach: doppelte Zeilen, doppeltes
Anfragevolumen. Das ist dieselbe Klasse Problem wie **P3** (In-Process-Rate-Limiter der Formulare)
und wird genauso behandelt: benannt, in die Budgetformel eingerechnet (× Instanzen), und als
Carry-forward-Zeile geführt statt mit einem verteilten Lease erschlagen, den heute niemand braucht.

### Die Kosten-Arithmetik

Das Budget, das wirklich bindet, ist **100 000 Requests/Tag kontoweit** auf Workers Free
(`cf-deploy.ts:16`, Ledger M-H1 — mit dessen eigener Provenienz-Warnung: die Zahl ist aus dem
Lean-Substrat-Entscheid geerbt, nicht frisch nachgeschlagen).

Nur die **Entry-Prüfung** einer App geht durch den Router und zählt gegen dieses Budget. Die
Formular-Speicherprüfung geht an die Cloudflare-D1-API, die Plattform-Prüfungen gehen an Vercel und
Railway — keine davon ruft den Router auf.

```
Heartbeat-Requests an den Router pro Tag = aktive Apps × (1440 / Taktminuten) × Instanzen
```

Bei 5-Minuten-Takt und einer Instanz:

| Aktive Apps | Requests/Tag | Anteil an 100 000 |
|---|---|---|
| 1 | 288 | 0,29 % |
| 10 | 2 880 | 2,9 % |
| 17 | 4 896 | 4,9 % |
| 50 | 14 400 | 14,4 % |
| 100 | 28 800 | 28,8 % |

Der Spike hat dieselbe Rechnung von der anderen Seite gemacht (§2.2, Profil B): **8 640 von 10 640
Requests einer typischen App im Monat — 81,2 % — sind Goblins eigener Heartbeat.** Bei wenig
Traffic ist die Überwachung die Last, nicht die Nutzer. Deshalb ist der Takt eine echte
Kostenstellschraube und keine Geschmacksfrage.

**Die Entscheidung: ein fester Anteil, aus dem der Takt folgt.**

```
HEARTBEAT_DAILY_REQUEST_BUDGET = 5 000 Requests/Tag   (5 % der Flotten-Decke)
Takt = clamp( aufgerundet-auf-5-Minuten( Apps × 1440 / 5 000 ), 5 … 60 Minuten )
```

| Aktive Apps | abgeleiteter Takt | Requests/Tag am Bandende |
|---|---|---|
| 1 – 17 | 5 min | 4 896 |
| 18 – 34 | 10 min | 4 896 |
| 35 – 52 | 15 min | 4 992 |
| 53 – 69 | 20 min | 4 968 |
| 70 – 86 | 25 min | 4 954 |
| 87 – 104 | 30 min | 4 992 |
| 105 – 121 | 35 min | 4 978 |
| 122 – 138 | 40 min | 4 968 |
| 139 – 156 | 45 min | 4 992 |
| 157 – 173 | 50 min | 4 982 |
| 174 – 190 | 55 min | 4 975 |
| 191 – 208 | 60 min | 4 992 |
| **≥ 209** | 60 min (Decke) | **5 016 und mehr — über Budget** |

*(Die Tabelle ist nicht abgeschrieben, sondern aus derselben Formel gerechnet, die der Code
verwendet; `ops-check-budget.test.ts` hält die Bandgrenzen fest.)*

Warum 5 % und nicht mehr: der Heartbeat darf **echten Traffic nie verdrängen**. 5 % ist reichlich
für den Beta-Radius und klein genug, dass eine App unter Last nicht wegen unserer eigenen Prüfungen
in die Tagesdecke läuft.

Warum eine Decke bei 60 Minuten statt weiter zu strecken: jenseits davon wird die Erkennungszeit
(2 Zyklen, P5-d) zu einer Zahl, die niemand mehr „Heartbeat" nennen sollte. **Ab 209 aktiven Apps
sagt der Läufer nicht leise weiter, sondern meldet, dass er über Budget läuft** — die Konsole zeigt
es, und es ist dann eine Entscheidung mit Preis (Workers Paid, $5/Monat), nicht ein stilles
Überziehen. Das ist **G-P5-1** unten.

**Der Takt ist keine Zusage.** Er bestimmt, wie oft gemessen wird — jede Anzeige zeigt trotzdem
ausschließlich den **gemessenen** Zeitstempel. Es gibt keine Stelle im Code, die aus „Takt ist 5
Minuten" schließt, wann zuletzt geprüft wurde.

---

## P5-b — Was eine Prüfung wirklich fragt

### ENTSCHIEDEN: vier Fragen, zwei davon pro App, zwei davon pro Plattform. Nichts, was wir nicht ehrlich deuten können.

**Von CC unter stehenden Prinzipien.**

### Pro App

| Prüfung | Was sie tut | Wie sie gedeutet wird |
|---|---|---|
| `entry` | `GET https://{name}.{appsDomain}/`, 10 s Timeout, `redirect: manual` | 200 → **ok**. Jeder andere Statuscode → **fail** (der Router antwortet, aber nicht mit der App). |
| `form_store` | nur Apps **mit** Datenbank: `SELECT 1` gegen die D1 der App, nur lesend | Abfrage gelungen → **ok**. Abfrage abgelehnt → **fail**. |

`form_store` ist bewusst **keine** synthetische Einsendung. Der Master-Plan schreibt „form-echo
synthetic"; das ist vor der D1-Entscheidung geschrieben worden. Eine Echo-Einsendung würde bei
jedem Tick eine Zeile in die Tabelle schreiben, in der **fremde Personendaten** liegen — 288 Zeilen
pro Tag und App, die aussehen wie Einsendungen und keine sind, im Posteingang eines Bauers und im
Export, den er weitergibt. Die lesende Abfrage prüft dieselbe Abhängigkeitskette (Token → D1-API →
Datenbank existiert → antwortet) ohne diesen Preis. **Abweichung vom Master-Plan, bewusst,
begründet.**

### Pro Plattform (einmal, nicht pro App)

| Prüfung | Was sie tut | Takt |
|---|---|---|
| `web` | `GET` auf die öffentliche Web-Adresse | jeder Tick |
| `api` | `GET {öffentliche API-Herkunft}/health` | jeder Tick |
| `cert` | TLS-Handshake, `valid_to` des ausgelieferten Zertifikats | stündlich |
| `domain` | RDAP-Abfrage der Registrierungs-Ablaufzeit | alle 12 Stunden |

**Warum Zertifikat und Domain NICHT pro App geprüft werden — das ist die eigentliche Entscheidung
in diesem Abschnitt.** Alle Apps liegen unter `*.justgoblin.app`: ein Zertifikat für die ganze
Zone, eine Registrierung für die ganze Zone. Eine Prüfung pro App wäre **dieselbe Tatsache N-mal**
— kein Erkenntnisgewinn, N-mal das Anfragevolumen, und N Karten, die alle gleichzeitig rot werden
und aussehen wie N Vorfälle. Einmal messen, allen zeigen, dazusagen, dass es eine Zonen-Tatsache
ist.

Das Zertifikat wird gegen den Hostnamen der **alphabetisch ersten aktiven App** gemessen (SNI
braucht einen Namen, der auflöst; der Apex `justgoblin.app` ist nicht vom Wildcard gedeckt). Gibt
es keine aktive App, wird **nicht gemessen** und die Zeile bleibt aus — nicht „gültig".

**`api` prüft die API von außen** — DNS, Proxy, Prozess — und sagt nichts über ihre inneren
Abhängigkeiten. Dass der Läufer im selben Prozess läuft, macht die Prüfung schwächer als sie
aussieht; sie steht deshalb als das da, was sie ist: die öffentliche Erreichbarkeit, nicht die
Gesundheit.

### Was ausdrücklich NICHT geprüft wird

- **Kein Asset-Byte-Vergleich.** Das tut `ops-hosted-verify.ts` beim Veröffentlichen, wo die
  hochgeladenen Bytes vorliegen. Im Dauerbetrieb liegen sie nicht vor.
- **Keine Inhaltsprüfung.** Was auf der Seite steht, ist Phase 3 beim Publish; ein Heartbeat, der
  Inhalte liest, wäre ein Scanner mit falschem Namen.
- **Nichts Modellgestütztes.** K0 ist per Definition deterministisch (Regel 5 des Prompts). Es gibt
  in dieser Phase keinen Aufruf an DeepInfra, keinen Token, keine `completion_costs`-Zeile.

---

## P5-c — Wo die Prüfergebnisse liegen

### ENTSCHIEDEN: eine Plattform-Tabelle `ops_app_checks` in Supabase, Migration `0103`, AUTORIERT und nicht angewendet. Niemals in der D1 der App.

**Von CC unter stehenden Prinzipien — und diese eine folgt aus einer Gründer-Entscheidung, nicht
aus einer Abwägung.**

Die D1 einer App enthält **Daten fremder Endkunden** (Phase 4, Datenschutzseite §1a). Plattform-
Telemetrie dort hineinzuschreiben hieße: sie landet im CSV-Export des Eigentümers, sie fällt unter
dessen Löschbefehl, sie zählt gegen die 500-MB-Grenze seiner Datenbank, und sie ist von der
Zeile „Einsendungen gehen mit der App" nicht mehr sauber zu trennen. Der Prompt nennt das
ausdrücklich; hier ist es noch einmal mit dem Grund.

**Ein Speicher, kein zweiter Zustandsspeicher.** `ops_app_checks` ist **append-only**: eine Zeile =
eine Messung. Es gibt **keine** Spalte, in der ein „aktueller Zustand" steht. Der Zustand wird beim
Lesen aus den jüngsten Zeilen **abgeleitet** (P5-d).

Das ist die wichtigste strukturelle Entscheidung dieser Phase: **es gibt kein gespeichertes Grün,
das schal werden kann.** Ein Feld `status = 'healthy'` müsste bei jedem Ausfall des Läufers aktiv
zurückgesetzt werden — und genau dieses Zurücksetzen ist die Zeile, die man vergisst. Was nie
gespeichert wird, kann nicht stehenbleiben.

Schema-Konventionen folgen `0100`/`0102`: RLS an, **keine** Policy (nur der Service-Role-Pfad hinter
den Gates liest), `status`-artige Spalten als freier Text ohne `CHECK` (damit eine spätere Phase
keinen neuen Zustand per Migration einführen muss), `app_id` mit `on delete cascade`.

---

## P5-d — Wie UNBEKANNT betreten und verlassen wird

### ENTSCHIEDEN: vier Zustände, abgeleitet aus einem Fenster von zwei Messungen, mit drei getrennten Wegen nach UNBEKANNT.

**Von CC unter stehenden Prinzipien. Dies ist der Ehrlichkeitsvertrag dieser Phase.**

Der Zustand ist eine **reine Funktion** über die jüngsten Zeilen eines Prüfgegenstands. Die Regeln
werden **in dieser Reihenfolge** ausgewertet; die erste, die greift, gewinnt:

| # | Bedingung | Zustand | Grund |
|---|---|---|---|
| 1 | keine Zeilen | **UNBEKANNT** | `never_checked` |
| 2 | die jüngste Zeile ist älter als die Frische-Schwelle | **UNBEKANNT** | `stale` |
| 3 | die jüngste Zeile hat den Ausgang `unknown` | **UNBEKANNT** | `inconclusive` |
| 4 | die jüngsten 2 Zeilen sind beide `fail` | **down** | |
| 5 | im Fenster ist mindestens ein `fail` oder `warn` | **degraded** | |
| 6 | sonst (alles `ok`) | **healthy** | |

**Die drei Wege nach UNBEKANNT sind genau die drei Ursachen, die der Prompt nennt:**

- **Cron-Lücke** → Regel 2. Der Läufer lief nicht (Redeploy, Absturz, Kill-Switch). Die Frische-
  Schwelle ist `3 × Takt` für Entry und Formular-Speicher, mit einer Untergrenze von 20 Minuten —
  ein einzelner verpasster Tick ist keine Lücke, drei sind eine.
- **Timeout** → Regel 3. Eine Prüfung, die in ein Timeout lief, wird als Zeile mit Ausgang
  `unknown` **geschrieben**, nicht verworfen. Sie ist eine Messung: die Messung, dass wir es nicht
  feststellen konnten.
- **Unser eigener Ausfall** → Regel 2 oder 3, je nachdem ob der Prozess stand oder nur die Anfragen
  scheiterten.

**Verlassen wird UNBEKANNT ausschließlich durch frische Messungen.** Es gibt keinen Pfad, auf dem
ein alter Zustand wieder hervorkommt, weil es keinen gespeicherten alten Zustand gibt (P5-c).

### Wann ein Fehlschlag `fail` ist und wann `unknown`

Diese Unterscheidung ist der Kern von „nie einen Zustand berichten, der nicht gemessen wurde":

| Was passierte | Ausgang | Warum |
|---|---|---|
| HTTP-Antwort erhalten, Status ≠ 200 | `fail` | Das öffentliche Internet hat geantwortet. Das ist eine Messung. |
| DNS existiert nicht, Verbindung abgelehnt, TLS abgelehnt | `fail` | Ebenfalls eine eindeutige Antwort des Netzes. |
| Timeout, Abbruch, temporärer DNS-Fehler (`EAI_AGAIN`) | `unknown` | Kann genauso gut an **uns** liegen. Als `fail` gezählt wäre es eine Behauptung über die App. |
| Zertifikat läuft in ≤ 14 Tagen ab | `warn` | Sie liefert aus. Sie ist nicht in Ordnung. |

### Debounce — und warum er in der Oberfläche steht

Zwei aufeinanderfolgende Fehlschläge bis `down`. Ein einzelner Fehlschlag ergibt `degraded`, nicht
`down`, und eine einzelne gelungene Prüfung nach einem Ausfall ergibt ebenfalls `degraded`, nicht
`healthy`. Ein Blip flappt den Zustand also nicht.

**Der Preis: die Erkennung dauert bis zu 2 Zyklen, und die Erholung dauert 2 Zyklen.** Das ist eine
Verzögerung, und eine Verzögerung, die man nicht sagt, ist eine Lüge über die Frische. Die Karte
sagt sie deshalb aus: *„Ein einzelner Ausfall wird als **eingeschränkt** gezeigt; **nicht
erreichbar** steht erst nach zwei Prüfungen hintereinander."* Nicht in einer Fußnote — im
Kartentext.

### Uptime über 7 Tage

Berechnet **ausschließlich** aus `entry`-Zeilen der letzten 7 Tage:

```
Quote = ok / (ok + fail)          unknown-Zeilen stehen NICHT im Nenner
```

Drei Regeln, die verhindern, dass daraus eine geschönte Zahl wird:

1. **Die Zahl kommt nie ohne ihre Stichprobe.** Angezeigt wird immer „… % (aus N Messungen)".
2. **`unknown`-Zeilen werden separat gezählt und genannt.** Sie aus dem Nenner zu nehmen, ohne sie
   zu zeigen, würde die Quote nach oben schönen — genau der Fall, in dem „wir wissen es nicht" als
   „alles gut" durchginge.
3. **Deckt das Fenster keine 24 Stunden ab, gibt es keine Prozentzahl**, sondern „noch nicht genug
   Daten" plus die tatsächlich abgedeckte Zeitspanne. Und solange weniger als 7 Tage abgedeckt
   sind, heißt es nicht „7 Tage", sondern nennt die echte Spanne.

### Eine Heuristik, die geprüft und ABGELEHNT wurde

*Wenn in einem Tick **alle** Apps fehlschlagen, ist unser eigener Ausgang oder der Router die
wahrscheinlichere Erklärung als N gleichzeitige unabhängige Ausfälle — also alle Zeilen als
`unknown` schreiben.*

**Abgelehnt.** Das wäre Interpolation: gemessene Tatsachen mit einer Wahrscheinlichkeitsannahme
überschreiben. Ist der Router wirklich unten, sind die Apps wirklich nicht erreichbar, und `down`
ist dann die richtige Antwort. Ein Mensch in der Betreiber-Ansicht sieht „alle unten" und liest das
sofort als Flotten-Ereignis; die Plattform-Zeilen daneben bestätigen oder widerlegen es. Die
Heuristik hätte nichts hinzugefügt, was ein Leser nicht ohnehin sieht, und hätte dafür die einzige
Eigenschaft aufgegeben, für die diese Phase existiert.

---

## P5-e — Wie lange die Prüfhistorie bleibt

### ENTSCHIEDEN: 8 Tage, bei jedem Tick beschnitten.

**Von CC unter stehenden Prinzipien.**

Die Uptime-Zahl braucht 7 volle Tage **in dem Moment, in dem sie gefragt wird**. Genau bei 7 zu
beschneiden würde bei jeder Abfrage die ältesten Stunden abrasieren, und die „7-Tage-Zahl" wäre
in Wahrheit eine 6-Tage-und-etwas-Zahl. Ein Tag Reserve, benannt, statt einer Zahl, die knapp
danebenliegt und niemandem auffällt.

**Was das an Zeilen bedeutet** (5-Minuten-Takt, eine Instanz):

| Quelle | Zeilen/Tag | über 8 Tage |
|---|---|---|
| 10 Apps × `entry` | 2 880 | 23 040 |
| 10 Apps × `form_store` | 2 880 | 23 040 |
| `web` + `api` | 576 | 4 608 |
| `cert` (stündlich) | 24 | 192 |
| `domain` (alle 12 h) | 2 | 16 |
| **Summe** | **6 362** | **50 896** |

Rund 51 000 Zeilen bei voller Beta-Besetzung, wenige MB. Beschnitten wird **im Tick**, nicht per
externem Job: ein Aufräumen, das eine eigene Auslösung braucht, ist ein Aufräumen, das irgendwann
nicht mehr läuft.

**Was mit dem Beschneiden verloren geht, ausdrücklich:** eine Uptime-Zahl über mehr als 7 Tage ist
danach nicht mehr berechenbar. Wenn Phase 7 (Wochenbericht) eine längere Reihe braucht, braucht sie
eine Verdichtung (Tagesaggregate) — die ist hier **nicht** gebaut und wäre ein eigener Unit.

---

## Eskalation an den Gründer

### G-P5-1 — Ab 209 aktiven Apps reicht der Anteil nicht mehr

Kein Blocker, keine Aktion heute. Bei 209 aktiven Apps ist der aus 5 % abgeleitete Takt bereits auf
die 60-Minuten-Decke gelaufen, und weitere Apps überziehen das Budget. Dann stehen drei Wege offen,
und keiner davon ist eine Implementierungsdetail-Frage:

1. **Den Anteil erhöhen** (5 % → 10 %) — kostenlos, aber der Heartbeat verdrängt mehr echten
   Traffic auf einer Decke, die kontoweit gilt.
2. **Workers Paid**, $5/Monat — löst gleichzeitig **P6** (die 10-Datenbanken-Decke der Formulare)
   und **G-P4-1**. Wahrscheinlich fallen beide Entscheidungen ohnehin zusammen.
3. **Den Takt weiter strecken** — kostenlos, aber ab hier heißt „Heartbeat" etwas anderes, und die
   Zusage nach außen müsste mitwandern.

Der Läufer **meldet** diesen Zustand (`overBudget`), die Konsole zeigt ihn. Er überzieht nicht still.

---

## Was diese Phase ausdrücklich NICHT entscheidet

- **Was bei einem Ausfall passiert.** Keine Benachrichtigung, kein Vorfall, keine Diagnose. Das ist
  Phase 6 und 9, und K0 hört beim Wissen auf.
- **Ob jemand für das Wissen zahlt.** Keine Preis-, Plan- oder Entitlement-Zeile. Phase 8.
- **Wie das nach außen heißt.** Thesis §5.3 verkauft „watched and honestly reported" — diese Phase
  baut das Instrument, nicht die Zusage.

---

## Der Boden, auf dem das alles steht

**Die Phasen 3 und 4 sind gebaut, gemergt, deployed — und ihr Gründer-Fenster ist nicht gelaufen**
(`ACT2_CARRY_FORWARD.md` **P1**). Diese Phase macht daraus drei unbewiesene Schichten.

Konkret, damit es niemand später für Beobachtung hält:

- Dass eine App überhaupt live geht, ist über den Phase-3-Pfad **angenommen**, nicht beobachtet.
  `entry` prüft etwas, was es in Produktion noch nie gab.
- Dass eine D1 existiert und antwortet, ist über den Phase-4-Pfad **angenommen**. Es ist nie eine
  Datenbank angelegt worden (**P1**), und ob `CF_API_TOKEN` überhaupt `D1:Edit` trägt, ist offen
  (**P2**). Die `form_store`-Prüfung steht auf beidem.
- Jede Zahl in dieser Phase, die nicht aus einem lokalen Testlauf stammt, ist eine Herleitung.

**Ob diese Phase das Gründer-Fenster schwerer deutbar macht:** nein, solange die Reihenfolge
eingehalten wird — erst Teil A (Scan), dann Teil B (Formulare), dann der Phase-5-Schritt. Der
Heartbeat beobachtet nur; er veröffentlicht nichts, ändert nichts an einer App und kann keinen
Befund aus Teil A oder B erzeugen. Wird die Reihenfolge **nicht** eingehalten, ist die Deutung
schwerer: eine `entry`-Zeile mit `fail` kann dann ein Router-Problem (Phase 2), ein Publish-Problem
(Phase 3) oder ein Prüf-Problem (Phase 5) sein. Deshalb steht der Phase-5-Schritt als **Teil C** am
Ende desselben Dokuments und nicht davor.
