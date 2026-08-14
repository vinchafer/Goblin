# AKT 2 · PHASE 4 — DIE FÜNF ENTSCHEIDUNGEN (P4-a … P4-e)

**Geschrieben: 2026-08-14 · Autor: CC · Branch `claude/act2-phase4-formulare-zxfmo4`**
**Grundlage: `docs/ACT2_PHASE4_PREFLIGHT.md` §6, gegen den heutigen Code und gegen Live-Dokumentation nachgeprüft.**

Der Preflight hat fünf Fragen benannt, die „vor der ersten Zeile Code" fallen müssen. Dieses Dokument
stellt sie wieder her, beantwortet jede, und sagt bei jeder ausdrücklich, **wer** sie entschieden hat
und **womit** sie umkehrbar ist.

**Die Regel, unter der CC hier entschieden hat** (Unit 0 des Phase-4-Prompts): selbst entscheiden,
wenn die Antwort aus einer bestehenden Gründer-Entscheidung, einem dokumentierten Prinzip oder der
offensichtlich risikoärmeren Option folgt — und das Prinzip dabei benennen. Eskalieren nur, was
wirklich an Geld, Rechtsrisiko, Nutzerdaten oder ungeklärter Produktphilosophie hängt.

**Alle fünf sind entschieden. Nichts hält an. Zwei tragen eine Gründer-Aktion, die aus der
Entscheidung folgt, nicht die Entscheidung selbst ist** — sie stehen unten unter „Was der Gründer
noch entscheiden muss".

---

## P4-a — D1 überhaupt?

**Die Frage, wie der Preflight sie stellte:** eine Datenbank pro App eröffnet die Substrat-Entscheidung
D2 vom 2026-07-27 neu. Der Preflight nennt sie „die schwerste" und begründet das so: *„Workers Paid
oder WfP, eine neue feste Kostenzeile, und der Upgrade-Auslöser feuert nicht."*

### ENTSCHIEDEN: ja, D1 — pro App, auf dem **Workers-FREE-Plan**. Kein Substratwechsel.

**Von CC unter stehenden Prinzipien; der Gründer kann es umkehren.**

**Die Prämisse des Preflights ist gegen Live-Dokumentation falsch, und das ändert die Frage.**
Abgerufen am 2026-08-13:

| Quelle | Was dort steht |
|---|---|
| `developers.cloudflare.com/d1/platform/limits/` | **10 Datenbanken** (Free) / 50 000 (Workers Paid) · **500 MB** pro Datenbank (Free) / 10 GB (Paid) |
| `developers.cloudflare.com/d1/platform/pricing/` | Free: **5 Mio. gelesene Zeilen/Tag**, **100 000 geschriebene Zeilen/Tag**, **5 GB** Speicher gesamt. Wörtlich: *„the Workers Free plan will always include the ability to prototype and experiment with D1 for free"* |

D1 **ist** auf dem Free-Plan. Es gibt keine neue feste Kostenzeile, kein Workers Paid, kein WfP.
**M-H1s „$0.00/Monat committed" übersteht diese Phase unverändert.**

**Und der Upgrade-Auslöser feuert wirklich nicht** — aus dem Grund, den der Preflight selbst nennt:
„eine App braucht serverseitigen Code" trifft nur zu, wenn man den Formularpfad **in die App** legt.
Hier liegt er auf der Plattform (siehe P4-e). Keine Nutzer-App führt Code aus. Das Substrat hat sich
nicht geändert; es hat ein Produkt bekommen, das ohnehin auf dem Plan lag.

**Was der Free-Plan sehr wohl auferlegt, und es ist echt: ZEHN DATENBANKEN.** Das ist eine harte
Decke von zehn Formular-Apps auf dem ganzen Konto. Sie wird **ehrlich durchgesetzt statt entdeckt**
(`D1_FREE_PLAN_DATABASE_LIMIT` in `ops-d1.ts`): die elfte Formular-Veröffentlichung wird mit einem
deutschen Satz abgelehnt, der die Decke benennt — und dieselbe App **ohne** Formular zu
veröffentlichen geht weiter.

