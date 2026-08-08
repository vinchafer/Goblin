# AKT 2 · PHASE 2.5 — die Gründer-Konsole

**Stand: 2026-07-29 · gehört zu PR „AKT 2 · Phase 2.5 — Founder Ops Console".**

Phase 2 hat eine funktionierende Hosting-Ebene geliefert. Jede Betreiber-Handlung
brauchte danach aber ein Terminal, ein von Hand kopiertes Bearer-Token und einen
Admin-Key — also einen Laptop. Der Gründer arbeitet vom iPhone. Das Phase-2-Fenster
hing damit am Werkzeug, nicht am Produkt.

Diese Phase entfernt das dauerhaft: eine Konsole in der Web-App, in der **die
bestehende Browser-Sitzung die Authentifizierung IST**.

> **Produkt-Resonanz.** Goblins These ist, dass echte Software vom Telefon aus
> gebaut und betrieben werden kann. Dass der Gründer Goblin selbst vom Telefon aus
> betreibt, ist diese These auf sich selbst angewendet.

---

## 0. Wer der Betreiber ist (Gründer-Entscheidung, 2026-08-08)

> **Wörtlich, wie festgelegt:**
>
> „Act-2 operator identity is vinc.hafner2@gmail.com (the founder's working
> account, also used for /admin). vinc.hafner3@gmail.com remains CC's test account
> for publish and E2E runs; CC must never use vinc.hafner2@. The methodology rule
> ‚test accounts only' governs what CC uses, not which human identity holds
> operator authority."

| Konto | Rolle | Wer benutzt es |
|---|---|---|
| `vinc.hafner2@gmail.com` | **Betreiber-Identität für Akt 2.** Steht auf `OPS_FOUNDER_ACCOUNTS`. Auch das `/admin`-Konto. | **Nur der Gründer.** CC niemals. |
| `vinc.hafner3@gmail.com` | CC-Testkonto für Publish- und E2E-Läufe. Fallback `…4@`. | CC |

Die beiden Regeln stehen **nicht** im Widerspruch, auch wenn sie sich lange so
gelesen haben: „nur Testaccounts" regelt, **womit CC arbeitet**. Es regelt nicht,
**welche menschliche Identität die Betreiber-Vollmacht hält**. Die Vollmacht liegt
beim Gründer, und der Gründer arbeitet mit `…2@`.

---

## 1. Die URL

```
https://justgoblin.com/dashboard/konsole
```

Erreichbar **nur durch Eintippen**. Es gibt keinen Navigationspunkt, keinen Link,
keine Erwähnung irgendwo in der App. `Header.tsx` und `Sidebar.tsx` sind nicht
angefasst.

---

## 2. Was der Gründer tun muss

### 2.1 Railway-Variable setzen

```
OPS_FOUNDER_ACCOUNTS = vinc.hafner2@gmail.com
```

Kurz warten, bis der Redeploy durch ist.

> **Das ist `…2@`, nicht `…3@`.** Diese Datei nannte bis 2026-08-08 das
> CC-Testkonto `vinc.hafner3@gmail.com` — die Konsole wurde dadurch für ein Konto
> scharfgeschaltet, mit dem der Gründer sich nie anmeldet, und antwortete ihm
> deshalb mit derselben 404 wie einem Fremden. Siehe §0 für die Identitätsregel.

> **Solange die Variable NICHT gesetzt ist, ist die Konsole für alle unerreichbar —
> auch für den Gründer.** Die Route antwortet dann mit exakt derselben 404 wie ein
> Pfad, den es nie gab. Das ist die Voreinstellung und der sichere Zustand.

Die Liste ist kommagetrennt und **unabhängig** von `OPS_BETA_ACCOUNTS` und von
`OPS_HOSTING_ENABLED`. Das ist Absicht und wurde erneut geprüft: `OPS_HOSTING_ENABLED`
ist der Weg, Akt 2 dunkel zu schalten — aber der Router bedient sich aus KV und R2
und fragt die API nie. Dunkelschalten stoppt also **keine** laufende App; nur die
Sperre tut das. Hinge die Betreiber-Vollmacht am selben Schalter, würde ein Umlegen
mitten in einem Vorfall genau das Werkzeug entwaffnen, das man dann braucht.

### 2.2 PR mergen

Über die GitHub-App. Diese Session merged nicht.

### 2.3 Die Konsole öffnen und das Phase-2-Fenster von dort fahren

Am iPhone, eingeloggt als `vinc.hafner2@gmail.com` (dem Betreiber-Konto — siehe §0):

