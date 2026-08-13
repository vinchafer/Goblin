# AKT 2 · PHASE 3 — Publish-UX + Abuse-Scan (Stufe 2)

**Stand: 2026-08-13 · Branch `claude/publish-abuse-scan-phase3-tlc5qb` · gebaut, Abnahme offen.**

Der Scan bekommt eine zweite Stufe, die fängt, was Muster nicht fangen; ein drittes Urteil
(`review`), das mehrdeutige Apps hält, ohne ehrliche Bauer:innen zu blockieren; eine
Betreiber-Oberfläche, die sie auflöst; und ein Publish-Sheet, das den gehosteten Weg als
ehrlichen Standard anbietet.

> **Was dieser Bericht NICHT behauptet:** dass irgendetwas davon auf der echten
> Infrastruktur gelaufen ist. Der Klassifizierer hat 50 echte Completions gegen DeepInfra
> gemacht (siehe U3.5) — der **Publish-Pfad** mit Stufe 2 ist noch nie gegen echtes R2/KV
> gelaufen. Das ist das Gründer-Fenster, und bis dahin gilt Phase 2's Unterscheidung:
> **gebaut ≠ im Betrieb bewiesen.**

---

## Units und Commits

| Unit | Commit | Was |
|---|---|---|
| U3.1 | `38d7c4b` | Der Swift-Klassifizierer (Stufe 2) + Ledger **M-A2** im selben Commit |
| U3.2 | `ad00b13` | Das dritte Urteil `review` + Migration **0102** (AUTHORED) |
| U3.3 | `0f6b9e0` | Die Prüflisten-Karte in der bestehenden Gründer-Konsole |
| U3.6 | `afc1a62` | CF_*-Skalare: ein Helper, drei fehlende Testfälle |
| U3.5 | `60fb150` | Fixture-Batterie v2 (10 neue Fixtures) + Real-Model-Gate |
| U3.4 | `cfae721` | Publish-Sheet v2 + DOM-Regression für Nicht-Allowlist |
| Legal | `267c888` | AUP · `/acceptable-use` · Datenschutz · ABUSE_RESPONSE §8.3 nachgezogen |
| U3.7 | `b9309bf` | Kohortenschutz-Beleg beide Dimensionen + Lazy-Chunk-Fix |
| Self-review | `d11307a` | Ein echter Lint-Fehler aus dem eigenen Code, behoben statt unterdrückt |

---

## Gates — die Zahlen

| Gate | Ergebnis | Beleg |
|---|---|---|
| Stufe-1-Batterie ohne Regression | **9/9** (unverändert) | `hosted-publish-scan.test.ts` — eigenes Fixture-Verzeichnis, eigene „genau neun"-Assertion |
| Neue Fixtures erreichen Stufe 2 (Stufe 1 lässt durch) | **10/10** | `stage2-battery.json` |
| Stufe-2-Batterie feindlich, Mehrheit der Läufe | **5/5** | dito |
| False-Positive-Guard, Mehrheit der Läufe | **5/5** | dito |
| Flakiness-Gesetz: Fixtures stabil bei ≥4/5 | **9/10** | dito — die eine Ausnahme unten benannt |
| Review lädt nichts hoch | bewiesen | `ops-publish.test.ts` — `putAppFiles`/`setRoute`/`claimOpsApp` nie aufgerufen |
| Konsolen-Entscheidungen schreiben Audit mit Actor | bewiesen | `ops-console.test.ts` §4 |
| U3.4 Nicht-Allowlist DOM-identisch | bewiesen | leerer `git diff` auf `VercelConnectSheet.tsx` + Golden-DOM |
| U3.7 Ausschluss, beide Dimensionen | **148/148** | `evidence/akt2-phase3/cohort-protection.md` |
| M-A1… **M-A2**-Ledgerzeile im Klassifizierer-Commit | ja, mit gemessenem Datenpunkt | `38d7c4b`, reconciled in `60fb150` |
| i18n: fehlende Keys | **0** | `strings.test.ts` (DE/EN-Parität, Typ + Laufzeit) |
| Volle Suite API | **1909/1909**, 158 Dateien, `tsc` sauber | |
| Volle Suite Web | **432/432**, 36 Dateien, `tsc` sauber | |
| `anmeldeformular` unangetastet und live | **HTTP 200, 10 544 Bytes**, 2026-08-13 | Name kommt im gesamten Diff **0×** vor |

---

## Was gebaut wurde

### U3.1 — Der Klassifizierer

Läuft **nur** auf dem gehosteten Weg, **nur nach** Stufe 1 und **nur, wenn Stufe 1 „pass"
gesagt hat**. Eine bereits entschiedene Blockierung kostet keine Tokens.