**Die Alternative, die der Preflight nennt (Einsendungen in Supabase-Postgres), ist begründet
abgelehnt.** Sie hätte die Mandantentrennung von *physisch* auf *logisch* gedreht: eine gemeinsame
Tabelle mit einer `app_id`-Spalte, in der jede Abfrage einen Filter **richtig** haben muss. Bei
fremden personenbezogenen Daten ist das die teurere Sorte Fehler — ein vergessenes `WHERE` ist dann
ein Datenleck über Mandanten hinweg, und keine Menge Tests macht daraus wieder eine Garantie. Mit
einer Datenbank pro App **gibt es keine Anweisung in diesem Code, die zwei Apps erreichen kann**,
weil es keine Anweisung gibt, die zwei Datenbanken erreicht. Das ist der Unterschied zwischen einer
Zusicherung und einer Form.

**Angewandtes Prinzip:** Gesetz 2 (gegen die Live-Dokumentation prüfen statt erinnern) und die
Eskalationsregel selbst — was den Auslöser nicht anfasst und keine Kostenzeile schafft, ist keine
Geldfrage.

**Verbunden mit Carry-forward C1, C2, C3, C5.** C5 (*„der Export gibt `.sql` zurück, nicht SQLite"*)
war ausdrücklich „schlafend, weil es kein D1 gibt". Es ist **nicht** aufgewacht: Phase 4 exportiert
**CSV** für den Eigentümer und verspricht nirgends eine Datenbankdatei. Die Blueprint-Erzählung
„Export = deine SQLite-Datei" bleibt uneingelöst und bleibt offen.

---

## P4-b — Verhalten über der Obergrenze

**Vorgeschlagen war:** ablehnen, ehrlich an den Besucher, Eigentümer benachrichtigen.

### ENTSCHIEDEN: genau so. Abgelehnt-mit-Ansage, nie angenommen-und-weggeworfen.

**Von CC unter stehenden Prinzipien; der Gründer kann es umkehren.**

Die Gegenoption — annehmen, wegwerfen, „Danke" anzeigen — ist das Schlimmste, was dieser Pfad tun
könnte: die absendende Person glaubt, sie sei in Kontakt getreten, der Eigentümer erfährt nie, dass
sie es versucht hat, und **keiner von beiden findet es je heraus**. Eine Absage ist ein kleinerer
Schaden als eine Lüge, und sie ist die einzige der beiden, auf die irgendwer reagieren kann.

Das ist der erste Goblin-Mechanismus, der einen **echten Endnutzer** abweist und keinen Bauer. Der
Satz, den diese Person bekommt, steht in `apps/api/src/routes/ops-forms.ts` und ist danach gebaut:
er gibt ihr keine Schuld, verspricht keinen Zeitpunkt, den niemand hat, und sagt ausdrücklich, dass
die Nachricht **nicht** angekommen ist.

Die zweite Hälfte ist die, die man vergessen könnte: **der Eigentümer wird benachrichtigt.** Eine
Absage, von der der Betreiber nichts hört, ist aus seiner Sicht dasselbe stille Versagen wie eine
weggeworfene Einsendung — Leute kommen nicht mehr durch und niemand sagt es. Diese Mail ist
ausdrücklich **nicht** vom Einsendungs-Opt-out betroffen: „schick mir nicht jede Nachricht" ist ein
anderer Wunsch als „sag mir nicht, dass mein Formular nichts mehr annimmt".

**Angewandtes Prinzip:** Feeling-Invariante „ehrliche Degradation, nie ein Phantom" · Gesetz 3
(niemals einen nicht ausgeführten Vorgang als ausgeführt melden).

---

## P4-c — Die Zahl 500/Monat

### ENTSCHIEDEN als **Planungszahl**, im Code als solche markiert, gründer-verstellbar ohne Deploy.

**Von CC unter stehenden Prinzipien; der Gründer setzt die endgültige Zahl.**

Sie liegt in `CAPS_PROFILES['free-static'].monthlySubmissions` — dieselbe Behandlung wie die
10 000/Tag, und aus demselben Grund: `0099` speichert das Cap-Profil bewusst als **Namen**, damit
Zahlen ohne Migration wandern.

**Woher die Zahl kommt, ausgeschrieben, damit man sie prüfen kann:** bei zehn Formular-Apps (der
D1-Decke) sind 500/Monat zusammen **5 000 geschriebene Zeilen im Monat**, gegen ein Free-Kontingent
von **100 000 geschriebenen Zeilen pro Tag**. Drei Größenordnungen Luft. **Die Zahl verteidigt also
nicht die Cloudflare-Rechnung.** Sie verteidigt zwei andere Dinge: das Postfach des Eigentümers, und
die Plausibilität eines Beta-Kontaktformulars. Ein echtes Geschäft, das über ein Goblin-Formular 500
Anfragen im Monat bekommt, ist ein Gespräch — kein Zwischenfall.

**Was sie ausdrücklich nicht ist:** eine Preisstufe. Der Text der Über-der-Grenze-Mail sagt das
wörtlich, damit die Obergrenze nicht als Verkaufsmasche gelesen wird.

Eine zweite Dimension auf `CapsProfile` statt einer zweiten Zahl neben der ersten, weil sie **an
einem anderen Ort durchgesetzt** wird: `dailyRequests` am Router aus dem KV-Record ohne
Datenbankzugriff, `monthlySubmissions` dort, wo die Einsendung ohnehin gespeichert wird — der einzige
Ort, der einen Monat exakt einmal zählen kann. Der Preflight §3.3 hat genau das als „echte
Designfrage" benannt; das ist die Antwort.

---

## P4-d — Wohin gehen Einsendungen, wenn der Besitzer sein Projekt löscht?

### ENTSCHIEDEN: sie werden **mitgelöscht**, und ein nicht bestätigter Abbau **blockiert** das Löschen.

**Von CC unter stehenden Prinzipien; der Gründer kann es umkehren — und sollte diese Zeile lesen,
weil sie fremde Daten betrifft.**

Drei Gründe, in dieser Reihenfolge:

1. **X1s Regel, eine Ebene weiter.** Eine D1-Datenbank, die ihre App überlebt, ist dieselbe
   Fehlerklasse wie eine verwaiste Route — und schwerer in der Art: es sind fremde personenbezogene
   Daten auf Goblins Konto, ohne App und ohne Zuständigen. Also gilt derselbe Vertrag, den PR #90
   für Routen und Dateien aufgestellt hat: `teardownApp` löscht die Datenbank und **liest sie neu**,
   und `gone !== true` macht den ganzen Abbau `ok: false`, worauf das Projektlöschen mit **409**
   antwortet und Projekt **und** Registry-Zeile stehen lässt.
2. **Datenminimierung.** Goblin ist hier Auftragsverarbeiter, der App-Eigentümer ist
   Verantwortlicher. Zerstört der Verantwortliche die App, hat der Auftragsverarbeiter keine
   Rechtsgrundlage mehr, die Daten seiner Endkunden aufzubewahren.
3. **Es gibt keine Grundlage für das Gegenteil.** Aufbewahren „für den Fall" wäre eine Entscheidung
   über die Daten fremder Menschen, für die niemand ein Mandat hat.

**Die ehrliche Kehrseite, ausgesprochen:** wer sein Projekt löscht, verliert die Einsendungen. Das
ist der Grund, warum der Export **vor** dem Löschen existiert und im Lösch-Dialog des Posteingangs
ausdrücklich empfohlen wird („Exportiere sie vorher, wenn du sie behalten willst"), und warum die
Datenschutzseite die Kette benennt.

**Was hier NICHT gebaut wurde und offen bleibt:** der Projekt-Lösch-Dialog nennt die **Zahl** der
betroffenen Einsendungen noch nicht. Er nennt die App und ihre Adresse (X1). Die Zahl wäre eine
weitere Abfrage im Lösch-Pfad und ist eine echte Verbesserung — sie steht im Register als **P4-1**.

---

## P4-e — Wo wird Turnstile verifiziert: Router oder API?

### ENTSCHIEDEN: **die API.** Der Router bleibt unverändert. Das Geheimnis bleibt in Railway.

**Von CC — und diese eine ist nicht Ermessen, sondern vom Substrat erzwungen.**

Das Argument in drei Schritten:

1. **Der Ingest muss in die EIGENE Datenbank der App schreiben.** Auf der schlanken Ebene bedient
   **ein** Router-Worker die ganze Flotte, und Worker-Bindings sind **statisch pro Deploy**. Jede
   App-Datenbank an den Router zu binden hieße, den Router neu hochzuladen, sobald **ein** Bauer auf
   „Veröffentlichen" drückt — ein flottenweites Deploy, ausgelöst von einer Person.
2. **Der einzige Weg daran vorbei wäre, dass der Router die D1-REST-API selbst aufruft** — also
   `CF_API_TOKEN` in ein Skript zu liefern, das bei **jedem Besucher-Request** läuft. Der Kopf von
   `cf-deploy.ts` schließt das aus, und zu Recht: mit diesem Token kann man jede App des Kontos
   löschen.
3. **Also passiert der Schreibvorgang in der Plattform-API.** Dort zu verifizieren, wo nicht
   geschrieben wird, brächte nichts: ein am Rand geprüftes Token, dem die API dann glaubt, ist ein
   Header, den jeder schicken kann.

**Wo welcher Schlüssel liegt — ausdrücklich, weil der Preflight genau das als Konsequenz benannt hat:**

| Wert | Wohin | Warum |
|---|---|---|
| **`CF_TURNSTILE_SECRET_KEY`** | Railway, **API**-Umgebung, sonst nirgends | Echtes Geheimnis. Steht in `SECRET_ENV_VARS` (`cf-deploy.ts`), also streicht die vorhandene Redaktion es aus **jeder** ausgehenden Zeichenkette. `routerBindings()` bekommt **nichts** dazu — die vom Preflight befürchtete `plain_text`-Bindung für ein Geheimnis entsteht gar nicht erst. |
| **`CF_TURNSTILE_SITE_KEY`** | Railway, **API**-Umgebung; von dort in das HTML der generierten App | Öffentlicher Wert. Ausdrücklich **kein** `NEXT_PUBLIC_*`: er muss nie ins Next.js-Bundle, weil die Seite, zu der er gehört, keine Goblin-Seite ist. Das ist die Präzisierung, die Preflight §5.2 verlangt hat. |

**Die Namen sind `CF_TURNSTILE_*`, nicht `TURNSTILE_*`.** Der Preflight schlug `TURNSTILE_SITE_KEY`
und `TURNSTILE_SECRET_KEY` vor; der Gründer hat die Variablen am 2026-08-13 als `CF_TURNSTILE_*` in
Railway angelegt. Der Code liest die Namen, die **wirklich existieren** — Gesetz 10, Repo und
Wirklichkeit schlagen den Plan. Der Preflight ist an dieser Stelle überholt.

**Was diese Entscheidung nebenbei rettet:** `worker.js` ist in dieser Phase **unverändert**. Der
405-Wächter, den Preflight §3.2 als „Regel, die man aufbricht" beschreibt, bleibt zu — und damit
bleibt der ganze Auslieferungspfad, an dem echte Nutzer hängen, außerhalb des Blastradius dieser
Phase. Preflight §7.3 („der Router wird zum einzigen Fehlerpunkt für Einsendungen") ist damit
gegenstandslos: der Router weiß von Formularen nichts.

**Der Preis, ausgesprochen:** das Formular postet **cross-origin** an die API statt an die eigene
Adresse. Es braucht also CORS (genau eine Origin, keine Credentials, `/f/*` ist von der globalen
CORS-Middleware ausgenommen, siehe `index.ts`) und einen erreichbaren API-Host. Fällt die API aus,
nehmen Formulare nichts an, während die Seiten weiter ausgeliefert werden — und der Besucher bekommt
den ehrlichen Satz „deine Nachricht ist NICHT angekommen" statt eines stillen Fehlschlags.

---

## Was der Gründer noch entscheiden muss

Beides folgt **aus** den Entscheidungen oben; keins hält Phase 4 auf.

| # | Frage | Warum sie beim Gründer liegt |
|---|---|---|
| **G-P4-1** | **Was passiert bei der elften Formular-App?** Die Free-Decke ist zehn. Darüber: Workers Paid, **$5/Monat**, und M-H1s „$0.00 committed" ist Geschichte. | Geld. Eine feste Kostenzeile aufzumachen ist nie eine Implementierungsentscheidung. Heute ist es folgenlos (eine bekannte echte App), und die Decke wird ehrlich abgelehnt statt verschwiegen — die Frage kann also warten, bis sie jemand stellt. |
| **G-P4-2** | **Die 500/Monat bestätigen oder ändern.** | Produkt. Die Zahl ist eine begründete Planungszahl, keine gemessene; die Begründung steht oben und in `ops-caps.ts`. Eine Zeile im Code, kein Deploy von irgendetwas anderem. |
