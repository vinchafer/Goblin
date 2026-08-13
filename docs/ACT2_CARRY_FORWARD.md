# AKT 2 — CARRY-FORWARD-REGISTER

**Angelegt: 2026-08-13, am Ende von Phase 3 · Autor: CC · Stand: master `9ea5710`**

Ein Ort für alles, was Akt 2 offen an die nächste Phase übergibt. Vorher lagen diese Zeilen
verstreut in sechs Dokumenten, jede in dem Bericht, der sie gefunden hat — was in Ordnung ist,
solange man weiß, dass man suchen muss. Ab Phase 4 muss man das nicht mehr: **wer wissen will,
was offen ist, liest diese Datei.**

**Was hier steht:** offene Punkte aus Akt 2, jeder mit einer Stelle, die ihn besitzt, und einer
Bedingung, unter der er fällig wird. **Was hier nicht steht:** erledigte Dinge (die stehen
gestempelt in ihrem Ursprungsdokument), und Akt-1-Altlasten, die Akt 2 nicht angefasst hat.

**Wie eine Zeile gelesen wird.** `Fällig` ist kein Datum, sondern ein **Auslöser** — Phase-4-Arbeit
ist etwas anderes als „bevor die Allowlist fällt" ist etwas anderes als „wenn ein echter Fall
auftritt". Ein Register mit Fristen, die niemand gesetzt hat, wäre eine Liste erfundener Termine.

**Wie es gepflegt wird.** Eine Zeile wird geschlossen, indem sie **durchgestrichen und gestempelt**
wird (Datum + PR/Commit), nicht indem sie gelöscht wird — sonst verschwindet die Spur, dass sie je
offen war. Neue Zeilen kommen unten in ihren Abschnitt. Die Nummern sind Etiketten, keine
Rangfolge; sie werden nicht wiederverwendet.

---

## A · SCAN UND KLASSIFIZIERER (Phase 3)