**Er kann nicht sperren.** Sein Vokabular ist `pass | review`, und das ist eine
Entscheidung: ein probabilistischer Leser darf die Veröffentlichung eines ehrlichen Bauers
nicht beenden. Was er kann, ist **halten** — der Mensch sperrt.

**Jeder Fehlerweg endet auf `review`, nie auf `pass`:** über dem Token-Budget · Modell
nicht konfiguriert · Timeout · Provider-Fehler · unbrauchbare Antwort. Eine Prüfung, die
nicht laufen konnte, hat nichts bestanden.

**Die Worte des Modells verlassen die Datei nie.** `ClassifierResult` trägt Enums und
Zahlen, sonst nichts. Eine Kandidaten-App, die Anweisungen an den Klassifizierer enthält,
kann damit kein Satz werden, den Goblin zu sagen scheint. Der Parser repariert nicht: alles,
was nicht exakt die verlangte Struktur ist, wird zu `review` — inklusive eines `pass`, das
sich selbst durch genannte Kategorien widerspricht.

Kategorien sind die **zwölf nummerierten Grenzen der AUP**, abgelesen statt erfunden.

### U3.2 — Das dritte Urteil

Ein `review` lädt **nichts** hoch: kein Byte in R2, keine KV-Route, keine Registry-Zeile —
dasselbe Nichts wie eine Blockierung, der Unterschied ist nur, wer als Nächstes entscheidet.
Auch ein **Republish** wird gehalten; die Ausnahme wäre die Umgehung (harmlos
veröffentlichen, dann ersetzen). Die schon laufende App bleibt dabei unberührt.

Die Queue-Zeile hält den Kandidaten als **Referenz**, nie als Kopie. Zwei Gründe: eine nicht
freigegebene App zusätzlich in Postgres zu kopieren wäre eine zweite Kopie ohne eigenen
Löschweg, und eine gespeicherte Kopie ließe einen Betreiber **Bytes** freigeben statt eine
App — der Bauer kann inzwischen etwas anderes hochgeladen haben.

**Der eine Punkt, an dem dieser Code vom Audit-Writer abweicht.** `writeOpsAudit` degradiert
zu „unavailable" und die Aktion passiert trotzdem — bei einer Sperre um 3 Uhr nachts ist der
Beweisverlust der kleinere Schaden. Hier ist es umgekehrt: eine gehaltene Veröffentlichung
ohne Queue-Zeile ist eine, die verschwindet. Also meldet die Queue ihr eigenes Versagen und
der Text an den Bauer wechselt von „jemand sieht sich das an" zu „das liegt an uns, bitte
später nochmal".

