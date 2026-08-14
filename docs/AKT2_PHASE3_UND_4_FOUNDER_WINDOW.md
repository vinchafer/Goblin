# AKT 2 · PHASEN 3 UND 4 — DAS GEMEINSAME GRÜNDER-FENSTER

**Geschrieben: 2026-08-14 · Für: den Gründer, mit der Konsole und dem iPhone · Dauer: ~45 Minuten in einem Zug**

Zwei Phasen sind gebaut und im Betrieb unbewiesen. Sie in **einer** Sitzung zu fahren ist nicht nur
bequemer — es ist richtiger: Phase 4 veröffentlicht durch Phase 3's Scan. Getrennt gefahren würde
jeder Formular-Befund erst einmal die Frage aufwerfen, ob er nicht doch ein Scan-Befund ist.

**Die Reihenfolge ist deshalb festgelegt: erst der Scan und die Prüfliste, dann die Formulare.**
Wenn Teil A rot ist, hat Teil B keine verlässliche Grundlage — und dann hörst du nach Teil A auf und
meldest das, statt weiterzumachen.

> **NACHTRAG 2026-08-14 — es gibt jetzt einen TEIL C (Phase 5, Heartbeat).** Er steht am **Ende**
> dieses Dokuments und ist die dritte, letzte Etappe derselben Sitzung — **nicht** ein eigenes
> Fenster und **nicht** ein drittes Dokument. Er kommt zuletzt aus einem Grund, der die Deutung
> rettet: eine rote `entry`-Prüfung kann ein Router-Problem (Phase 2), ein Publish-Problem (Phase 3)
> **oder** ein Prüf-Problem (Phase 5) sein. Wer Teil C vor Teil A fährt, weiß bei jedem Befund
> nicht, welcher der drei es war. **Ist Teil A oder B rot, wird Teil C nicht gefahren** — dann gibt
> es nichts Gesundes, dessen Ausfall man induzieren könnte.
>
> Teil C braucht **~15 Minuten** und **eine Migration vorab** (`0103`, siehe 0.4).

> Dieses Dokument **ersetzt** für die Sitzung `docs/AKT2_PHASE3_FOUNDER_WINDOW.md` und
> `docs/AKT2_PHASE4_FOUNDER_WINDOW.md`. Beide bleiben als ausführliche Referenz stehen — dort steht
> mehr Begründung, hier steht der Ablauf. Bei Widerspruch gilt dieses Dokument, weil es das jüngste
> ist.

---

## 0 · Vorher (5 Minuten, in Railway und in der Konsole)

### 0.1 Die Kopfzeile der Konsole lesen

`/dashboard/konsole` öffnen. **Vier Zeilen, alle vier vor dem Start:**

| Zeile | Muss sagen | Wenn nicht |
|---|---|---|
| Hosting-Schalter | **an** | `OPS_HOSTING_ENABLED=true` in Railway. Ohne ihn antwortet `/api/ops` mit 404 und nichts unten funktioniert. |
| Migrationen | **0099 angewendet · 0100 angewendet** | 0100 ist kein Blocker (Carry-forward B1) — die Entscheidungen passieren trotzdem, nur ohne Protokollzeile. Notieren, weitermachen. |
| Router | **alle vier grün** | Erst das klären. Steht dort UNBEKANNT, weiß niemand, ob veröffentlichte Apps überhaupt ausgeliefert werden. |
| **Formulare** *(neu)* | **eingerichtet** | Siehe 0.2. |

### 0.2 Die Formular-Zeile — das ist die Vorprüfung für Teil B

Die Zeile sagt genau eines von vier Dingen. **Sie zeigt nie einen Wert** — nur, welche Variablen
gesetzt sind und welche Form die Adresse hat.

| Was dort steht | Was es heißt | Was zu tun ist |
|---|---|---|
| **eingerichtet** | Beide Turnstile-Werte da, Adresse ist eine reine Herkunft. Teil B kann laufen. | nichts |
| **HALB EINGERICHTET** | Ein Teil ist gesetzt. Sieht konfiguriert aus, wird beim Veröffentlichen aber abgelehnt. Darunter stehen die **fehlenden Namen**. | Die genannten Variablen setzen. |
| **ADRESSE NICHT IN ORDNUNG** | `OPS_FORMS_ENDPOINT` (oder der Fallback) ist gesetzt und ist **keine reine Herkunft** — meist ein Pfad am Ende. Darunter steht die Variable und das Problem. | Auf Schema + Host kürzen: `https://…` und **nichts** dahinter. Siehe unten. |
| **nicht eingerichtet** | Gar nichts gesetzt. | Alles drei setzen. |
| **UNBEKANNT** (gestrichelt) | Die API läuft noch auf einem Commit **vor** Phase 4. | Deploy abwarten, Seite neu laden. |