1. **Router ausrollen** — idempotent. Schlägt ein Schritt fehl, steht die genaue
   Klickfolge fürs Cloudflare-Dashboard wörtlich in einem kopierbaren Block.
2. **E2E starten** — läuft 5–15 Minuten im Hintergrund. Die Schrittliste füllt sich
   mit echten Ergebnissen, nicht mit einem Fortschrittsbalken.
3. **Test-App veröffentlichen** → **öffnen** → **sperren** → **entsperren**.
   Nach Sperren und Entsperren misst die Karte, nach wie vielen Sekunden die
   Änderung öffentlich tatsächlich sichtbar war.
4. **Teardown** (später) — zwei Bestätigungen, App-Name muss getippt werden.

### 2.4 Ergebnis kopieren

Ein Knopf legt das Ergebnis als JSON in die Zwischenablage, bereinigt von
E-Mail-Adressen und allem, was nach einem Schlüssel aussieht, plus eine deutsche
Zusammenfassungszeile. Das geht an Steven für den Phasenbericht.

---

## 3. Was die Konsole kann

| Karte | Ruft auf | Anmerkung |
|---|---|---|
| Zustand | `GET /api/ops-console/status` | Hosting-Schalter · Router (Worker, Zone, **Wildcard proxied**, Route) · 0099/0100 · Zeitstempel |
| Router ausrollen | `POST /api/ops/router/provision` | bestehender Endpunkt, unverändert |
| Test-App veröffentlichen | `GET /api/ops/apps/name-check`, `POST /api/ops/apps/publish` | Projektauswahl nur aus dem eigenen Konto |
| Gehostete Apps | `GET /api/ops-console/apps` + `/api/admin/ops/…` | Sperren · Entsperren · Teardown |
| Propagations-Messung | `GET /api/ops-console/probe?name=…` | misst, statt anzunehmen |
| E2E | `POST /api/ops-console/e2e/start`, `GET /api/ops-console/e2e/status/:id` | treibt `runOpsE2E`, implementiert nichts nach |
| Ergebnis kopieren | — | bereinigtes JSON + Zusammenfassung |

### Warum ein eigener Mount `/api/ops-console`

`/api/ops` hängt hinter `opsGate`, das `OPS_HOSTING_ENABLED` mit-UNDet. Die Aufgabe
der Konsole ist aber, dem Betreiber zu **sagen**, in welchem Zustand die Ebene ist —
und „Hosting ist aus" ist eine der Antworten, die sie geben können muss. Hinter
`opsGate` wäre diese Antwort eine 404 gewesen, und der Gründer hätte zwischen kaputter
Konsole, abgelaufener Sitzung und umgelegtem Schalter raten müssen.

### Warum die Propagation serverseitig gemessen wird

Ein Browser kann es nicht: ein Cross-Origin-`fetch` auf `*.justgoblin.app` darf den
Statuscode nicht lesen, und `mode:'no-cors'` liefert eine undurchsichtige Antwort.
Also schaut die API nach und meldet, was sie gesehen hat; die Konsole zählt die
verstrichene Zeit über echte Antworten. Der Endpunkt nimmt einen **Namen**, nie eine
URL — eine Route, die eine vom Aufrufer gelieferte URL abruft, wäre ein SSRF-Loch,
egal welches Gate davor sitzt.

---

## 4. Der zweite Autorisierungspfad (Rule 6)

`/api/admin/ops/*` (Sperren, Entsperren, Teardown, Waisen) hat jetzt **zwei** Wege
hinein:

1. **`x-admin-key`** — unverändert. Zuerst geprüft, gleicher Header, gleicher
   Vergleich, gleicher 401-Körper, gleicher selbst angegebener Aktor mit dem
   gleichen ehrlichen Rückfall `admin-key-holder`.
2. **Eine Gründer-Sitzung** — ein normales Bearer-Token, dessen Konto-E-Mail auf
   `OPS_FOUNDER_ACCOUNTS` steht.

Auf dem Gründer-Pfad ist der Aktor die **verifizierte** E-Mail. Weder das Feld
`actor` im Körper noch der Header `x-admin-actor` können sie überschreiben; beide
Fälschungsversuche sind getestet. Der Aktor landet unverändert in der 0100-Zeile
(Route → `ops-operator` → `writeOpsAudit`).

Die Absage bleibt `401 {"error":"Unauthorized"}` — **nicht** die 404 der Ops-Ebene.
Diese Oberfläche antwortet seit vor Akt 2 mit 401 und muss weiter wie der Rest von
`/api/admin` aussehen.