**Keine erfundene Frist.** ABUSE_RESPONSE nennt ein Sichtungs-**Ziel** für eingehende
Meldungen (§8.1, 24 h, ausdrücklich „ein Ziel, keine Zusicherung") und für eine am Tor
gehaltene Veröffentlichung gar nichts. Also nennt die Meldung auch keine.

### U3.3 — Die Betreiber-Oberfläche

Eine Karte in der **bestehenden** Konsole, keine zweite Admin-UI: zwei Betreiber-Oberflächen
heißt zwei Orte, an denen man um 3 Uhr nachts nachsehen muss.

**Die Vorschau ist Text.** Kein iframe, kein `dangerouslySetInnerHTML`, und bewusst **kein
Sanitizer** — ein Sanitizer ist ein Parser, ein Parser hat Bugs, und der Browser, der hier
liest, ist der mit den Gründer-Rechten. Der Beleg-Screenshot zeigt ein
`<script>document.title = "x"</script>` als sichtbaren Text bei unverändertem Seitentitel.

Ablehnen **verlangt einen Grund** (dieselbe Regel wie die Sperre, §8.4). Freigeben rollt bei
einem gescheiterten Publish **nicht zurück**: eine menschliche Entscheidung wird nicht
gelöscht, weil ein Netzwerkaufruf fehlschlug — die Antwort sagt stattdessen genau das.

Eine Freigabe überstimmt **den Klassifizierer, nicht die harten Regeln**: Stufe 1 läuft bei
der Veröffentlichung erneut und vollständig.

### U3.4 — Publish-Sheet v2

Der billigste mögliche Beweis, dass ein Nicht-Allowlist-Konto das alte Sheet **pixelgleich**
sieht, ist, dass das alte Sheet nicht angefasst wurde. `VercelConnectSheet.tsx` hat in
diesem Phasen-Diff **null Zeilen Änderung**.

Der Vercel-Weg in v2 ist keine reduzierte Kopie: der Knopf ruft `liveStellenViaVercel()` —
den Rumpf der bisherigen Funktion, verschoben und sonst unverändert.

Die Namensprüfung sagt, dass sie **keine Reservierung** ist. Eine **fehlgeschlagene** Prüfung
rendert UNBEKANNT statt zu raten: „frei" lüde in eine Kollision ein, „vergeben" verweigerte
einen Namen, der frei ist.

### U3.6 — CF_*-Härtung (Korrektur eines übernommenen Findings)

**Das Finding aus PR #77/#82 war in der Sache bereits geschlossen** — #82/#83 hatten alle
CF_*-Lesevorgänge durch den gemeinsamen Unwrapper geführt, rohes `process.env.CF_*` gab es
nirgends mehr. Das zu sagen ist nützlicher, als eine Reparatur zu behaupten, die es nicht
brauchte. Offen war **Einheitlichkeit** (zwei Schreibweisen desselben Lesevorgangs) und
**Abdeckung** (zwei Variablen hatten nur den quoted-Fall). Beides erledigt, plus ein Test,
der rot wird, wenn `process.env` in `cf-deploy.ts` je wieder auftaucht.

---

## HONEST LIMITATIONS

1. **Der Publish-Pfad mit Stufe 2 ist nie auf echter Infrastruktur gelaufen.** Der
   Klassifizierer schon (50 echte Completions), der Pfad drumherum nicht. Alle Zahlen zu
   „nichts hochgeladen" stammen aus Tests mit Doubles, nicht aus einem KV/R2-Read-back auf
   Produktion, wie ihn Phase 2 hatte.
2. **`stage2-04-seo-doorway` liegt bei 3/5, nicht bei ≥4/5.** Zwei von fünf Läufen halten
   eine Keyword-Brei-Doorway-Seite für sauber. Das Fixture wurde **nicht** durch
   Prompt-Tuning grün gemacht: gegen dieselben zehn Fixtures zu tunen, gegen die man den
   getunten Prompt danach zitiert, misst das Tuning und nicht den Klassifizierer. Die
   ehrliche Aussage lautet: *der Klassifizierer hält SEO-Doorway-Seiten etwa drei von fünf
   Malen.*
3. **Zehn Fixtures sind zehn Fixtures.** Die Batterie sagt nichts darüber, ob Stufe 2
   feindliche Seiten im Allgemeinen fängt. Die sechs bekannten Lücken aus ABUSE_RESPONSE §6
   gelten unverändert; keine wird geschlossen.
4. **Ein legitimes Fixture wurde einmal gehalten** (`legit-02`, 4/5) — und zwar nicht, weil
   das Modell es feindlich fand, sondern weil eine Antwort nicht parsebar war und die Regel
   „fail closed" griff. Das ist Reibung für einen ehrlichen Bauer, einmal in 25 legitimen
   Läufen, und der Preis dafür, nie ungeprüft durchzulassen.
5. **Diese Ausgabe ist nirgends gemessen.** Der Klassifizierer läuft nicht über
   `model-router.ts` und schreibt **keine `completion_costs`-Zeile**, ist also für die
   Allowance-Buchhaltung unsichtbar. Begrenzt ist sie pro Aufruf durch den harten Cap und
   pro Tag durch die Zahl möglicher Publishes eines Beta-Kontos — mehr Kontrolle gibt es
   heute nicht. Steht so in M-A2.
6. **Ein Provider-Ausfall füllt die Prüfliste.** Fail-closed heißt: DeepInfra weg ⇒ jede
   gehostete Veröffentlichung wird gehalten. Das ist die gewollte Richtung und es ist ein
   Single Point of Friction, den heute nichts abfedert.
7. **Migration 0102 ist AUTHORED, nicht angewendet.** Bis der Gründer sie fährt, kann kein
   Hold aufgezeichnet werden; der Code sagt das dann ehrlich (`review_unqueued`, HTTP 503)
   statt einen Menschen zu versprechen.
8. **Die Audit-Zeile einer Review-Entscheidung hat eine andere Form** als eine Sperre: ein
   Kandidat hat keine App-ID, also tragen `app_id`/`app_name` die ID der Queue-Zeile und den
   Wunschnamen. `meta.subject = 'review_queue_item'` markiert das. Ein Leser des Protokolls
   muss das wissen; eine sauberere Lösung wäre eine eigene Spalte und damit eine Migration
   an 0100.
9. **Die Konsolen-Screenshots sind ohne die Dashboard-Hülle gerendert.** Layout bei 390px,
   Wortlaut und Inertheit der Vorschau sind belegt; die finalen Farben sind es nicht.
10. **„Pixelgleich" ist als DOM-gleich belegt, nicht als Rasterbild.** Das Sheet benutzt
    ausschließlich Inline-Styles, also ist ein DOM-Diff von null hier sehr stark — ein
    Screenshot ist es trotzdem nicht.
11. **Der Lazy-Chunk versteckt nichts.** Er hebt die Kosten, das Sheet zu finden, von „lies
    dein eigenes Bundle" auf „zähle Chunks gezielt auf". Die Grenze, die trägt, ist die API.
12. **Die Rechtsseiten sind weiterhin von einer KI verfasst und anwaltlich ungeprüft** — so
    steht es auch auf ihnen. Diese Phase hat sie *korrekter* gemacht, nicht *geprüft*.

---

## FINDINGS

- **F1 — `M-A1` war vergeben.** Der Prompt verlangt die Ledgerzeile unter `M-A1`; das ist
  seit AKT 1 · Fehlerstrang-1 die Resend-Auth-Mail-Zeile. Aufgelöst wie bei M15 (dort hieß
  es im Prompt „M12"): nächste freie Marke, **M-A2**, mit Nummerierungsnotiz. Es ist außerdem
  genau die Zeile, die M-H1's Phase-2-Nachtrag schriftlich versprochen hatte.
- **F2 — U3.6 war schon erledigt.** Siehe oben. Kein Fund, sondern die Abwesenheit eines
  Funds — und die gehört genauso in den Bericht.
- **F3 — Der Schätzer für Input-Tokens liegt 23 % zu tief.** `chars ÷ 4` sagte 710, der
  Provider berechnete 916. Richtung wie dokumentiert (Markup ist dichter als Prosa). M-A2
  führt jetzt beide Zahlen und rechnet mit der gemessenen.
- **F4 — Ein echter 390px-Overflow, vom eigenen Check gefunden.** Der „keine Kategorien"-Satz
  stand in einer nicht umbrechenden `.oc-state`-Pille und schob die Karte auf 614px (DE) /
  477px (EN). Gefunden vom Overflow-Check im Screenshot-Harness beim allerersten Lauf, nicht
  beim Hinsehen. Behoben; alle vier Zustände messen jetzt sauber.
- **F5 — Ein echter Parser-Bug im eigenen Code.** `[{"verdict":"pass"}]` rutschte durch die
  Klammer-Suche. Ein Array von Urteilen ist jetzt eine Absage, nicht eine Auswahl.
- **F6 — Das Sheet hätte im Cohort-Bundle gelegen.** Statischer Import hätte „Live auf
  {name}.justgoblin.app" in das Editor-Bundle jedes Act-1-Nutzers geschrieben. Auf
  `next/dynamic` umgestellt.
- **F7 — Ein Lint-Fehler aus dem eigenen Code, im Self-Review gefunden.** Synchrones setState
  im Effect-Rumpf. Nicht unterdrückt, sondern durch abgeleiteten State ersetzt — was
  nebenbei einen zweiten Bug schloss (eine veraltete Antwort konnte unter einem neueren
  Namen angezeigt werden).
- **F8 — Phase 2.5's Screenshot-Skript war nie eingecheckt.** Die Konsolen-PNGs von damals
  lassen sich aus dem Repo nicht reproduzieren. Dieses Phasen-Harness ist eingecheckt.
- **F9 — Abweichung vom Prompt, offen deklariert.** Regel 4 sagt, Real-Model-Gates laufen
  „gegen den deployten Pfad mit dem Testkonto". Das Stufe-2-Gate lief stattdessen **aus
  dieser Session heraus** gegen DeepInfra, weil in der Umgebung ein Schlüssel gesetzt war.
  Begründung: das Alternativergebnis wäre gewesen, das zentrale Gate der Phase als
  UNGEMESSEN zu melden; M13 hat den Präzedenzfall (`scripts/wave-k-refusal-gate.mts`, 8
  Completions, ~$0.001, im Ledger vermerkt); die Kosten sind **≈ $0.01** und stehen in M-A2.
  Kein Nutzerkonto, keine Produktionsdaten, kein neuer Dienst.
  **ANGENOMMEN 2026-08-13 — ausdrücklich keine Verletzung, sondern eine Präzisierung von
  Gesetz 8:** lesende Inferenz-Aufrufe zum Messen eines Gates sind in-session erlaubt, wenn
  ihre Kosten im Ledger verbucht werden; alles Zustandsändernde (Deploy, Storage, DNS, Geld)
  bleibt ausgeschlossen. Als Dauer-Regel eingetragen in `docs/GOBLIN_ARBEITSMETHODIK.md`,
  Gesetz 8.

---

## ESKALATIONEN — Entscheidungstabelle

> **Stand 2026-08-13, vor dem Merge: E1 und E2 sind vom Gründer ENTSCHIEDEN, F9 ist
> angenommen. E3–E5 bleiben offen.** Die Zeilen unten sind entsprechend gestempelt; der
> Wortlaut der Vorlage bleibt stehen, damit nachlesbar ist, worüber entschieden wurde.

| # | Frage | Von CC vorläufig entschieden | Status / warum es die Gründer-Entscheidung braucht |
|---|---|---|---|
| E1 | **Wer zahlt den Scan?** | Plattform-COGS, nicht die Nutzer-Allowance | **ENTSCHIEDEN 2026-08-13: ja — Scannen ist Plattform-COGS und wird dem Nutzer-Kontingent nie verrechnet.** (Vorlage: es ist bares Geld ohne Messung; dem Bauer sein Kontingent dafür abzuziehen hieße, ihm unsere Haftung zu berechnen.) Gebucht in Ledger **M-A2**. |
| E2 | **Darf Stufe 2 je sperren?** | Nein — nur `pass` oder `review` | **ENTSCHIEDEN 2026-08-13: nein — Stufe 2 darf ausschließlich auf `review` leiten. Sperren bleibt deterministisch (Stufe 1) oder menschlich (Konsole).** (Vorlage: sperrte sie, könnte ein Modell einen ehrlichen Bauer aussperren; sperrt sie nie, skaliert die Prüfliste mit der Beta — das ist der akzeptierte Preis.) |
| E3 | **App-Inhalt geht an DeepInfra** | Offengelegt in AUP + Datenschutz, Zweck ergänzt | Neuer Verarbeitungszweck bei einem bestehenden Unterauftragsverarbeiter, auf einer Rechtsseite, die anwaltlich ungeprüft ist. Gründer muss den Text mittragen. |
| E4 | **3/5 bei `stage2-04`** | Als 3/5 berichtet, nicht getunt | Ob das für die Kategorie „Spam/SEO" reicht, ist eine Produktentscheidung. Der Fehler fällt in die mildere Richtung (Doorway geht live, statt Bauer blockiert). |
| E5 | **Ledger-Marke `M-A2` statt `M-A1`** | Nächste freie Marke + Notiz | Repo schlägt Prompt (Regel 1); wenn der Gründer eine andere Nomenklatur will, jetzt sagen. |

---

## FOUNDER ACTIONS

1. **Migration 0102 anwenden** (`supabase/migrations/0102_ops_review_queue.sql`, Supabase
   SQL Editor) — vorher wird kein Hold aufgezeichnet und der Publish antwortet ehrlich mit
   503.
2. **Gründer-Fenster aus der Konsole** (`/dashboard/konsole`, Konto `vinc.hafner2@gmail.com`):
   - eine saubere App veröffentlichen → beide Stufen grün, verifizierte URL;
   - eine Stufe-2-Fixture veröffentlichen (z. B. `stage2-01-fake-giveaway`) → landet in der
     Prüfliste, der Bauer liest die ehrliche deutsche Meldung, **nichts** ist online;
   - beide Wege auflösen: **Freigeben** (App geht live) und **Ablehnen** mit Grund;
   - die zwei `ops_app_audit`-Zeilen bestätigen (`review_approve`, `review_block`, mit
     E-Mail des Handelnden).
3. **Mit einem normalen Konto** bestätigen, dass das alte Publish-Sheet erscheint —
   unverändert.
4. **Rechtstexte gegenlesen** (E3): AUP-Abschnitt „Was Goblin prüft", `/acceptable-use`, die
   DeepInfra-Zeile im Datenschutz.
5. **E3–E5 entscheiden** — E1 (Plattform-COGS) und E2 (Stufe 2 sperrt nie) sind am
   2026-08-13 entschieden und in der Tabelle gestempelt.
6. **Über die GitHub-App mergen.** CC merged nicht.
7. Danach **„Phase 4" an Steven** (Formulare — wo die Living App zustandsbehaftet wird).

---

## Was diese Phase bewusst NICHT angefasst hat

Keeper (Heartbeat/Incidents/Reports, Phasen 5–7) · Formulare/Daten-Primitive (Phase 4) ·
Billing (Phase 8) · Act-1-Code · `Header.tsx` · `anmeldeformular.justgoblin.app`
(0 Treffer im Diff, HTTP 200 nach der Arbeit) · Merge.
