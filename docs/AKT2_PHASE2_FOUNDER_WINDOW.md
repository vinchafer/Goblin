# AKT 2 · PHASE 2 — die Gründer-Fenster (U2.2 + U2.8)

**Stand: 2026-07-28 · gehört zu PR „AKT 2 · Phase 2 — Hosted Publish".**

Zwei Dinge kann eine CC-Session nicht selbst tun, und beide stehen hier als exakte
Befehlsfolge: das **Bereitstellen des Routers** (U2.2 — schreibt DNS und eine
Worker-Route) und der **Ende-zu-Ende-Lauf auf Produktion** (U2.8).

Der Grund ist derselbe wie in Phase 1 (`OPS_SPIKE_0` §4.4): **die Cloudflare-
Zugangsdaten liegen ausschließlich in der Railway-Umgebung.** Eine Cloud-CC-Session
ist kein Tresor. Deshalb löst der Gründer *eine* autorisierte Anfrage aus, und der
bereits deployte Code macht die Arbeit — kein Mensch und keine Session fasst je ein
Token an.

---

## 0. Vorher: was gemacht sein muss

| # | Schritt | Warum |
|---|---|---|
| 1 | **PR mergen** | Der Router-Code muss deployt sein, bevor er sich selbst ausrollen kann. |
| 2 | **Migration `0099_ops_apps.sql` anwenden** (falls noch nicht) | Ohne die Registry **verweigert** der Publish-Pfad die Arbeit — absichtlich: hochgeladene Dateien ohne Registry-Zeile wären genau das Waisenkind aus `ABUSE_RESPONSE` §8.3. |
| 3 | **Migration `0100_ops_app_audit.sql` anwenden** | Ohne sie funktionieren Sperren trotzdem, aber der Lauf meldet `audit: "unavailable"` statt Beweiszeilen. |
| 4 | Warten, bis Railway das Deployment ausgerollt hat | Sonst testest du den alten Stand. |

Migrationen: Supabase → SQL Editor → Datei-Inhalt einfügen → Run. Beide sind
additiv und idempotent (`IF NOT EXISTS` durchgehend) und fassen keine bestehende
Tabelle an.

---

## 1. Vorbereitung: Token-Rechte prüfen

Phase 2 braucht **drei Berechtigungen, die Phase 1 nie benutzt hat**. Wenn sie
fehlen, sagt dir der Provisioning-Lauf in Schritt 3 genau das — du kannst also auch
direkt weitermachen und erst reagieren, wenn er es meldet.

Cloudflare Dashboard → My Profile → API Tokens → das Goblin-Token bearbeiten:

- Account → Workers Scripts → **Edit**  *(hatte Phase 1 schon)*
- Account → Workers KV Storage → **Edit**  *(hatte Phase 1 schon)*
- Zone → Zone → **Read**  *(neu)*
- Zone → DNS → **Edit**  *(neu)*
- Zone → Workers Routes → **Edit**  *(neu)*

Zonen-Bereich: `justgoblin.app`.

---

## 2. Das Fenster öffnen

Railway → Variables:

```
OPS_HOSTING_ENABLED = true
```

Kurz warten, bis der Redeploy durch ist.

> Ab jetzt ist die Ops-Ebene **für das Konto `vinc.hafner3@gmail.com` erreichbar** —
> und für sonst niemanden. Das ist bewiesen (U2.7), nicht gehofft.

Du brauchst ein **Bearer-Token** dieses Kontos. Am einfachsten: im eingeloggten
Browser die DevTools → Application → Local Storage → der Supabase-Session-Eintrag →
`access_token`.

```bash
export API=https://api.justgoblin.com          # falls die API-Domain anders heißt: anpassen
export TOKEN="<access_token von vinc.hafner3@>"
export ADMIN_KEY="<ADMIN_API_KEY aus Railway>"
```

---

## 3. U2.2 — den Router ausrollen

Erst ansehen, ohne etwas zu ändern:

```bash
curl -s "$API/api/ops/router" -H "Authorization: Bearer $TOKEN" | jq
```

