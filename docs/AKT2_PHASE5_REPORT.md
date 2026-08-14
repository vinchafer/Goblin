# AKT 2 · PHASE 5 — KEEPER-1a: HEARTBEAT & EHRLICHER ZUSTAND (K0)

**Geschrieben: 2026-08-14 · Autor: CC · Branch `claude/keeper-1a-heartbeat-status-aa8wgj`**
**Basis: `origin/master` `c5c724d` (enthält PR #92 und #93) · nichts gemergt, nichts angewendet**

---

## 0 · DIE EHRLICHE STANDORTBESTIMMUNG — bitte zuerst

**Es ist in Produktion nichts passiert.** Migration `0103` ist **autoriert und nicht angewendet**,
kein Tick ist gelaufen, keine Zeile ist geschrieben, kein Zertifikat und keine Domain sind je
gemessen worden. **Jede Zahl in diesem Bericht kommt entweder aus einem lokalen Lauf oder aus den
ausgelieferten Konstanten.**

Und der Boden darunter ist weicher, als diese Phase allein aussehen lässt: **die Phasen 3 und 4 sind
gebaut, gemergt, deployed — und ihr Gründer-Fenster ist nicht gelaufen** (Carry-forward **P1**).
Damit sind es jetzt **drei unbewiesene Schichten**. Konkret, damit es niemand später für Beobachtung
hält:

- Dass eine App über den Phase-3-Pfad überhaupt live geht, ist **angenommen**. Die `entry`-Prüfung
  misst etwas, was es in Produktion noch nie gab.
- Dass eine D1 existiert und antwortet, ist **angenommen** — es wurde nie eine angelegt (**P1**), und
  ob `CF_API_TOKEN` überhaupt `D1:Edit` trägt, ist offen (**P2**). Die `form_store`-Prüfung steht auf
  beidem.
- **Kein Satz in diesem Bericht und keine Zeile Code dieser Phase setzt voraus, dass jene Schichten
  in Produktion funktionieren.** Wo eine Aussage darauf steht, ist die Annahme benannt.

**Macht diese Phase das Gründer-Fenster schwerer deutbar?** Nein — **solange die Reihenfolge
eingehalten wird**. Der Heartbeat beobachtet nur: er veröffentlicht nichts, ändert an keiner App
etwas und kann keinen Befund aus Teil A oder B erzeugen. Deshalb steht der Phase-5-Test als **Teil C
am Ende desselben Dokuments** und nicht davor. Wird er vorgezogen, ist jede rote `entry`-Zeile
dreideutig (Router · Publish · Prüfung), und dann hat das Fenster einen Befund weniger und eine
Frage mehr.

---

## 1 · WAS GEBAUT WURDE

| Unit | Was | Commit |
|---|---|---|
| U0 | Die fünf Entscheidungen, vor der ersten Zeile Code | `ebef440` |
| U5.2 | Migration `0103` (AUTORIERT), Speicher, Zustandsmaschine | `7ee7634` |
| U5.1 · U5.5 | Der Läufer, das Takt-Budget, Plattform-Prüfungen, **Ledger M-K1** | `05fc57e` |
| U5.3 | Besitzer-Statuskarte + `GET /api/ops/apps/:appId/status` | `594b975` |
| U5.4 · U5.5 | Flotten-Zustand in der Gründer-Konsole + `POST /checks/run` | `503844d` |
| U5.6 | Induzierter-Ausfall-Harness + Evidenz | `200f661` |
| U5.7 | Kohorten-Schutz, beide Dimensionen | `f577f42` |

Die **eine strukturelle Entscheidung**, aus der alles andere folgt: **es gibt nirgends eine
gespeicherte Zustandsspalte.** `ops_app_checks` ist append-only, eine Zeile = eine Messung, und der
Zustand wird beim **Lesen** aus den jüngsten Zeilen abgeleitet.

Der Grund ist nicht Eleganz. Ein gespeicherter Zustand muss **aktiv zurückgesetzt** werden, wenn das
Instrument aufhört zu messen — bei einem Redeploy, einem Absturz, einem umgelegten Kill-Switch. Das
Zurücksetzen ist die Zeile, die man vergisst, und das Ergebnis des Vergessens ist genau das grüne
Dashboard, dessen Gegenteil dieses Produkt sein soll. **Was nie gespeichert wird, kann nicht
schal werden**, und eine Lücke in den Zeilen **ist** das UNBEKANNT — strukturell, nicht weil jemand
daran denkt.

---

## 2 · GATES

### 2.1 Induzierter Ausfall — das Kopf-Gate

**Deterministisch gemessen**, lokal, gegen den **ausgelieferten** Läufer und die **ausgelieferte**
Ableitung. Ersetzt sind nur zwei Steckdosen (HTTP-Transport → lokaler Server; Speicher → Array);
URL-Bau, Status-Deutung, Fehler-Klassifizierung, Debounce, Frische-Regel und Ableitung sind die
echten.

| Größe | Lauf 1 | Lauf 2 | Lauf 3 |
|---|---|---|---|
| Zyklen bis zum ersten Signal (`degraded`) | **1** | **1** | **1** |
| Zyklen bis `down` | **2** | **2** | **2** |
| Zyklen bis zurück auf `healthy` | **2** | **2** | **2** |

**N = 2.** Bei 5-Minuten-Takt: *eingeschränkt* nach ≤ 5 Minuten, *nicht erreichbar* nach ≤ 10, und
die Erholung ebenfalls ≤ 10. **3/3 Läufe stimmen überein** (`consistent: true`); jeder Lauf startet
mit leerer Historie, damit Lauf 2 nichts von Lauf 1 erbt.

Evidenz: `evidence/akt2-phase5/induced-failure.json` (Zyklus für Zyklus), reproduzierbar mit
`pnpm --filter @goblin/api keeper:induced-failure`, und derselbe Lauf in der Suite als
`ops-check-induced-failure.test.ts`.

**Was das NICHT belegt:** irgendetwas über Produktion. Es belegt, dass der Mechanismus reagiert wie
entworfen. Cloudflare, Router, KV und R2 kommen darin nicht vor — dafür ist **Teil C** da.

### 2.2 UNBEKANNT-Pfad — demonstriert

```json
{ "whileRunning": "healthy", "whilePaused": "unknown", "pausedReason": "stale",
  "pausedMeasuredAt": "2026-08-14T13:25:00.000Z", "afterResume": "healthy" }
```

Der Läufer wird **pausiert**, Zeit vergeht, die App liefert unverändert 200 aus. Der Zustand wird
**UNBEKANNT**, nicht grün — und der Zeitstempel der letzten echten Messung bleibt stehen, damit die
Lücke **datiert** und nicht leer ist. Verlassen wird UNBEKANNT nur durch neue Messungen.

Drei Wege hinein, alle getestet: **Cron-Lücke** (Regel 2, `stale`), **Timeout** (Regel 3,
`inconclusive` — ein Timeout wird als Zeile *geschrieben*, nicht verworfen), **unser eigener
Ausfall** (je nachdem, der eine oder der andere). Ein Weg hinaus.

### 2.3 Kein Zustand ohne Messzeitpunkt — was ich tatsächlich geprüft habe

**Nicht behauptet, sondern gesweept.** Was geprüft wurde, Stelle für Stelle:

| Oberfläche | Wie geprüft | Ergebnis |
|---|---|---|
| Besitzer-Karte, Zustandssatz | `stateLine()` direkt aufgerufen, **alle fünf** Zustand/Grund-Kombinationen, DE **und** EN | Jede enthält die Uhrzeit. Die **einzige** Ausgabe ohne Zeit ist `never_checked`, und sie enthält **kein** Zustandswort. |
| Besitzer-Karte, Zustandswort | Quelltext-Sweep: das Wort wird an **einer** Stelle gerendert, im selben Kasten unmittelbar über `stateLine` | gepaart |
| Konsole, Zustands-Pillen | gezählt: `oc-state ${stateClass(` → **3** Vorkommen, `lastMeasured` → **3**; Test hält das Verhältnis | jede Pille hat ihre Zeitzeile |
| Konsole, `CheckState` | nimmt das ganze Subjekt und rendert **immer** beides — es gibt keine „nur die Pille"-Variante | strukturell |
| „nie gemessen" | eigenes Wort (`nie` / `never`), kein Strich | Strich reads als „nichts zu melden"; getestet, dass keiner benutzt wird |
| API-Nutzlast | `SubjectState` trägt `measuredAt` als **Pflichtfeld**; Test läuft über jede Zeile jedes Reports | keine Form ohne Zeit |

**Ehrliche Grenze dieses Sweeps:** er deckt die in dieser Phase gebauten Oberflächen ab. Er ist ein
Quelltext- und Verhaltens-Sweep, **kein gerendertes Bild** — die Farben sind nicht belegt (**K8**).

### 2.4 Aufbewahrung — begrenzt und benannt

**8 Tage**, im Tick beschnitten. Sieben würde jeder „7-Tage"-Zahl die ältesten Stunden abrasieren;
ein Aufräumen mit eigener Auslösung ist eines, das irgendwann nicht mehr läuft. Bei voller
Beta-Besetzung (10 Apps, alle mit Formular): **6 362 Zeilen/Tag ≈ 51 000 Zeilen** stehend.

### 2.5 Fan-out, Cron-Decke und Anfragebudget — mit Rechnung

**Cron-Trigger verbraucht: 0.**

> **BEFUND — der Prompt hat hier eine falsche Zahl.** Er nennt die Cron-Decke „250 pro Konto".
> `OPS_SPIKE_0_DECISION_TABLE.md` §2 (abgerufen 2026-07-25 bei Cloudflare) sagt **5 (Free) / 250
> (Paid)**, und Goblin fährt Workers **FREE**. Spike-Befund **F2** („ein Cron pro App skaliert
> nicht") bricht damit **bei fünf Apps**, nicht bei 250 — eine Größenordnung dringender, als der
> Prompt annahm. Gesetz 1: Repo schlägt Prompt.

Die Formel, in Code, Ledger und Entscheidungsdokument identisch:

```
Router-Requests/Tag = aktive Apps × (1440 / Taktminuten) × API-Instanzen
```

Nur die `entry`-Prüfung geht durch den Router. Budget: **5 000/Tag = 5 %** der 100 000/Tag des
Free-Plans. Der Takt wird daraus **abgeleitet**, nicht gesetzt:
`clamp(aufrunden5(Apps × 1440 / 5000), 5 … 60)`.

| Aktive Apps | Takt | Requests/Tag | Anteil |
|---|---|---|---|
| 10 (Beta-Radius) | 5 min | **2 880** | **2,9 %** |
| 17 | 5 min | 4 896 | 4,9 % |
| 208 | 60 min | 4 992 | 5,0 % |
| **209** | 60 min (Decke) | **5 016** | **über Budget → gemeldet** |

Jedes Bandende ist in `ops-check-budget.test.ts` festgehalten, damit die Tabelle nicht von der Formel
abdriften kann.

### 2.6 Ledger

**M-K1** liegt im Commit seines Mechanismus (`05fc57e`): Kostenklasse (**Plattform-COGS, $0.00
committed**), die Formel oben inklusive des Instanz-Faktors, den nichts hier messen kann, die
Speicher-Arithmetik und die korrigierte Cron-Decke. Status: **FORMULA**.

**Diese Phase gibt null Token aus.** Kein Prompt, keine Completion, keine `completion_costs`-Zeile,
kein Zweig, der eine bekommen könnte. Es gab keinen Anlass zu eskalieren.

### 2.7 i18n

**0 fehlende Schlüssel.** Zweifach erzwungen: `en: typeof de` macht eine Lücke zum **Compile-Fehler**,
und `strings.test.ts` läuft den Baum zur Laufzeit ab (leere Strings, Nicht-Strings, deutsche Prosa im
EN-Block). Die Besitzer-Karte benutzt `t(lang, de, en)`; ein Test prüft, dass jeder ihrer fünf
Zustandssätze in beiden Sprachen existiert und sich unterscheidet.

### 2.8 Kohorten-Ausschluss — beide Dimensionen

Erweitert die stehende Beweisdatei statt eine zweite anzulegen.

- **Dimension 1 (Konto):** `GET /apps/:id/status` steht in `ROUTES` und wird wie jede Route gegen ein
  nicht-allowlistetes Konto **und** einen echten Akt-1-Nutzer gefahren → **404**, byte-identisch zu
  einem nie gemounteten Pfad.
- **Dimension 2 (Schalter):** dieselbe Route, `OPS_HOSTING_ENABLED=false`, allowlistetes Konto →
  **404**.
- **Der Hintergrund-Job**, den eine Routen-Prüfung nicht erfasst: mit ausgeschaltetem Schalter macht
  er **keine** ausgehende Anfrage, schreibt **nichts** und fragt nicht einmal, welche Apps es gibt.
  Er wählt seine Ziele **ausschließlich** aus der Registry; leere Registry = leerer Fan-out, kein
  Default-Ziel.
- **Der Kill-Switch entwaffnet den Kill-Switch nicht:** mit ausgeschaltetem Schalter bleibt die
  Konsole für den Gründer erreichbar (sonst könnte er UNBEKANNT nicht *sehen*) und ist für alle
  anderen weiter 404.

### 2.9 Suite und tsc

| | Zahl |
|---|---|
| API-Tests | **173 Dateien · 2 313 Tests · alle grün** |
| Web-Tests | **43 Dateien · 530 Tests · alle grün** |
| `tsc --noEmit` API | **0 Fehler** |
| `tsc --noEmit` Web | **0 Fehler** |

### 2.10 `anmeldeformular` unberührt

**Nicht angefasst, nicht umbenannt, nicht gesperrt, nicht abgebaut.** Kein Code dieser Phase kennt
sie namentlich. Diese Sitzung hat sie **nicht** abgefragt — es gab keinen Anlass, und der 200er aus
der Phase-4-Sitzung wird hier **nicht** als frischer Befund weitergereicht.

**Wenn der Läufer in Produktion läuft, sieht er sie an** — sofern sie eine Registry-Zeile mit Status
`active` hat: eine `GET`-Anfrage auf die Startseite, im abgeleiteten Takt, mit `User-Agent:
goblin-keeper/1.0`. **Reine Beobachtung.** Kein Schreibzugriff, kein Formular-Test gegen sie (das
wäre `form_store`, und das ist ein `SELECT 1` gegen die D1 — auch lesend), keine Änderung.
Teil C fasst sie ausdrücklich nicht an; kaputtgemacht wird die Test-App aus Teil A.

---

## 3 · SELBST-REVIEW VOR DER PR

| Schritt | Ergebnis |
|---|---|
| **Evidenz-Audit** | Jede Zahl oben ist rückverfolgbar: Zyklen → `induced-failure.json`; Budget-Bänder → `ops-check-budget.test.ts`; Suite-Zahlen → Läufe in dieser Sitzung. Keine Zahl ohne Quelle. |
| **Diffstat gegen den Umriss** | 7 Units, 7 Commits, jeder isoliert und revert-fähig. Kein Error-SDK, keine Vorfälle, keine Benachrichtigung, kein Wochenbericht, keine Diagnose, kein Billing, kein Akt-1-Code, keine `Header.tsx`. |
| **Regressions-Sonde** | Volle API- und Web-Suite grün. Bestehende Konsolen-Tests unverändert grün; `ROUTES` und die Unsichtbarkeitsliste **erweitert**, nicht ersetzt. |
| **Ehrlichkeits-Sweep** | §2.3, mit benannter Grenze (kein gerendertes Bild). |
| **Ledger** | M-K1 im Commit seines Mechanismus. Status FORMULA, Provenienz-Warnung geerbt. |
| **Bericht-Vollständigkeit** | Diese Datei + Entscheidungen + Teil C + Register-Abschnitt K. |

**Zwei Dinge, die die Tests gefunden haben und die echte Mängel waren, nicht Harness-Artefakte:**

1. Der Speicher **warf** bei einem kaputten Client, statt zu degradieren — eine Route hätte daraus
   500 gemacht („da ist was schiefgelaufen"), wo eine Zeile früher dieselbe Störung ein ehrliches
   UNBEKANNT ergibt. Jetzt geht jeder Lese- und Schreibpfad durch `attempt()`.
2. Eine **werfende Prüfung** hätte den ganzen Batch mitgenommen — die schon gemessenen Apps hätten
   ihre Zeilen wegen eines fremden Fehlers verloren. Jetzt kostet sie ihre eigene Zeile (`unknown`).

**Und einer, den das Schreiben von Teil C gefunden hat:** der naheliegende Ausfall-Test („App
sperren") **funktioniert nicht** — gesperrte Apps werden bewusst nicht geprüft, weil sie die
Sperrseite ausliefern *sollen*. Teil C sagt das jetzt ausdrücklich und nennt den Weg, der wirklich
funktioniert (`index.html` in R2 löschen, danach neu veröffentlichen). Wäre das nicht aufgefallen,
hätte der Gründer im Fenster fünfzehn Minuten auf eine Karte gestarrt, die korrekt UNBEKANNT sagt.

---

## 4 · EHRLICHE GRENZEN (verbindlich)

1. **Nichts davon ist in Produktion gelaufen.** `0103` unangewendet, kein Tick, keine Zeile, kein
   gemessenes Zertifikat, keine gemessene Domain. (**K1**)
2. **Drei unbewiesene Schichten.** Phase 3, 4 und jetzt 5 warten auf **ein** Fenster. `entry` und
   `form_store` stehen auf Annahmen über Phase 3 und 4.
3. **Der Läufer lebt im Prozess.** Mehrere Railway-Instanzen ⇒ (Instanzen ×) Anfragen und doppelte
   Zeilen. Bewusst nicht mit einem Lease erschlagen. (**K2**, wie **P3**/**C1**)
4. **Die 100 000/Tag sind geerbt, nicht nachgeschlagen** — dieselbe Provenienz-Warnung wie **M-H1**.
   Das gesamte Budget hängt daran. (**K3**)
5. **Ein Timeout ist UNBEKANNT, kein Ausfall.** Eine tote App mit langsamem DNS liest sich als
   UNBEKANNT. Bewusste Richtung, mit dem Preis Untererkennung. (**K5**)
6. **Die `api`-Plattformprüfung ist schwächer, als sie aussieht** — der Läufer sitzt im selben
   Prozess. Sie belegt DNS, Proxy und „antwortet", nicht die inneren Abhängigkeiten. (**K7**)
7. **Keine Screenshots.** Wortlaut und Verhalten sind getestet, die Farben nicht. (**K8**)
8. **Keine Verdichtung über 7 Tage hinaus.** Nach dem Beschneiden ist keine längere Reihe
   berechenbar. (**K6**)
9. **Der Harness ist kein Produktionsbeweis.** Er zeigt, dass der Mechanismus reagiert; über
   Cloudflare sagt er nichts.

---

## 5 · MONITORING-KONSOLIDIERUNG — **BEGONNEN, NICHT GESCHLOSSEN**

Der Prompt bittet zu sagen, dass dieser Faden geschlossen ist, **oder warum nicht**. Er ist **nicht**
geschlossen, und das Repo sagt das selbst:

- **Master-Plan Phase 5, U5.4 wörtlich:** *„Goblin's own /health rides the same instrument (**begins
  the monitoring consolidation**)"* — begonnen.
- **Master-Plan, Zeile 338:** *„**this phase** CLOSES the standing monitoring consolidation thread"*
  steht bei **Phase 7** (Wochenbericht), nicht bei Phase 5.
- **Blueprint Part C, Zeile 175:** dieselbe Zuordnung — die Wochenbericht-Welle *„absorbs and closes"*
  den Faden.

**Was Phase 5 tatsächlich erreicht hat:** Goblins eigene Web-App, die öffentliche API, das
Zonen-Zertifikat und die Domain-Registrierung sind **Zeilen in derselben Tabelle**, abgeleitet von
**derselben** Zustandsmaschine, gerendert von **denselben** Komponenten wie jede Nutzer-App. Kein
zweites Dashboard, das ähnlich aussieht.

**Was fehlt, damit man „geschlossen" sagen darf:**

1. **`/health/deep` ist nicht eingebunden.** Die `api`-Prüfung fragt `/health` von außen und belegt
   nichts über Supabase, Storage oder LiteLLM. (**K7**)
2. **Kein Alarm.** Wird Goblin selbst rot, sieht das nur, wer die Konsole öffnet. Benachrichtigung
   ist Phase 6, der wiederkehrende Bericht Phase 7.
3. **Kein Verlauf über eine Woche hinaus.** (**K6**)

Ehrlich zusammengefasst: **die Instrumente sind vereinigt, die Aufmerksamkeit nicht.**

---

## 6 · GRÜNDER-AKTIONEN

| # | Was | Warum |
|---|---|---|
| **1** | **Migration `0103_ops_app_checks.sql` anwenden** (Supabase SQL-Editor) | Ohne sie schreibt der Heartbeat nichts und jede Karte steht auf UNBEKANNT. Additiv und idempotent. **Vor** dem Fenster. |
| **2** | **Das gemeinsame Fenster fahren: Teil A → Teil B → Teil C** in `docs/AKT2_PHASE3_UND_4_FOUNDER_WINDOW.md` | Die Reihenfolge ist die Deutbarkeit. Teil C ist **angehängt**, kein drittes Dokument. ~15 Min. zusätzlich. |
| **3** | **Die PR über die GitHub-App mergen** | Diese Sitzung merged nichts. |
| **4** | **Danach „Phase 6" an Steven** | Fehler-Erfassung und Vorfälle (K1). |
| **5** | *(optional, umkehrbar)* `OPS_CHECKS_ENABLED` kennenlernen | Standard **an**. `=false` stoppt nur den Heartbeat, der Rest von Akt 2 läuft weiter. Der Schalter, den Schritt C4 benutzt. |

> ### Phase 6 startet nicht vor dem Fenster — nach der eigenen Regel des Gründers
>
> Phase 6 baut **Vorfälle** auf dem Heartbeat auf. Vor dem Fenster hat der Heartbeat niemanden
> angesehen: „ein Vorfall wurde erkannt" stünde dann auf einer Erkennung, die in Produktion nie
> stattgefunden hat, und ein Fehlalarm wäre nicht von einem Fehler in Phase 6 zu unterscheiden.
> Es wären **vier** unbewiesene Schichten übereinander.

### Zwei Entscheidungen, die zur Kenntnis genommen und nicht getroffen werden müssen

- **G-P5-1** (ab 209 aktiven Apps reicht der 5-%-Anteil nicht): weit weg, gemeldet statt still
  überzogen, fällt vermutlich mit **G-P4-1** zusammen (Workers Paid, $5/Monat).
- **P5-a bis P5-e** sind von CC unter stehenden Prinzipien entschieden und **alle umkehrbar** —
  Begründung je Entscheidung in `docs/ACT2_PHASE5_DECISIONS.md`.

---

## 7 · BEFUNDE

1. **Die Cron-Decke ist 5, nicht 250** (§2.5). Spike-Befund **F2** ist eine Größenordnung dringender
   als angenommen. Diese Phase verbraucht 0.
2. **„App sperren" ist kein Ausfall-Test** (§3). Gesperrte Apps werden bewusst nicht geprüft. Beim
   Schreiben von Teil C gefunden, dort ausdrücklich benannt.
3. **Zwei echte Robustheitsmängel**, von den Tests gefunden und behoben (§3).
4. **Der Master-Plan schreibt „form-echo synthetic"** — vor der D1-Entscheidung geschrieben. Eine
   Echo-Einsendung würde 288 falsche Zeilen pro Tag in die Tabelle mit **fremden Personendaten**
   schreiben. Bewusst abgewichen: lesendes `SELECT 1`, dieselbe Abhängigkeitskette, keiner der
   Kosten (`ACT2_PHASE5_DECISIONS.md` §P5-b).
5. **Zertifikat und Domain sind Zonen-Tatsachen, keine App-Tatsachen.** Pro App geprüft wären es
   N-mal dieselbe Antwort — kein Erkenntnisgewinn, N-mal die Kosten, und N Karten, die gleichzeitig
   rot werden und wie N Vorfälle aussehen.
6. **Eine Heuristik wurde geprüft und abgelehnt:** „wenn in einem Tick alle Apps fehlschlagen, ist es
   wahrscheinlich unser Ausgang → alles als UNBEKANNT schreiben". Das wäre Interpolation — gemessene
   Tatsachen mit einer Wahrscheinlichkeitsannahme überschreiben — und hätte die einzige Eigenschaft
   aufgegeben, für die diese Phase existiert.

---

## 8 · GRÜNDER-KENNTNISNAHMEN (2026-08-14, bei der Merge-Freigabe)

Zwei Punkte aus diesem Bericht sind vom Gründer **wie berichtet angenommen** worden. Beide sind
ausdrücklich **nicht blockierend** — die PR wurde in Kenntnis beider gemergt. Beide stehen mit ihrem
**Auslöser** im Carry-forward-Register, damit sie nicht nur hier liegen:

| Was | Kenntnisnahme | Auslöser | Register |
|---|---|---|---|
| **Cron-Decke: 5 (Free), nicht 250 (Paid)** — Spike-Befund **F2** bricht damit bei **fünf** Apps, nicht bei 250 (§2.5, §7.1) | angenommen, nicht blockierend | **Sobald irgendeine Phase einen Cloudflare-Cron-Trigger anlegen will.** Heute folgenlos: Phase 5 verbraucht **0 von 5**. | **K9** |
| **G-P5-1** — ab **209 aktiven Apps** reicht der 5-%-Anteil des Tagesbudgets nicht mehr (§2.5, §6) | angenommen, nicht blockierend | **Die 209. aktive App** — oder früher, sobald `overBudget` in der Konsole auftaucht. Der Läufer meldet es; still überzogen wird nichts. | **K4** |

**Was diese Kenntnisnahme NICHT ist:** eine Entscheidung. Bei **K9** ist nichts zu entscheiden — es
ist eine korrigierte Zahl, die ein späterer Entwurf voraussetzen muss. Bei **K4/G-P5-1** bleibt die
Entscheidung offen und hat einen Preis (Anteil erhöhen · Workers Paid $5/Monat, was zugleich **P6**
und **G-P4-1** löst · Takt strecken und die Zusage mitverschieben); sie ist nur **noch nicht fällig**.
