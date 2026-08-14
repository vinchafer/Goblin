# AKT 2 · PHASEN 3 UND 4 — DAS GEMEINSAME GRÜNDER-FENSTER

**Geschrieben: 2026-08-14 · Für: den Gründer, mit der Konsole und dem iPhone · Dauer: ~45 Minuten in einem Zug**

Zwei Phasen sind gebaut und im Betrieb unbewiesen. Sie in **einer** Sitzung zu fahren ist nicht nur
bequemer — es ist richtiger: Phase 4 veröffentlicht durch Phase 3's Scan. Getrennt gefahren würde
jeder Formular-Befund erst einmal die Frage aufwerfen, ob er nicht doch ein Scan-Befund ist.

**Die Reihenfolge ist deshalb festgelegt: erst der Scan und die Prüfliste, dann die Formulare.**
Wenn Teil A rot ist, hat Teil B keine verlässliche Grundlage — und dann hörst du nach Teil A auf und
meldest das, statt weiterzumachen.

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

**Phase 4 hat keine.** `0103` bleibt unvergeben. Phase 3's `0102` ist laut Gründer angewendet; falls
doch nicht, sagt es dir Teil A Schritt 2 sofort und eindeutig.

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

Und die beiden Zeilen, die sich nach einem grünen Fenster **ändern müssen**:
`docs/GOBLIN_OPS_MASTER_PLAN_16_PHASES.md` sagt für Phase 3 und 4 heute **„gebaut — im Betrieb nicht
bewiesen"**. Daraus wird *„im Betrieb bewiesen"* — mit Datum und Zahlen, nicht mit Adjektiven.

Dann: **„Phase 5"** an Steven — Keeper-Herzschlag, der Punkt, an dem Goblin anfängt hinzusehen.

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