| # | Offen | Zuhause | Fällig |
|---|---|---|---|
| **A1** | **`stage2-04-seo-doorway` liegt bei 3/5**, unter der 4/5-Stabilitätsschwelle. Bewusst **nicht** durch Prompt-Tuning grün gemacht: gegen dieselben zehn Fixtures zu tunen, gegen die man den Prompt danach zitiert, misst das Tuning und nicht den Klassifizierer. Ehrliche Aussage: *er hält SEO-Doorway-Seiten etwa drei von fünf Malen.* Die Fehlerrichtung ist die mildere — eine Doorway-Seite geht live, statt dass ein ehrlicher Bauer blockiert wird. | Messwert `evidence/akt2-phase3/stage2-battery.json` · Tabelle `apps/api/src/services/safety/hosted-scan-battery-v2.ts` | Wenn ein **echter** Spam-/Doorway-Fall auftritt. Dann gilt `ABUSE_RESPONSE` §7: neue Regel **und** neue Fixture — an echten Fällen zu tunen ist erlaubt, an den eigenen nicht. Offen als Produktentscheidung: **E4** im Phase-3-Bericht. |
| **A2** | **Die sechs bekannten Lücken sind unverändert offen.** Stufe 2 schließt **keine** davon. Sie erkennt Absichten statt Muster und trifft damit einige seltener — das ist etwas anderes als „geschlossen", und der Unterschied darf in keiner Zusage verschwimmen. | `docs/ABUSE_RESPONSE.md` §6 (Residual-Risk-Register) | Dauerhaft. Vor jeder Aussage nach außen, die suggeriert, der Scan sei vollständig. |
| **A3** | **Die Klassifizierer-Ausgabe wird nirgends verbucht.** Kein `completion_costs`-Eintrag, also unsichtbar für `goblinWeightedUsage()` und `isOverMonthlyAllowance()`. Das ist heute richtig — Gründer-Entscheid **E1**: Scannen ist Plattform-COGS und wird dem Nutzer-Kontingent nie verrechnet. Es heißt aber auch: **die Kosten sind heute nur durch den harten Cap pro Aufruf und die Zahl möglicher Publishes eines Beta-Kontos begrenzt**, nicht durch eine Messung. | Ledger **M-A2**, Abschnitt „Billed to" (die Konsequenz steht dort ausgeschrieben) | **Bevor Hosting die Allowlist verlässt.** Dann braucht es einen gemessenen Pfad — eine eigene `platform_cogs`-Zeile, nicht das Nutzer-Kontingent. |
| **A4** | **Ein Provider-Ausfall füllt die Prüfliste, ungefedert.** Fail-closed heißt: DeepInfra weg ⇒ **jede** gehostete Veröffentlichung wird gehalten. Das ist die gewollte Richtung. Es gibt heute nur nichts, was den Stau abfängt: keine Warteschlangen-Wiederholung, keine Benachrichtigung an den Betreiber, keinen Automatik-Retry. Ein Ausfall von einer Stunde ist eine Prüfliste voller Leute, die nichts falsch gemacht haben. | Verhalten in `apps/api/src/services/safety/abuse-classifier.ts` | Kandidat für **Phasen 5–7 (Keeper)**, wo Betreiber-Benachrichtigung ohnehin gebaut wird. Vorgezogen, sobald mehr als eine Handvoll Konten auf der Allowlist steht. |
| **A5** | **Der Token-Schätzer läuft 23 % zu tief** — 710 geschätzt gegen 916 gemessen, weil `chars ÷ 4` eine Prosa-Zahl ist und Markup dichter. Kostenseitig harmlos (der Ledger rechnet mit dem gemessenen Wert). **Budgetseitig ist es die falsche Richtung:** eine App knapp unter der geschätzten Decke kann real darüber liegen — und wird dann nach dem Aufruf gehalten statt vorher, also nachdem sie Geld gekostet hat. | `CHARS_PER_TOKEN_ESTIMATE` in `abuse-classifier.ts` · Zahlen in Ledger **M-A2** | Wenn ein zweiter Messpunkt existiert. **Eine Messung ist keine Kalibrierung** — den Faktor an einem einzigen Lauf nachzuziehen wäre Overfitting auf n=1. |
| **A6** | **Das 6 000-Token-Budget hält vermutlich keine Framework-App.** 6 000 ≈ 24 000 Zeichen extrahierter Text; ein einziges gebündeltes Vite-/React-`index-*.js` liegt deutlich darüber. Eine schlichte statische Seite passt bequem, ein echter Build landet **by design** in der Prüfliste. Beim Schreiben des Gründer-Fensters aufgefallen, **nicht gemessen**: bisher ist keine echte Framework-App durch diesen Pfad gegangen. | `OPS_SCAN_CLASSIFIER_MAX_TOKENS` (Stellschraube, kein Deploy nötig) · dokumentiert in `apps/api/.env.example` | Im **Gründer-Fenster, Schritt 4 Weg A** zu messen. Bis dahin eine begründete Vermutung, keine Zahl. |
| **A7** | **Der Scan ist ein Publish-Zeitpunkt-Scan.** Er liest das Artefakt, wenn es veröffentlicht wird — nichts danach. Für eine statische Seite ist das vollständig. Für alles Zustandsbehaftete nicht. | `hosted-publish-scan.ts` (Aufrufzeitpunkt) | **Phase 4 (Formulare) macht Apps zustandsbehaftet.** Was ein Besucher später einsendet, wird von nichts gescannt. Steht schon als Warnung in der Phase-4-Bereitschaftsnotiz; hier, damit es nicht nur dort steht. |

## B · BETRIEB UND OBERFLÄCHE

