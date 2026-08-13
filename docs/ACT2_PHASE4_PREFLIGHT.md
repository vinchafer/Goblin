# AKT 2 · PHASE 4 (DATA-1F, FORMULARE) — PREFLIGHT

**Geschrieben: 2026-08-13 · Autor: CC · Geprüft gegen master `418e43f`**

Die Bereitschaftsnotiz am Ende von Phase 3 (`GOBLIN_OPS_MASTER_PLAN_16_PHASES.md`, Phase 4) sagt,
was Phase 4 braucht. Dieses Dokument prüft sie **noch einmal gegen den Code, wie er heute steht**,
und wird konkret, wo sie es nicht war: exakte Variablennamen, der exakte Dashboard-Pfad, die exakten
Stellen im Code.

**Es ist kein Entwurf.** Es entscheidet nichts und baut nichts. Es ist die Liste, aus der der
Phase-4-Prompt geschrieben wird, damit dessen STATE-CHECK nicht bei null anfängt.

**Ergebnis in einem Satz:** die Bereitschaftsnotiz hält der Nachprüfung stand, mit **einer**
Ungenauigkeit meinerseits (§5) — aber die Prüfung hat **einen echten, heute offenen Defekt**
gefunden, der nichts mit Phase 4 zu tun hat und vor Phase 4 gehört (§1).

---

## 1. HALT-Kandidat: eine gelöschte App bleibt live

**Das ist kein Phase-4-Punkt. Es ist heute wahr, auf Produktion, und es ist das Einzige in diesem
Dokument, das ich als dringend bezeichnen würde.**

`supabase/migrations/0099_ops_apps.sql:32-38` trägt eine Warnung, die als **PHASE-2-OBLIGATION**
formuliert ist:

> ⚠ PHASE-2 OBLIGATION: the cascade deletes the ROW, not the hosted content. Whoever builds project
> deletion in the ops world must delete the R2 prefix and the KV route FIRST (cf-deploy
> `deleteAppFiles` + `deleteRoute`) — otherwise a deleted project leaves a live app nobody can find.

**Diese Obligation ist nicht erfüllt.** Nachgeprüft, nicht erinnert:

- `apps/api/src/routes/projects.ts:400` (`DELETE /projects/:id`) räumt **Vercel** ab
  (`teardownVercelProject`), **Storage** (`deleteProject`) und die **Checkpoint-Blobs**
  (`purgeProjectCheckpoints`). Zu `ops_apps`, R2 oder KV steht dort **nichts** — die Datei enthält
  keinen einzigen dieser Bezeichner.
- `apps/api/src/services/account-deletion.ts` enthält ebenfalls **keinen** Ops-Bezug.
- `deleteAppFiles` / `deleteRoute` werden nur an zwei Stellen benutzt: als Rollback im Publish-Pfad
  (`ops-publish.ts`) und im Selftest. Kein Löschpfad ruft sie.
- `ops_apps.project_id` ist `on delete cascade` (0099:39). Die Registry-Zeile verschwindet also
  garantiert.

**Was daraus folgt.** Löscht heute ein Beta-Konto sein Projekt, dann verschwindet die
`ops_apps`-Zeile, während der KV-Route-Record und das R2-Präfix stehen bleiben. Die App bleibt unter
`{name}.justgoblin.app` **erreichbar** — und die Betreiber-Konsole findet sie nicht mehr, weil jede
Betreiber-Handlung über `ops_apps` geht. Das ist genau das Waisenkind, vor dem `ABUSE_RESPONSE` §8.3
warnt, und es ist die eine Klasse von Fehler, die dieses Projekt sich nicht leisten kann: **Inhalt,
der auf Goblins Domain liegt und den Goblin nicht mehr herunternehmen kann, ohne von Hand in
Cloudflare zu greifen.**

**Wie schlimm.** Der Radius ist heute klein — die Allowlist, und soweit bekannt genau eine echte
gehostete App (`anmeldeformular.justgoblin.app`, die der Gründer online hält). Ein Missbrauchsfall
mit anschließendem Projektlöschen ist trotzdem der billigste Weg, eine unlöschbare Seite auf
`justgoblin.app` zu bekommen — und der Weg steht offen, ohne dass man ihn kennen müsste.

