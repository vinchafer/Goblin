# Missbrauchs-Runbook (ABUSE_RESPONSE) — für den Gründer

**Stand: 2026-07-28 · Wave-K, Layer 5 (die menschliche Schicht) · erweitert um Abschnitt 8
(von Goblin gehostete Apps, AKT 2 · Pre-Phase-2).**

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
- **Aufbewahrungsfrist für Beweise (12 Monate, 8.7)** bestätigen oder korrigieren — offen.
- **Vier Phase-2-Anforderungen aus 8.3 abnehmen**, bevor die erste fremde App live geht:
  Router respektiert `suspended` · Admin-Schreibpfad für die Sperre · Orphan-Sweep beim
  Projektlöschen · K3-Scan im CF-Publish-Pfad (sonst wird die öffentliche AUP-Zusage falsch).

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

**Existiert NOCH NICHT — Phase-2-Anforderungen, hier festgehalten statt beschönigt:**

1. **Der Router respektiert `status = 'suspended'` noch nicht** — es gibt in Phase 1 keinen
   Router Worker. Bis Phase 2 ihn baut und die Statusprüfung einbaut, ist der einzige
   wirksame Not-Aus pro App das **Löschen der KV-Route** (`deleteRoute`) — grob, aber
   wirksam. *Phase-2-Anforderung: der Router MUSS eine suspendierte App abweisen.*
2. **Es gibt keinen Schreibpfad für die Suspendierung.** `ops-apps-store.ts` ist heute
   read-only (`listUserOpsApps`, `findOpsAppByName`). Suspendieren heißt derzeit: `UPDATE
   public.ops_apps SET status='suspended' WHERE app_name='…';` im Supabase-SQL-Editor.
   *Phase-2-Anforderung: ein Admin-Pfad mit Audit-Eintrag.*
3. **Es gibt keinen Orphan-Sweep.** Das Löschen eines Projekts entfernt die Registry-Zeile
   per Cascade, **nicht** die gehosteten Dateien (siehe Warnung in `0099_ops_apps.sql`).
   Eine gelöschte Projektzeile kann eine erreichbare URL zurücklassen. *Phase-2-Anforderung.*
4. **Der Publish-Scan (K3) ist an den Vercel-Pfad gebunden.** *Phase-2-Anforderung: der
   CF-Publish-Pfad MUSS durch denselben Scan laufen* — sonst wird die öffentliche AUP-Zusage
   „automatische Prüfungen vor dem Veröffentlichen" auf Weg B falsch.

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
der Behörden folgen und deren Weisung einholen. *(Frist ist ein Vorschlag → Gründer-/
Anwaltsentscheid, siehe Abschnitt 7.)*
