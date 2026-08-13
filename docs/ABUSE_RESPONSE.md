# Missbrauchs-Runbook (ABUSE_RESPONSE) — für den Gründer

**Stand: 2026-08-12 · Wave-K, Layer 5 (die menschliche Schicht) · erweitert um Abschnitt 8
(von Goblin gehostete Apps, AKT 2 · Pre-Phase-2) · Abschnitt 8.3 am 2026-08-12 auf den
U2.8-Lauf umgestellt: die vier Phase-2-Anforderungen sind nicht mehr nur gebaut, sondern auf
der echten Infrastruktur bewiesen, und die geschätzte Sperr-Zeit ist durch einen Messwert
ersetzt (`evidence/akt2-phase2/`).**

Dieses Runbook ist der Handlungs-Leitfaden, wenn ein Missbrauchs-Verdacht auftaucht.
Es setzt die fünf Schutzschichten voraus (K1 Nutzungsrichtlinie · K2 Generierungs-Refusal ·
K3 Publish-Scan · K4 Verhaltens-Signale · K5 dieses Runbook). Die ersten vier verringern
Risiko technisch; diese Schicht ist der Mensch, der entscheidet — denn
**Konto-Aktionen sind Gründer-Entscheidungen, nie automatisch** (OS-Eskalationstabelle:
Nutzerdaten / irreversibel).

## Zwei Wege — und nur auf einem ist Goblin der Hoster

> **Geändert 2026-07-28 (AKT 2 · Pre-Phase-2).** Hier stand: „Goblin hostet Nutzer-Inhalte
> nie öffentlich." Das gilt ab Phase 2 nicht mehr. Siehe `docs/HOSTING_CLAIMS_AUDIT.md`.

**Weg A — eigenes Vercel-Konto des Nutzers (Standard, alle Konten).**
Missbrauchsfläche: (a) was der Agent baut (K2), (b) was die Publish-Pipeline ausliefert
(K3), (c) Plattform-Ressourcen (Wave-D). Die Hosting-Ebene gehört dem Nutzer und Vercel.
Ein Inhalt, der erst NACH dem Publish auf dem Vercel des Nutzers erscheint, ist primär
Vercels Meldeweg (Abschnitt 4). **Goblin kann dort nichts abschalten.**

**Weg B — von Goblin gehostet auf `{name}.justgoblin.app` (Phase 2, Beta, Allowlist).**
Hier ist **Goblin der Hoster**: die Dateien liegen in Goblins R2, die Route in Goblins KV,
ausgeliefert unter Goblins Domain. Goblin **kann und muss** hier selbst abschalten. Der
Meldeweg ist Goblins eigener (Abschnitt 8), nicht Vercels. Der Projektspeicher (B2) ist
auf beiden Wegen privat.

**Die eine Zeile, ehrlich:** Goblin kann von ihm gehostete Inhalte jederzeit abschalten und
entfernen, prüft aber nicht jede App und findet Missbrauch überwiegend erst durch Meldungen
oder den deterministischen Publish-Scan — nicht durch Überwachung.

---

## 1. Intake — woher ein Fall kommt

| Quelle | Wo sichtbar | Typischer Auslöser |
|---|---|---|
| **Feedback / Appeal** | `feedback`-Tabelle, `surface = 'publish_block'` | Nutzer meldet Fehl-Blockierung ODER Dritte melden Missbrauch |
| **Externe Meldung** | E-Mail an Support (Wave-J), Missbrauchs-Mail | Opfer/Provider meldet eine Phishing-/Betrugs-Seite |
| **K4-Signal** | Admin-Dashboard → „Sicherheit · Missbrauchs-Signale" | `publish_velocity` · `content_fanout` · `repeated_policy_blocks` |
| **K3-Block** | `platform_events`, `event_type = 'publish_blocked'` | Deterministischer Scan hat einen Publish gestoppt |

**Ein K4-Signal ist ein Hinweis, kein Urteil.** Es sagt „schau hin", nicht „sperre".

---

## 2. Assess — gegen die Nutzungsrichtlinie prüfen

1. Öffne `docs/ACCEPTABLE_USE_POLICY.md` — welche konkrete Grenze ist berührt?
2. Sieh dir den echten Projektinhalt an (Admin/Storage), nicht nur das Signal.
3. Ordne ein:
   - **Klarer Missbrauch** (Phishing-Klon einer fremden Marke, Miner, Kartendaten-Sammler,
     illegaler Inhalt) → Aktion (Abschnitt 3).
   - **Graubereich** (könnte legitim sein — eigener Login, Sicherheits-Lernprojekt) →
     zuerst Nutzer kontaktieren, fragen, Kontext einholen. **False Positives sind unsere
     eigene Ehrlichkeits-Niederlage** — ein zu Unrecht gesperrter zahlender Bauer ist
     schlimmer als ein durchgerutschtes Graubereich-Projekt.
   - **Fehl-Blockierung** (K3 hat legitime App gestoppt) → entsperren + Regel justieren
     (`scan-rules.ts`), Fixture ergänzen.