**Bewusst nicht hier repariert.** Diese Kehrarbeit ist ausdrücklich docs-only und ändert kein
Verhalten. Es ist ein eigener Fix mit eigenen Tests und einem eigenen Commit, und der Gründer
sequenziert ihn.

**Der Umriss, damit der Prompt nicht neu hergeleitet werden muss.**
1. Vor dem `projects.delete` in `projects.ts`: `ops_apps`-Zeilen für dieses Projekt lesen, für jede
   `deleteRoute(name)` und `deleteAppFiles(appId)` aufrufen, **dann erst** löschen — dieselbe
   Reihenfolge und dieselbe Best-effort-Regel wie beim Vercel-Teardown darüber, also ein
   Teardown-Fehler blockiert das Löschen nicht, sondern kommt als `orphanUrl` zurück.
2. Dasselbe in `account-deletion.ts`, sonst hat die Kontolöschung dieselbe Lücke.
3. Der Code muss tolerant bleiben, wenn `ops_apps` nicht existiert — dieselbe Feature-Erkennung, die
   der Rest von Akt 2 benutzt (`opsAppsAvailable`).
4. Regressionstest: Projekt mit gehosteter App löschen ⇒ `deleteRoute` und `deleteAppFiles` wurden
   aufgerufen, **bevor** die Zeile weg war.

---

## 2. Turnstile — was der Gründer holen muss, und wo genau

Turnstile kommt **in keiner Codezeile** dieses Repos vor. Nachgeprüft: eine Suche ohne
Groß-/Kleinschreibung über `apps/`, `packages/` und `workers/` liefert **null** Treffer. Es ist auch
keine Variable dafür reserviert — weder in `apps/api/.env.example` noch in `CF_ENV_VARS`.

**Dashboard-Pfad (Cloudflare):** `dash.cloudflare.com` → Konto auswählen → linke Seitenleiste
**Turnstile** → **Add widget**.

| Feld | Wert | Begründung |
|---|---|---|
| Widget name | z. B. `goblin-living-apps` | frei wählbar, taucht nur im Dashboard auf |
| Hostnames | **`justgoblin.app`** — ein einziger Eintrag | Wildcards sind **nicht** erlaubt (`*` wird abgelehnt), aber *„When you add a hostname, the widget will work on that exact hostname and all of its subdomains."* Ein Eintrag deckt also jede Living App ab. Beleg: `OPS_SPIKE_0_DECISION_TABLE.md` §1.2, Zeile „Turnstile" |
| | ggf. zusätzlich `justgoblin.com` | nur nötig, wenn Turnstile auch auf der Plattformseite eingesetzt wird (z. B. `/missbrauch-melden`, siehe §6). Das Limit sind 10 Hostnames pro Widget |
| Widget mode | Managed | Voreinstellung |

**Das Widget liefert zwei Werte**, und sie sind **nicht** austauschbar:

| Cloudflare nennt es | Gehört wohin | Vorgeschlagener Variablenname | Warum |
|---|---|---|---|
| **Site Key** | in das **HTML der Nutzer-App** — also öffentlich, im Klartext ausgeliefert | `TURNSTILE_SITE_KEY` in der Railway-**API**-Umgebung | Es ist ein öffentlicher Wert, aber er kommt **nicht** über `NEXT_PUBLIC_*` in die Web-App: eingebaut wird er in die **generierte App**, und die entsteht in der API. Er gehört dahin, wo das Formular-Snippet gebaut wird (Unit 4.5), nicht in das Next.js-Bundle. Falls die Web-App ihn je selbst braucht, dann zusätzlich als `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — nie stattdessen. |
| **Secret Key** | zur **Verifikation**, serverseitig | `TURNSTILE_SECRET_KEY` in der Railway-**API**-Umgebung | Echtes Geheimnis. Es darf in keinem Bundle, keinem Log und in keiner Antwort landen. Es gehört in `SECRET_ENV_VARS` in `cf-deploy.ts` (bzw. in dessen Äquivalent für den neuen Pfad), damit der Redaktions-Mechanismus, den Akt 2 schon hat, es automatisch aus jeder ausgehenden Zeichenkette streicht. |

**Eine Falle, die man vorher wissen sollte.** Verifiziert wird gegen
`https://challenges.cloudflare.com/turnstile/v0/siteverify` — **serverseitig**. Wenn der
Ingest-Endpunkt im Router-Worker sitzt (§3), braucht *der Worker* das Secret als Binding, nicht die
Railway-API. Das ist eine Architekturentscheidung, keine Konfigurationsfrage, und sie muss **vor**
dem Widget-Anlegen fallen, weil sie bestimmt, wo der Wert überhaupt hin soll. Solange der Router die
Verifikation macht, kommt zu `routerBindings()` (`ops-router-deploy.ts:246`) ein vierter Eintrag
dazu — und `plain_text` ist für ein Secret die falsche Bindungsart.

