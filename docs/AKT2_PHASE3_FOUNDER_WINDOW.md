# AKT 2 · PHASE 3 — das Gründer-Fenster (U3.2 / U3.3, ausstehend)

**Stand: 2026-08-13 · gehört zu PR #86 (`5b17cb2`, gemerged) · NOCH NICHT GEFAHREN.**

Phase 3 ist **gebaut und testgedeckt, im Betrieb aber nicht bewiesen.** Der Klassifizierer hat
50 echte Completions gegen DeepInfra gemacht — der **Publish-Pfad mit Stufe 2** ist noch nie
gegen echtes R2/KV gelaufen. Dieses Fenster ist der Beweis, der fehlt.

**Kein `curl`, kein Token, keine Kommandozeile.** Anders als Phase 2 braucht dieses Fenster
keinen einzigen direkten API-Aufruf: alles, was zu tun ist, sind Taps in der Gründer-Konsole
auf dem iPhone. Der Grund ist unverändert der aus `OPS_SPIKE_0` §4.4 — die
Cloudflare-Zugangsdaten liegen ausschließlich in Railway, und der bereits deployte Code macht
die Arbeit.

Konto: **`vinc.hafner2@gmail.com`** (Betreiber-Identität, steht auf `OPS_FOUNDER_ACCOUNTS`).
Oberfläche: **`justgoblin.com/dashboard/konsole`** — direkt eintippen, es verlinkt nichts dorthin.

---

## 0. Vorher: was gemacht sein muss