**Zur Adresse, weil hier der einzige Wert steckt, den du selbst tippen musst:**
`OPS_FORMS_ENDPOINT` ist **Schema + Host (+ Port), sonst nichts** — kein Pfad, kein `?`, kein
Schrägstrich am Ende. An sie wird `/f/{name}/{formId}` angehängt; ein Pfad davor ergibt eine URL, die
niemand ausliefert, und das Formular schluckt jede Nachricht.

**Nimm exakt den Wert, der in Vercel als `NEXT_PUBLIC_API_URL` steht.** Nicht aus dem Kopf tippen und
nicht aus einem Dokument abschreiben — auch nicht aus diesem: ein Beispielwert in einer Anleitung ist
genau die Sorte Vermutung, die hier nichts zu suchen hat. *(Diese Sitzung hat `api.justgoblin.com`
von außen angefragt und keine Antwort bekommen. Das kann Netz, DNS oder ein anderer Host sein — es
ist kein Befund, aber es ist der Grund, warum hier kein Wert vorgeschlagen wird.)*

Ein Schrägstrich am Ende ist **kein Fehler** — er wird entfernt, und die Konsole sagt dir, dass sie
das getan hat. Die Zeile steht da, damit dir auffällt, wenn dort mehr steht als gedacht.

### 0.3 Was diese Sitzung NICHT prüfen konnte

**Ob `CF_API_TOKEN` die D1-Berechtigung trägt.** Die Berechtigungen eines Tokens lassen sich aus dem
Token nicht zurücklesen, und in dieser Sitzung liegt kein Cloudflare-Zugang. Es zeigt sich in
**Teil B, Schritt 6**: die erste Formular-Veröffentlichung antwortet dann ehrlich mit
`d1_unavailable`. Cloudflare-Dashboard → API-Token → **D1:Edit** ergänzen, neu versuchen. Ein Klick.

### 0.4 Migrationen

**Phase 4 hat keine.** Phase 3's `0102` ist laut Gründer angewendet; falls doch nicht, sagt es dir
Teil A Schritt 2 sofort und eindeutig.

**Phase 5 hat eine: `0103_ops_app_checks.sql`** (die Prüftabelle des Heartbeats). *Nachtrag
2026-08-14 — die Nummer `0103` ist damit vergeben; oben stand sie noch als unvergeben.*

**Wenn du Teil C fahren willst, wende sie VOR der Sitzung an** (Supabase SQL-Editor, additiv und
idempotent, rührt keine bestehende Tabelle an). Ohne sie schreibt der Heartbeat nichts, jede Karte
steht auf **UNBEKANNT**, und das ist korrekt — aber es ist kein Testergebnis, sondern eine
ungestellte Frage.

---

# TEIL A · SCAN UND PRÜFLISTE (Phase 3) — ~20 Minuten

Beweist, dass die zweite Scan-Stufe im Betrieb funktioniert, dass eine gehaltene Veröffentlichung
**nichts** hochlädt, und dass beide Entscheidungswege gehen.

## A1 — Eine saubere App veröffentlichen

Konsole → Karte **„Test-App veröffentlichen"** → Projekt wählen → Name `p3-clean-<datum>` → warten
auf **„Dieser Name ist frei."** → **Veröffentlichen**.

**Erwartet:** **„Live."** mit echter URL · „Öffnen" führt zur Seite · die App steht unter
**„Gehostete Apps"** als **aktiv**.

> **Nimm ein schlichtes statisches Projekt, keinen Framework-Build.** Das Stufe-2-Budget ist
> ~6 000 Tokens ≈ 24 000 Zeichen; ein gebündeltes `index-*.js` liegt weit darüber und wird
> **korrekt gehalten** — dann testest du aber A2 statt A1. Für den Framework-Fall gibt es A4 Weg A.

## A2 — Eine Fixture veröffentlichen, die gehalten werden muss

**Fixture: `stage2-01-fake-giveaway`** (5/5 im Gate-Lauf, eine Datei, 1 503 Bytes, kein Passwortfeld).
Repo-Pfad: `apps/api/src/services/safety/__fixtures__/hosted-publish-stage2/stage2-01-fake-giveaway/index.html`

*(Nicht `stage2-04-seo-doorway` — die liegt bei 3/5 und geht in zwei von fünf Fällen einfach durch.)*