Dann ausrollen (idempotent — mehrfach ausführen ist ausdrücklich in Ordnung):

```bash
curl -s -X POST "$API/api/ops/router/provision" \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Was du liest:**

- `"provisioned": true` → alle vier Schritte grün: Worker hochgeladen (mit KV- und
  R2-Bindings), Zone gefunden, `*.justgoblin.app` proxied, Route gesetzt. Weiter zu 4.
- `"blockedOnDns": true` → mindestens ein Schritt hat nicht funktioniert. **Jeder
  fehlgeschlagene Schritt trägt sein eigenes `founderAction`-Feld** mit der genauen
  Klickfolge im Dashboard. Ausführen, dann den `provision`-Aufruf wiederholen.

Der eine Fall, der wie Erfolg aussieht und keiner ist: ein `*`-Eintrag, der
**existiert, aber nicht proxied** (graue Wolke) ist. Dann läuft der Worker nie. Der
Lauf meldet das als `fail` und rührt deinen Eintrag nicht an — die orange Wolke
setzt du selbst.

**Gegenprobe im Browser (30 Sekunden):**

```bash
curl -sI https://gibtesnichtxyz.justgoblin.app/     # erwartet: 404
curl -sI https://justgoblin.app/                    # erwartet: 302 → justgoblin.com
```

Die 404-Seite ist eine **gestaltete deutsche Seite** („Hier wohnt keine App."), kein
Cloudflare-Fehler. Wenn du eine Cloudflare-Fehlerseite siehst, ist die Route nicht
gesetzt.

---

## 4. U2.8 — der Ende-zu-Ende-Lauf

**Ein Befehl.** Er dauert je nach KV-Propagation **etwa 5–15 Minuten** — er wartet
absichtlich auf die echten öffentlichen URLs, statt sich auf interne Zusicherungen
zu verlassen.

```bash
curl -s -X POST "$API/api/ops/e2e?confirm=RUN-E2E" \
  -H "Authorization: Bearer $TOKEN" \
  --max-time 1800 | tee /tmp/goblin-e2e.json | jq
```

Was er auf der echten Infrastruktur macht:

1. **Preflight** — ist der Router überhaupt erreichbar?
2. **Scan-Batterie** — dieselben 9 eingecheckten Fixtures, auf Produktion
3. **5× publish → verify** — jeweils bis zur öffentlichen URL, Assets byte-genau
4. **rename** — neue Adresse liefert aus, **alte Adresse antwortet 410** (keine Weiterleitung)
5. **hostile** — eine feindliche Fixture wird abgelehnt und lädt **nichts** hoch
6. **suspend → gesperrte Seite live → unsuspend**
7. **teardown** — null Reste, 404, und der Lauf räumt seine eigenen KV-Schlüssel weg

**Die Zahlen, auf die es ankommt** (`.numbers` im Ergebnis):

```json
{ "publishLoops": "5/5", "scanBattery": "9/9", "suspensionRoundTrip": "3/3" }
```

`"passed": true` heißt: jeder einzelne Schritt war grün. Jeder Schritt trägt sein
eigenes `detail`, und die URL-Schritte tragen `propagationSec` — **wie lange die
Änderung wirklich gebraucht hat, bis sie öffentlich sichtbar war.** Diese Zahl ist
die ehrliche Antwort auf „wie schnell ist der Not-Aus" und gehört ins Runbook.

Die Namen sind immer `e2e-<zufall>`, `project_id` ist `null`. Der Lauf **kann** keine
echte App anfassen.

---

## 5. Bestätigung am iPhone

Während der Lauf läuft (oder direkt danach, mit einer eigenen Test-App), am Handy:

```bash
# Eine App, die stehen bleibt, statt sich selbst wieder abzuräumen:
curl -s -X POST "$API/api/ops/apps/publish" \
  -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"projectId":"<eine deiner Projekt-IDs>","name":"vinc-test"}' | jq
```

Am iPhone öffnen: **`https://vinc-test.justgoblin.app`**

Dann sperren und die gesperrte Seite ansehen:

```bash
curl -s -X POST "$API/api/admin/ops/apps/vinc-test/suspend" \
  -H "x-admin-key: $ADMIN_KEY" -H "content-type: application/json" \
  -H "x-admin-actor: vinc.hafner3@gmail.com" \
  -d '{"reason":"Test der Sperre am iPhone"}' | jq
```

Seite neu laden (ggf. bis zu **60 Sekunden** warten — KV-Lesecache):
Du solltest **„Diese App wurde vorübergehend gesperrt."** sehen, mit Link auf die
Nutzungsrichtlinie. Auf Englisch, wenn dein iPhone auf Englisch steht.

Wieder freigeben und aufräumen:

```bash
curl -s -X POST "$API/api/admin/ops/apps/vinc-test/unsuspend" \
  -H "x-admin-key: $ADMIN_KEY" -H "content-type: application/json" \
  -d '{"reason":"Test beendet"}' | jq

curl -s -X DELETE "$API/api/admin/ops/apps/vinc-test" \
  -H "x-admin-key: $ADMIN_KEY" -H "content-type: application/json" \
  -d '{"reason":"Test beendet — Aufräumen"}' | jq
```

Beim Teardown ist `"orphansRemaining": 0` und `"routeGone": true` **der Beweis** —
nicht die Behauptung, dass gelöscht wurde, sondern das Ergebnis des Nachsehens.

---

## 6. Das Fenster schließen

Railway → Variables:

```
OPS_HOSTING_ENABLED = false
```

**Wichtig und beabsichtigt:** Der Kill-Switch schaltet die **API-Oberfläche** ab. Er
schaltet **nicht** den Router ab — der liest KV und R2 und fragt die API nie etwas.

- Eine veröffentlichte App **bleibt online**, wenn du den Schalter umlegst.
- Der Not-Aus pro App (`/api/admin/ops/.../suspend`) **funktioniert weiter**, weil er
  am Admin-Key hängt und nicht an diesem Schalter. Genau so soll es sein: Act 2 dunkel
  zu schalten darf nicht gleichzeitig die einzige Sperre entwaffnen.

Wenn du willst, dass nach dem Fenster **nichts** mehr erreichbar ist, muss die
Test-App per Teardown weg (Schritt 5) — das Umlegen des Schalters reicht dafür nicht.

---

## 7. Wenn etwas schiefgeht

| Symptom | Bedeutung | Nächster Schritt |
|---|---|---|
| `provision` meldet `auth` | Dem Token fehlt ein Recht | `founderAction` im Ergebnis lesen — die Liste steht dort |
| `404` von `/api/ops/...` | `OPS_HOSTING_ENABLED` ist nicht `true`, oder das Token gehört nicht zu `vinc.hafner3@` | Variable prüfen, Redeploy abwarten |
| E2E: `preflight:router` rot | DNS/Route fehlen | Schritt 3 — der Lauf überspringt dann bewusst alle URL-Schritte |
| E2E: `registry_unavailable` | Migration 0099 fehlt | Anwenden, Lauf wiederholen |
| E2E: `audit: "unavailable"` | Migration 0100 fehlt | Anwenden. Sperren funktionieren trotzdem, nur ohne Beweiszeile |
| Cloudflare-Fehlerseite statt Goblin-Seite | Die Worker-Route greift nicht | `GET /api/ops/router` — `routeBound` und `wildcardProxied` ansehen |
| Gesperrte App liefert noch aus | KV-Lesecache | Bis zu 60 Sekunden warten. Bleibt es länger, `route` im Sperr-Ergebnis prüfen |

---

## 8. Danach

- Die Zahlen aus `/tmp/goblin-e2e.json` in den Phasenbericht eintragen.
- `ABUSE_RESPONSE.md` §8.3: die vier Phase-2-Anforderungen sind im Code erledigt —
  nach einem grünen Lauf sind sie auch **belegt**.
- Dann „Phase 3" an Steven: Swift-Klassifizierer, Review-Queue, Admin-Oberfläche,
  Publish-Sheet.
