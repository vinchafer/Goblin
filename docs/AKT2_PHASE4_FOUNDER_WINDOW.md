# AKT 2 · PHASE 4 — DAS GRÜNDER-FENSTER (Formulare)

**Geschrieben: 2026-08-14 · Für: den Gründer, mit dem iPhone und der Konsole · Dauer: ~25 Minuten**

Phase 4 ist gebaut, getestet und **nicht in Betrieb bewiesen**. Alles, was echte Cloudflare- oder
Supabase-Zugangsdaten braucht, liegt außerhalb einer CC-Sitzung (Gesetz 8) — dieses Fenster ist der
Ort, an dem aus „gebaut" „läuft" wird.

> **VORBEDINGUNG, die nicht in dieser Phase entstanden ist:** das Gründer-Fenster von **Phase 3** ist
> nie gelaufen. Stufe 2 des Scans, die Prüfliste und das Publish-Sheet v2 sind deployed und
> **unbewiesen im Betrieb**. Phase 4 hängt an Schritt 3 unten von genau diesem Pfad: eine
> Formular-App wird durch denselben Scan veröffentlicht. Wenn Schritt 3 an der Prüfliste hängen
> bleibt, ist das ein **Phase-3-Befund**, kein Phase-4-Defekt — und die Konsole zeigt ihn.

---

## Vorher: eine Sache anlegen, eine Sache prüfen

### 0.1 — Eine Umgebungsvariable, die Phase 4 braucht (2 Minuten)

Die generierte App muss wissen, **wohin** sie ihre Einsendungen schickt. Die API kennt ihre eigene
öffentliche Adresse nicht von selbst.

In Railway, API-Service, Variables:

| Name | Wert | Wenn sie fehlt |
|---|---|---|
| `OPS_FORMS_ENDPOINT` | die öffentliche Basis-URL der API, **ohne** Schrägstrich am Ende (z. B. `https://api.justgoblin.com` — genau der Wert, der in Vercel als `NEXT_PUBLIC_API_URL` steht) | Der Code fällt auf `NEXT_PUBLIC_API_URL` zurück, **falls diese Variable auch in Railway gesetzt ist.** Ist sie es nicht, wird eine App mit Formular **nicht veröffentlicht** — mit einem ehrlichen deutschen Satz, nicht mit einem stillen Fehlschlag. |

**Wenn `NEXT_PUBLIC_API_URL` in Railway schon steht, ist Schritt 0.1 optional.** Sie einmal
ausdrücklich zu setzen ist trotzdem besser: dann hängt der Formularpfad nicht an einer Variablen, die
jemand für eine Web-Variable hält und aufräumt.

### 0.2 — Die beiden Turnstile-Werte prüfen (1 Minute)

Sie wurden am 2026-08-13 angelegt. Nur nachsehen, **dass die Namen da sind** — niemals den Wert
irgendwohin kopieren:

- `CF_TURNSTILE_SITE_KEY`
- `CF_TURNSTILE_SECRET_KEY`

**Fehlt das Secret, nimmt der Ingest gar nichts an** — das ist Absicht (eine Spam-Tür, die zu
aussieht, ist schlimmer als eine, die sagt, dass sie offen ist). Fehlt der Site Key, wird eine
Formular-App nicht veröffentlicht.

### 0.3 — Migrationen

**Phase 4 hat keine.** `ops_apps.d1_database_id` liegt seit `0099` nullable bereit; alles andere lebt
in der eigenen Datenbank jeder App. **`0103` bleibt unvergeben.**

Wenn `0100` (Audit-Tabelle) noch nicht angewendet ist — Carry-forward **B1** — sagt die Konsole das
von selbst. Das ist kein Phase-4-Blocker.

---

## Das Fenster

### Schritt 1 — Der Gesundheitscheck (1 Minute)

Konsole → die vorhandene Karte. Erwartet: unverändert grün. **Turnstile taucht dort absichtlich
nicht auf**: die beiden neuen Variablen stehen bewusst **nicht** in `CF_ENV_VARS`, weil diese Liste
„jede erforderliche Variable" bedeutet und eine Instanz ohne Formulare eine korrekte Instanz ist.

### Schritt 2 — Waisen-Prüfung, VOR dem ersten Formular (2 Minuten)

Konsole → **Waisen-Prüfung** → *Prüfung starten*.

Die Karte hat seit dieser Phase **zwei neue Zeilen**, und sie stehen absichtlich **oben**, weil sie
die schwersten sind:

- **Verwaiste Formular-Datenbanken** — eine Datenbank, die Goblin für eine App angelegt hat, ohne
  dass die Registry diese App noch kennt.
- **Datenbanken gelöschter Apps** — ein Abbau, der nicht fertig geworden ist.

**Heute müssen beide „keine gefunden" sagen**, weil es noch keine einzige Formular-Datenbank gibt.
Sagen sie **NICHT GEPRÜFT** (gestrichelt, farblos), fehlt dem API-Token vermutlich die
**D1-Berechtigung** — dazu Schritt 3 unten.

Das ist auch der Moment für **X1-S**, den Bestands-Sweep, der noch offen ist.

### Schritt 3 — Eine App mit Formular veröffentlichen (8 Minuten)

Mit dem **Testkonto** `vinc.hafner3@gmail.com` (nicht dem persönlichen).

Ein Projekt mit genau dieser `index.html` genügt — das Formular hat **kein** `action`, und das ist die
ganze Regel:

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

Dann: „Live stellen" → Name → veröffentlichen.

**Was dabei passieren soll, in dieser Reihenfolge:** das Formular wird verdrahtet (bevor gescannt
wird), der Scan läuft über die **fertigen** Bytes, die Registry-Zeile entsteht, **die Datenbank wird
angelegt**, dann erst Upload, Route und Verifikation.