Am iPhone: Datei auf GitHub in der Raw-Ansicht öffnen, alles kopieren, in Goblin ein neues Projekt
anlegen, als `index.html` einfügen, sichern. Dann Konsole → Publish-Karte → dieses Projekt → Name
`p3-hold-<datum>` → **Veröffentlichen**.

**Erwartet:**
- Publish-Karte: **„Angehalten — nichts veröffentlicht."** plus die deutsche Meldung der API.
  **Kein Link. Nirgends „Live.".** Steht dort „Live." oder UNKLAR → **hier abbrechen und melden.**
- Prüflisten-Karte: neuer Eintrag, Pille **STUFE 2 (KLASSIFIZIERER)**, Stufe 1 **PASS**,
  Kategorien **deception**, Tokens (rein/raus) — **die beiden Zahlen abschreiben**, sie gehen in den
  Ledger (M-A2).
- **„Gehostete Apps" zeigt diese App NICHT.**
- **`https://p3-hold-<datum>.justgoblin.app` liefert 404** ← *das ist der eigentliche Beweis.*
- **„Inhalt ansehen"**: Quelltext als sichtbarer **Text**, keine gerenderte Seite, kein Skript läuft.

## A3 — Einmal ablehnen

Am Betrugs-Eintrag: **Freigeben / Ablehnen** → **Grund** ausfüllen (Pflicht; der Nutzer liest ihn),
z. B. *„Fake-Gewinnspiel, verlangt Vorauszahlung — AUP Nr. 3 (Täuschung & Betrug)."* → **Ablehnen**.

**Erwartet:** „Abgelehnt." + **„Protokollzeile geschrieben."** Der Eintrag verschwindet. Es geht
nichts offline, weil nie etwas online war.

## A4 — Einmal freigeben

**NICHT den Betrugs-Eintrag freigeben** — eine Freigabe veröffentlicht sofort, und du hättest eine
Betrugsseite unter Goblins Domain live.

Erzeuge einen **harmlosen** Hold:
- **Weg A (empfohlen):** ein Projekt mit echtem Framework-Build (oder irgendeiner Textdatei über
  ~24 000 Zeichen) veröffentlichen → `over_budget`. Die Prüfliste zeigt **Kategorien: UNBEKANNT**,
  **Tokens 0/0** und „…sie wurde gar nicht beurteilt." **Das ist zugleich der einzige Beweis für den
  Fail-closed-Zweig auf echter Infrastruktur** — und beantwortet Carry-forward **A6**.
- **Weg B:** `OPS_SCAN_CLASSIFIER_MAX_TOKENS=10`, Redeploy, irgendetwas Sauberes veröffentlichen.
  **Hinterher unbedingt entfernen.**

Dann freigeben (Grund optional, trotzdem einen).

**Erwartet:** „Freigegeben und live." + „Protokollzeile geschrieben." · App unter „Gehostete Apps" ·
URL liefert aus. *(Stufe 1 läuft bei der Freigabe erneut — eine Freigabe überstimmt den
Klassifizierer, nicht die harten Regeln.)*

## A5 — Die Abnahme

Prüflisten-Karte → **„Zuletzt entschieden"**: **zwei Einträge**, einer freigegeben, einer abgelehnt,
je mit wer/wann/warum. Kein SQL nötig.

**Wenn du tiefer prüfen willst** (die Beweiszeile in `ops_app_audit` überlebt auch eine
Konto-Löschung, die Queue-Zeile nicht):

```sql
select created_at, action, actor, app_name, reason, meta
from public.ops_app_audit
where action in ('review_approve','review_block')
order by created_at desc limit 10;
```
**Erwartet: zwei Zeilen**, `actor = vinc.hafner2@gmail.com`, `meta.subject = "review_queue_item"`.

> **Ist Teil A rot — insbesondere A2 („Live." statt „Angehalten") — hier aufhören.** Teil B
> veröffentlicht durch genau diesen Pfad.

---

# TEIL B · FORMULARE (Phase 4) — ~25 Minuten

## B1 — Eine App mit Formular veröffentlichen

Mit dem **Testkonto** `vinc.hafner3@gmail.com` (nicht dem persönlichen). Ein Projekt mit genau dieser
`index.html` — das Formular hat **kein** `action`, und das ist die ganze Regel:

```html
<!doctype html>
<html lang="de">
  <body>
    <h1>Testformular</h1>
    <form id="kontakt">
      <label for="name">Name</label>
      <input id="name" name="name">
      <label for="nachricht">Nachricht</label>
      <textarea id="nachricht" name="nachricht"></textarea>
      <button type="submit">Absenden</button>
    </form>
  </body>
</html>
```

**Live stellen** → Name `p4-form-<datum>` → veröffentlichen.

**Wenn es hängt:**

| Antwort | Was los ist |
|---|---|
| `form_unwirable` (503) | Site Key oder Adresse fehlt. Zurück zu 0.2. **Die App ist nicht live** — Absicht. |
| `d1_unavailable` (503) | Datenbank ließ sich nicht anlegen. **Wahrscheinlichste Ursache: D1:Edit fehlt am Token** (0.3). Zweitens: die zehn Free-Datenbanken sind voll — dann sagt die Meldung das. |
| 202 „wird geprüft" | Stufe 2 hat gehalten. **Ein Teil-A-Ergebnis.** In der Prüfliste freigeben, dann hier weiter. |

## B2 — Absenden. Dreimal.

App am Telefon öffnen, Formular ausfüllen, absenden — **dreimal mit unterschiedlichen Texten**, damit
„3/3" wirklich drei Durchläufe sind. Jedes Mal:

1. Die Seite sagt **„Danke — deine Nachricht ist angekommen."** (der Satz kommt vom Server; steht dort
   etwas anderes, ist das der ehrliche Grund und die Antwort).
2. **E-Mail kommt an** — „Neue Einsendung — {name}", mit Inhalt, und darunter der Satz, dass Goblin
   den Inhalt **nicht** geprüft hat.
3. **Im Posteingang sichtbar** — Publish-Sheet des Projekts → **Posteingang öffnen**.

**Das ist das Rundlauf-Gate: absenden → Zeile → E-Mail → Posteingang, 3/3.**

## B3 — Die drei Schritte, die man am liebsten auslässt

Sie sind der Grund, warum dieses Fenster existiert. Ohne sie ist nur bewiesen, dass es funktioniert,
wenn alles funktioniert.

**B3a — Turnstile ausfallen lassen.** In Railway `CF_TURNSTILE_SECRET_KEY` kurz umbenennen (ein `X`
anhängen), Deploy abwarten, absenden.
→ Erwartet: *„Dieses Formular kann im Moment nichts entgegennehmen. Das liegt an uns, nicht an dir.
Deine Nachricht ist NICHT angekommen."* **Niemals ein Danke.** Danach zurückbenennen.

**B3b — Die Obergrenze.** 500 von Hand ist keine Prüfung. Stattdessen
`CAPS_PROFILES['free-static'].monthlySubmissions` in `apps/api/src/services/ops-caps.ts` **kurz auf 3
setzen**, deployen, ein **viertes** Mal absenden.
→ Erwartet, alle drei zusammen: der Besucher liest *„…so viele Einsendungen bekommen, wie es annehmen
kann … **NICHT** angekommen … wurde darüber informiert"* · im Testkonto-Postfach liegt **„Formular
voll — {name}"** · **und die vierte Einsendung ist NIRGENDS** — nicht im Posteingang, nicht im Export.
Das ist der Punkt: **abgelehnt, nicht weggeworfen.** Danach zurück auf 500.

**B3c — Löschen, und was mitgeht.** Erst **eine** Einsendung löschen, dann **alle** (verlangt die
Bestätigung im Sheet). Danach sagt die Karte **„Noch keine Einsendungen"** — die ruhige Karte, **nicht**
die rote „konnte nicht nachsehen"-Box. Die beiden sind absichtlich verschieden; wenn du hier die rote
siehst, ist das ein Befund.
Dann **das Projekt löschen**. Erwartet: geht durch, und **die Datenbank ist weg**.

## B4 — Waisen-Prüfung, danach

Konsole → **Waisen-Prüfung** → *Prüfung starten*. Die Karte hat seit Phase 4 zwei neue Zeilen, und sie
stehen **oben**, weil sie die schwersten sind:

- **Verwaiste Formular-Datenbanken** → muss **„keine gefunden"** sagen.
- **Datenbanken gelöschter Apps** → muss **„keine gefunden"** sagen.

Sagt eine **NICHT GEPRÜFT** (gestrichelt, farblos), fehlt dem Token vermutlich D1:Edit — das ist keine
Entwarnung, das ist eine ausgefallene Prüfung. Sagt eine etwas anderes, ist ein Abbau nicht fertig
geworden, und genau dafür steht die Karte da.

**Das ist auch der Moment für X1-S**, den Bestands-Sweep über die alten Routen und Präfixe, der seit
PR #90 offen ist.