| # | Offen | Zuhause | Fällig |
|---|---|---|---|
| **B1** | **Migration `0100` (Audit-Tabelle) ist nicht als angewendet bestätigt.** `0099` ist seit PR #57 angewendet, `0102` seit 2026-08-13 — für `0100` gibt es keine Bestätigung, und der grüne Phase-2-Lauf beweist sie **nicht**, weil der Audit-Schreiber absichtlich tolerant gegenüber ihrem Fehlen ist. Kein Defekt, eine Wissenslücke. | `docs/ABUSE_RESPONSE.md` §7 · Konsole meldet es von selbst | **Beim nächsten Blick in die Konsole.** Steht dort „Keine Protokollzeile — Migration 0100 fehlt", ist die Antwort da. |
| **B2** | **Die Audit-Zeile einer Review-Entscheidung hat eine andere Form als die einer Sperre.** Ein Kandidat hat keine App-ID, also tragen `app_id`/`app_name` die ID der Queue-Zeile und den Wunschnamen; `meta.subject = 'review_queue_item'` markiert das. Wer das Protokoll per SQL liest, muss es wissen. Sauberer wäre eine eigene Spalte — und damit eine Migration an `0100`. | Schreibpfad in `apps/api/src/routes/ops-console.ts` · gelesen in der Konsole über `listRecentReviewDecisions` | Wenn ohnehin an `0100` migriert wird. Isoliert lohnt die Migration nicht. |
| **B3** | **Die Konsolen-Screenshots sind ohne die Dashboard-Hülle gerendert.** Layout bei 390 px, Wortlaut und Inertheit der Vorschau sind belegt; die **finalen Farben** sind es nicht — das Harness rendert die Karte, nicht die Seite. | `apps/web/scripts/konsole-shots.mts` · Bilder in `evidence/akt2-phase3-konsole/` | Wenn eine Farbaussage gebraucht wird. Für Layout und Text ist der Beleg tragfähig wie er ist. |
| **B4** | **„Pixelgleich" ist als DOM-gleich belegt, nicht als Rasterbild.** Das Sheet benutzt ausschließlich Inline-Styles, weshalb ein DOM-Diff von null hier sehr stark ist — ein Screenshot-Vergleich ist es trotzdem nicht. | Phase-3-Bericht, Notiz 10 | Nur, wenn jemand das Wort „pixelgleich" nach außen tragen will. Dann: entweder messen oder anders sagen. |
| **B5** | **Der Lazy-Chunk versteckt nichts.** Er hebt die Kosten, das Publish-Sheet zu finden, von „lies dein eigenes Bundle" auf „zähle Chunks gezielt auf". Die Grenze, die trägt, ist die API — nicht das Bundle-Splitting. | Phase-3-Bericht, Notiz 11 | Dauerhaft, als Korrektur einer möglichen Fehllesung. Kein Fix nötig; die tragende Grenze ist die richtige. |

## C · SUBSTRAT UND KOSTEN

| # | Offen | Zuhause | Fällig |
|---|---|---|---|
| **C1** | **Es gibt keine Obergrenze pro App.** Der Free-Plan hat keine Per-Tenant-Limits, und `setTenantLimits` existiert nicht. Die Eindämmung ist die Allowlist, der Kill-Switch und `ops-caps.ts` — plus die 100 000 Requests/Tag des Plans, die **kontoweit** greifen und damit die ganze Flotte schließen, nicht die eine App, die läuft. Das ist ein **bewusst eingetauschtes** Requirement (Thesis §5.2 (b)), keine Lücke, die jemand übersehen hat. | Ledger §„Substrate & plan" · Banner in `GOBLIN_THESIS_v3_DRAFT.md` §5.2 | Dauerhaft als **Sprachregel**: „harte Obergrenzen pro App" darf in keinem Pitch und keiner Zusage stehen. Als Technik: mit dem dokumentierten Upgrade-Auslöser. |
| **C2** | **Der Upgrade-Auslöser ist definiert, aber nichts misst ihn.** Der Wechsel auf Workers Paid / WfP + D1 ist ausgelöst, wenn **entweder** das Free-Tageslimit tatsächlich beißt (gemessen, aus dem Cloudflare-Dashboard — nicht vorhergesagt) **oder** eine Nutzer-App serverseitigen Code braucht. Für den ersten Zweig gibt es heute keinen Alarm; jemand müsste hinsehen. | Ledger §„Documented upgrade trigger" | Bevor mehr als eine Handvoll Apps live ist. Ein Auslöser, den niemand beobachtet, ist eine Notiz. |
| **C3** | **`A1 = 5 CPU-ms/Request` ist unverifiziert** und die größte ungemessene Eingabe des gesamten Kostenmodells. Auf Free ist das folgenlos (es wird nichts pro CPU-ms berechnet); beim Upgrade ist es der Faktor, an dem die ganze Rechnung hängt. | `OPS_SPIKE_0_DECISION_TABLE.md` §2, Caveat 2 zu D2 | **Beim Upgrade**, vor der Rechnung, nicht danach. Der Ledger nennt das Nachrechnen bereits als Bedingung. |
| **C4** | **Die Preis-Evidenz des Spikes ist seit 2026-07-25 nicht nachgeprüft.** Jede Cloudflare-Zahl darin trägt ein Abrufdatum, und keines ist neu. | Banner oben in `OPS_SPIKE_0_DECISION_TABLE.md` | Beim Upgrade. Bis dahin schadet die Veraltung nichts, weil auf $0.00/Monat nichts davon angewendet wird. |
| **C5** | **`F1` — der Export gibt `.sql` zurück, nicht SQLite.** Der Blueprint verspricht „export = die SQLite-Datei"; D1 liefert über CLI **und** REST einen `.sql`-Dump. Entweder serverseitig konvertieren oder die Zusage ändern. Heute schlafend, weil es kein D1 gibt. | `OPS_SPIKE_0_DECISION_TABLE.md` §F1 · Blueprint Part C | **Mit Phase 4, falls D1 wiedereröffnet wird.** Vorher gibt es nichts zu exportieren. |