---

## 3. Actions ladder — von mild nach hart (immer die mildeste ausreichende Stufe)

1. **Nutzer kontaktieren.** Ehrliche Nachricht (Vorlage unten), Frist zur Klärung/Behebung.
2. **Publish-Sperre für die Zukunft.** Projekt bleibt, aber weitere Veröffentlichungen
   werden blockiert (K3-Regel gezielt / Projekt-Flag). Reversibel.
3. **Projekt-Sperre.** Projekt sperren (kein Zugriff/Publish). Beweise vorher sichern.
4. **Konto-Kündigung.** Bei schwerem/wiederholtem Verstoß, gemäß AUP. **Irreversibel für
   den Nutzer → bewusste Gründer-Entscheidung, Beweise gesichert, Begründung dokumentiert.**
5. **Meldung an Vercel** (wenn die Seite bereits auf dem Vercel des Nutzers live ist —
   siehe Abschnitt 4). Vercel kann das Hosting stoppen; das ist ihr Meldeweg, nicht unserer.
6. **Behörden** (nur bei illegalen Inhalten, insb. Minderjährigenschutz) — nach
   Rechtsberatung; nicht im Alleingang.

**Beweise sichern (immer VOR einer irreversiblen Stufe):** Storage-Snapshot des Projekts,
die relevanten `platform_events` (publish_blocked / abuse_signal), die betroffene URL,
Zeitstempel. Ablegen außerhalb des Nutzer-Projekts.

---

## 4. Vercel-Missbrauchsmeldung (verifizierter Weg)

**Verifiziert am 2026-07-11:**
- **Missbrauchs-Formular:** <https://vercel.com/abuse> — Kategorien u. a.
  **„Phishing or Malware"**, „Copyright Infringement / DMCA", „Trademark Violations", „Other".
- **DMCA-spezifisch:** `dmca@vercel.com` · Vercel Inc., Attn: DMCA, 440 N Barranca Ave
  #4133, Covina, CA 91723.

> ⚠️ Vercel ändert Wege gelegentlich. Vor einer Meldung kurz gegenprüfen, ob
> <https://vercel.com/abuse> noch aktuell ist, und das Datum hier aktualisieren.

Da generierte Apps auf dem **eigenen** Vercel-Konto des Nutzers liegen, ist Vercel der
richtige Adressat, um eine bereits live gestellte Missbrauchs-Seite herunterzunehmen —
Goblin kann den Nutzer sperren, aber nicht dessen Vercel-Deployment löschen.

---

## 5. Vorlagen