## B5 — Zwei Dinge, die unberührt sein müssen

- **`anmeldeformular.justgoblin.app`** öffnen → muss normal ausliefern. *(Diese Sitzung hat sie am
  2026-08-14 abgefragt: **HTTP 200, text/html, 10 544 Bytes**, Titel beginnt „Schachkur…". Sie hat
  also vor dem Merge ausgeliefert; nach dem Merge nachzusehen ist trotzdem billiger als anzunehmen.)*
- **Ein normales Konto** (nicht auf der Allowlist) öffnet sein Dashboard → sieht **nichts** von
  alledem: kein Posteingang, kein Hinweis, keine andere Antwort als vorher.

---

## Was danach zu berichten ist

Zehn Zeilen reichen.

| # | Zahl / Antwort | Wohin |
|---|---|---|
| 1 | saubere Veröffentlichung live (1/1) | Phase-3-Bericht |
| 2 | Holds erzeugt (2/2) · **404 der gehaltenen Adresse: ja/nein** | Phase-3-Bericht + Closure-Zeile im 16-Phasen-Plan |
| 3 | Entscheidungen (1× freigegeben, 1× abgelehnt) + Protokollzeilen (2/2) | Phase-3-Bericht + `ABUSE_RESPONSE` §8.3 |
| 4 | `tokens_input` / `tokens_output` der Holds | **Ledger M-A2** — erste Produktionsmessung |
| 5 | Hängt ein echter Framework-Build am Budget? (A4 Weg A) | Carry-forward **A6** |
| 6 | **Rundlauf n/3** | Phase-4-Bericht |
| 7 | Über der Grenze: ehrliche Absage + Eigentümer-Mail + vierte Einsendung nirgends? | Phase-4-Bericht |
| 8 | Waisen-Prüfung, beide D1-Zeilen | Phase-4-Bericht |
| 9 | `anmeldeformular` weiter erreichbar: ja/nein | Phase-4-Bericht (schließt das halb offene Gate) |
| 10 | Sieht ein normales Konto nichts? | beide Berichte |
| 11 | **Zyklen bis „nicht erreichbar" und zurück** (Teil C) | Phase-5-Bericht |
| 12 | **UNBEKANNT-Pfad in Produktion gesehen: ja/nein** (Teil C) | Phase-5-Bericht |

Und die beiden Zeilen, die sich nach einem grünen Fenster **ändern müssen**:
`docs/GOBLIN_OPS_MASTER_PLAN_16_PHASES.md` sagt für Phase 3 und 4 heute **„gebaut — im Betrieb nicht
bewiesen"**. Daraus wird *„im Betrieb bewiesen"* — mit Datum und Zahlen, nicht mit Adjektiven.

Dann: **„Phase 6"** an Steven — Fehler-Erfassung und Vorfälle.

> **Nachtrag 2026-08-14:** die Zeile hier sagte „Phase 5", weil Phase 5 damals noch nicht gebaut
> war. Sie ist es jetzt (PR aus Branch `claude/keeper-1a-heartbeat-status-aa8wgj`) und ihr Test ist
> **Teil C unten**. Der nächste Auftrag ist Phase 6 — und nach der Regel des Gründers **erst, wenn
> dieses Fenster gelaufen ist**: Phase 6 baut Vorfälle auf einem Heartbeat auf, der bis dahin
> niemanden angesehen hat.
>
> `docs/GOBLIN_OPS_MASTER_PLAN_16_PHASES.md` trägt nach einem grünen Fenster für **Phasen 3, 4 und
> 5** dieselbe Änderung: aus „gebaut — im Betrieb nicht bewiesen" wird „im Betrieb bewiesen", mit
> Datum und Zahlen.

---

## Wenn etwas schiefgeht

