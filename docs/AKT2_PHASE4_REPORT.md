# AKT 2 · PHASE 4 — FORMULARE (DATA-1F). DER PHASENBERICHT

**Datum: 2026-08-14 · Branch `claude/act2-phase4-formulare-zxfmo4` · Basis `50b3257` (origin/master)**
**Status: GEBAUT, GETESTET, GEMERGT (`4e5004d`, 2026-08-14) — DER FORMULARPFAD IST IM BETRIEB UNBEWIESEN.**

Der Satz oben ist die wichtigste Zeile dieses Dokuments. **Gemergt heißt ausgerollt, nicht bewiesen.**
Beide Seiten tragen den Merge-Commit (API 02:30:06 UTC, Web 02:30:38 UTC, an `/api/health` bzw.
`/api/version` abgelesen) — und es existiert trotzdem keine D1-Datenbank, keine echte
Einsendung, keine verschickte Benachrichtigung und kein verifiziertes Turnstile-Token. Jede Zahl hier
kommt aus einem Testlauf, einer Live-Dokumentationsseite oder einer ausgeschriebenen Herleitung —
**keine aus einer Produktionsbeobachtung.** Der Beweis ist das **gemeinsame** Gründer-Fenster
(`docs/AKT2_PHASE3_UND_4_FOUNDER_WINDOW.md` — Phase 3 und 4 in einer Sitzung, weil Phase 4 durch
Phase 3's Scan veröffentlicht), und es ist noch nicht gelaufen.

---

## 1. Was jetzt geht

Eine veröffentlichte Goblin-App kann Formular-Einsendungen entgegennehmen. Der Eigentümer sieht sie
in Goblin, bekommt eine E-Mail, kann exportieren und löschen. Spam wird gefiltert. Nichts leckt,
nichts wird still weggeworfen, nichts überlebt seine App.

Für den Bauer ist es **eine** Sache: ein Formular ohne `action` in seiner App, und beim
Veröffentlichen ist es angeschlossen. Kein Endpunkt zum Einfügen, kein Dienst zum Anmelden, kein
Schlüssel zum Eintragen.

## 2. Die fünf Entscheidungen

Vollständig in **`docs/ACT2_PHASE4_DECISIONS.md`**. In einem Satz je:

| # | Entschieden | Von wem |
|---|---|---|
| **P4-a** | **D1 ja**, pro App, auf dem Workers-**FREE**-Plan. Kein Substratwechsel, keine neue Kostenzeile. | CC unter stehenden Prinzipien (Gesetz 2 — gegen Live-Docs prüfen); umkehrbar |
| **P4-b** | Über der Grenze wird **abgelehnt**, ehrlich an den Besucher, mit Mail an den Eigentümer. Nie angenommen-und-weggeworfen. | CC (Honesty-Invariante, Gesetz 3); umkehrbar |
| **P4-c** | **500/Monat** als markierte Planungszahl, gründer-verstellbar ohne Deploy. | CC; die endgültige Zahl setzt der Gründer (**G-P4-2**) |
| **P4-d** | Einsendungen **gehen mit der App**; ein nicht bestätigter Abbau **blockiert** das Löschen (409). | CC (X1s Vertrag + Datenminimierung); umkehrbar, und die Zeile betrifft fremde Daten |
| **P4-e** | **Die API verifiziert Turnstile**, nicht der Router. Das Geheimnis verlässt Railway nie. | Vom Substrat erzwungen, nicht Ermessen |

**Die wichtigste Korrektur an einer Vorannahme:** der Preflight führt P4-a auf der Prämisse, dass eine
App-Datenbank Workers Paid bedeutet und damit eine feste Kostenzeile. Gegen die Live-Dokumentation
(abgerufen 2026-08-13) ist das **falsch** — D1 ist auf dem Free-Plan: 10 Datenbanken, 500 MB je,
5 GB gesamt, 5 Mio. gelesene / 100 000 geschriebene Zeilen pro Tag, **$0.00**. M-H1s „$0.00/Monat
committed" übersteht diese Phase. Was der Free-Plan **wirklich** auferlegt, ist die Decke von **zehn
Datenbanken** — und die wird ehrlich abgelehnt statt entdeckt.

## 3. Die Einheiten, mit ihren Commits

| Unit | Commit | Was |
|---|---|---|
| **U4.1 + U4.2** | `5acdf9e` | D1-Adapter (create/get/list/delete/query), Bereitstellung pro App, versioniertes Schema, Abbau mit Beweis, Waisen-Sweep um Datenbanken erweitert, Konsole zeigt sie zuerst |
| **U4.3 + U4.6** | `d5a11a7` | `POST /f/:appName/:formId`, Turnstile in der API, acht Schichten, Monatsgrenze, ehrliche Absagen in DE und EN |
| **U4.5** | `439d0ee` | Benachrichtigung, Opt-out pro App, Burst-Bremse, Über-der-Grenze-Mail, **Ledger M-F1 · M-F2 · M-F3** |
| **U4.7** | `cc80dc3` | Formularerkennung und -verdrahtung beim Veröffentlichen, vor dem Scan; D1 vor dem Upload |
| **U4.4 + U4.8** | `d64a62b` | Posteingang (API + Sheet), CSV-Export, Löschen, Isolationsbeweis, Kohortenschutz |
| Doku | dieser Commit | Entscheidungen, Fenster, Datenschutzseite, Register, dieser Bericht |

## 4. Die Gates, ehrlich beantwortet

| Gate | Stand |
|---|---|
| **Echter Rundlauf durch den deployten Pfad, 3/3** | **NICHT ERFÜLLT — und nicht erfüllbar in dieser Sitzung.** Er verlangt Cloudflare- und Supabase-Zugangsdaten, die hier nicht liegen (Gesetz 8, Regel 4 des Prompts). Fenster-Schritt 4. Was stattdessen belegt ist: der ganze Pfad ist an jedem Übergang durch Tests gefahren, mit einem In-Memory-D1, das mitschreibt, welche Datenbank jede Anweisung adressiert hat. |
| **Isolationsversuch abgewiesen, mit Beleg** | **ERFÜLLT.** `apps/api/src/routes/ops-form-isolation.test.ts`, 13 Tests. Zwei Apps, zwei Datenbanken, zwei Eigentümer. Anna versucht Bertas Posteingang zu lesen, zu exportieren, eine Nachricht zu löschen, ihn zu leeren, ihren Benachrichtigungsschalter umzulegen, von Bertas Seite in Annas Formular zu posten, und eine Einsendung mit `databaseId: db-berta` im Body zu schmuggeln. **Jeder Versuch scheitert, BEVOR eine Datenbank adressiert wird** — die Zusicherung ist `wire === []`, also: Bertas Datenbank wurde nicht abgefragt und dann gefiltert, sie wurde nie berührt. |
| **Turnstile-Fehlerpfad und fehlendes Geheimnis ehrlich** | **ERFÜLLT auf Testebene.** 14 Tests in `ops-turnstile.test.ts`: kein Geheimnis → Absage ohne einen einzigen ausgehenden Aufruf; abgelehntes Geheimnis → als *unsere* Konfiguration gemeldet, nicht als gescheiterte Prüfung des Besuchers; 5xx, kaputter Body, Hänger (mit falschen Timern) → **UNAVAILABLE**, nie grün. Der Live-Beleg ist Fenster-Schritt 5a. |
| **Über der Grenze: abgelehnt + Eigentümer benachrichtigt, null stille Verluste** | **ERFÜLLT auf Testebene.** Bei 500 wird abgelehnt, die Absage wird gezählt, `insert` wird nicht aufgerufen, die Über-der-Grenze-Mail wird **abgewartet, bevor** die Antwort rausgeht — weil der Satz an den Besucher sagt, der Eigentümer sei informiert, und der Satz stimmen muss, wenn er gesendet wird. Live: Fenster-Schritt 5b. |
| **Abbau entfernt D1 mit null Waisen; ein gescheiterter Abbau blockiert das Löschen (X1-Regression)** | **ERFÜLLT auf Testebene, und es ist die stärkste Zusicherung dieser Phase.** Die X1-Regressionssuite stellt jetzt ein In-Memory-D1 daneben: Projekt mit Formular löschen ⇒ Datenbank weg, Sweep sauber. Löschen mit blockiertem D1-Delete ⇒ **409**, Projektzeile steht, Registry-Zeile steht, Datenbank steht, und die deutsche Meldung sagt **„Einsendungen"** statt „die Adresse bliebe online". Der zweite Versuch geht durch. Eine App **ohne** Formular ist von alledem unberührt. |
| **Kein Einsendungsinhalt in Logs, Fehlern oder Modellaufrufen** | **ERFÜLLT, und hier ist, was geprüft wurde.** (a) Jeder `logger.*`-Aufruf der sechs Phase-4-Dateien aufgezählt: 18 Stück, jeder trägt nur IDs, Codes und Zahlen (`appId`, `formId`, `reason`, `fieldCount`, `bytes`, `used`, `cap`, `status`, `codes`, `aborted`). (b) `grep -E "logger\.[a-z]+\(\{[^}]*(payload\|fields:\|content\|value\|…)"` über dieselben Dateien: **ein** Treffer, `jurisdiction: created.value.jurisdiction` — das ist die Zeichenkette `eu`, kein Inhalt; das Muster hat auf `value` angeschlagen. (c) `grep` nach `abuse-classifier`, `runHostedPublishScan`, `DeepInfra`, `completion` über den Formularpfad: **null Treffer**. (d) Ein Test fährt vier verschiedene Absagen und prüft, dass eine bestimmte E-Mail-Adresse in **keinem** Ergebnis und in **keinem** Antwortkörper vorkommt. |
| **i18n, 0 fehlende Schlüssel** | **ERFÜLLT im Sinne dieses Projekts.** Es gibt keine Schlüsseldatei; die i18n ist `t(lang, de, en)`. „0 fehlende Schlüssel" heißt hier: keine sichtbare Zeichenkette ist einsprachig. Belegt für den Posteingang durch einen Test, der jeden nackten deutschen JSX-Textknoten verbietet (`>Löschen<` wäre einer) und ≥ 20 gepaarte `t(lang, …)`-Aufrufe verlangt. Die Besucher-Sätze des Ingest sind ein geschlossener Datensatz mit DE und EN pro Code, und ein Test läuft ihn durch. |
| **Datenschutzseite aktualisiert** | **ERFÜLLT.** Neuer Abschnitt **1a**, DE und EN, plus D1 in der Cloudflare-Zeile der Unterauftragsverarbeiter. Details in §6. |
| **Ledger-Zeilen im Commit ihrer Einheit** | **TEILWEISE — und das ist eine Abweichung, keine Auslegung.** M-F2 und M-F3 stehen im Commit ihrer Mechanismen. **M-F1 (D1) nicht:** der Mechanismus ist `5acdf9e`, die Zeile kam in `439d0ee`. Die Ledger-Zeile sagt das selbst. |
| **Volle Suite + tsc** | **ERFÜLLT.** API **2144/2144** in 167 Dateien. Web **493/493** in 41 Dateien. `tsc --noEmit` sauber in beiden. |
| **`anmeldeformular` unberührt und weiter erreichbar** | **ERFÜLLT — beide Hälften, seit 2026-08-14.** *Unberührt:* `git diff origin/master -- apps/api/src/services/ops-router/` ist **leer** — `worker.js` und die generierte Datei sind nicht angefasst, der Auslieferungspfad liegt außerhalb des Blastradius. Die App hat keine Datenbank, also 404t der Ingest für sie wie für jede andere. *Weiter erreichbar:* **gemessen, zweimal.** Vor dem Merge und erneut nach dem Merge und nach dem Deploy beider Seiten: **HTTP 200, `text/html; charset=utf-8`, 10 544 Bytes, `<title>Schachkurs Anmeldung`** — byte-gleich groß in beiden Abrufen. *(Diese Zeile stand bis zum Merge als HALB im Bericht, weil ich die Beobachtung nicht gemacht hatte. Jetzt ist sie gemacht.)* |

## 5. Wie das Substrat aussieht, nachdem diese Phase gemerged ist

```
{name}.justgoblin.app                    →  Router-Worker  →  KV route:{name}  →  R2 apps/{appId}/
                                             UNVERÄNDERT       unverändert         unverändert
        │
        │  das Formular auf der Seite postet cross-origin
        ▼
api.justgoblin.com/f/{name}/{formId}     →  Plattform-API  →  Turnstile (siteverify)
                                                            →  D1 goblin-app-{appId}  (EU)
                                                            →  Resend an den Eigentümer
```

Der Router weiß von Formularen **nichts**. Das ist P4-e, und es ist der Grund, warum diese Phase am
Auslieferungspfad keine einzige Zeile geändert hat.

## 6. Datenschutz — was auf der Seite steht, weil es jetzt stimmt

Ab dieser Phase speichert Goblin Daten von Menschen **ohne Goblin-Konto**, die nie etwas mit uns
vereinbart haben. Der App-Eigentümer ist Verantwortlicher, Goblin ist Auftragsverarbeiter. Der neue
Abschnitt **1a** (DE + EN) sagt:

- **Was gespeichert wird:** die Feldinhalte, der Zeitpunkt, die Formularkennung, die Größe, gelesen
  ja/nein.
- **Was ausdrücklich NICHT gespeichert wird:** keine IP, kein User-Agent, kein Referrer, keine
  Cookies, keine wiedererkennbare Kennung. Das ist im Code eine Eigenschaft und keine Zusage: die
  Adresse wird beim Lesen sofort gehasht (Salt pro Prozess, nie persistiert) und existiert nirgends
  als Variable, die den Ausdruck überlebt. An Turnstile wird `remoteip` bewusst **nicht** geschickt.
- **Wo:** eigene Datenbank pro App, Cloudflare D1, **EU-Jurisdiktion** — dieselbe Variable, die R2
  regelt, und eine Bereitstellung, die **verweigert**, wenn diese Variable etwas sagt, das D1 nicht
  einhalten kann.
- **Aufbewahrung und Löschung:** keine automatische Frist; der Eigentümer löscht einzeln oder alles
  und kann vorher als CSV exportieren; **mit der App geht alles mit.** Wer selbst etwas eingesendet
  hat, wendet sich an den Betreiber — und wenn er niemanden erreicht, an `support@justgoblin.com`.
- **Was Goblin NICHT tut:** Einsendungen werden nicht geprüft, nicht durchsucht und nicht an ein
  Modell übergeben. Der Scan betrifft die App zum Veröffentlichungszeitpunkt, nie das, was danach
  jemand einsendet.

Der Kostenpunkt dazu: **die Datenschutzseite ist weiterhin KI-verfasst und anwaltlich ungeprüft**
(Carry-forward **D1**). Diese Phase hat sie korrekter gemacht, nicht geprüft.

## 7. Ledger

| Zeile | Was | Status |
|---|---|---|
| **M-F1** | D1-Speicher pro App. Free-Plan-Zahlen aus Live-Docs, die Zehner-Decke, die Rechnung (5 000 Zeilen/Monat gegen 100 000/Tag Kontingent), und die Feststellung, dass der Upgrade-Auslöser nicht feuert. | FORMULA — keine Datenbank existiert |
| **M-F2** | Turnstile. **$0.00.** Registriert, weil eine Abhängigkeit ohne Rechnung eine Abhängigkeit ist — und weil ihre wirkliche Kosten nicht Geld sind, sondern der Fail-closed-Handel im Pfad jeder Einsendung. | STRUCTURAL — keine Verifikation gelaufen |
| **M-F3** | Resend-Volumen. Hart gedeckelt durch die Monatsgrenze: 500 × 10 Apps = **5 000 Sends/Monat** flottenweit, auf dem mit M-A1 geteilten Kontingent. Plattform-COGS nach E1. | STRUCTURAL — kein Send gelaufen |

## 8. EHRLICHE EINSCHRÄNKUNGEN

Die Liste, die man liest, bevor man irgendetwas hiervon nach außen sagt.

1. **Nichts hiervon ist in Produktion gelaufen.** Keine Datenbank, keine Einsendung, keine Mail, kein
   Token. Zwei Ebenen tief: auch das **Phase-3-Fenster** ist nie gelaufen, und Phase 4 veröffentlicht
   durch genau diesen Pfad. Wenn eine Formular-App in der Prüfliste hängen bleibt, ist das ein
   Phase-3-Befund.
2. **Dem `CF_API_TOKEN` könnte die D1-Berechtigung fehlen.** Nicht nachgeprüft — es gibt hier keine
   Cloudflare-Zugangsdaten. Die erste Formular-Veröffentlichung würde dann ehrlich, aber überraschend
   mit `d1_unavailable` scheitern. Ein Klick im Dashboard.
3. **Die Railway-Umgebung habe ich nicht gesehen.** Die Vorbedingungen des Prompts (die
   `CF_TURNSTILE_*`-Variablen, `OPS_BETA_ACCOUNTS`, `CF_R2_JURISDICTION=eu` …) sind **nicht** von mir
   verifiziert — dieser Container trägt keine davon. Ich habe sie **nach Namen** im Code und in
   `.env.example` verankert und im Fenster ein Nachsehen aufgeschrieben. Was der Gründer am 2026-08-13
   angelegt hat, glaube ich; geprüft habe ich es nicht.
4. **Eine Variable, die es noch nicht gibt: `OPS_FORMS_ENDPOINT`.** Die API kennt ihre eigene
   öffentliche Adresse nicht. Der Code fällt auf `NEXT_PUBLIC_API_URL` zurück, falls die in Railway
   steht — ob sie das tut, weiß ich nicht. Fehlen beide, wird eine Formular-App **nicht**
   veröffentlicht (ehrlich, nicht still). Fenster-Schritt 0.1.
5. **Die Rate-Begrenzung und die Mail-Bremse laufen im Prozess** (Carry-forward **P3**). Bei mehreren
   Instanzen ist die echte Grenze (Instanzen × Zahl). Turnstile ist die Schicht, die wirklich etwas
   kostet; die Monatsgrenze in D1 ist exakt.
6. **Die Formularerkennung liest HTML mit regulären Ausdrücken** (**P4**). Ein Formular, das
   JavaScript zur Laufzeit baut, ist unsichtbar und bleibt es. Was nicht sauber lesbar ist, wird
   gemeldet und nicht angefasst, und das Publish-Ergebnis trägt `forms.wired` und `forms.skipped`.
7. **Nichts scannt, was ein Besucher einsendet** (**A7**, jetzt eingetreten; **P5**). Kein
   Klassifizierer, keine Regelliste, kein Modell. Jede Benachrichtigungsmail sagt das dem Eigentümer.
8. **Die Zählung an der Monatsgrenze hat ein Rennen.** Zwei gleichzeitige Einsendungen an der Grenze
   können beide durchgehen. Die Richtung ist die richtige: **Überschreiten statt still verlieren.**
9. **Die Zehner-Decke ist eine Produktgrenze, keine technische Wahl** (**P6**, **G-P4-1**).
10. **Der Projekt-Lösch-Dialog nennt die Zahl der Einsendungen nicht** (**P7**).
11. **Es gibt keine Aufbewahrungsfrist** (**P8**). Einsendungen bleiben, bis jemand löscht.
12. **`D5` ist fällig geworden** (**P9**): es gibt keinen niedrigschwelligen öffentlichen
    Missbrauchs-Meldeweg, und ab jetzt nehmen Apps fremde Daten entgegen — genau der Auslöser, den
    D5 selbst benennt.
13. **Der CSV-Export ist bei 5 000 Zeilen gedeckelt** und sagt es in einem Header; das Sheet zeigt
    den Satz. Kein „vollständig aussehender" Teilexport.
14. **Zwei Sitzungsläufe der Stripe-Plan-Change-Tests sind einmal rot gewesen** (gegen die echte
    Stripe-Test-Umgebung) und im selben Baum isoliert **grün**. Der letzte volle Lauf war 2144/2144.
    Es ist Flakiness gegen einen Fremdservice, nicht dieser Diff — aber es ist beobachtet und gehört
    aufgeschrieben.

## 9. BEFUNDE (was beim Bauen aufgefallen ist, ohne dass jemand danach gefragt hat)

1. **Der Preflight irrt bei P4-a in der Prämisse.** D1 ist auf dem Free-Plan. Das kippt die
   Entscheidung von „Substratwechsel mit Kostenzeile" auf „ein Produkt, das ohnehin auf dem Plan
   lag, mit einer Decke von zehn". §2 oben.
2. **Der Preflight erwartet eine `d1`-Erweiterung der `CfBinding`-Union. Sie ist nicht gekommen, und
   das ist kein Versäumnis.** Bindings sind statisch pro Deploy; N App-Datenbanken an den einen
   geteilten Router zu binden hieße, den Router neu hochzuladen, sobald ein Bauer veröffentlicht.
   Eine Union-Erweiterung wäre Code gewesen, den nichts aufruft.
3. **Die Variablennamen des Preflights stimmen nicht mit Railway überein.** Vorgeschlagen war
   `TURNSTILE_*`, angelegt wurde `CF_TURNSTILE_*`. Der Code liest, was existiert.
4. **`loadArtifact` hatte eine latente Falle.** Es baute die Sicht des Scans **während** des Ladens
   auf. Sobald irgendetwas die Bytes danach ändert — wie diese Phase es tut —, hätte der Scan die
   Datei beschrieben, wie sie **vorher** war, und die U2.3-Zusage wäre still gebrochen. Jetzt wird
   die Sicht aus den endgültigen Bytes **abgeleitet**, und ein Test hält scanned == uploaded.
5. **Die globale CORS-Middleware hätte den Ingest lautlos unbrauchbar gemacht.** Der `OPTIONS`-Handler
   in `index.ts` beantwortet jeden Preflight, bevor eine Route ihn sieht, und `*.justgoblin.app` steht
   nicht in `CORS_EXACT` — jeder Browser-Preflight wäre mit leerem `Access-Control-Allow-Origin`
   zurückgekommen. Die Versuchung, `*.justgoblin.app` in `CORS_EXACT` aufzunehmen, wäre der Fehler
   gewesen: das ist die Liste der Origins, die die **authentifizierte** API mit Credentials aufrufen
   dürfen, und jeder veröffentlichten Bauer-App einen Platz darin zu geben wäre eine ganz andere
   Entscheidung. Stattdessen treten beide Middlewares für genau `/f/*` beiseite.
6. **`SECRET_ENV_VARS` war auf `CfEnvVar` typisiert** und konnte deshalb kein Geheimnis aufnehmen,
   das nicht in `CF_ENV_VARS` steht. Der Turnstile-Secret gehört ausdrücklich **nicht** in
   `CF_ENV_VARS` (sonst meldet `/api/ops/health` ihn als fehlend auf jeder Instanz ohne Formulare) —
   also wurde der Typ geweitet statt die Variable verschoben. Außerhalb der Health-Liste zu stehen
   darf nicht heißen, außerhalb der Redaktion zu stehen.
7. **Der CSV-Export braucht einen Formel-Schutz, und das ist keine Kür.** Diese Datei wird aus Text
   gebaut, den Fremde in ein Kontaktformular getippt haben. Ein Wert, der mit `=`, `+`, `-` oder `@`
   beginnt, ist in Excel und Numbers eine **Formel**. Ein Export, der ausführt, was ein Besucher
   geschrieben hat, ist kein Export.
8. **Der Preflight sagt, `lib/email.ts` existiere — es stimmt.** Eine frühere Notiz in dieser Sitzung
   hat das kurz bezweifelt; die Zweifel kamen von einem falschen Arbeitsverzeichnis, nicht vom Repo.
   Aufgeschrieben, damit niemand der falschen Spur folgt.

## 10. GRÜNDER-AKTIONEN

1. **`OPS_FORMS_ENDPOINT`** in Railway setzen (oder bestätigen, dass `NEXT_PUBLIC_API_URL` dort
   steht). Fenster-Schritt 0.1.
2. **`CF_TURNSTILE_SITE_KEY` und `CF_TURNSTILE_SECRET_KEY`** nach Namen nachsehen. Schritt 0.2.
3. **Keine Migration.** `0103` bleibt unvergeben.
4. **Das Fenster fahren** — `docs/AKT2_PHASE3_UND_4_FOUNDER_WINDOW.md` (Teil A: Scan und Prüfliste, Teil B: Formulare): veröffentlichen, dreimal absenden,
   E-Mail und Posteingang bestätigen, die Grenze und die Absage testen, löschen, Waisen-Prüfung,
   `anmeldeformular` ansehen, und bestätigen, dass ein normales Konto nichts davon sieht.
5. **Zwei Entscheidungen** aus `docs/ACT2_PHASE4_DECISIONS.md`: **G-P4-1** (die elfte Formular-App
   kostet $5/Monat — jetzt oder wenn sie kommt?) und **G-P4-2** (bleibt es bei 500/Monat?).
6. **Über die GitHub-App mergen.**
7. Danach: **„Phase 5"** an Steven.