**Kosten: $0.00.** Free-Plan, *„Unlimited challenges"*, bis 20 Widgets, 10 Hostnames pro Widget
(Spike §2.4). Keine neue bezahlte Leistung, also kein Konflikt mit der stehenden Regel.

---

## 3. Was Phase 4 **ändern** muss, nicht erweitern

### 3.1 `cf-deploy.ts` kennt kein D1

`CfBinding` (Zeile 162) ist eine **geschlossene** Union:

```ts
export type CfBinding =
  | { type: 'kv_namespace'; name: string; namespace_id: string }
  | { type: 'r2_bucket';    name: string; bucket_name: string; jurisdiction?: R2Jurisdiction }
  | { type: 'plain_text';   name: string; text: string };
```

Kein `d1` darin, und keine D1-Aufrufe in der Datei — die beiden `D1`-Vorkommen sind **Kommentare**
(Zeile 10 und 22), die erklären, dass es keins gibt. *(Korrektur an mir selbst: die
Bereitschaftsnotiz schreibt „`grep -c d1` returns 0". Es sind 2, beide in Kommentaren. Die Aussage
stimmt, die Zahl nicht.)*

Was Phase 4 hier anfassen muss, falls D1 kommt: die Union um `d1` erweitern, Create/Query gegen die
D1-REST-API dazubauen, und — leicht zu übersehen — **die Jurisdiktion mitdenken**. D1 hat
`eu`-Jurisdiktion genauso wie R2, sie ist **nach der Erstellung unveränderlich**, und die
Datenschutzseite sagt heute „R2 in der EU". Eine App-Datenbank ohne Jurisdiktion würde diese Seite
still falsch machen. `R2Jurisdiction` und die Verweigerungslogik daneben sind die Vorlage; der
Grund, warum es sie gibt, steht in `ROUTER_R2_JURISDICTION_BINDING.md` §3.

**Was sauber trägt:** `ops_apps.d1_database_id` liegt seit `0099` nullable bereit (Zeile 73) und
wartet genau darauf. Das **Schema** erweitert sich also ohne Migration — der **Adapter** nicht.

### 3.2 Der Router liefert nur Bytes, und weist alles andere aktiv ab

`worker-source.generated.ts`, im `fetch`-Einstieg (Zeile ~489):

```js
if (request.method !== 'GET' && request.method !== 'HEAD') {
  return refuse(request, siteUrl, 'bad_method', 405, { allow: 'GET, HEAD' });
}
```

**Ein `POST /f/:appId/:formId` bekommt heute ein 405.** Das ist kein Loch, das man füllt, sondern
eine Regel, die man aufbricht: der Router wächst von „eine Verantwortung" auf „zwei". Der
Formularpfad muss **vor** diesem Wächter abzweigen, und die Abzweigung muss eng sein (exakt dieser
Pfad, exakt POST), damit der 405 für alles andere erhalten bleibt.

**Wichtig fürs Vorgehen:** `worker-source.generated.ts` ist **generiert** (`worker.js` →
`pnpm ops:gen-router`, `apps/api/scripts/gen-router-source.mts`). Geändert wird `worker.js`; die
generierte Datei ist Ausgabe, kein Quelltext. Wer sie von Hand editiert, verliert es beim nächsten
Lauf — und der Diff sieht bis dahin richtig aus.

### 3.3 `ops-caps.ts` kennt nur eine Dimension

`CapsProfile` hat heute genau ein Feld (`dailyRequests`) plus eine Beschreibung. Eine
Einsendungs-Obergrenze pro Monat ist eine **zweite Dimension** — z. B. `monthlySubmissions` — und
`0099` speichert das Profil bewusst als **Namen** statt als Zahlen, damit genau das ohne Migration
geht (`ops-caps.ts:4`).