| Symptom | Was es heißt |
|---|---|
| Konsole gar nicht da (404) | Konto nicht in `OPS_FOUNDER_ACCOUNTS`, **oder** `OPS_HOSTING_ENABLED` aus. Sieht von außen gleich aus — absichtlich. |
| „Prüfliste konnte nicht gelesen werden … Migration 0102" | 0102 fehlt. Anwenden, neu laden. |
| Veröffentlichung: „Bitte versuch es später noch einmal" | Der Hold konnte nicht vorgemerkt werden. Ehrlich so gebaut: lieber das sagen, als einen Menschen zu versprechen, der nie nachsieht. |
| Jede App landet in der Prüfliste | Klassifizierer nicht erreichbar, **oder** `OPS_SCAN_CLASSIFIER_MAX_TOKENS` steht noch auf dem Testwert aus A4 Weg B. |
| Formulare-Zeile: HALB EINGERICHTET | Darunter stehen die fehlenden **Namen**. Setzen, Deploy abwarten. |
| Formulare-Zeile: ADRESSE NICHT IN ORDNUNG | Meist ein Pfad am Ende von `OPS_FORMS_ENDPOINT`. Auf Schema + Host kürzen. |
| `d1_unavailable` beim ersten Formular | D1:Edit am Token ergänzen (0.3). Oder die zehn Free-Datenbanken sind voll — dann sagt es die Meldung. |
| Das Formular sagt „Wir konnten das gerade nicht abschicken" | Die Seite hat die API **gar nicht erreicht** — falscher Host in `OPS_FORMS_ENDPOINT`, oder die API ist unten. Das ist der einzige Satz, den die Seite selbst verfasst; alle anderen kommen vom Server. |
| Posteingang zeigt die rote „konnte nicht nachsehen"-Box | Die Datenbank war nicht lesbar. Das heißt **nicht** „leer". Erneut versuchen; hält es an, ist es ein Befund. |
| **Zustandskarte: „Prüfergebnisse nicht lesbar"** | Migration `0103` fehlt (0.4). Anwenden, neu laden. |
| **Alles UNBEKANNT, „noch nie geprüft"** | Es ist noch kein Durchlauf gelaufen. **„Jetzt prüfen"** tippen. Bleibt es dabei: `OPS_CHECKS_ENABLED` steht auf `false`, oder `OPS_HOSTING_ENABLED` ist aus. |
| **Zustandskarte zeigt „ÜBER BUDGET"** | Mehr als 208 aktive Apps. Bei einer Beta-Flotte ist das ein Befund, kein Zustand — melden. |
| **`entry` dauerhaft „kein Ergebnis" statt fail/ok** | Die API kommt nicht nach außen (Netz, DNS, Proxy). **Ehrlich, aber kein Testergebnis** — die Prüfung hat nicht stattgefunden. |

---

# TEIL C · HEARTBEAT (Phase 5) — ~15 Minuten

**Angehängt: 2026-08-14 · Branch `claude/keeper-1a-heartbeat-status-aa8wgj` · Migration `0103` nötig**

Phase 5 ist die erste Sprosse der Keeper-Leiter (Thesis §5.3, K0): **Goblin weiß, ob eine App
erreichbar ist — und sagt es ohne Kosmetik.** Teil C prüft genau zwei Dinge, und beide sind
Behauptungen, die man nur durch Kaputtmachen belegen kann:

1. Ein **echter Ausfall** bewegt den Zustand — und die Erholung bewegt ihn zurück.
2. Eine **Lücke im Prüfraster** wird UNBEKANNT, nicht grün.

> **Nur fahren, wenn Teil A und Teil B grün sind.** Sonst ist jeder Befund dreideutig (Router,
> Publish oder Prüfung), und ein dreideutiger Befund ist keiner.

> **`anmeldeformular.justgoblin.app` wird in Teil C NICHT angefasst.** Der Heartbeat *sieht* sie an
> — eine `GET`-Anfrage auf die Startseite, alle paar Minuten, wie jeder Besucher. Er verändert
> nichts an ihr, veröffentlicht nichts, sperrt nichts. Kaputtgemacht wird ausschließlich die
> **Testapp aus Teil A**.

---

## C1 — Die Karte aufmachen (2 Min)

`/dashboard/konsole` → Karte **„Zustand der Apps"**.

Beim ersten Öffnen ist fast alles **UNBEKANNT · noch nie geprüft**. Das ist richtig: der Läufer
schreibt erst, seit die Migration steht.

**„Jetzt prüfen"** tippen. Danach müssen dastehen:

| Was | Muss zeigen | Wenn nicht |
|---|---|---|
| Deine Test-App aus Teil A | **erreichbar**, mit Uhrzeit daneben | Steht dort „nicht erreichbar", ist Teil A doch nicht grün — hier aufhören und melden. |
| **Takt** | *alle 5 Minuten* | Bei einer Beta-Flotte kann dort nichts anderes stehen. |
| **Heartbeat-Budget** | eine Zahl, nicht „ÜBER BUDGET" | „ÜBER BUDGET" bei einer Handvoll Apps ist ein Befund. |
| **Goblin selbst** → Web-App, API | **erreichbar** | Ist die API hier rot, prüfst du gleich mit einem kaputten Instrument. |
| **Goblin selbst** → Zertifikat | eine Zahl „Tage übrig" | UNBEKANNT ist hier kein Drama (siehe unten), aber notieren. |