## D · RECHT UND ZUSAGEN

| # | Offen | Zuhause | Fällig |
|---|---|---|---|
| **D1** | **Die Rechtsseiten sind KI-verfasst und anwaltlich ungeprüft** — so steht es auch auf ihnen. Akt 2 hat sie *korrekter* gemacht, nicht *geprüft*. Betroffen: AUP, AGB, Datenschutz, Impressum. | Warnblock oben in `docs/ACCEPTABLE_USE_POLICY.md` · `ABUSE_RESPONSE.md` §7 | **Vor Skalierung** — die längststehende offene Gründer-Aufgabe von Akt 2. |
| **D2** | **`E3` ist unentschieden: App-Inhalt geht an DeepInfra.** Ein neuer Verarbeitungszweck bei einem bestehenden Unterauftragsverarbeiter, offengelegt in AUP und Datenschutz — auf einer Rechtsseite, die anwaltlich ungeprüft ist. Der Text ist geschrieben; was fehlt, ist, dass der Gründer ihn mitträgt. | Phase-3-Bericht, Eskalation **E3** | Gründer-Entscheidung, unabhängig von D1. |
| **D3** | **AGB, Datenschutz und Impressum sind englisch-only**, während die AUP zweisprachig ist. Eine vorbestehende Parität-Lücke; die in Akt 2 **neu** geschriebenen Abschnitte sind DE+EN. Die alten zu übersetzen hieße, Haftungswortlaut zu ändern — bewusst nicht nebenbei getan. | `HOSTING_CLAIMS_AUDIT.md` **G2/G3** | Gründer-Entscheidung, sinnvollerweise zusammen mit D1. |
| **D4** | **Der Vercel-Meldeweg muss halbjährlich gegengeprüft werden** und das Datum in `ABUSE_RESPONSE` §4 aktualisiert. Zuletzt: 2026-07-28. | `ABUSE_RESPONSE.md` §7 | **Ab ~2026-01-28.** Eine Meldeadresse, die niemand nachprüft, ist eine Vermutung. |
| **D5** | **`E5` — die Ledger-Marke ist `M-A2`, nicht `M-A1`.** `M-A1` war seit Akt 1 die Resend-Auth-Mail-Zeile; aufgelöst wie bei M15: nächste freie Marke plus Nummerierungsnotiz. Falls der Gründer eine andere Nomenklatur will, ist jetzt der billigste Zeitpunkt. | Ledger **M-A2**, Nummerierungsnotiz | Jetzt oder nie — je später, desto mehr Verweise. |

## E · REPO-HYGIENE UND WERKZEUG