Drei Dinge, die die vorhandene Datei schon richtig macht und die die neue Dimension übernehmen
sollte, statt sie neu zu erfinden: ein unbekanntes Profil fällt auf die **Voreinstellung** zurück,
nicht auf „unbegrenzt" (ein Tippfehler darf nie der Grund sein, dass etwas keine Decke hat); die
Zahlen sind gründer-verstellbar ohne Deploy; und die Beschreibung ist auf Deutsch, weil sie in
Berichten auftaucht.

**Achtung, anderer Durchsetzungsort.** `dailyRequests` wird am **Router** durchgesetzt, aus dem
KV-Record heraus, ohne Datenbank. Eine Monatszahl kann das nicht: sie braucht einen Zähler, der
einen Monat überlebt, und der KV-Tageszähler löscht sich per `expirationTtl` nach 48 Stunden. Das
ist eine echte Designfrage für den Prompt, keine Zeile Code — und die ehrlichste Antwort ist
vermutlich, die Monatszahl dort zu zählen, wo die Einsendung ohnehin gespeichert wird.

---

## 4. Was sauber erweitert (zur Kontrolle nachgeprüft)

- **Resend** — `apps/api/src/lib/email.ts` existiert und ist derselbe Client, über den `M-A1` die
  Auth-Mail schon schickt. Die Eigentümer-Benachrichtigung ist ein neuer Aufruf, kein neuer Dienst.
- **Der Beta-Gate und der Kill-Switch** — `isOpsBetaAccount`, `OPS_HOSTING_ENABLED`, unverändert.
  Phase 4 erbt sie und darf sie nicht umgehen.
- **Das Audit-Protokoll** — `0100`'s `action` hat kein `CHECK`, eine formularbezogene
  Betreiber-Handlung braucht also keine Migration. *(Mit der Einschränkung aus dem
  Carry-forward **B1**: dass `0100` angewendet ist, ist nicht bestätigt.)*
- **Die Dashboard-Hülle**, in der der Posteingang leben wird.
- **Die nächste freie Migrationsnummer ist `0103`.** `0102` ist die letzte vergebene.

---

## 5. Wo die Bereitschaftsnotiz nachzuschärfen ist

Sie hält, mit zwei Anmerkungen:

1. **`grep -c d1` in `cf-deploy.ts` gibt 2 zurück, nicht 0** (beide Kommentare). Die Schlussfolgerung
   stimmt, die Zahl ist falsch aufgeschrieben — und eine falsche Zahl in einer Notiz, die genau
   deshalb existiert, um nachprüfbar zu sein, ist es wert, benannt zu werden.
2. Sie nennt den Site Key „`NEXT_PUBLIC_`-style or app-injected". Das ist zu unbestimmt für einen
   Prompt: **app-injected**, und §2 sagt, warum — er wird in der API in die generierte App gebaut,
   nicht in das Next.js-Bundle.

Alles Übrige — Turnstile fehlt vollständig, die geschlossene `CfBinding`-Union, der reine
Byte-Router, die eine Dimension in `ops-caps.ts`, die nullable `d1_database_id`, der generierte
Worker — habe ich gegen den heutigen Code nachgeprüft und bestätigt gefunden.

---

## 6. Entscheidungen, die vor der ersten Zeile Code fallen müssen

