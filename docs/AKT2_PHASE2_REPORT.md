# AKT 2 · PHASE 2 — HOSTED PUBLISH: Phasenbericht

**Datum: 2026-07-28 · Branch `claude/akt-2-phase-2-6roa0q` · Basis `origin/master` @ `eddb6c1`**

---

## 0. STATE-FIRST — was geprüft wurde, bevor irgendetwas gebaut wurde

| Vorbedingung | Ergebnis |
|---|---|
| `origin/master` enthält PR #57, #58, #59 | ✅ `git log` bestätigt alle drei |
| PR #60 (`/acceptable-use`-Middleware-Fix) | ✅ **gemerged** (`eddb6c1`) — Fix in `apps/web/middleware.ts:72` verifiziert. Branch darauf rebased |
| Phase-1-Artefakte vorhanden | ✅ `cf-deploy.ts` (874 Z.), `ops-apps-store.ts`, `ops-beta.ts`, `ops-gate.ts`, `/api/ops/health`, `/api/ops/selftest`, Migration `0099_ops_apps.sql` |
| Rechtsdokumente live | ✅ `ACCEPTABLE_USE_POLICY.md` v1.1, ToS §7–8, Runbook Abschnitt 8 |
| Default-Branch MASTER, Branch frisch | ✅ |

### Ein Widerspruch, aufgelöst statt umgangen

Der Prompt verweist durchgehend auf **`docs/ABUSE_RUNBOOK.md`**. Diese Datei existiert
nicht. Was existiert, ist **`docs/ABUSE_RESPONSE.md`**, Titel „Missbrauchs-Runbook
(ABUSE_RESPONSE)", und deren Abschnitt 8.3 listet **exakt die vier Lücken**, die der
Prompt als load-bearing benennt. Dasselbe Artefakt, anderer Dateiname — kein
inhaltlicher Widerspruch, also **kein HALT**. Gearbeitet wurde mit der Repo-Datei; sie
ist in diesem PR aktualisiert.

---

## 1. Die Einheiten

Neun Commits, jede Einheit einzeln zurücknehmbar.

| Unit | Commit | Was |
|---|---|---|
| U2.1 | `c8e4d5f` | Router Worker + gestaltete DE/EN-Seiten (404/410/429/gesperrt) |
| U2.2 | `50f56d1` | Wildcard-DNS + Worker-Route, per API, ehrlich bei Verweigerung |
| U2.3 | `cd6f7c9` | Pre-Publish-Scan + 9/9-Fixture-Batterie |
| U2.4 | `4e4cefb` | Publish-Pfad — vorher gescannt, nachher verifiziert |
| U2.5 | `55633cb` | Sperr-Schreibpfad, Teardown, Orphan-Sweep, Audit |
| U2.6 | `49e92dc` | Tages-Budget pro App |
| U2.7 | `3413aff` | Kohorten-Schutz, aufgezählt statt gestichprobt |
| U2.8 | `f163eac` | E2E-Läufer + Gründer-Fenster |
| Abschluss | *(dieser Commit)* | Ledger M-H1, Runbook 8.3, dieser Bericht |

---

## 2. Beweise pro Gate

### Gate: U2.3-Batterie 9/9 — ein falsches „pass" auf einer feindlichen Fixture = Phase gescheitert

**✅ 9/9.** Neun eingecheckte Artefakte in
`apps/api/src/services/safety/__fixtures__/hosted-publish/`, als echte Dateien, nicht als
Strings im Test — damit ein Prüfer `benign-06` öffnen und selbst beurteilen kann, ob das
wirklich ein ehrlicher Sicherheits-Ratgeber ist.

| Fixture | Urteil | Wogegen sie zielt |
|---|---|---|
| `benign-01-portfolio` | pass | Grundfall |
| `benign-02-own-login` | pass | **Zugangsdaten-Regeln** — ein Login für die EIGENE App |
| `benign-03-newsletter` | pass | **Fremd-Domain-Regel** — Formular an Mailchimp, ohne Passwortfeld |
| `benign-04-shop-stripe` | pass | **Zahlungs-Regel** — redet über Karten, sammelt keine |
| `benign-05-spa-build` | pass | **Verschleierungs-Regeln** — echtes minifiziertes Vite-Bundle |
| `benign-06-crypto-guide` | pass | **Wallet-Regeln** — ERKLÄRT Seed Phrases, fragt nach nichts |
| `hostile-01-paypal-phish` | **block** (phishing) | fremde Marke + Zugangsdatenfeld |
| `hostile-02-wallet-drainer` | **block** (wallet) | Seed-Phrase-Eingabe + Drainer-Aufruf |
| `hostile-03-cred-exfil` | **block** (phishing) | Zugangsdaten an fremde Domain |

