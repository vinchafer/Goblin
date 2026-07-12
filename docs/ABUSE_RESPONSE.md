# Missbrauchs-Runbook (ABUSE_RESPONSE) — für den Gründer

**Stand: 2026-07-11 · Wave-K, Layer 5 (die menschliche Schicht).**

Dieses Runbook ist der Handlungs-Leitfaden, wenn ein Missbrauchs-Verdacht auftaucht.
Es setzt die fünf Schutzschichten voraus (K1 Nutzungsrichtlinie · K2 Generierungs-Refusal ·
K3 Publish-Scan · K4 Verhaltens-Signale · K5 dieses Runbook). Die ersten vier verringern
Risiko technisch; diese Schicht ist der Mensch, der entscheidet — denn
**Konto-Aktionen sind Gründer-Entscheidungen, nie automatisch** (OS-Eskalationstabelle:
Nutzerdaten / irreversibel).

## Der strukturelle Vorteil (immer mitdenken)

**Goblin hostet Nutzer-Inhalte nie öffentlich.** Generierte Apps laufen im **eigenen
Vercel-Konto des Nutzers**; der Projektspeicher (B2) ist privat. Missbrauchsfläche ist
deshalb: (a) was der Agent baut (K2), (b) was die Publish-Pipeline zu Vercel ausliefert
(K3), (c) Plattform-Ressourcen (Wave-D). Die Hosting-Ebene — und Vercels eigene
Trust-&-Safety-Maschinerie — gehört dem Nutzer und Vercel. Ein Inhalt, der erst NACH dem
Publish auf dem Vercel des Nutzers sichtbar wird, ist primär Vercels Meldeweg (siehe unten).

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