| # | Frage | Warum sie nicht nebenbei entschieden werden kann |
|---|---|---|
| **P4-a** | **D1 überhaupt?** | Das ist die schwerste. `OPS_SPIKE_0` D2 wurde am 2026-07-27 ausdrücklich **ohne** D1 entschieden, und der Ledger hält „$0.00/Monat committed" fest. Eine Datenbank pro App eröffnet diese Entscheidung neu — es ist ein **Substratwechsel**, kein Inkrement: Workers Paid oder WfP, eine neue feste Kostenzeile, und der Upgrade-Auslöser feuert nicht (das Free-Limit beißt nicht, „eine App braucht serverseitigen Code" trifft nur zu, wenn man den Formularpfad in die App legt statt auf die Plattform). **Es gibt eine Alternative, die den Auslöser nicht anfasst:** Einsendungen in **Postgres** (Supabase) statt in per-App-D1. Dann bleibt die Plattformebene die Plattformebene, D1 bleibt zu, und der Preis ist, dass die Mandantentrennung logisch statt physisch ist und die „Export = deine Datenbankdatei"-Erzählung nicht kommt. Gehört in eine Entscheidungstabelle, nicht in einen Prompt. Verbunden mit Carry-forward **C1**, **C3**, **C5**. |
| **P4-b** | **Verhalten über der Obergrenze** (PROPOSED: ablehnen, ehrlich an den Besucher, Besitzer benachrichtigen) | Der **erste Goblin-Mechanismus, der einen echten Endnutzer abweist** — nicht einen Bauer. Was ein Besucher zu sehen bekommt, wenn das Formular eines Fremden voll ist, ist eine Produkt- und Tonfallentscheidung. |
| **P4-c** | **Die Zahl 500/Monat** (PROPOSED, nicht entschieden) | Braucht dieselbe Behandlung wie die 10 000/Tag: eine begründete Zahl, gründer-verstellbar, an den Beta-Umfang gebunden. |
| **P4-d** | **Wohin gehen Einsendungen, wenn der Besitzer sein Projekt löscht?** | Dieselbe Kaskadenfrage wie §1 — und §1 zeigt, dass die heutige Antwort auf die verwandte Frage „falsch" ist. Diesmal geht es um **fremde** Daten: die E-Mail-Adresse eines Besuchers, die jemand hinterlassen hat. Löschen, exportieren, aufbewahren — das ist eine DSGVO-Frage, keine Aufräumfrage. |
| **P4-e** | **Wo wird Turnstile verifiziert — Router oder API?** | §2 zeigt, warum diese vor dem Widget-Anlegen fallen muss: sie bestimmt, wohin das Secret gehört und ob `routerBindings()` eine Bindung dazubekommt. |

---

## 7. Was Phase 4 kaputtmachen würde, so wie sie heute spezifiziert ist

1. **Der Scan deckt Einsendungen nicht ab, und nichts darf so klingen, als täte er es.** Phase 3
   liest das Artefakt beim Veröffentlichen. Ein Formular macht die App zustandsbehaftet; was ein
   Besucher danach einsendet, wird von **nichts** gescannt. Das steht schon in der
   Bereitschaftsnotiz und als **A7** im Carry-forward. Es hier zu wiederholen, ist Absicht: es ist
   die Zusage, die am leichtesten aus Versehen zu weit gefasst wird.
2. **Der Ingest-Endpunkt ist die erste öffentliche, unauthentifizierte Schreiboperation von Akt 2.**
   Alles bisher liegt hinter `isOpsBetaAccount` oder ist Nur-Lesen. `/f/:appId/:formId` nimmt
   Schreibzugriffe von jedem im Internet entgegen. Turnstile ist eine Schicht; die Formulierung des
   Phase-4-Gates sollte auch die anderen fordern (Größenbegrenzung des Bodys, pro-IP-Deckel, und die
   Frage, ob eine unbekannte `appId` mit `404` oder mit einem Byte-gleichen Nichts antwortet — Akt 2
   hat für Letzteres eine Konvention und sie sollte nicht gebrochen werden).
3. **Der Router wird zum einzigen Fehlerpunkt für Einsendungen.** Er liefert heute Bytes aus; wenn er
   auch schreibt, nimmt ein Router-Fehler nicht nur Seiten offline, sondern verliert Einsendungen.
   Was bei einem gescheiterten Insert passiert, gehört ins Design, nicht in ein Catch.
4. **Es gibt keinen öffentlichen Missbrauchs-Meldeweg.** Der Spike hat `/missbrauch-melden` plus
   `POST /api/abuse/report` als §3.2-Lieferung benannt; **beides existiert nicht** (nachgeprüft:
   null Treffer in `apps/`). Was existiert, ist die Kontaktadresse `support@justgoblin.com` auf den
   Rechtsseiten — also ein Meldeweg, der zählt, aber kein Formular. Für statische Seiten ist das
   vertretbar. Sobald Apps **fremde Daten entgegennehmen**, wird die Lücke größer, ohne dass Phase 4
   sie erwähnt. Neu ins Carry-forward aufgenommen als **D5**.
5. **§1 zuerst.** Ein Formularpfad auf eine App zu bauen, die man nach dem Löschen des Projekts nicht
   mehr herunternehmen kann, verdoppelt den Schaden: dann liegen dort auch noch die Daten fremder
   Leute.
