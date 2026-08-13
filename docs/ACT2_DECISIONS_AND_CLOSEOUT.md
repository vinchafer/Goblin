# AKT 2 — ENTSCHEIDUNGEN E1–E5, REGISTER-ABSCHLUSS, PHASE-4-BEREITSCHAFT

**Geschrieben: 2026-08-13 · Autor: CC · gegen master `31d2290` (enthält PR #89 und #90)**

Diese Sitzung baut eine Sache (die Waisen-Prüfung in der Konsole) und schließt sonst nur ab. Ihr
eigentlicher Zweck ist, dass **nach ihr nichts mehr offen ist außer dem, was tatsächlich der Gründer
tun muss** — und dass diese Liste kurz genug ist, um sie zu glauben.

---

## 1. DIE ENTSCHEIDUNGSTABELLE E1–E5, hierher geholt

Sie stand bisher in `docs/AKT2_PHASE3_REPORT.md` §ESKALATIONEN, und die Entscheidungen zu E1 und E2
sind im Chat gefallen. Ein Entscheid, der nur in einem Chatverlauf lebt, ist in vier Wochen ein
Gerücht. Hier steht sie vollständig, mit **wer** entschieden hat.

| # | Frage | Entscheidung | Von wem, am | Woraus sie folgt |
|---|---|---|---|---|
| **E1** | **Wer zahlt den Scan?** | **Plattform-COGS.** Scannen wird dem Nutzer-Kontingent **nie** verrechnet. | **Gründer, 2026-08-13** | Eigene Entscheidung. Begründung des Gründers sinngemäß: dem Bauer sein Kontingent für unsere Haftungsprüfung abzuziehen hieße, ihm unsere Haftung zu berechnen. Gebucht in Ledger **M-A2**, Abschnitt „Billed to". |
| **E2** | **Darf Stufe 2 je sperren?** | **Nein.** Stufe 2 darf ausschließlich auf `review` leiten. Sperren bleibt **deterministisch** (Stufe 1) oder **menschlich** (Konsole). | **Gründer, 2026-08-13** | Eigene Entscheidung. Der akzeptierte Preis ist ausgesprochen: die Prüfliste skaliert mit der Beta. |
| **E3** | **App-Inhalt geht an DeepInfra** — offengelegt in AUP und Datenschutz, Verarbeitungszweck ergänzt. | **OFFEN — Gründer.** Der Text ist geschrieben und live; was fehlt, ist, dass der Gründer ihn mitträgt. | — | **Bewusst nicht von CC entschieden.** Siehe §2.3. |
| **E4** | **`stage2-04-seo-doorway` liegt bei 3/5.** Als 3/5 berichten oder den Prompt grün tunen? | **Als 3/5 berichten, nicht tunen.** Neu bewertet wird, wenn ein **echter** Fall auftritt — dann als neue Regel **und** neue Fixture. | **CC, 2026-08-13, unter stehenden Prinzipien — der Gründer kann das umkehren.** | Siehe §2.1. |
| **E5** | **Ledger-Marke `M-A2` statt `M-A1`** (der Prompt verlangte `M-A1`, die Marke war vergeben). | **`M-A2` bleibt.** Nächste freie Marke plus Nummerierungsnotiz, wie bei M15. | **CC, 2026-08-13, unter stehenden Prinzipien — der Gründer kann das umkehren.** | Siehe §2.2. |

**Kurz gesagt:** von den drei offenen habe ich **E4 und E5 entschieden** und **E3 nach oben
gegeben**. E3 ist keine neue Gründer-Aufgabe — es ist Schritt 4 des Gründer-Fensters, das ohnehin
aussteht.

---

## 2. Die beiden Entscheidungen im Einzelnen, und die eine Nicht-Entscheidung

### 2.1 E4 — 3/5 bleibt 3/5

**Entschieden: der Klassifizierer wird für diese Kategorie nicht nachgetunt. Die Zahl wird berichtet.**

Drei Dinge tragen das, und keines davon ist Geschmack:

1. **Gesetz 2 der Arbeitsmethodik** — *„Erfolgsraten als Zahl (‚4/5'), nie als Adjektiv."* Eine
   gemessene 3/5 in eine grüne 5/5 zu tunen, indem man gegen dieselben zehn Fixtures optimiert,
   gegen die man den Prompt danach zitiert, **misst das Tuning und nicht den Klassifizierer**. Die
   Zahl würde besser aussehen und weniger bedeuten.
2. **`ABUSE_RESPONSE.md` §7, Regel-Pflege** — *„jeden echten Missbrauchsfall als neue Regel +
   Fixture gießen (der Scan wird nur durch echte Fälle klüger)."* Das ist die dokumentierte
   Bedingung, unter der hier nachgeschärft wird, und sie ist heute nicht erfüllt: es gibt keinen
   echten Fall.
3. **Gründer-Entscheid E2 begrenzt den Schaden bereits.** Weil Stufe 2 nie sperren darf, ist der
   Fehler in dieser Kategorie einseitig: eine SEO-Doorway-Seite geht live, statt dass ein ehrlicher
   Bauer ausgesperrt wird. Dazu kommen Allowlist und Kill-Switch. Es ist die mildere Richtung, sie
   ist gewollt, und E2 hat sie schon abgewogen.

**Was das nicht heißt.** Es heißt nicht „gut genug". Es heißt: *der Klassifizierer hält
SEO-Doorway-Seiten etwa drei von fünf Malen*, dieser Satz steht so im Bericht, in der Batterie und
im Register, und er darf nach außen nicht runder klingen. Der Auslöser für die Neubewertung steht
in Carry-forward **A1**.

**Was der Gründer umkehren könnte, wenn er will:** die Produktentscheidung, dass 3/5 für die
Kategorie „Spam/SEO" reicht. Ich entscheide hier nicht, dass die Zahl gut ist — ich entscheide, dass
sie **nicht durch Tuning gegen die eigenen Fixtures verändert wird**. Das ist die konservative
Hälfte der Frage; die andere Hälfte bleibt jederzeit seine.

### 2.2 E5 — `M-A2` bleibt

**Entschieden: die Ledger-Marke des Klassifizierers heißt `M-A2` und wird nicht umbenannt.**

- **Gesetz 10 (State-first):** *„Widerspricht der Prompt der Repo-Realität → dem Repo glauben."*
  Der Phase-3-Prompt verlangte `M-A1`. `M-A1` war seit Akt 1 die Resend-Auth-Mail-Zeile. Der Prompt
  ist ein Plan, das Repo ist die Wahrheit.
- **Präzedenzfall M15**, dieselbe Kollision, dieselbe Auflösung: nächste freie Marke plus
  Nummerierungsnotiz. Die Notiz steht bereits im Ledger und sagt ausdrücklich, wo jemand landet, der
  „M-A1 · classifier" sucht.
- **Die risikoärmere Option.** Umbenennen kostet jede Referenz in Bericht, Register, Ledger und
  Preflight — und ein Ledger, dessen Marken wandern, ist genau der Beleg, den man nicht mehr zitieren
  kann. Es steht kein Geld, kein Recht und kein Nutzerdatum daran.

Damit ist Carry-forward **D6** geschlossen.

### 2.3 E3 — bleibt beim Gründer, und warum ich es nicht nehme

**Nicht entschieden.** Die Eskalationsregel der Arbeitsmethodik nennt **Lizenzen/Recht** ausdrücklich
als das, was vorgelegt und nicht selbst gewählt wird. E3 ist genau das:

- Es ist ein **neuer Verarbeitungszweck** bei einem bestehenden Unterauftragsverarbeiter — nicht
  „derselbe Dienst wie bisher".
- Der Text steht auf einer Rechtsseite, die **KI-verfasst und anwaltlich ungeprüft** ist (Carry-forward
  **D1**, die längststehende offene Gründer-Aufgabe von Akt 2). Ich kann eine Rechtsseite korrekter
  machen; ich kann sie nicht **mittragen**.
- Es geht um Inhalte, die **Nutzer** hochgeladen haben.

**Was ich stattdessen entschieden habe** — und was ausdrücklich keine Rechtsentscheidung ist: die
**Offenlegung bleibt stehen**, solange die Sache läuft. Sie folgt aus Gesetz 6 (nie einen Zustand
behaupten, den es nicht gibt): der Inhalt **geht** an DeepInfra; eine Datenschutzseite, die das
verschweigt, wäre falsch, unabhängig davon, ob der Wortlaut am Ende genau dieser bleibt. Offen ist
also nicht, **ob** offengelegt wird, sondern **mit welchem Wortlaut** — und das ist der Teil, den der
Gründer gegenliest.

**Aufwand für den Gründer: drei Absätze.** AUP-Abschnitt „Was Goblin prüft", `/acceptable-use`, die
DeepInfra-Zeile im Datenschutz. Es ist Schritt 4 der Gründer-Aktionen aus dem Phase-3-Bericht und
steht als Carry-forward **D2**.

---

## 3. X1-S läuft jetzt aus der Konsole (die eine gebaute Sache)

Der Bestands-Sweep war die einzige Gründer-Aufgabe mit „Fällig: **jetzt**" — und er verlangte ein
Terminal und den Admin-Schlüssel. Er steht jetzt als **Nur-Lese-Karte** in `/dashboard/konsole`.

- **Kein neuer API-Pfad.** Die Karte ruft `GET /api/admin/ops/orphans` über den Gründer-Sitzungsweg,
  den U-C1 seit Phase 2.5 dafür gebaut hat. Ein Admin-Schlüssel im Browser war ohnehin nie möglich —
  CORS erlaubt `Authorization` und nicht `x-admin-key`.
- **`null` bleibt `null`.** Drei Felder, drei Zustände, drei Pillen: gefunden (rot), geprüfte Null
  (grün), **nicht geprüft** (gestrichelt, farblos). Es gibt keinen Pfad von `null` nach grün, und die
  Zuordnung liegt als reine Funktion in `orphan-view.ts`, weil das der Teil ist, der falsch sein kann.
  Zehn Tests halten genau das fest.
- **Kein Lösch-Knopf, mit Ansage.** Die Karte sagt selbst, warum: Aufräumen verlangt benannte
  App-IDs, einen Grund fürs Protokoll und eine erneute Registry-Prüfung unmittelbar vor dem Löschen.
  Das bleibt ein eigener Schritt.
- **Läuft nicht beim Öffnen der Seite.** Der Sweep listet KV und R2 vollständig auf; das gehört
  ausgelöst, nicht bei jedem Blick aufs Handy nebenbei getan.

Belege: `evidence/akt2-x1s-konsole/` — vier Screenshots bei 390 px in DE und EN, in denen die drei
Zustände nebeneinander stehen, plus die DOM-Dumps. `apps/web` 476/476 grün, Typecheck sauber, der
Overflow-Check des Harness meldet nichts.

**Was das nicht ist:** eine Antwort. Ob es heute Waisen gibt, weiß weiterhin niemand — die Karte
macht die Frage nur endlich stellbar. Das ist Gründer-Aktion, ein Tippen.

---

## 4. Was im Carry-forward-Register geschlossen wurde

Vollständige Begründung je Zeile steht im Register selbst; hier die Bilanz.

| # | Vorher | Jetzt |
|---|---|---|
| **X1** | „GESCHLOSSEN (Branch `claude/project-deletion-orphans-r4ewk7`)" | **Geschlossen, jetzt mit der PR, die es geschlossen hat: PR #90, Commit `6f3d949`, Merge `31d2290`.** Ein Branch-Name ist keine Quittung — Branches werden gelöscht. |
| **D6 (E5)** | offen, Gründer-Entscheidung zur Nomenklatur | **Geschlossen — CC-Entscheid unter Gesetz 10 (§2.2).** |
| **A1 (E4)** | offen, mit E4 als Produktentscheidung darüber | **Die Methodenfrage ist entschieden (§2.1); die Zeile bleibt offen als Messwert mit Auslöser** — sie ist genau dafür da. |
| **X1-S** | „braucht Cloudflare- und Supabase-Zugangsdaten, die in keiner CC-Sitzung liegen" | **Bleibt offen — aber der Weg hat sich geändert:** kein Terminal, kein Schlüssel, eine Karte in der Konsole. Gehört damit ins Gründer-Fenster statt daneben. |
| **B1** | „0100 nicht als angewendet bestätigt" | **Bleibt offen und braucht keine eigene Handlung:** die Konsole meldet es von selbst. Beim Blick ins Fenster ist die Antwort da. |
| **E5 (Harness)** | „braucht auf manchen Maschinen `PW_CHROMIUM_PATH`" | **Bleibt offen als Umgebungsvoraussetzung — jetzt mit einem belegten Beispielwert**, in dieser Sitzung gebraucht und im Register notiert. |

**Was ausdrücklich nicht geschlossen wurde und warum:** alles, dessen `Fällig` ein Auslöser ist, der
nicht eingetreten ist (A2, A4–A7, C1–C5, D4, D5) und alles, was einen echten Gründer-Willen braucht
(D1, D3, E1-Repo-Hygiene, E6). Eine Zeile zu schließen, weil sie stört, ist die eine Art, dieses
Register wertlos zu machen.

---

## 5. Phase-4-Preflight: was gegen heutigen master gedriftet war

`docs/ACT2_PHASE4_PREFLIGHT.md` war gegen master `418e43f` geschrieben. Seither sind PR #89 und #90
gelandet. Nachgeprüft wurde **jede** Behauptung, nicht die auffälligen; korrigiert wurde:

1. **§1 war der schwerwiegendste Fall — die Datei beschrieb einen Defekt als offen, der behoben
   ist,** und empfahl obendrein eine Bauform (Best-effort-Teardown), die in PR #90 **begründet
   abgelehnt** wurde. Eine Preflight-Notiz, aus der der nächste Prompt geschrieben wird, hätte damit
   genau den Mechanismus wieder eingebaut, der X1 erzeugt. §1 ist jetzt Historie mit Zeiger auf
   `ACT2_X1_PROJECT_DELETION.md` §2.
2. **`opsAppsAvailable` heißt in Wahrheit `opsAppsTableAvailable`.** Ein Bezeichner in einer Notiz,
   die zum Grepen da ist, muss grepbar sein.
3. **`routerBindings()` steht in `ops-router-deploy.ts:227`, nicht `:246`.**
4. **Der 405-Wächter:** `worker.js:476` ist die Quelle, `worker-source.generated.ts:490` die Ausgabe.
   Vorher stand nur die generierte Datei da, mit einer inzwischen verschobenen Zeilennummer — und die
   generierte ist genau die, die man **nicht** editiert.

**Unverändert bestätigt gefunden** (jeweils heute nachgeprüft, nicht erinnert): Turnstile kommt in
`apps/`, `packages/`, `workers/` **null**-mal vor · `CfBinding` ist weiterhin eine geschlossene Union
aus drei Fällen (`cf-deploy.ts:162`), die beiden `D1`-Treffer sind Kommentare · `CapsProfile` hat
weiterhin genau eine Dimension plus Beschreibung · `ops_apps.d1_database_id` liegt nullable bereit
(`0099:73`) · die nächste freie Migrationsnummer ist `0103` · `SECRET_ENV_VARS` in `cf-deploy.ts:300`
ist der Redaktions-Mechanismus, in den der Turnstile-Secret gehört.

Die Turnstile-Schritte in §2 sind **unverändert korrekt und vollständig** — Dashboard-Pfad,
Hostname-Regel, die beiden Schlüssel und wohin sie gehören, die Falle mit der serverseitigen
Verifikation. Das ist die zweite offene Gründer-Sache, und sie steht dort abholbereit.

---

## 6. WAS FÜR DEN GRÜNDER OFFEN IST — die ganze Liste

**Zwei Dinge. Alles andere ist entweder erledigt, hat einen Auslöser, der nicht eingetreten ist, oder
wartet auf eine Phase, die noch nicht läuft.**

### 6.1 Das Gründer-Fenster (`/dashboard/konsole`, Konto `vinc.hafner2@gmail.com`)

Ein Termin, nicht fünf. In dieser Reihenfolge:

1. **Migration `0102` anwenden** (`supabase/migrations/0102_ops_review_queue.sql`, Supabase SQL
   Editor). Vorher wird kein Hold aufgezeichnet und der Publish antwortet ehrlich mit 503.
2. **Waisen-Prüfung starten** (die neue Karte). Ein Tippen. `routeOrphans` ist der Befund, auf den es
   ankommt. **`null` in einem Feld ist keine Entwarnung** — die Karte sagt das selbst. Kommt überall
   „keine gefunden", ist X1 nie ausgelöst worden; kommt etwas, dann bitte zuerst melden und nichts
   löschen.
3. **Die Publish-Schleife fahren**: eine saubere App veröffentlichen (beide Stufen grün, verifizierte
   URL); eine Stufe-2-Fixture veröffentlichen (landet in der Prüfliste, nichts ist online); beide
   Wege auflösen — **Freigeben** und **Ablehnen** mit Grund; die zwei `ops_app_audit`-Zeilen
   bestätigen. Nebenbei fällt dabei **B1** (steht dort „Migration 0100 fehlt", ist die Frage
   beantwortet) und **A6** (eine echte Framework-App durch den Pfad schicken misst das
   6 000-Token-Budget).
4. **Mit einem normalen Konto** bestätigen, dass das alte Publish-Sheet unverändert erscheint.
5. **Die drei Rechtsabsätze gegenlesen** — das ist **E3**. AUP „Was Goblin prüft",
   `/acceptable-use`, die DeepInfra-Zeile im Datenschutz.

### 6.2 Die Turnstile-Schlüssel

Ein Widget in Cloudflare anlegen, zwei Werte nach Railway. Alles Nötige steht in
`ACT2_PHASE4_PREFLIGHT.md` §2, inklusive der Falle: **erst entscheiden, wo verifiziert wird** (Router
oder API — `P4-e`), denn das bestimmt, wohin das Secret gehört. Kosten $0.00. **Phase 4 kann ohne
diese Schlüssel nicht anfangen.**

### 6.3 Was auf dieser Liste bewusst NICHT steht

Damit die Kürze oben nicht als Vollständigkeit missverstanden wird — diese Dinge sind offen,
brauchen aber **heute** nichts:

- **D1 (juristische Prüfung der Rechtsseiten)** — fällig *vor Skalierung*, nicht vor Phase 4. Die
  älteste offene Zeile von Akt 2 und die einzige, die ich ungern kurz mache.
- **Phase-4-Entscheidungen `P4-a` bis `P4-e`** (D1-Substrat, Verhalten über der Obergrenze, die Zahl
  500/Monat, Löschen von Einsendungen, Turnstile-Ort). Die gehören in die Entscheidungstabelle **am
  Anfang von Phase 4**, nicht davor — mit einer Ausnahme: `P4-e` gehört vor das Widget, siehe oben.
- **Kosmetik ohne Frist:** die 44 gemergten Remote-Branches (**E6**), die `*.txt`-Falle in
  `.gitignore` (**E1**), Evidenz-READMEs in alten Ordnern (**E2**).
- **Alles mit einem Auslöser, der nicht eingetreten ist:** A1–A7, C1–C5, D3–D5.

---

## 7. Ehrliche Grenzen dieser Sitzung

- **Die Waisen-Karte ist gegen einen Stub belegt, nicht gegen Produktion.** Sie wurde in dieser
  Sitzung **nie gegen echtes Cloudflare aufgerufen** — in diesem Container liegt kein `CF_*`- und
  kein `SUPABASE_*`-Wert. Was belegt ist: die Darstellung, in vier Screenshots und zehn Tests. Was
  nicht belegt ist: dass der Endpunkt in Produktion antwortet. Der Endpunkt selbst ist unverändert
  seit PR #90.
- **Ich habe E4 und E5 entschieden, nicht ausgehandelt.** Beide sind mit einem Satz umkehrbar, beide
  sind hier mit dem Prinzip aufgeschrieben, aus dem sie folgen — und wenn der Gründer eines der
  Prinzipien anders liest, fällt die Entscheidung mit.
- **Die Farben der Konsolen-Screenshots sind weiterhin nicht die finalen** (Carry-forward **B3**):
  das Harness rendert die Karte, nicht die Seite. Layout bei 390 px und Wortlaut sind belegt.
- **Der Register-Durchgang ist eine Buchprüfung, kein Audit des Codes.** Ich habe geprüft, ob eine
  Zeile das beschreibt, was heute im Repo steht — nicht, ob das, was im Repo steht, gut ist.