**Wenn es hier hängt, was es bedeutet:**

| Antwort | Was los ist |
|---|---|
| `form_unwirable` (503) | Site Key oder Endpoint fehlt (Schritte 0.1 / 0.2). **Die App ist nicht live** — Absicht: ein sichtbares Formular, das nichts annimmt, wäre schlimmer. |
| `d1_unavailable` (503) | Die Datenbank ließ sich nicht anlegen. **Wahrscheinlichste Ursache: dem `CF_API_TOKEN` fehlt die D1-Berechtigung.** Cloudflare-Dashboard → API-Token → **D1:Edit** ergänzen. Zweite Möglichkeit: die zehn Free-Datenbanken sind voll — dann sagt die Meldung das. |
| 202 „wird geprüft" | Stufe 2 hat gehalten. **Ein Phase-3-Ergebnis**, kein Formular-Problem. In der Konsole → Prüfliste freigeben, dann hier weiter. |

### Schritt 4 — Absenden. Dreimal. (5 Minuten)

Die App auf dem Telefon öffnen, das Formular ausfüllen, absenden. **Dreimal, mit unterschiedlichen
Texten**, damit „3/3" wirklich drei Durchläufe sind.

Jedes Mal zu prüfen:

1. **Die Seite sagt „Danke — deine Nachricht ist angekommen."** — der Satz kommt vom Server, nicht
   von der Seite. Steht dort etwas anderes, ist es der ehrliche Grund, und er ist die Antwort.
2. **Eine E-Mail kommt an** — Betreff „Neue Einsendung — {name}", mit dem Inhalt, und mit dem Satz
   darunter, dass Goblin den Inhalt **nicht** geprüft hat.
3. **Der Posteingang zeigt sie** — im Publish-Sheet des Projekts: *Posteingang öffnen*.

**Das ist das Rundlauf-Gate: absenden → Zeile in der App-Datenbank → E-Mail → im Posteingang
sichtbar, 3/3.**

### Schritt 5 — Die unehrlichen Wege, absichtlich ausgelöst (5 Minuten)

Das ist der Teil, den man auslässt und später bereut.

**5a — Turnstile fällt aus.** In Railway `CF_TURNSTILE_SECRET_KEY` **kurz umbenennen** (z. B. ein `X`
anhängen), Deploy abwarten, absenden.
→ Erwartet: „Dieses Formular kann im Moment nichts entgegennehmen. Das liegt an uns, nicht an dir.
Deine Nachricht ist NICHT angekommen." **Niemals ein Danke.** Danach zurückbenennen.

**5b — Die Obergrenze.** 500 Einsendungen von Hand sind keine Prüfung. Stattdessen:
`CAPS_PROFILES['free-static'].monthlySubmissions` in `apps/api/src/services/ops-caps.ts` **kurzzeitig
auf 3 setzen**, deployen, ein viertes Mal absenden.
→ Erwartet: der Besucher liest „…so viele Einsendungen bekommen, wie es annehmen kann … **NICHT**
angekommen … wurde darüber informiert", **und** im Testkonto-Postfach liegt „Formular voll — {name}".
**Und die vierte Einsendung ist nirgends** — das ist der Punkt: abgelehnt, nicht weggeworfen. Danach
zurück auf 500.

**5c — Der Kill-Switch.** `OPS_FORMS_ENABLED=false` setzen, absenden → ehrliche Absage. Zurücksetzen.
Nebenbei belegt das, dass die **Seiten weiter ausgeliefert werden** — der Router weiß von Formularen
nichts.

### Schritt 6 — Löschen, und was dabei mitgeht (3 Minuten)

**6a — Eine Einsendung löschen**, dann **alle** (das verlangt die Bestätigung im Sheet). Danach ist
der Posteingang leer — und die Karte sagt „Noch keine Einsendungen", **nicht** die rote
„konnte nicht nachsehen"-Box. Die beiden sind absichtlich verschieden.

**6b — Das Projekt löschen.** Erwartet: es geht durch, und danach ist **die Datenbank weg**.

**6c — Waisen-Prüfung noch einmal.** Beide D1-Zeilen müssen „keine gefunden" sagen. Sagt eine von
ihnen etwas anderes, ist ein Abbau nicht fertig geworden — und genau dafür steht die Karte da.

### Schritt 7 — Zwei Dinge, die unberührt geblieben sein müssen (1 Minute)

- **`anmeldeformular.justgoblin.app`** im Browser öffnen. Sie muss **normal ausliefern**. Diese Phase
  hat sie nicht angefasst; `worker.js` ist unverändert, und die App hat keine Datenbank.
- **Ein normales Konto** (nicht auf der Allowlist) öffnet sein Dashboard: es sieht **nichts** von
  alledem — kein Posteingang, kein Hinweis, keine andere Antwort als vorher.

---

## Was danach zu berichten ist

Vier Zahlen und zwei Sätze reichen:

1. **Rundlauf: n/3** (absenden → Datenbank → E-Mail → Posteingang).
2. **Über der Grenze:** hat der Besucher die ehrliche Absage bekommen und der Eigentümer die Mail?
3. **Waisen-Prüfung nach dem Löschen:** was steht in den beiden D1-Zeilen?
4. **`anmeldeformular` unberührt:** ja/nein.
5. Ein Satz zu **G-P4-1** (die elfte Formular-App = $5/Monat) und einer zu **G-P4-2** (bleibt es bei
   500/Monat?) — siehe `docs/ACT2_PHASE4_DECISIONS.md`.

Dann: **„Phase 5"** an Steven — Keeper-Herzschlag, der Punkt, an dem Goblin anfängt hinzusehen.