| # | Schritt | Stand |
|---|---|---|
| 1 | PR #86 gemerged, API und Web ausgerollt | **ERLEDIGT** 2026-08-13 (`5b17cb21`) |
| 2 | Migration `0102_ops_review_queue.sql` anwenden | **ERLEDIGT** (Gründer) |
| 3 | `OPS_HOSTING_ENABLED=true` in Railway | muss an sein, sonst antwortet `/api/ops` mit 404 — die Konsole sagt es dir in der Kopfzeile („Hosting-Schalter") |
| 4 | **BLOCKER — siehe §1** | offen |

> Diese Session hat **keinen Datenbank-Zugang** und hat Punkt 2 nicht selbst nachgeprüft; sie
> übernimmt die Angabe des Gründers. Falls 0102 doch fehlt, sagt es dir Schritt 3 des Fensters
> sofort und eindeutig: die Veröffentlichung endet mit „Bitte versuch es später noch einmal"
> statt mit einem Prüflisten-Eintrag, und die Prüflisten-Karte zeigt „Prüfe Migration 0102".

---

## 1. BLOCKER: die Konsole meldet eine gehaltene Veröffentlichung als „Live."

**Gefunden beim Schreiben dieses Dokuments, 2026-08-13, nicht behoben** (die Closing-Wave war
ausdrücklich docs-only). Es ist eine False-Green-Anzeige im Betreiber-Werkzeug und trifft
**genau Schritt 3 unten**.

Der Publish-Pfad ist korrekt: ein `review` lädt nichts hoch und die API antwortet
**HTTP 202** mit `{"status":"review", "message": …, "reviewId": …}`. Die **Publish-Karte der
Konsole** (`console-client.tsx`, `publish()`) prüft aber nur `response.ok` — und 202 ist ok.
Sie schreibt das Ergebnis in ihren `published`-State und rendert:

> **Live.** [leerer Link]

Also: *„Live."* für eine Veröffentlichung, die **nichts** hochgeladen hat, plus ein `<a>` mit
`href=undefined`. Der Text der ehrlichen deutschen Meldung wird verworfen.

**Was das für das Fenster heißt:** die Konsolen-Publish-Karte ist in Schritt 3 **nicht
vertrauenswürdig**. Der Hold ist trotzdem echt — der Beweis steht eine Karte tiefer in der
**Prüfliste**, und die ist korrekt. Fahre das Fenster also so:

- **Ignoriere in Schritt 3, was die Publish-Karte sagt.**
- Scrolle zur **Prüfliste**. Erscheint der Eintrag dort, ist der Hold passiert.
- Prüfe zusätzlich unter **„Gehostete Apps"**, dass **keine** App mit diesem Namen auftaucht,
  und rufe die Adresse `https://<name>.justgoblin.app` auf: sie muss **404** liefern. Das ist
  der eigentliche Beweis — er ist stärker als jede Konsolen-Anzeige, weil er das echte KV/R2
  fragt statt unsere eigene UI.

*Betroffen ist nur die Konsolen-Karte.* Das Sheet, das ein echter Bauer sieht
(`HostedPublishSheet`), behandelt 202 korrekt und zeigt die deutsche Halte-Meldung. Der Fix
ist klein (den 202-Fall in `publish()` verzweigen, wie es das Sheet tut) und gehört in die
nächste Welle — Entscheidung liegt beim Gründer.

---

## 2. Schritt 1 — eine saubere App veröffentlichen

Beweist: der gehostete Publish-Pfad funktioniert **mit** Stufe 2 dazwischen, auf echtem R2/KV.

1. Konsole öffnen, Kopfzeile prüfen: **Hosting-Schalter = an**, **Migrationen: 0099 angewendet,
   0100 angewendet**, **Router: alle vier grün**. Steht irgendwo UNBEKANNT — erst das klären.
2. Karte **„Test-App veröffentlichen"**.
3. **Projekt** wählen (die Liste zeigt nur Projekte dieses Kontos). Nimm ein schlichtes
   statisches Projekt mit einer `index.html` — kein Framework-Build, siehe die Warnung unten.
4. **Name** eintippen, z. B. `p3-clean-<datum>`. Warte auf **„Dieser Name ist frei."**
5. **„Veröffentlichen"** tippen.

**Erwartet:** die Karte zeigt **„Live."** mit einer echten URL, „Öffnen" führt zur Seite, und die
App erscheint unter **„Gehostete Apps"** mit Status **aktiv**.

> **Warum kein Framework-Build:** das Stufe-2-Budget ist **6 000 geschätzte Tokens ≈ 24 000
> Zeichen extrahierter Text**. Ein einziges gebündeltes Vite-/React-`index-*.js` überschreitet
> das um ein Vielfaches — die App wird dann **korrekt gehalten** (`over_budget`), aber du
> testest damit Schritt 3 statt Schritt 1. Das ist keine Fehlfunktion; es ist die
> Fail-closed-Regel. Als Carry-forward notiert (Bericht, Abschnitt „Carry-forward").

---

## 3. Schritt 2 — eine Stufe-2-Fixture veröffentlichen, damit sie in der Prüfliste landet

**Nimm `stage2-01-fake-giveaway`.** Warum diese: sie hat im Gate-Lauf **5/5** erreicht (die
verlässlichste der fünf), sie ist **eine Datei, 1 503 Bytes**, sie enthält **kein
Passwortfeld** und nichts, was beim Hineinkopieren unangenehm wäre, und sie ist auf den ersten
Blick als Betrug erkennbar — eine „Gewinnbenachrichtigung", die eine Versandpauschale
verlangt. Kategorie im Lauf: `deception`.

*(Nicht `stage2-04-seo-doorway` nehmen — die liegt bei 3/5 und würde in zwei von fünf Fällen
einfach durchgehen. Für eine Vorführung ist das die falsche Fixture.)*

Datei im Repo:
`apps/api/src/services/safety/__fixtures__/hosted-publish-stage2/stage2-01-fake-giveaway/index.html`

**Wie sie aus der Konsole veröffentlicht wird — ehrlich: gar nicht direkt.** Die Publish-Karte
veröffentlicht **Projekte dieses Kontos**, keine Repo-Fixtures. Der Weg ist deshalb:

1. In Goblin (normale App, nicht die Konsole) ein **neues Projekt** anlegen, z. B.
   „P3 Fixture Giveaway".
2. Den Inhalt der Fixture-Datei als **`index.html`** hineinlegen. Am iPhone am einfachsten: die
   Datei auf GitHub öffnen (Raw-Ansicht), alles kopieren, im Goblin-Editor in `index.html`
   einfügen, sichern.
3. Zurück in die **Konsole**, Karte „Test-App veröffentlichen", dieses Projekt wählen, Name
   z. B. `p3-hold-<datum>`, **„Veröffentlichen"**.

**Erwartet — und hier gilt §1:**

- Die Publish-Karte sagt fälschlich **„Live."**. **Ignorieren.**
- Karte **„Prüfliste"**: ein neuer Eintrag mit dem Wunschnamen, Pille **„STUFE 2
  (KLASSIFIZIERER)"**, Zeilen **Stufe 1 (feste Regeln): PASS**, **Kategorien: deception**,
  **Sicherheit**, **Geprüft: 1 Dateien**, **Tokens (rein/raus)**, und der Satz „Der
  Klassifizierer hat die Seite gelesen und etwas gefunden, das ein Mensch ansehen sollte."
- **„Gehostete Apps"** zeigt **keine** App mit diesem Namen.
- `https://p3-hold-<datum>.justgoblin.app` liefert **404**. ← *das ist der Beweis*
- **„Inhalt ansehen"** tippen: der Quelltext erscheint als **sichtbarer Text**, nicht als
  gerenderte Seite. Kein Skript läuft, der Seitentitel der Konsole ändert sich nicht.

---

## 4. Schritt 3 — einmal ablehnen

Am **Betrugs-Eintrag** aus Schritt 2 — das ist die richtige Entscheidung für diesen Inhalt.

1. In der Prüfliste beim Eintrag **„Freigeben / Ablehnen"** tippen.
2. Feld **„Grund"** ausfüllen, z. B. *„Fake-Gewinnspiel, verlangt Vorauszahlung — AUP Nr. 3
   (Täuschung & Betrug)."* Der Grund ist **Pflicht**: ohne ihn bleibt „Ablehnen" grau, und
   darunter steht warum. Der Nutzer bekommt diesen Satz zu lesen (ABUSE_RESPONSE §8.4).
3. **„Ablehnen"** tippen.

**Erwartet:** „Abgelehnt." plus **„Protokollzeile geschrieben."** Der Eintrag verschwindet aus
der Prüfliste. Es geht **nichts** offline, weil nie etwas online war.

---

## 5. Schritt 4 — einmal freigeben

**Nicht den Betrugs-Eintrag freigeben.** Eine Freigabe veröffentlicht sofort — du hättest damit
eine Betrugsseite unter Goblins eigener Domain live, und sei es für eine Minute. Das ist genau
das, was `ABUSE_RESPONSE` verhindern soll.

Erzeuge stattdessen einen **harmlosen** Hold und gib den frei. Zwei Wege, beide echt:

**Weg A (empfohlen, ohne Konfigurationsänderung):** veröffentliche ein Projekt mit einem
**echten Framework-Build** (oder irgendeiner Text-Datei über ~24 000 Zeichen). Es wird mit
`over_budget` gehalten — die Prüfliste zeigt dann **Kategorien: UNBEKANNT**, **Sicherheit:
UNBEKANNT**, **Tokens 0 / 0** und den Satz „Die Seite war größer als das Prüf-Budget. Sie wurde
NICHT gekürzt und beurteilt — sie wurde gar nicht beurteilt." Das ist zugleich der Beweis für
den **Fail-closed-Zweig auf echter Infrastruktur**, den sonst nichts belegt.

**Weg B:** `OPS_SCAN_CLASSIFIER_MAX_TOKENS=10` in Railway setzen, Redeploy abwarten, eine
beliebige saubere App veröffentlichen — sie wird gehalten. **Hinterher unbedingt wieder
entfernen**, sonst wird jede Veröffentlichung gehalten.

Dann:

1. Beim harmlosen Eintrag **„Freigeben / Ablehnen"** tippen.
2. Grund ist hier **optional** (steht so unter dem Feld) — trotzdem einer, z. B. *„Nur zu groß
   fürs Budget, Inhalt geprüft und harmlos."*
3. **„Freigeben"** tippen.

**Erwartet:** „Freigegeben und live." plus „Protokollzeile geschrieben.", die App erscheint
unter „Gehostete Apps", und ihre URL liefert die Seite aus. Läuft die Veröffentlichung nach der
Freigabe schief, steht dort stattdessen: „Die Freigabe steht und ist protokolliert — die
Veröffentlichung selbst ist nicht durchgelaufen." Das ist Absicht: eine menschliche
Entscheidung wird nicht gelöscht, weil ein Netzwerkaufruf fehlschlug.

> **Beim Weg A gilt:** Stufe 1 läuft bei der Freigabe **erneut und vollständig**. Eine Freigabe
> überstimmt den Klassifizierer, nicht die harten Regeln.

---

## 6. Die zwei Protokollzeilen — wo sie stehen, und wo nicht

**Die Konsole zeigt sie nicht.** Sie bestätigt nur unmittelbar nach der Aktion
„Protokollzeile geschrieben." (bzw. „Keine Protokollzeile — Migration 0100 fehlt"). Eine
Liste der Zeilen gibt es in keiner Oberfläche.

`GET /api/admin/ops/apps/:idOrName` liefert zwar `audit`, **findet diese beiden Zeilen aber
nicht**: eine Prüflisten-Entscheidung betrifft einen *Kandidaten* ohne App-ID, also tragen
`app_id`/`app_name` dort die **ID der Queue-Zeile** und den Wunschnamen — und dazu gibt es
keine `ops_apps`-Zeile, die Route antwortet 404. Ehrliche Lücke, im Carry-forward notiert.

**Also: Supabase → SQL Editor.**

```sql
select created_at, action, actor, app_name, reason, meta
from public.ops_app_audit
where action in ('review_approve', 'review_block')
order by created_at desc
limit 10;
```

**Erwartet: zwei Zeilen.** Beide mit `actor = 'vinc.hafner2@gmail.com'`, eine
`review_block` mit deinem Ablehnungsgrund, eine `review_approve`. In `meta` steht
`subject: "review_queue_item"`, die `review_id`, `stage2_reason` und die Kategorien — der
Marker, an dem man erkennt, dass `app_id` hier eine Queue-Zeile meint und keine App.

Und der Zustand der Queue selbst:

```sql
select created_at, requested_name, status, stage2_reason, categories, decided_by, decision_reason
from public.ops_review_queue order by created_at desc limit 10;
```

**Erwartet:** eine Zeile `blocked`, eine `approved`, keine `pending`.

---

## 7. Welche Zahlen dieses Fenster erzeugt — und wohin sie danach kommen

Es gibt hier **kein** JSON-Ergebnis wie in Phase 2 (das war der E2E-Runner; dieses Fenster ist
handgefahren). Die Zahlen sind Beobachtungen, und sie werden **abgeschrieben, nicht geschätzt**:

| Zahl | Woher | Wohin danach |
|---|---|---|
| saubere Veröffentlichungen live/versucht (Ziel 1/1) | Karte „Gehostete Apps" + die echte URL | Phasenbericht, Abschnitt „Gates" |
| Holds erzeugt/erwartet (Ziel 2/2) | Prüflisten-Karte | dito |
| **404 der gehaltenen Adresse** — ja/nein | Browser am iPhone | dito, **und** in die Closure-Zeile im 16-Phasen-Plan: das ist die Zahl, die „nichts hochgeladen" von *test-doubles* auf *auf echtem KV/R2 beobachtet* hebt |
| Prüflisten-Entscheidungen (Ziel 2/2: 1× approve, 1× block) | Konsole | Phasenbericht |
| Protokollzeilen (Ziel 2/2) | die SQL-Abfrage in §6 | Phasenbericht + `ABUSE_RESPONSE.md` §8.3 |
| `tokens_input` / `tokens_output` der gehaltenen Einträge | Prüflisten-Karte, Zeile „Tokens (rein/raus)" | **Ledger M-A2** — erste Produktionsmessung neben den 916/19 aus der Fixture-Batterie |
| Zeit vom Publish bis zum sichtbaren Prüflisten-Eintrag | Uhr | Phasenbericht, als **Messwert**, nie als Zusicherung |

**Und die eine Sache, die dieses Fenster ändern muss, wenn es grün ist:** die Closure-Zeile in
`docs/GOBLIN_OPS_MASTER_PLAN_16_PHASES.md` sagt heute **„GEBAUT — im Betrieb noch nicht
bewiesen"**. Nach einem grünen Fenster wird daraus, im Phase-2-Idiom, *„im Betrieb bewiesen"* —
mit Datum, Zahlen und dem Satz, was **eine** Beobachtung von **einem** Ort aus wert ist.

---

## 8. Wenn etwas schiefgeht

| Symptom | Was es heißt |
|---|---|
| Konsole ist gar nicht da (404) | Konto nicht auf `OPS_FOUNDER_ACCOUNTS`, oder `OPS_HOSTING_ENABLED` aus. Beides sieht von außen gleich aus — absichtlich. |
| „Prüfliste konnte nicht gelesen werden … Prüfe Migration 0102" | 0102 fehlt doch. Anwenden, Seite neu laden. |
| Veröffentlichung endet mit „Bitte versuch es später noch einmal" | Der Hold konnte **nicht** vorgemerkt werden (0102 fehlt oder das Insert schlug fehl). Ehrlich so gebaut: lieber das sagen, als einen Menschen zu versprechen, der nie nachsieht. |
| Jede App landet in der Prüfliste, auch die saubere | Entweder ist der Klassifizierer nicht erreichbar (`unavailable` in der Prüfliste), oder `OPS_SCAN_CLASSIFIER_MAX_TOKENS` steht noch auf einem Testwert aus Weg B. |
| „Keine Protokollzeile — Migration 0100 fehlt" | 0100 anwenden. Die Entscheidung selbst ist trotzdem passiert und steht im Anwendungs-Log. |
| Stufe 2 will gar nicht laufen | `OPS_SCAN_CLASSIFIER_ENABLED=false` gesetzt? Dann verhält sich der Publish wie in Phase 2 — deterministische Schicht allein. |

---

## 9. Danach

1. Zahlen aus §7 in `docs/AKT2_PHASE3_REPORT.md` eintragen.
2. Closure-Zeile im 16-Phasen-Plan von „gebaut" auf „bewiesen" heben — mit den Zahlen, nicht
   mit Adjektiven.
3. `ABUSE_RESPONSE.md` §8.3: die drei Phase-3-Punkte (5/6/7) stehen dort als **GEBAUT**; nach
   einem grünen Fenster sind sie **belegt**.
4. Über den Blocker aus §1 entscheiden.
5. Dann „Phase 4" an Steven — Formulare. Bereitschaftsnotiz steht im 16-Phasen-Plan unter
   PHASE 4.