**Notiere die Zahl bei „Tage übrig" für Zertifikat und Domain.** Sie sind die einzigen Werte in
dieser Phase, die in Produktion **frisch gemessen** und sonst nirgends nachlesbar sind.

> **Zertifikat und Domain gelten für die ganze Zone**, nicht pro App: ein Wildcard-Zertifikat für
> `*.justgoblin.app`, eine Registrierung für `justgoblin.app`. Deshalb steht dort **eine** Zeile und
> nicht eine pro App.

---

## C2 — Die App des Bauers: gibt es eine Karte, und sagt sie eine Uhrzeit? (2 Min)

Als **Beta-Konto** (`vinc.hafner3@`, nicht das Gründer-Konto) das Projekt aus Teil A öffnen →
**Live stellen** → das Blatt öffnet sich.

Über dem Posteingang-Knopf steht jetzt **„Zustand"**. Prüfe **einen Satz**:

> **Steht neben dem Zustandswort eine Uhrzeit?**

Es muss dastehen: **„Zuletzt geprüft 14:02 — erreichbar."** — nicht „erreichbar", nicht ein grüner
Punkt allein. **Ein Zustand ohne Zeit ist das Gate dieser Phase, und es ist verletzt, wenn du
irgendwo einen Zustand ohne Uhrzeit findest.**

Darunter steht entweder eine Erreichbarkeits-Quote **mit ihrer Stichprobenzahl**, oder „für eine
Quote reichen die Daten noch nicht". Am ersten Tag ist Zweiteres richtig — die Quote kommt erst nach
24 Stunden Abdeckung.

---

## C3 — Kaputtmachen. Das ist der Kern. (6 Min)

**Die Test-App aus Teil A, nicht `anmeldeformular`.**

### Der Weg: eine Datei in R2 löschen

**Cloudflare-Dashboard → R2 → der Bucket → `apps/{app_id}/` → `index.html` löschen.**

Die `app_id` steht in der Konsole an der App. Danach hat die App keine Startseite mehr, und der
Router antwortet auf `https://{name}.justgoblin.app/` mit seiner ehrlichen 404-Seite statt mit der
App.

**Wiederherstellen** ist ein Klick in der Konsole: dieselbe App aus dem Projekt **erneut
veröffentlichen**. Die Dateien werden neu hochgeladen, App-ID und Adresse bleiben.