Die harmlose Hälfte ist die größere. Absicht: ein zu Unrecht blockierter Bauer ist unsere
eigene Ehrlichkeits-Niederlage, und jede blockierende Regel hat hier ihren Gegenbeweis.

`34/34` in `hosted-publish-scan.test.ts`, `57/57` über `src/services/safety` (K3 unverändert).

### Gate: U2.7 Ausschluss bewiesen, beide Dimensionen

**✅ 43/43** in `apps/api/src/routes/ops-cohort-protection.test.ts`. Aufgezählt, nicht
gestichprobt: **jede** der 9 Phase-2-Routen läuft durch beide Dimensionen.

- **Dimension 1 (Konto):** `vinc.hafner4@` (gültiger Login, nicht auf der Allowlist) und ein
  echter Act-1-Kohortennutzer bekommen **404 auf allen 9 Routen**.
- **Dimension 2 (Schalter):** `OPS_HOSTING_ENABLED=false` → **404 auf allen 9** auch für
  `vinc.hafner3@`, und Supabase wird **nicht einmal gefragt**, wer der Aufrufer ist.
- Verweigerte, anonyme und nie-gemountete Antwort werden **gegeneinander verglichen**:
  drei identische Bodies, drei identische Status. `/api/ops/*` ist von einem nicht
  existierenden Pfad nicht unterscheidbar.
- Jeder Cloudflare- und Storage-Aufruf ist im Test so gestubbt, dass er **wirft**. Ein Leck
  fällt laut auf, statt still durchzugehen.
- **Der Router selbst**, gegen leeres KV und leeren Bucket: 404 für jeden Hostnamen und
  jeden Pfad (`/.env`, `/admin`, `/api/users` inklusive), und **kein** Leak von „R2", „KV",
  „Cloudflare", „apps/", „route:".

### Gate: Seiten in Design-System-Qualität, DE/EN, 0 i18n-Leaks

**✅.** Vier nutzerseitige Seiten — 404, 410, 429, gesperrt — plus 405 und ein ehrliches
503 „wir wissen es gerade nicht".

- **Leak-Prüfung ist eine Zusicherung, kein Grep:** für jede Seite prüft der Test, dass die
  deutsche Fassung den englischen Satz **nicht enthält** und umgekehrt (`20` Zusicherungen).
- DE ist Standard; EN nur bei englisch-erster `Accept-Language`. Unbekannte Sprache → DE,
  nicht geraten.
- Design-Tokens aus `styles/design-tokens.css` sind im Test **festgenagelt** (`#FBF7EC`,
  `#F4ECD8`, `#0F2B1E`, `#1A3A2A`, `#D4A737`) — eine Token-Änderung im Web-App wird zum
  roten Test statt zu zwei Goblins, die leise aufhören, gleich auszusehen.
- Responsive, Dark-Mode, `noindex`, **kein** externes Script/Stylesheet/Font.

`78/78` in `worker.test.ts` — und zwar gegen **die tatsächlich deployten Bytes**: der Test
importiert `ROUTER_WORKER_SOURCE` als Modul. Ein Drift-Test hält die Konstante und
`worker.js` byte-identisch.

### Gate: Teardown lässt null Waisen

**✅ im Code, Beweis auf echter Infrastruktur steht aus.** Der Teardown **behauptet** nicht,
gelöscht zu haben — er **sieht nach**: Prefix erneut gelistet, Route erneut gelesen
(`orphansRemaining`, `routeGone`). Eine Prüfung, die selbst fehlschlägt, meldet `null`,
niemals eine saubere Bilanz, die niemand gesehen hat. `23/23` in `ops-operator.test.ts`.

### Gate: Audit-Zeilen für jede Operator-Aktion

**✅ im Code.** Jede Aktion schreibt `ops_app_audit` (Migration **0100, AUTHORED**) und
meldet das Ergebnis als `written` / `unavailable` / `failed`. Vor Anwendung der Migration
funktionieren Sperren **trotzdem** und landen im Anwendungs-Log — der Not-Aus darf nicht von
einer Migration abhängen, und er darf auch nicht behaupten, Beweise zu haben, die es nicht
gibt.

### Gate: Regression — der bestehende Vercel-Publish-Pfad unverändert

**⚠️ TEILWEISE — hier ist die Grenze ehrlich.** Statisch bewiesen, nicht als Live-Lauf.