| # | Offen | Zuhause | Fällig |
|---|---|---|---|
| **E1** | **`.gitignore:2` ist `*.txt` — eine Falle für Evidenz.** Die vier DOM-Dumps aus Phase 3 wurden stillschweigend verschluckt, während `evidence/akt2-phase3-konsole/README.md` sie zitierte: eine README, die auf Dateien zeigt, die es im Repo nicht gibt. Phase 1 hat dieselbe Falle überlebt, weil dort jemand `git add -f` benutzt hat — also durch Glück, nicht durch Konstruktion. Die vier Dateien werden im selben PR wie dieses Register nachgetragen; die **Falle selbst steht danach unverändert**. Ein Vorschlag für eine gezielte Ausnahme (`!evidence/**/*.txt`) liegt vor und ist bewusst **nicht** angewendet — eine `.gitignore`-Änderung wirkt auf jeden künftigen Commit im ganzen Repo, das ist eine Gründer-Entscheidung. | `.gitignore` · Vorschlag im PR dieser Kehrarbeit | **Gründer-Entscheidung.** Bis dahin: **jede** `.txt`-Evidenz braucht `git add -f`, und wer eine README schreibt, die Dateien zitiert, prüft danach `git ls-files`. |
| **E2** | **Evidenz-READMEs gibt es nur in Akt-2-Ordnern.** 27 der 31 Ordner unter `evidence/` haben keine. Das ist eine Akt-2-Konvention, die rückwirkend niemand durchgesetzt hat — kein Defekt, aber wer in `evidence/fw3-theme/` schaut, findet Dateien ohne Erklärung. | `evidence/` | Wenn ein alter Ordner tatsächlich gebraucht wird. Rückwirkend alle nachzuziehen wäre Fleiß ohne Leser. |
| **E3** | **Der Deploy ist pfadgefiltert, und das sieht wie Rückstand aus.** Ein Docs-only-Merge löst keinen API-Deploy aus, also läuft die API danach sichtbar auf einem älteren Commit als `master`. Das ist korrekt und spart Deploys — aber es hat in dieser Sitzung einmal zu einer Fehlmeldung geführt („die API hängt einen Merge zurück"), bis der Grund gefunden war. Es steht in keinem Dokument. | Railway-Watch-Paths (Dashboard, nicht im Repo) | Dauerhaft, als Lesehilfe. **Wichtig für jede Sitzung, die nach einem Merge „läuft der neue Commit?" prüft:** die Antwort „nein" ist bei einem Docs-PR die richtige. |
| **E4** | **Phase 2.5's Screenshot-Skript wurde nie eingecheckt.** Die Konsolen-PNGs von damals lassen sich aus dem Repo nicht reproduzieren. Das Phase-3-Harness (`konsole-shots.mts`) ist eingecheckt — genau deswegen. | `evidence/akt2-phase2.5-konsole/` | Nicht zu reparieren (das Skript ist weg). Steht hier als der Grund, warum es das Phase-3-Harness gibt. |
| **E5** | **`konsole-shots.mts` braucht auf manchen Maschinen `PW_CHROMIUM_PATH`.** Ohne gesetzten Pfad findet Playwright den Browser nicht und das Harness bricht ab — kein Defekt des Harness, eine Umgebungsvoraussetzung, die niemand rät. | `apps/web/scripts/konsole-shots.mts` | Beim nächsten Lauf auf einer neuen Maschine. |

## F · AUSSERHALB DIESES REPOS

| # | Offen | Zuhause | Fällig |
|---|---|---|---|
| **F1** | **`KD-2` — Diagramm-Achsenbeschriftungen im Pitch-Repo.** Aus Akt-1-Arbeit übrig, liegt **nicht** in diesem Repo und kann von hier nicht geschlossen werden. Steht hier ausschließlich, damit es nicht dadurch verschwindet, dass niemand mehr weiß, wo es hingehört. | Pitch-Repo (separat) | Wenn am Pitch gearbeitet wird. |
| **F2** | **`GOBLIN_CFO_DASHBOARD_DE.html` ist als Quelle der Finanzwahrheit benannt und liegt nicht im Repo.** Der Spike hat das als Gründer-Aufgabe eskaliert. **Phase 8 (Billing) HALTet an Unit 8.4 ohne CFO v2** — das ist im Master-Plan als Gate formuliert, nicht als Wunsch. | `OPS_SPIKE_0_DECISION_TABLE.md` §6.2 (4) · Master-Plan Phase 8 | **Vor Phase 8.** Früh genug ansehen, dass es kein Blocker wird, wenn es einer ist. |

---

## Offene Entscheidungen für Phase 4 im Besonderen

Diese sind **nicht** Carry-forward im engeren Sinn — sie sind Vorbedingungen der nächsten Phase.
Vollständig ausgeführt in der Bereitschaftsnotiz (`GOBLIN_OPS_MASTER_PLAN_16_PHASES.md`, Phase 4)
und im Preflight; hier nur als Zeiger, damit dieses Register vollständig ist:

- **D1 überhaupt** — eine App-Datenbank pro App eröffnet die Substrat-Entscheidung D2 neu. Das ist
  ein Substratwechsel, kein Inkrement, und gehört in eine Entscheidungstabelle vor die erste Zeile
  Code (verbunden mit **C1**, **C3**, **C5**).
- **Turnstile-Schlüssel** — der Gründer muss ein Widget anlegen; Turnstile kommt heute in **keiner**
  Codezeile vor.
- **Verhalten über der Obergrenze** (PROPOSED) — der erste Goblin-Mechanismus, der einen echten
  Endnutzer abweist statt eines Bauers. Braucht ein Gründer-Ja.
- **Die Zahl 500/Monat** (PROPOSED, nicht entschieden).
- **Wohin Einsendungen gehen, wenn der Besitzer sein Projekt löscht** — dieselbe Kaskadenfrage, für
  die `0099` bereits eine Warnung trägt.