> **Warum genau das:** es ist der Ausfall aus dem 16-Phasen-Plan („break test app asset") und es ist
> die realistischste billige Kaputtmach-Art — ein halb hochgeladener Deploy sieht genauso aus. Der
> Läufer weiß nichts davon: er stellt dieselbe `GET`-Anfrage wie immer und bekommt etwas anderes als
> 200 zurück.

> ### ⚠ SPERREN funktioniert als Ausfall-Test NICHT — und das ist Absicht
>
> Naheliegend wäre, die App in der Konsole zu **sperren**. Der Heartbeat prüft aber **nur aktive
> Apps**: eine gesperrte App *soll* die Sperrseite ausliefern, und sie deswegen als „nicht
> erreichbar" zu melden wäre ein Dauerbefund über einen gewollten Zustand.
>
> Eine gesperrte App steht in der Konsole deshalb auf **UNBEKANNT**, mit ihrem Registry-Status
> („gesperrt") und einem Satz daneben, der sagt, dass das korrekt und kein Befund ist. **Wenn du
> beim Sperren etwas anderes siehst, ist das ein Befund** — aber es ist nicht der Ausfalltest.

Dann, **zweimal hintereinander**, in der Zustandskarte **„Jetzt prüfen"** tippen — und nach **jedem**
Tippen die Karte lesen:

| Nach dem … | Zustand muss sein | Zykluszahl |
|---|---|---|
| 1. Tippen | **eingeschränkt** | 1 |
| 2. Tippen | **nicht erreichbar** | 2 |

**Notiere, nach wie vielen Tippern der Zustand gekippt ist.** Erwartet: 1 und 2. Der lokale Harness
misst dieselben Zahlen 3/3 (`evidence/akt2-phase5/induced-failure.json`) — die Frage hier ist, ob
Produktion sich gleich verhält.

> Dass **nicht** sofort „nicht erreichbar" dasteht, ist kein Fehler: ein einzelner Ausfall ist
> *eingeschränkt*, damit ein kurzer Aussetzer nicht als Ausfall gemeldet wird. Die Karte sagt das
> auch selbst.

**Dann reparieren:** die App aus dem Projekt **erneut veröffentlichen** (Konsole, Publish-Karte).
Wieder **zweimal** „Jetzt prüfen":

| Nach dem … | Zustand muss sein |
|---|---|
| 1. Tippen | **eingeschränkt** |
| 2. Tippen | **erreichbar** |

**Wenn du kannst, wiederhole C3 zweimal** (insgesamt 3 Durchläufe — jedes Mal `index.html` löschen
und neu veröffentlichen) und notiere, ob die Zahlen jedes
Mal gleich waren. Bleiben sie es nicht, ist das der interessanteste Befund der ganzen Phase.

---

## C4 — Die Lücke: UNBEKANNT statt grün (4 Min)

Der wichtigere der beiden Tests, und der unspektakulärere.

1. App steht auf **erreichbar** (nach C3 wieder hergestellt).
2. In Railway **`OPS_CHECKS_ENABLED=false`** setzen. Der Läufer hört auf zu messen; alles andere an
   Akt 2 läuft weiter.
3. **20 Minuten warten.** (Drei verpasste Takte — das ist die Frische-Schwelle.) Kaffee.
4. Die Karte neu laden — **ohne** „Jetzt prüfen" zu tippen.

**Es muss dort UNBEKANNT stehen**, mit einem Satz in der Art *„Zuletzt geprüft 14:02 — seitdem ist
keine Prüfung mehr durchgekommen"*, und die **Uhrzeit der letzten echten Messung muss noch
dastehen**.

**Was NICHT passieren darf, und was du ausdrücklich prüfst:**

- ❌ Die Karte steht weiter auf **erreichbar**. → Das wäre ein stehengebliebenes Grün und der
  schwerste mögliche Befund dieser Phase.
- ❌ Die Karte steht auf **nicht erreichbar**. → Auch falsch: der App fehlt nichts, uns fehlt die
  Messung.
- ❌ Die Karte ist **leer** oder zeigt einen Strich ohne Erklärung.

Denselben Blick auf die **Besitzer-Karte** (Beta-Konto, C2): dort muss sinngemäß stehen *„Wir wissen
es gerade nicht … Das heißt NICHT, dass etwas kaputt ist; es heißt, dass wir nicht nachgesehen
haben."*

5. **`OPS_CHECKS_ENABLED` wieder entfernen** (oder auf `true`). Nach dem Redeploy ein-, zweimal
   „Jetzt prüfen" — der Zustand muss zurück auf **erreichbar** gehen.

> **Der Sinn dieses Schritts in einem Satz:** jede Statusseite der Welt kann grün. Diese hier muss
> beweisen, dass sie aufhört grün zu sein, sobald niemand mehr hinsieht.

---

## C5 — Zwei Dinge, die auch nach Teil C unberührt sein müssen

- **`anmeldeformular.justgoblin.app`** öffnen → liefert weiter normal aus. Sie taucht in der
  Zustandskarte **nur als Zeile** auf, wenn sie eine Registry-Zeile hat; steht sie dort, muss sie
  **erreichbar** sein. Angefasst wurde sie nicht.
- **Ein normales Konto** (nicht auf der Allowlist) → sieht **keine** Zustandskarte, keinen Hinweis
  darauf, dass irgendetwas beobachtet wird.

---

## Was aus Teil C zu berichten ist

Sechs Zeilen.

| # | Frage | Erwartet |
|---|---|---|
| C-1 | Zyklen bis **eingeschränkt** / bis **nicht erreichbar** | 1 / 2 |
| C-2 | Zyklen bis zurück auf **erreichbar** | 2 |
| C-3 | Wie oft wiederholt, und waren die Zahlen gleich? | 3/3 gleich |
| C-4 | Nach 20 Min. Pause: **UNBEKANNT** — ja/nein? Und stand die alte Uhrzeit noch da? | ja / ja |
| C-5 | Zertifikat und Domain: **Tage übrig** | zwei Zahlen |
| C-6 | Welcher Ausfall-Weg? (`index.html` in R2 gelöscht — oder ein anderer, dann welcher) | benannt |

**C-4 ist die Zeile, die zählt.** C-1 bis C-3 belegen, dass der Mechanismus reagiert — das misst der
lokale Harness auch. C-4 belegt, dass er **aufhört zu behaupten**, wenn er nichts mehr weiß, und das
ist die einzige Eigenschaft, für die diese Phase gebaut wurde.