- **Diffstat:** kein Byte in `agent/publish.ts`, `agent/tools.ts`, `routes/deploy.ts`,
  `deploy-verification.ts`, `scan-rules.ts`, `publish-scan.ts`. Der hosted Pfad
  **importiert** K3, er verändert es nicht.
- **Testsuite:** `src/services/safety` 57/57 grün, K3-Tests unverändert.
- **`apps/web` wurde nicht angefasst** — `Header.tsx` und alle Act-1-Flows sind unberührt
  (0 Dateien geändert unter `apps/web/`).
- **Was fehlt:** ein echter Vercel-Publish-Lauf auf Produktion. Der braucht das
  Gründer-Konto und ein echtes Projekt; er ist als Gründer-Aktion aufgeführt. **Ich habe
  ihn nicht ausgeführt und behaupte nicht, dass er grün ist.**

### Gate: U2.8-Zahlen vollständig

**❌ UNKNOWN — und das ist die ehrliche Antwort, keine Ausrede.**

| Zahl | Gefordert | Stand |
|---|---|---|
| Publish-Loops | 5/5 | **UNKNOWN** — braucht das Gründer-Fenster |
| Scan-Batterie | 9/9 | **9/9** ✅ (deterministisch, lokal bewiesen; der Läufer fährt dieselben 9 auf Prod) |
| Sperr-Round-Trip | 3/3 | **UNKNOWN** — braucht das Gründer-Fenster |

Die Cloudflare-Zugangsdaten liegen **ausschließlich** in Railway (`OPS_SPIKE_0` §4.4). Ich
kann keine echte App veröffentlichen, keine echte URL abrufen und keine echte Sperre
auslösen. Was ich statt einer Schätzung gebaut habe: **`POST /api/ops/e2e?confirm=RUN-E2E`**,
der den ganzen Kreis auf der echten Infrastruktur fährt und genau diese drei Zahlen
zurückgibt. Ein Befehl, in `docs/AKT2_PHASE2_FOUNDER_WINDOW.md` ausgeschrieben.

**Erfundene Zahlen wären der eine Fehler, den dieses Phasen-Design nicht überlebt.**

---

## 3. Die vier §8.3-Lücken

| # | Lücke | Stand |
|---|---|---|
| 1 | Router respektiert `suspended` nicht | **gebaut** (U2.1) — 403 + gestaltete Seite, ohne Datenbank, wirkt auch wenn die API steht |
| 2 | Kein Schreibpfad für die Sperre | **gebaut** (U2.5) — Admin-Routen mit Pflicht-Begründung + Audit |
| 3 | Kein Orphan-Sweep | **gebaut, mit Grenze** (U2.5) — Sweep + bewiesener Teardown; die Projektlöschung räumt weiterhin nicht selbst auf |
| 4 | K3-Scan nur auf dem Vercel-Pfad | **gebaut** (U2.3) — dieselben Regeln, vor dem ersten Byte, 9/9 |

**Die AUP-Zusage „automatische Prüfungen vor dem Veröffentlichen" ist ab der ersten
gehosteten Veröffentlichung wahr** — nicht erst mit Phase 3.

---

## 4. HONEST LIMITATIONS

Was **nicht** stimmt, wenn man diesen PR optimistisch liest:

1. **Nichts davon lief je auf echter Cloudflare-Infrastruktur.** Jede Zahl in diesem Bericht
   außer 9/9 kommt aus Tests mit gemocktem Cloudflare. Der Router ist gegen seine echten
   deployten Bytes getestet — aber in Node, nicht in der Workers-Runtime. Echte
   KV-Konsistenz, echtes R2-Streaming und echtes Cache-Verhalten sind **ungetestet**.
2. **Das Request-Budget ist grob und kein Rate-Limiter.** KV liest mit 60 Sekunden Cache pro
   Standort und schreibt asynchron. Unter einem Burst zählt der Zähler zu niedrig; über viele
   Standorte hinweg **deutlich** zu niedrig. Es bremst wochenlanges Ausufern, nicht eine
   Minute Flut. Präzise ginge nur mit Durable Objects — nicht auf dem Free-Plan.