### 5a. Nutzer-Hinweis (DE)
> Betreff: Deine Goblin-Veröffentlichung — kurze Rückfrage
>
> Hallo,
> wir haben in deinem Projekt „{Projekt}" etwas gefunden, das unsere Nutzungsrichtlinie
> berührt: {konkrete Grenze, z. B. „eine Login-Seite, die eine fremde Marke nachbaut"}.
> Falls das ein Missverständnis ist, antworte kurz mit dem Kontext — wir schauen es uns an.
> Falls nicht: Bitte passe es bis {Datum} an. Was erlaubt ist und was nicht, steht hier:
> {URL /acceptable-use}.
> Viele Grüße, das Goblin-Team

### 5b. User notice (EN)
> Subject: Your Goblin publish — a quick question
>
> Hi,
> we found something in your project "{project}" that touches our Acceptable-Use Policy:
> {specific limit}. If this is a misunderstanding, just reply with the context and we'll
> take a look. If not, please adjust it by {date}. What's allowed and what isn't:
> {URL /acceptable-use}.
> Best, the Goblin team

### 5c. Vercel-Meldung (EN, via vercel.com/abuse → „Phishing or Malware")
> Reporting a site hosted on Vercel that violates your Acceptable-Use Policy.
> URL: {url}
> Type: {Phishing / Malware / Fraud}
> Evidence: {short description — e.g. "clones the PayPal login and posts captured
> credentials to an external endpoint"}. Screenshots/HTML attached.
> Reporter: Goblin (the app was generated on our platform and deployed to the user's own
> Vercel account; we have terminated the user's Goblin account and are reporting the live
> deployment for takedown).

---

## 6. Residual-Risk-Register — was diese fünf Schichten NICHT fangen

Ehrlichkeit ist hier der Punkt: „null" existiert nicht. Was bleibt:

1. **Neuartige Social-Engineering-Muster.** K2/K3 kennen die heutigen Klassen. Eine clevere
   Betrugsmasche ohne Marken-Token, ohne Credential-Feld, ohne Miner-Signatur baut der
   Agent evtl. und der Scan lässt sie durch. → Fängt K5 (Meldung) reaktiv.
2. **Inhalte, die erst NACH dem Publish auf dem Vercel des Nutzers erscheinen.** K3 scannt
   die ausgelieferten Dateien — nicht, was der Nutzer danach dort manuell ändert oder per
   API nachlädt. → Vercels Trust&Safety + Meldeweg (Abschnitt 4).
3. **Entschlossene Angreifer.** Wer die Regeln kennt, kann Formulierungen so wählen, dass
   K2 nicht refused und K3 nicht matcht (z. B. Marke nur als Bild, Exfil über verschleierte
   Requests). Deterministische Heuristiken sind umgehbar; das ist ihre Natur.
4. **Obfuskation per Design.** K3 blockt Obfuskation allein NICHT (Option A, bewusst) —
   ein Miner in stark verschleiertem, signaturfreiem Code kann durchrutschen. K4 (Velocity/
   Fan-out) fängt das evtl. im Muster, nicht am Einzelfall.
5. **False Negatives der Marken-Heuristik.** Nur Marken in `BRAND_TOKENS` und nur in
   Titel/Überschrift werden erkannt. Eine unbekannte Marke oder ein Marken-Token nur im
   Body wird nicht als HIGH geblockt (bewusst, gegen False Positives).
6. **Signale ohne Handlung.** K4 informiert nur. Wenn niemand ins Dashboard schaut,
   passiert nichts. Diese Schicht braucht einen Menschen mit einer Routine.

**Gegenmaßnahme für alle sechs:** dieses Runbook + regelmäßiger Blick ins
Admin-Dashboard („Sicherheit"-Karte) + zügige Reaktion auf Feedback/Meldungen. Und:
`scan-rules.ts` wächst mit jedem echten Fall (neue Regel + Fixture).

---

## 7. Gründer-Aufgaben (offen)

- **Juristische Prüfung** der Nutzungsrichtlinie + AGB vor Skalierung (AUP ist KI-verfasst,
  nicht anwaltlich geprüft).
- **Vercel-Meldeweg** halbjährlich gegenprüfen und das Datum in Abschnitt 4 aktualisieren.
- **Regel-Pflege:** jeden echten Missbrauchsfall in `scan-rules.ts` als neue Regel + Fixture
  gießen (der Scan wird nur durch echte Fälle klüger).

**Neu aus AKT 2 · Pre-Phase-2 (Abschnitt 8):**

- ~~**Missbrauchs-Adresse festlegen.**~~ **ERLEDIGT (Gründer-Entscheid 2026-07-28):**
  `support@justgoblin.com` — eine Mailbox, die bereits existiert und überwacht wird. Damit
  wurde bewusst *keine* neue `abuse@`-Adresse erfunden: eine Rechtsseite, die auf eine
  ungelesene Mailbox zeigt, wäre eine Lüge. Alle Vorkommen auf den Rechtsseiten, im
  Runbook und in der Richtlinie zeigen jetzt auf diese Adresse.
- ~~**Karenzfrist 30 Tage**~~ **BESTÄTIGT (Gründer-Entscheid 2026-07-28):** 30 Tage, wie in
  AGB Abschnitt 7 formuliert.
- ~~**Aufbewahrungsfrist für Beweise (12 Monate, 8.7)**~~ **BESTÄTIGT (Gründer-Entscheid
  2026-07-28):** 12 Monate, CSAM ausgenommen (dort gilt das Verfahren der Behörden).
- ~~**Vier Phase-2-Anforderungen aus 8.3 abnehmen**~~ **IM CODE ERLEDIGT (AKT 2 · Phase 2,
  2026-07-28) — Abnahme steht aus.** Alle vier sind gebaut und getestet (Details in 8.3).
  Was noch fehlt, ist der Beweis auf der echten Infrastruktur: **das U2.8-Fenster fahren**
  (`docs/AKT2_PHASE2_FOUNDER_WINDOW.md`) und Migration **0100** anwenden (**0099** ist seit
  PR #57 angewendet).
  Vorher darf keine fremde App live gehen — gebaut ist nicht bewiesen.

---

## 8. Von Goblin gehostete Apps (Weg B) — der Hoster-Meldeweg

Gilt für alles unter `*.justgoblin.app`. Auf diesem Weg gibt es keinen dritten Anbieter,
an den weitergereicht werden kann.

### 8.1 Intake

| Quelle | Wo | Hinweis |
|---|---|---|
| **`support@justgoblin.com`** | Mailbox (bestehend, überwacht) | Der öffentliche Meldeweg. Steht auf `/acceptable-use` und in den AGB (Abschnitt 8). Bewusst die **bestehende** Support-Mailbox statt einer neuen `abuse@`-Adresse — eine Adresse, die niemand liest, wäre eine Lüge auf einer Rechtsseite. Missbrauchsmeldungen laufen also im Support-Posteingang auf und müssen dort als solche erkannt werden. |
| Urheberrechtsbeschwerde | dieselbe Mailbox | Verfahren in 8.6 |
| K3-Publish-Block | `platform_events`, `event_type = 'publish_blocked'` | präventiv, vor dem Livegang |
| K4-Signal | Admin-Dashboard → „Sicherheit" | Muster, kein Urteil |

**Ziel: glaubwürdige Meldungen innerhalb von 24 Stunden sichten.** Das ist ein **Ziel, keine
Zusicherung** — so steht es auch öffentlich. Goblin wird von einer Einzelperson betrieben;
Urlaub, Krankheit und Zeitzonen existieren. Niemals als SLA formulieren.

### 8.2 Triage — Schweregrade

| Klasse | Beispiele | Handlung |
|---|---|---|
| **S0 — sofort** | CSAM · aktives Phishing mit echtem Credential-Abfluss · Malware-Auslieferung | **Zuerst abschalten, dann prüfen.** Keine Vorankündigung. Beweise sichern. Bei CSAM: Konto-Kündigung + Behördenmeldung, keine Ermessensfrage. |
| **S1 — dringend** | Krypto-Drainer · Marken-Imitation · Kartendaten-Formulare · Ressourcen-Missbrauch mit laufenden Kosten | Abschalten oder sperren, Nutzer gleichzeitig benachrichtigen. |
| **S2 — normal** | Spam/SEO-Linkfarm · Urheberrechtsbeschwerde · Grenzfall-Täuschung | Nutzer zuerst kontaktieren, Frist zur Behebung setzen, dann sperren. |
| **S3 — unklar** | Meldung ohne Beleg · Konkurrenz-/Beschwerdemotiv erkennbar | Selbst ansehen. Nicht auf Zuruf sperren. |

Die Regel aus Abschnitt 2 gilt unverändert: **False Positives sind unsere eigene
Ehrlichkeits-Niederlage.** S2/S3 zuerst mit dem Menschen klären.

### 8.3 Der Sperr-Mechanismus — was heute existiert und was nicht

**Existiert nach Phase 1 (verifiziert am 2026-07-28):**

| Hebel | Wo | Wirkung |
|---|---|---|
| `OPS_HOSTING_ENABLED=false` | Env, API | **Globaler Kill-Switch.** Legt die gesamte Ops-Ebene still (`apps/api/src/services/ops-beta.ts:45`, `ops-gate.ts:53`). Alles-oder-nichts — kein Instrument gegen eine einzelne App. |
| `OPS_BETA_ACCOUNTS` | Env, API | Allowlist. Entfernen eines Kontos nimmt ihm den Zugang zur Ops-Ebene (`isOpsBetaAccount`). |
| `ops_apps.status = 'suspended'` | DB (Migration 0099) | Der vorgesehene Not-Aus pro App. Ein `UPDATE`, sofort umkehrbar — das Gegenteil vom Löschen. |
| `deleteAppFiles(appId)` / `deleteRoute(name)` | `apps/api/src/services/cf-deploy.ts:552` / `:752` | Harte Entfernung: R2-Prefix bzw. KV-Route. **Nicht umkehrbar.** Erst nach Beweissicherung. |

**Die vier Phase-2-Anforderungen — Stand nach dem U2.8-Fenster (2026-08-12):**

> **Alle vier: IM BETRIEB BEWIESEN — nicht mehr nur gebaut.** Hier stand bis zum 2026-08-12
> „im Code erledigt, im Betrieb noch unbelegt": alle vier waren gebaut und durch Tests
> abgedeckt, der Beweis auf der echten Infrastruktur stand aus. Er ist erbracht. Der Gründer
> hat das U2.8-Fenster am **2026-08-12** aus der Gründer-Konsole gefahren, gegen die **echte
> Cloudflare-Infrastruktur** (echtes R2, echtes KV, der Router-Worker auf `justgoblin.app`,
> die echte `ops_apps`-Registry): **19/19 Schritte grün · Veröffentlichungen 5/5 ·
> Scan-Batterie 9/9 · Sperr-Runde 3/3 · Laufzeit 13 033 ms.** Beweis:
> `evidence/akt2-phase2/e2e-founder-window-2026-08-12.json` — der eingecheckte Bericht des
> Laufs selbst, aus dem jede Zahl in diesem Absatz gelesen ist; Index dazu:
> `evidence/akt2-phase2/README.md`.
>
> **Und die Grenze dieses Satzes, im selben Atemzug:** bewiesen heißt hier *einmal
> beobachtet*, am 2026-08-12, von einem Ort aus. Die **Zählungen** sind Gates und sie sind
> erfüllt. Die **Zeiten** aus diesem Lauf sind Messwerte, keine Zusicherungen — das gilt
> besonders für die Sperr-Zeit in Punkt 1.

1. ~~Der Router respektiert `status = 'suspended'` noch nicht~~ **GEBAUT (U2.1) · IM BETRIEB
   BEWIESEN (U2.8, 2026-08-12).** Es gibt
   jetzt einen Router Worker (`apps/api/src/services/ops-router/worker.js`). Er liest
   `route:{name}` aus KV und weist eine gesperrte App mit einer **gestalteten deutschen
   Seite** ab (403, „Diese App wurde vorübergehend gesperrt.", Link auf die
   Nutzungsrichtlinie). Der Not-Aus braucht **keine Datenbank**: der Router fragt die API
   nie etwas, also wirkt die Sperre auch dann, wenn die API steht.
   **Wie schnell eine Sperre öffentlich sichtbar wurde — gemessen, nicht geschätzt:** hier
   stand eine Schätzung („greift innerhalb einer Minute, nicht in derselben Sekunde"),
   abgeleitet aus dem 60-Sekunden-Cache, den KV-Lesevorgänge pro Standort haben. Der
   U2.8-Lauf hat es stattdessen gemessen. **Messwert vom 2026-08-12: die Sperre war nach
   1 Sekunde öffentlich sichtbar** (Messung der Konsole); der Lauf selbst schreibt
   `propagationSec: 0` ins Ergebnis, weil er in ganzen Sekunden zählt und die erste
   Abfrage bereits die gesperrte Seite bekam. Die Schätzung war also zu pessimistisch.
   **Was dieser Messwert ist und was nicht:** er ist **eine Beobachtung aus einem einzigen
   Lauf**, von einem Standort aus, am 2026-08-12 — **keine Zusicherung**. Niemandem darf
   „innerhalb einer Sekunde" versprochen werden, weder einem Melder, noch einem Opfer, noch
   in einer Rechtsseite. Der Mechanismus gibt das nicht her: der 60-Sekunden-KV-Cache
   existiert unverändert, und ein anderer Cloudflare-Standort, der die alte Route frisch
   gecacht hat, kann sie bis zu einer Minute weiter ausliefern. **Die belastbare Aussage
   bleibt: innerhalb einer Minute — und einmal gemessen waren es 1 Sekunde.**
   *(Gründer-Entscheid 2026-08-12: die Minute bleibt stehen. Der Messwert von 1 Sekunde hebt
   den 60-Sekunden-Cache des Mechanismus nicht auf; das Runbook nennt den schlechtesten Fall
   und den Messwert daneben, nicht den Messwert statt des schlechtesten Falls.)*
   Jeder weitere Lauf schreibt seine eigene Zeit als `propagationSec` ins Ergebnis; wer die
   Zahl hier ändert, ersetzt sie durch einen neuen Messwert, nicht durch eine bessere
   Schätzung. Im Lauf vom 2026-08-12 waren **alle sechs** gemessenen Propagationszeiten `0`
   (`public:serves`, `rename:old-410`, `rename:new-200`, `suspend:page-live`,
   `unsuspend:restored`, `teardown:404`) — sechs Nullen von **einem** Standort aus, was über
   einen anderen Standort mit frisch gecachter alter Route weiterhin nichts aussagt.
2. ~~Es gibt keinen Schreibpfad für die Suspendierung~~ **GEBAUT (U2.5) · IM BETRIEB BEWIESEN
   (U2.8, 2026-08-12 — Sperr-Runde 3/3 über die echten Endpunkte).** Kein Hand-`UPDATE`
   mehr im SQL-Editor. Stattdessen:
   `POST /api/admin/ops/apps/{name}/suspend` · `.../unsuspend` · `DELETE /api/admin/ops/apps/{name}`.
   Jeder Aufruf **verlangt einen Grund** (ohne Grund: 400) — weil Abschnitt 8.4 dem Nutzer
   diesen Satz schuldet und 8.5 ohne ihn keinen Widerspruch führen kann. Jede Aktion
   schreibt eine Zeile in `ops_app_audit` (Migration **0100**, siehe 8.7). Auch das ist im
   U2.8-Lauf nachgewiesen und nicht bloß behauptet: `migrations.audit: true`, und der Schritt
   `suspend:flip` meldet `route ok, registry ok, audit written` — die Sperre hat ihre
   Beweiszeile wirklich geschrieben, statt auf `audit: "unavailable"` zurückzufallen.
   Gehängt an den **Admin-Key**, nicht an die Beta-Allowlist, und **absichtlich nicht** an
   `OPS_HOSTING_ENABLED`: dieser Schalter legt die API-Oberfläche still und den Router
   nicht. Act 2 dunkel zu schalten darf nicht die einzige Sperre entwaffnen.
3. ~~Es gibt keinen Orphan-Sweep~~ **GEBAUT (U2.5) · IM BETRIEB BEWIESEN (U2.8, 2026-08-12 —
   der Teardown hat sein Ergebnis auf echtem R2/KV nachgewiesen), mit unveränderter Grenze.**
   `GET /api/admin/ops/orphans`
   listet R2-Prefixe ohne Registry-Zeile — genau das, was das Löschen eines Projekts
   hinterlässt. Ein Teardown **beweist** sein Ergebnis, statt es zu behaupten: er listet
   den Prefix danach erneut und liest die Route erneut (`orphansRemaining`, `routeGone`).
   **Bewusst nur ein Bericht:** es löscht nichts von selbst. Ein automatischer Sweeper, der
   einmal falsch liegt, vernichtet die Live-App eines zahlenden Nutzers. Das Aufräumen ist
   ein zweiter, ausdrücklicher Aufruf mit App-IDs — ein „alles löschen" gibt es nicht.
   **Weiterhin offen:** die Projektlöschung selbst räumt nicht automatisch auf. Sie
   entfernt die Zeile per Cascade wie bisher; die Dateien findet erst der Sweep. Das ist
   eine bewusste Phasengrenze (Act-1-Code wird hier nicht angefasst), keine Vergesslichkeit.
4. ~~Der Publish-Scan (K3) ist an den Vercel-Pfad gebunden~~ **GEBAUT (U2.3) · IM BETRIEB
   BEWIESEN (U2.8, 2026-08-12 — Scan-Batterie 9/9 auf Produktion).** Der
   CF-Publish-Pfad läuft durch **dieselben K3-Regeln** — wiederverwendet, nicht
   nachgebaut, denn zwei Scanner wären zwei Antworten auf dieselbe Richtlinie. Dazu drei
   Ergänzungen, nur wo *Hoster sein* den Unterschied macht: Wallet-Drainer,
   Zugangsdaten-Formulare an fremde Domains (auf Vercel nur protokolliert, hier
   blockierend), und Größen-/Typ-Prüfung.
   Der Scan läuft **bevor ein einziges Byte in R2 landet** — eine Blockierung heißt: nichts
   hochgeladen, keine Route, keine Registry-Zeile. Er **verweigert im Zweifel**, anders als
   K3 auf dem Vercel-Weg: wenn wir nicht lesen können, was wir gleich von unserer eigenen
   Domain ausliefern, liefern wir es nicht aus.
   Beleg: 9 eingecheckte Fixtures (6 harmlos, 3 feindlich), 9/9 erwartete Urteile,
   `apps/api/src/services/safety/__fixtures__/hosted-publish/`. Die harmlose Hälfte ist die
   größere — darunter eine Seite, die Seed Phrases *erklärt* und nicht blockiert werden darf.
   **Damit ist die öffentliche AUP-Zusage „automatische Prüfungen vor dem Veröffentlichen"
   ab der ersten gehosteten Veröffentlichung wahr** — nicht erst mit Phase 3.

   **Der Beleg dafür, aus dem U2.8-Lauf selbst (2026-08-12).** Bis hierher stützte sich diese
   Zusage auf eingecheckte Fixtures — also darauf, dass der Scan im Test das Richtige tut. Der
   Lauf hat es auf dem echten Publish-Pfad wiederholt: er hat die feindliche Fixture
   (`hostile-01-paypal-phish`, ein Zugangsdaten abgreifender PayPal-Login-Klon) durch
   `publishHostedApp` geschickt, so wie ein echter Nutzer es täte. Ergebnis, zwei getrennte
   Schritte, beide grün:

   - `hostile:blocked` — **am Scan verweigert, Regel `PH-BRAND-CRED`**, `code: 'scan_blocked'`.
     Die Regel-ID steht im Ergebnis für uns; sie geht **nicht** an den Nutzer hinaus
     (`ops-publish.test.ts:239`) — eine Blockierliste, die sich selbst vorliest, ist eine
     Bauanleitung zum Umgehen.
   - `hostile:nothing-written` — **es wurde nichts geschrieben.** Der Lauf behauptet das nicht,
     er sieht nach: er liest die KV-Route der abgelehnten App danach erneut und verlangt
     `null`. Keine Route, keine Registry-Zeile, keine Bytes in R2 — der Scan läuft eben
     *bevor* das erste Byte landet, und dieser Lauf ist der Nachweis auf der echten
     Infrastruktur, nicht im Testdouble.

   **Das ist die Evidenz hinter dem Satz in der Nutzungsrichtlinie.** Wer die AUP-Zusage
   „automatische Prüfungen vor dem Veröffentlichen" je verteidigen muss — gegenüber einem
   Melder, einem Anwalt, einem Provider —, zeigt diese beiden Schritte in
   `evidence/akt2-phase2/e2e-founder-window-2026-08-12.json`. **Und sagt im selben Atemzug
   dazu, was sie nicht sind:** ein Beleg, dass *diese* Regel *diese* Fixture erkennt und
   dann nichts schreibt — kein Beleg, dass der Scan jede feindliche Seite erkennt. Die
   deterministische Schicht erkennt Muster, keine Absicht; die sechs bekannten Lücken aus
   Abschnitt 6 gelten unverändert.

**Was Phase 3 hier ergänzt — GEBAUT (2026-08-13), Abnahme im Gründer-Fenster offen.**
Hier stand bis zum 2026-08-13: „der Swift-Klassifizierer, die Review-Queue und die
Admin-Oberfläche … existieren heute NICHT". Alle drei existieren jetzt im Code. Was noch
aussteht, ist der Nachweis auf der echten Infrastruktur (das Gründer-Fenster) — genau die
Unterscheidung, die Phase 2 zwischen „gebaut" und „im Betrieb bewiesen" gezogen hat.

5. **Stufe 2 — der Klassifizierer** (`apps/api/src/services/safety/abuse-classifier.ts`).
   Läuft **nur auf dem gehosteten Weg** und **nur, wenn Stufe 1 bereits „pass" gesagt hat**
   — eine bereits entschiedene Blockierung kostet keine Tokens. Er kennt genau zwei
   Urteile: `pass` und `review`. **Er kann nicht sperren**, und das ist eine Entscheidung,
   kein Rest: ein probabilistischer Leser darf die Veröffentlichung eines ehrlichen Bauers
   nicht beenden. Jeder Fehlerfall — über dem Token-Budget, Dienst nicht erreichbar,
   Timeout, unbrauchbare Antwort — landet auf `review`, nie auf `pass`. Eine Prüfung, die
   nicht laufen konnte, hat nichts bestanden. Kosten: Ledger **M-A2**.
6. **Das dritte Urteil — die Review-Queue** (Migration **0102**; geschrieben in Phase 3, vom
   Gründer am **2026-08-13 angewendet** — Angabe des Gründers, nicht selbst geprüft). Ein `review`
   lädt **nichts** hoch, schreibt keine Route und keine Registry-Zeile — dasselbe Nichts
   wie eine Blockierung; der Unterschied ist nur, wer als Nächstes entscheidet. Die Zeile
   hält den Kandidaten als **Referenz** (Nutzer + Projekt + Wunschname), nie als Kopie:
   eine nicht freigegebene App zusätzlich in Postgres zu kopieren wäre eine zweite Kopie
   ohne eigenen Löschweg. Kann die Queue die Sperre **nicht** aufnehmen (0102 fehlt), sagt
   die Meldung an den Nutzer das auch — statt einen Menschen zu versprechen, der nie
   nachsieht.
7. **Die Betreiber-Oberfläche** — als Karte in der **bestehenden** Gründer-Konsole
   (`/dashboard/konsole`), nicht als zweite Admin-UI. Freigeben und Ablehnen; **Ablehnen
   verlangt einen Grund** (dieselbe Regel wie die Sperre, aus 8.4). Jede Entscheidung
   schreibt eine `ops_app_audit`-Zeile mit der E-Mail des Handelnden — Aktion
   `review_approve` / `review_block`. **Formhinweis fürs Lesen des Protokolls:** ein
   Kandidat hat keine App-ID, deshalb tragen `app_id`/`app_name` dort die ID der
   Queue-Zeile und den Wunschnamen, und `meta.subject = 'review_queue_item'` sagt das.
   Die Vorschau des Inhalts ist **reiner Text** — nie ein iframe, nie eingebettetes HTML,
   kein Sanitizer: der Browser, der hier liest, ist der mit den Gründer-Rechten.
   Eine Freigabe überstimmt **den Klassifizierer, nicht die harten Regeln**: Stufe 1 läuft
   bei der anschließenden Veröffentlichung erneut und vollständig.

**Was das an der öffentlichen Zusage ändert — und wo es nachgezogen wurde.** Die
Nutzungsrichtlinie sagte „ohne externen Dienst", „liest sie nicht durch" und „keine
manuelle Vorabkontrolle". Auf dem gehosteten Weg ist seit Phase 3 **alles drei falsch**:
der Text der App geht an DeepInfra, und angehaltene Apps sieht ein Mensch an, bevor sie
live gehen. Korrigiert im selben PR in `docs/ACCEPTABLE_USE_POLICY.md`, auf
`/acceptable-use` und in der Datenschutzerklärung (neuer Zweck beim bestehenden
Unterauftragsverarbeiter DeepInfra).

**Und was Phase 3 NICHT ändert.** Die deterministische Schicht bleibt, wie sie war, und
bleibt die einzige, die sperren kann. Der Klassifizierer ist nicht klug, nur weniger
wörtlich: gemessen am 2026-08-13 über 10 Fixtures × 5 Läufe hält er die fünf feindlichen
Fixtures mehrheitlich (5/5) und lässt die fünf legitimen mehrheitlich durch (5/5), aber
nur **9 von 10** erreichen die Stabilitätsschwelle von 4/5 — `stage2-04-seo-doorway` liegt
bei 3/5. **Die sechs bekannten Lücken aus Abschnitt 6 gelten unverändert weiter;** keine
davon wird durch Stufe 2 geschlossen, einige nur seltener getroffen. Beleg:
`evidence/akt2-phase3/stage2-battery.json`.

### 8.4 Nutzer benachrichtigen

Immer, außer bei S0. Vorlagen in Abschnitt 5 — für Weg B ergänzen: welche URL, welche
Grenze, was passiert ist (gesperrt/entfernt), wie der Export geht, wie widersprochen wird.
Bei S0 wird **nachträglich** benachrichtigt, sobald die Gefahr gebannt ist — nicht gar nicht.

### 8.5 Widerspruch

Der Nutzer antwortet auf die Benachrichtigung oder schreibt an `support@justgoblin.com`.
Ein Mensch (der Gründer) sieht es sich an. War die Sperre falsch: entsperren
(`status='active'` bzw. Route neu setzen via `setRoute`), dem Nutzer sagen, dass es unser
Fehler war, und die auslösende Regel in `scan-rules.ts` justieren + Fixture ergänzen.
**Ausnahme: bei CSAM gibt es kein Widerspruchsverfahren, das die Sperre aufschiebt.**

### 8.6 Urheberrechtsbeschwerde (Schweiz, notice-and-takedown)

Goblin sitzt in der **Schweiz**; es gilt Schweizer Recht. **Goblin unterhält keinen
DMCA-Agenten** und darf keine DMCA-Verfahrensgarantien behaupten — steht so auch öffentlich.

1. Beschwerde an `support@justgoblin.com` mit: URL · Bezeichnung des Werks · Nachweis der
   Berechtigung · Kontaktdaten · Richtigkeitserklärung. Unvollständig → nachfordern.
2. Plausibilität prüfen (keine juristische Würdigung, nur: ist das schlüssig?).
3. Plausibel → Inhalt sperren, Nutzer benachrichtigen, Kopie der Beschwerde beilegen.
4. Widerspricht der Nutzer begründet, ist es ein **Rechtsstreit zwischen zwei Parteien**.
   Goblin entscheidet ihn nicht. Beide Seiten informieren, Sperre bis zur Klärung halten,
   bei ernsthaftem Streit anwaltlichen Rat einholen.

### 8.7 Beweisaufbewahrung

Vor jeder irreversiblen Stufe sichern: R2-Snapshot der ausgelieferten Dateien, die
`ops_apps`-Zeile, die relevanten `platform_events`, die URL, die Meldung selbst,
Zeitstempel. Ablage außerhalb des Nutzer-Projekts.

**Aufbewahrung: 12 Monate**, dann löschen — lang genug für einen Folgestreit, nicht länger
als nötig. **Ausnahme CSAM:** nichts eigenständig aufbewahren oder ansehen; dem Verfahren
der Behörden folgen und deren Weisung einholen. *(Gründer-Entscheid 2026-07-28: bestätigt —
keine offene Frist mehr. Bei einer späteren anwaltlichen Prüfung mit zu bestätigen.)*