> Nebenbei: CORS auf der API erlaubt `Authorization`, aber nicht `x-admin-key`. Ein
> Browser hätte den Key-Pfad also ohnehin nie benutzen können.

---

## 5. Ehrlichkeit, eingebaut statt versprochen

- **UNBEKANNT ist ein Wert.** Jede Prüfung ist dreiwertig; `null` kommt als `null`
  an und wird als eigenes, gestricheltes, farbloses Feld gezeigt. Es gibt keinen
  Zweig, der aus einem `null` ein Grün macht.
- **Keine erfundenen Fortschritte.** Kein Timer treibt irgendetwas. Es gibt bewusst
  keinen Prozentbalken: wie viele Schritte ein Lauf hat, steht erst am Ende fest —
  ein blockierter Preflight endet nach zweien.
- **Keine Geister-Knöpfe.** Ein Knopf, der nicht funktionieren kann, ist deaktiviert
  **und** trägt den Grund als Satz daneben (kein Tooltip — auf dem Telefon gibt es
  kein Hover).
- **Kein Stacktrace.** Jeder Fehler wird ein deutscher Satz plus ein kopierbarer
  Detailblock.
- **Der Job ist ehrlich über seinen Speicher.** Der Fortschritt liegt im
  Arbeitsspeicher der API. Eine unbekannte Job-ID antwortet „unbekannt" — nie
  „fehlgeschlagen", nie „fertig" — und sagt dazu, dass ein Redeploy die **Ansicht**
  verliert, während der Lauf selbst weitergelaufen sein kann.

---

## 6. Belege

| Gate | Ergebnis |
|---|---|
| U-C1, vier Gate-Fälle | 27/27 grün (`ops-founder` 10, `ops-founder-gate` 17) |
| Admin-Doppelpfad inkl. Regression auf `x-admin-key` | 21/21 grün |
| Konsolen-Routen + Job-Lebenszyklus + Probe | 37/37 grün |
| `onStep`-Beobachter am **echten** Runner | 4/4 grün |
| DE/EN-Parität + Copy-Out | 16/16 grün, 0 fehlende Schlüssel in beide Richtungen |
| API-Gesamtsuite | **1512/1512** in 142 Dateien |
| Web-Gesamtsuite | **156/156** in 19 Dateien |
| `tsc --noEmit` (API und Web) | 0 Fehler |
| ESLint auf dem neuen Code | 0 Fehler, 0 Warnungen |
| 390×844-Rendering | 4 Aufnahmen, alle Gates grün — `evidence/akt2-phase2.5-konsole/` |
| Kein Navigationslink | Grep: 0 Treffer außerhalb des eigenen Verzeichnisses |

Die Rendering-Belege entstehen mit `node scripts/akt2-konsole-shots.mjs`. Der Harness
bündelt die **echte** Komponente mit den **echten** Stylesheets und misst im Browser:
kein horizontaler Scroll (`scrollWidth ≤ 390`), nichts abgeschnitten, jedes
Bedienelement ≥ 44 px, und im degradierten Szenario mindestens fünf UNBEKANNT-Felder
bei null grünen. Das unterscheidet ihn von den älteren Harnessen unter `scripts/`,
die HTML von Hand nachbauen: ein Nachbau kann korrekt aussehen, während die
Komponente es nicht ist.

---

## 7. FOUNDER-PENDING — was hier nicht bewiesen werden konnte

Die Sandbox kann sich nicht anmelden und hat keinen Zugang zu Supabase, Cloudflare
oder Railway. Ehrlich offen bleibt daher:

1. **Dass das Gate auf Produktion den Gründer einlässt.** Getestet ist die Logik
   gegen eine gemockte Supabase-Auth. Der erste echte Aufruf ist der Beweis.
2. **Dass die Konsole in der laufenden App wie in den Aufnahmen aussieht.** Der
   Harness rendert die echte Komponente mit den echten Stylesheets, aber ohne den
   `DashboardShell` darum herum und ohne die `next/font`-Schriften — er setzt Manrope
   direkt.
3. **Dass die Aufrufe an `/api/ops/*` und `/api/admin/ops/*` aus dem Browser
   durchgehen.** CORS ist gelesen, nicht ausgeführt.
4. **Alle Zahlen des E2E-Laufs.** Sie entstehen erst, wenn der Gründer ihn startet.
5. **Migration 0100.** Weiter offen; die Konsole zeigt sie als „nicht angewendet"
   und sagt, was das für Protokollzeilen bedeutet.