3. **Eine Sperre greift innerhalb einer Minute, nicht sofort.** Derselbe KV-Lesecache. Für
   einen S0-Fall („zuerst abschalten") ist das relevant und steht deshalb im Runbook. Der
   E2E-Lauf misst die echte Zeit als `propagationSec`.
4. **Der hosted Pfad baut nicht.** Veröffentlicht werden die gespeicherten Projektdateien.
   Ein Framework-Projekt muss sein gebautes Ergebnis bereits enthalten, sonst fehlt die
   `index.html` und der Publish verweigert ehrlich. Ein Build-Schritt ist **nicht** gebaut.
5. **Die Projektlöschung hängt nicht am Teardown.** §8.3-Lücke 3 ist als *Sweep* geschlossen,
   nicht als Automatik: ein gelöschtes Projekt hinterlässt weiterhin Dateien, bis jemand
   `GET /api/admin/ops/orphans` aufruft. Das ist eine bewusste Phasengrenze — der Haken säße
   in Act-1-Code, den dieser Prompt nicht anfassen darf.
6. **Die reservierte Namensliste existiert zweimal.** Einmal in `ops-app-names.ts`, einmal im
   Worker (der nicht importieren kann). Ein Test parst die Worker-Quelle und vergleicht beide
   — die Duplizierung ist abgesichert, aber sie ist da.
7. **Migration 0100 ist AUTHORED, nicht angewendet.** Bis der Gründer sie fährt, melden
   Operator-Aktionen `audit: "unavailable"`. Sie funktionieren, aber die Beweiszeile fehlt.
8. **Die Billing-Tests sind unter Parallellast instabil.** In der Gesamtsuite fällt je nach
   Lauf **eine** Datei aus (`change-plan.test.ts` bzw. `account-deletion.test.ts`) mit einem
   Netzwerkfehler der **echten Stripe-Test-API** (`Invalid JSON received from the Stripe
   API`) — keine fehlgeschlagene Zusicherung. **Isoliert jeweils grün: 7/7 bzw. 6/6.**
   Beide haben mit dieser Phase nichts zu tun (Billing, und `goblin_hosted_waitlist` dort
   ist die Layer-2-Warteliste, nicht Act-2-Hosting) — aber sie sind rot gewesen, also
   stehen sie hier. **Gesamtlauf: 1395 bestanden, 6 übersprungen, 0 fehlgeschlagene
   Zusicherungen, `tsc` 0 Fehler.**
9. **Die WAF-Rate-Limit-Regel ist bewertet, nicht gebaut** (der Prompt fordert nur die
   Bewertung — siehe Abschnitt 6).
10. **Kein iPhone gesehen.** Die Seiten sind responsiv gebaut und getestet; auf einem echten
    Gerät hat sie niemand angesehen. Das ist eine Gründer-Aktion.

---

## 5. FINDINGS

Dinge, die beim Bauen auffielen und über diese Phase hinaus zählen:

1. **Der Kill-Switch schaltet den Router nicht ab.** `OPS_HOSTING_ENABLED=false` legt die
   API-Oberfläche still — der Router liest KV und R2 und fragt die API nie etwas.
   **Eine veröffentlichte App bleibt online, wenn der Schalter fällt.** Das ist nirgends
   falsch dokumentiert gewesen, aber es war auch nirgends ausgesprochen. Folge im Design:
   der Sperr-Pfad hängt am Admin-Key, **nicht** am Schalter — sonst würde „Act 2 dunkel
   schalten" gleichzeitig den einzigen Not-Aus entwaffnen. Steht jetzt im Runbook und im
   Gründer-Fenster.
2. **Ein `*`-DNS-Eintrag ohne orange Wolke ist der gefährlichste Zustand.** Er sieht
   konfiguriert aus, und der Worker läuft nie. Deshalb meldet `ensureWildcardDns` das als
   **Fehler** und fasst den Eintrag des Gründers nicht an.
3. **Cloudflare ersetzt Worker-Bindings beim Upload komplett.** Ein Deploy, der sie weglässt,
   nimmt dem Router still den Zugriff auf KV und R2 und macht jede App zu einer 503. Deshalb
   gehen sie bei **jedem** Upload mit. Dieselbe Logik beim KV-Record: das Budget wird bei
   jedem Route-Schreibvorgang mitgesendet, sonst löscht ein Suspend/Unsuspend still das
   Limit.
4. **Zwei Testannahmen von mir waren falsch, der Code hatte recht.** `demo` steht auf der
   reservierten Liste (die Fixture musste umbenannt werden), und der URL-Parser löst
   Punkt-Segmente auf, bevor der Worker sie sieht — der Traversal-Test prüft jetzt die
   Eigenschaft, auf die es ankommt („keine Anfrageform erreicht die Dateien einer anderen
   App"), plus einen NUL-Byte-Fall, der die Prüfung wirklich erreicht.
5. **`platform_events` taugt nicht als Audit-Trail.** Es ist metadaten-only *und* Teil der
   Konto-Lösch-Purge. Ein Beweispfad, der verschwindet, sobald das dokumentierte Konto
   gelöscht wird, ist keiner. Deshalb eine eigene Tabelle, bewusst außerhalb der Purge,
   und `app_id` **ohne** Fremdschlüssel: die Aufzeichnung einer Entfernung muss die
   Entfernung überleben.
6. **Namen können nicht recycelt werden.** Nach einer Umbenennung bleibt die alte Adresse als
   410-Grabstein und der Name aus dem Verkehr. Wer den Namen später neu vergibt, schickt
   jeden mit einem alten Lesezeichen auf fremden Inhalt — dasselbe Versagen wie die
   Phantom-Weiterleitung, die der Router verweigert.

---

## 6. Bewertung: CF-WAF-Rate-Limit als zweite Schicht (nur Bericht, wie gefordert)

**Empfehlung: ja, eine Regel, vom Gründer im Dashboard gesetzt — nicht per API in diesem PR.**

- **Was sie kann, was das KV-Budget nicht kann:** am Edge zählen, ohne KV-Konsistenz, also
  echte Bursts. Genau die Lücke aus HONEST LIMITATIONS #2.
- **Kostenlage:** Cloudflare Free enthält **eine** Rate-Limiting-Regel pro Zone. Kein neuer
  Dienst, kein Abo — bleibt innerhalb Regel 4 des Prompts.
- **Vorschlag:** Ausdruck `http.host wildcard "*.justgoblin.app"`, Zähler pro IP,
  z. B. 300 Anfragen/Minute, Aktion *Managed Challenge* (nicht Block — ein hartes Block
  träfe geteiltes NAT). Die eine Freie Regel gilt zonenweit, **nicht pro App**; die
  Pro-App-Fairness bleibt beim KV-Budget.
- **Warum nicht in diesem PR:** die Regel würde für **echten** Traffic gelten, sofort, ohne
  dass irgendjemand ihre Wirkung gemessen hat, und sie ist per Dashboard in 60 Sekunden
  gesetzt und zurückgenommen. Eine Schwelle blind per API zu schreiben wäre die Art
  Änderung, die man nicht bemerkt, bis sie echte Besucher trifft.

---

## 7. FOUNDER ACTIONS

Nach dem Merge, in dieser Reihenfolge:

1. **Migrationen anwenden:** `0099_ops_apps.sql` (falls noch offen) **und**
   `0100_ops_app_audit.sql`. Ohne 0099 **verweigert** der Publish-Pfad die Arbeit — absichtlich.
2. **Token-Rechte ergänzen** (drei neue, die Phase 1 nie brauchte): Zone→Zone Read,
   Zone→DNS Edit, Zone→Workers Routes Edit. Wenn du es überspringst, sagt dir der
   Provisioning-Lauf genau, was fehlt.
3. **Das Fenster fahren:** `docs/AKT2_PHASE2_FOUNDER_WINDOW.md`, Schritt für Schritt.
   `OPS_HOSTING_ENABLED=true` → `POST /api/ops/router/provision` → `POST /api/ops/e2e` →
   Schalter zurück. **Dauer: ~5–15 Minuten für den E2E-Lauf**, weil er auf echte
   öffentliche URLs wartet.
4. **iPhone-Bestätigung:** die Live-URL **und** die gesperrte Seite. Beides steht als
   Copy-Paste-Befehl im Fenster-Dokument.
5. **Einen echten Vercel-Publish laufen lassen** (Regressionsnachweis, siehe Gate oben —
   der eine Beweis, den ich nicht führen konnte).
6. **Falls BLOCKED-ON-DNS:** jeder fehlgeschlagene Schritt trägt sein eigenes
   `founderAction`-Feld mit der Klickfolge. Ausführen, `provision` wiederholen — der Lauf ist
   idempotent. Danach kann CC den Rest in einer Folge-Session abschließen.
7. **Die Zahlen aus dem Lauf** in Abschnitt 2 dieses Berichts eintragen (die drei UNKNOWNs).
8. **Dann „Phase 3" an Steven:** Swift-Klassifizierer, Review-Queue, Admin-Oberfläche,
   Publish-Sheet-Redesign.

**Nicht vergessen:** den Schalter zurück auf `false` — und wissen, dass das die Test-App
**nicht** offline nimmt. Dafür braucht es den Teardown (Schritt 5 im Fenster-Dokument).

---

## 8. Was dieser PR ausdrücklich NICHT tut

Kein Swift-Klassifizierer · keine Review-Queue · keine Admin-Review-Oberfläche · kein
Publish-Sheet-Redesign (alles Phase 3) · kein Plan-Upgrade · keine Act-1-Änderung ·
`Header.tsx` nicht angefasst · `apps/web` gar nicht angefasst · nichts gemerged ·
keine Migration angewendet · keine Produktions-Flags umgelegt.
