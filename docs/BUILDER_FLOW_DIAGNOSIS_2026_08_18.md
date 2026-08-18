# Builder-Flow — Diagnose der Founder-Walk-Defekte vom 2026-08-18

Diagnose-Pass (U1). **Keine Fixes in diesem Commit.** Jeder Fix-Commit dieser Welle
verweist auf einen Abschnitt hier.

Basis: `origin/master` = `6b7c718` (PR #106). Web läuft auf `6b7c718`
(`/api/version`, gelesen 2026-08-18 11:03 UTC), API auf `33ad3a82`
(`/health` auf `goblinapi-production.up.railway.app`) — das ist der PR-#104-Merge;
#105 und #106 waren docs- bzw. web-only, die API ist also inhaltlich aktuell.
Die Merges PR #97–#101 sind in master enthalten (`e822c37` und darunter) — die
Voraussetzung der Aufgabenstellung hält.

**Ohne Browser in dieser Umgebung.** Jede Aussage unten ist aus dem Code belegt
(Datei + Zeile) oder aus einer gemessenen Zahl. Wo ich eine Ursache nicht
feststellen konnte, steht das als `UNGEKLÄRT` mit dem, was ich ausgeschlossen habe
— nicht als Vermutung im Indikativ.

---

## 0. Die PR-#101-Hypothese — geprüft und **verworfen**

Die Vorannahme lautete: PR #101 (`f0c59f0`, „reset session state and pending payload
on a project switch") feuert seinen Reset auf einem Nicht-Wechsel (`undefined → id`
beim Mount) und löscht damit die Payload, die „An Code senden" gerade gesetzt hat.

Das ist **nicht** der Fall, aus drei unabhängigen Gründen:

1. `apps/web/hooks/code/useCodeSessions.ts:48` — `const projectRef = useRef(projectId)`.
   Die Ref wird beim **ersten** Render mit dem echten `projectId` initialisiert, nicht
   mit `undefined`. Der Reset-Zweig (`:67`) vergleicht `projectRef.current !== projectId`
   und kann beim Mount deshalb strukturell nicht auslösen.
2. `apps/web/components/project/code-tab.tsx:41` — `const prevProjectIdRef = useRef(projectId)`.
   Identisches Muster. Das `setPendingCodePayload(null)` in `:45` kann beim Mount
   ebenfalls nicht feuern.
3. Entscheidender: **die Payload des Founders lief gar nicht über `pendingCodePayload`.**
   Der Weg aus dem Chat ist `stashAndRouteToCode`
   (`apps/web/components/chat/standalone-chat.tsx:117-135`): er schreibt
   `sessionStorage["goblin:stc-pending"]` und navigiert per `router.push` nach
   `/dashboard/project/<id>/work?tab=code`. Gelesen wird der Stash in
   `CodeWorkspace` (`apps/web/components/code/CodeWorkspace.tsx:91-101`).
   Der PR-#101-Clear fasst `sessionStorage` nirgends an.

Belegt wird 3. auch durch das Screenshot selbst: der Session-Tab heißt
„Bau mir eine einfache Ko…", also `titleFromPrompt(stashPayload.prompt)`
(`CodeWorkspace.tsx:166`). Der Prop-Pfad trägt gar kein `prompt` — er hätte die
Session nach dem **Dateinamen** benannt. Die Session ist also nachweislich über den
Stash-Pfad entstanden.

**Verdikt: Hypothese hält nicht.** PR #101 ist an D-A und D-D unbeteiligt.

---

## 1. Der gemeinsame Nenner: eine nicht aufgelöste Liste wird als leere Liste gezeigt

D-A, D-C und D-D haben **eine gemeinsame Fehlerklasse**, an drei verschiedenen
Stellen implementiert:

> Eine Operation, die nicht beantwortet werden konnte, wird als „nichts da"
> gerendert statt als „ich weiß es nicht".

Das ist genau der Verstoß gegen die Feeling-Invariante *„niemals einen Zustand
behaupten, den du nicht geprüft hast"*. Die drei Fundstellen:

| # | Stelle | Was passiert |
|---|--------|--------------|
| 1 | `apps/api/src/routes/code-sessions.ts:212-217` | POST bestätigt `draftCount: initialContent ? 1 : 0`, **ohne** das Insert-Ergebnis zu prüfen (`:206-209` wirft `error` weg). |
| 2 | `apps/api/src/services/agent/tools.ts:329-334` + `:357-364` | `listSessionPaths` verwirft `error` aus Supabase; ein fehlgeschlagenes Query liefert `[]`, und `toolListFiles` meldet das als **erfolgreichen** Schritt „keine Dateien". |
| 3 | `apps/web/hooks/code/useCodeSessionDetail.ts:47` | `if (!res.ok) { setLoading(false); return; }` — ein fehlgeschlagener Detail-Load lässt `files: []` stehen und die Oberfläche zeigt „Noch keine Dateien". |

Sie werden deshalb in U2/U3/U4 **einzeln, aber nach demselben Prinzip** repariert:
unaufgelöst ≠ leer.

---

## 2. D-A — „An Code senden" öffnet den Tab, aber die Session bleibt leer  [LOAD-BEARING]

**Symptom (Founder, wörtlich):** „dann ist der codetab aufgegangen, und oben war die
session sichtbar aber nicht passiert, das codefenster macht nicht, ich klicke oben auf
den tab und nichts passiert… ich klicke 10 mal auf die session aber sie geht nicht auf
obwohl sie direkt aufgehen sollte."

**Was das Screenshot tatsächlich zeigt** — und das ist der erste Befund, weil er die
Symptombeschreibung korrigiert:

* Der Thread zeigt „Noch nichts hier. Stell unten eine Aufgabe — oder öffne eine Datei
  aus dem Projekt." (`apps/web/components/code/SessionThread.tsx:79`). Das ist der
  Leerzustand für **Nachrichten**, und er ist für eine frische STC-Session *korrekt* —
  eine per Send-to-Code erzeugte Session hat naturgemäß keinen Chat-Verlauf.
* Der Editor zeigt „Noch nichts zu zeigen." (`SessionPane.tsx:1024`) und „Noch keine
  Dateien" (`StatusStrip.tsx:58`). **Das** ist der Defekt: die Session hat keine Datei.

Die Session ist also **offen**. Klicken ändert nichts, weil sie bereits aktiv ist
(`CodeWorkspace.tsx:199` wählt sie, `SessionTabs.tsx:49` schaltet auf dieselbe id).
Für den Nutzer ist „offen und leer" von „geht nicht auf" nicht unterscheidbar — er
klickt zehnmal, und das Produkt sagt ihm nie, dass etwas schiefging.

**Belegte Wegstrecke.** Der Payload wird korrekt bis zur Session-Erzeugung getragen:

1. `standalone-chat.tsx:125` schreibt `{files, content, filename, prompt}` in den Stash.
2. `CodeWorkspace.tsx:91-101` liest ihn genau einmal, synchron, in `stashPayload`.
3. `CodeWorkspace.tsx:158-197` routet ihn: bei 0 oder 1 vorhandener Session
   `s.createSession({ initialContent, initialFilename, name })` (`:193`).
4. `useCodeSessions.ts:109-121` POSTet nach `/api/code-sessions`.

Bis hier ist nichts verloren. Der Bruch liegt am Ende:

```ts
// apps/api/src/routes/code-sessions.ts:205-215
if (initialContent && initialContent.trim()) {
  const path = (initialFilename && initialFilename.trim()) || 'index.html';
  await sb.from('code_session_files').insert({          // ← Rückgabewert verworfen
    session_id: session.id, user_id: userId, path, content: initialContent,
    change_state: 'draft',
  });
}
return c.json({ session: { ...session, draftCount: initialContent ? 1 : 0 } }, 201);
//                                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                     behauptet einen Entwurf, der nie geprüft wurde
```

Die Session-Zeile wird angelegt und zurückgegeben — deshalb **erscheint der Tab mit dem
richtigen, aus dem Prompt abgeleiteten Namen**. Schlägt das zweite Insert fehl (Unique
auf `(session_id, path)`, RLS, Größenlimit, Netz-Blip zwischen zwei getrennten
Supabase-Calls), bekommt der Client trotzdem `201` **und** `draftCount: 1`. Der Tab
zeigt den Entwurfs-Punkt (`SessionTabs.tsx:62`), die Session ist leer, und es gibt
**keinen einzigen Ort im Client, der das bemerken könnte** — `createSession` prüft nur
`res.ok` (`useCodeSessions.ts:115`).

**Root cause (D-A):** `POST /api/code-sessions` bestätigt das Landen des
Send-to-Code-Entwurfs, ohne es zu prüfen. Ein fehlgeschlagenes Datei-Insert ist von
einem erfolgreichen ununterscheidbar — für den Client und damit für den Nutzer.
Sekundär: der Client hat für „Payload geroutet, aber nicht angekommen" **keinen
Zustand** — er fällt in denselben generischen Leerzustand wie eine absichtlich leere
Session.

**Ehrliche Grenze.** Ich kann aus dieser Umgebung **nicht** feststellen, ob das Insert
im konkreten Lauf des Founders wirklich fehlschlug — dafür bräuchte es die Supabase-
Logs zu diesem Zeitpunkt. Was ich belegen kann: **wenn** es fehlschlägt, ist das
Ergebnis exakt das beobachtete Bild, und das Produkt schweigt dazu. Der Fix in U2 macht
den Fehlschlag daher zuerst *sichtbar* — er behebt die Blindheit, nicht eine geratene
Einzelursache. Siehe FOUNDER ACTIONS für die Abfrage, die die Frage abschließend klärt.

---

## 3. D-B — Der Nutzer-Turn verschwindet aus dem Code-Tab-Chat

**Symptom:** „dann im chat im coding tab geschrieben, stell mir das live - meine
nachricht war gleich nicht mehr sichtbar".

**Befund, der sicher ist:** Im Code-Tab existiert **kein optimistischer Nutzer-Turn**.
`SessionPane.handleSubmit` (`apps/web/components/code/SessionPane.tsx:331-358`) ruft
`agentRun.submit(...)` bzw. `runClassic(...)` und fügt der Thread-Liste nichts hinzu;
`SessionThread` rendert ausschließlich `detail.messages`
(`SessionPane.tsx:778-779`), also das, was der Server zuletzt geliefert hat. Eine Suche
über `SessionPane.tsx`, `useCodeAgent.ts` und `SessionPromptInput.tsx` nach
`setMessages` / `role: 'user'` findet keine einzige lokale Einfügung.

Die Sichtbarkeit der eigenen Nachricht hängt damit **vollständig** an
`detail.refresh()` — einem Netzwerk-Round-Trip, dessen Fehlerpfad
(`useCodeSessionDetail.ts:47`) still zurückkehrt.

**UNGEKLÄRT: die eigentliche Ursache des Verschwindens.** Der Founder sah die Blase
*erst* und *dann* nicht mehr. Ohne optimistischen Turn heißt „erst": ein `refresh` hatte
sie bereits vom Server. „Dann nicht mehr" heißt: ein *späterer* `refresh` lieferte sie
nicht. Ich konnte nicht feststellen, welcher.

Ausgeschlossen habe ich:
* **Nicht persistiert:** Der Agent-Pfad schreibt den Nutzer-Turn serverseitig
  (`apps/api/src/routes/code-sessions.ts:702-705`), und zwar *vor* dem Lauf. Das
  Screenshot zeigt einen gelaufenen Schritt („1 Schritt · 114ms"), der Insert war also
  erreicht.
* **Verlauf-Kollaps:** `SessionThread` klappt mit `COLLAPSED_COUNT = 3`
  (`SessionThread.tsx:24`) nur die **ältesten** Nachrichten ein
  (`messages.slice(-3)`, `:45`); der jüngste Nutzer-Turn fällt dabei nicht heraus,
  solange nach ihm höchstens zwei weitere Nachrichten kommen.
* **Regression der Lock-Screen-Turn-Loss-Behebung:** die betrifft den
  Standalone-Chat (`lib/chat-recovery.ts`), nicht diesen Thread. Es ist ein
  **zweiter, eigener Pfad** — keine Regression.

**Was U5 deshalb liefert:** nicht eine geratene Ursache, sondern die Erfüllung des
Vertrags — der Nutzer-Turn wird lokal dauerhaft, sofort, und überlebt jeden
fehlgeschlagenen oder unvollständigen Refresh. Das schließt die Symptomklasse
unabhängig davon, welcher Refresh sie ausgelöst hat.

---

## 4. D-C — Der Agent meldet „keine Dateien" für ein Projekt mit Dateien

**Symptom:** Schrittblock „Ich lese erst einmal die Projektdateien…" → „keine
Dateien · 114ms".

**Belegte Herkunft des Strings:** `apps/api/src/services/agent/tools.ts:362` —

```ts
summary: paths.length ? `${paths.length} Datei…` : 'keine Dateien',
```

`paths` kommt aus `listSessionPaths` (`tools.ts:329-334`):

```ts
const { data } = await sb.from('code_session_files').select('path').eq('session_id', sessionId);
return (data ?? [])…          // ← `error` wird nicht destrukturiert, nicht geprüft
```

**Root cause (D-C):** Zwei Stellen behaupten Leere, ohne sie geprüft zu haben.

1. `listSessionPaths` verwirft den Supabase-`error`. Jedes fehlgeschlagene Query
   (Timeout, Verbindungslimit, transienter 5xx) liefert `data === null` → `[]`.
2. `toolListFiles` gibt das als `ok: true` zurück. Der Schritt wird dem Nutzer als
   **gelungen** angezeigt, mit dem Ergebnis „keine Dateien" — und der Agent arbeitet
   ab da auf der Annahme eines leeren Projekts weiter.

Verstärkend: `hydrateSessionFiles` (`code-sessions.ts:85-125`) spiegelt die echten
Projektdateien in die Session, fängt aber **jeden** Fehler ab und loggt nur
(`:123`, `session_hydrate_failed`). Ein fehlgeschlagener Hydrate ist vom Fall
„Projekt ist wirklich leer" nicht unterscheidbar; der Lauf startet trotzdem.

Die 114 ms passen zu beidem: ein aufgelöst-leeres Query und ein fehlgeschlagenes
Query sind beide schnell. Genau das ist der Punkt — **die Zahl kann die beiden Fälle
nicht trennen, und der Code trennt sie auch nicht.**

Zweiter, unabhängig realer Pfad zur selben Anzeige: die im Chat gebaute Seite lebt
zunächst nur als **Entwurf** in der Session, aus der „An Code senden" sie erzeugt hat.
Erst „Sichern" schreibt sie in den Projektspeicher (`/save`, `code-sessions.ts:328`).
Ein Agent-Lauf in einer **anderen** Session desselben Projekts hydratisiert daher aus
einem leeren Speicher und meldet — korrekt, aber für den Nutzer unbegreiflich —
„keine Dateien". Das ist kein Bug in der Zählung, sondern eine fehlende Erklärung;
es gehört in FINDINGS, nicht in diesen Fix.

---

## 5. D-D — Der Editor zeigt den Code erst nach Verlassen und Wiederbetreten

**Symptom:** „dann nochmals raus, zuerst in anderes projekt dann in wieder ins richtige
projekt und dann auf editor, erst dann kam der erarbeitete code."

**Ausgeschlossen: serverseitige Hydration.** `GET /api/code-sessions/:sessionId`
ruft `hydrateSessionFiles` **vor** dem Ausliefern auf und `await`et es
(`code-sessions.ts:232`). Der erste Aufruf liefert bereits die gespiegelten Dateien;
ein „zweiter Aufruf hydratisiert erst" gibt es nicht.

**Ausgeschlossen: der PR-#101-Reset.** Siehe Abschnitt 0.

**Root cause (D-D):** Der Client kann einen **fehlgeschlagenen** ersten Detail-Load
nicht von einem erfolgreichen leeren unterscheiden:

```ts
// apps/web/hooks/code/useCodeSessionDetail.ts:46-48
const res = await authFetch(`/api/code-sessions/${sessionId}`);
if (!res.ok) { setLoading(false); return; }     // files bleibt [], kein Fehlerzustand
```

Der Code-Tab feuert beim Betreten einen **Pulk** von Requests: die
Verfügbarkeitssonde (`code-tab.tsx:55`), die Session-Liste (`useCodeSessions.ts:76`),
das Projekt (`CodeWorkspace.tsx:78`), das Session-Detail (`useCodeSessionDetail.ts:46`),
dazu `fetchAllTextFilesWithStatus` und die Hosted-Eligibility. Die API hat ein
generelles Rate-Limit von 60/min; dass genau dieser Pulk es reißt, ist im Repo bereits
dokumentiert und für andere Aufrufe mit `fetchWithRetryOn429` behandelt
(`apps/web/lib/api.ts:66-78`, Kommentar P1.10). **`useCodeSessionDetail` benutzt diesen
Schutz nicht** — es ruft `fetch` direkt.

Ein 429 (oder 5xx) auf dem Detail-Request ergibt damit exakt das beobachtete Bild:
Editor leer, keine Meldung. Beim Wiederbetreten läuft derselbe Request außerhalb des
Bursts, gelingt, und „erst dann kam der erarbeitete code."

**Ehrliche Grenze:** dass es im konkreten Lauf ein 429 war, ist nicht belegt — belegt
ist, dass **jeder** fehlgeschlagene Detail-Load als „Noch keine Dateien" erscheint und
ein Wiederbetreten ihn genau so heilt, wie beschrieben. U4 behebt die Ununterscheidbarkeit
und den fehlenden Retry.

---

## 6. D-E — Sackgasse in der Navigation aus dem Code-Tab

**Symptom:** „dann links auf projekt geklickt in menu leiste - passiert nichts. ich
musste oben im tab auf chat, das ich auf die projektübersicht komme."

**(1) Sidebar-Klick reagiert nicht.**
`apps/web/components/app-shell/projects-list.tsx:76-79`:

```tsx
onClick={() => { setActiveProject(project); router.push(`/dashboard/project/${project.id}`); }}
```

Der Founder stand auf `/dashboard/project/<id>/work?tab=code` und klickte **dasselbe**
Projekt. Der Push geht auf `/dashboard/project/<id>` — eine andere Route, die
Navigation ist also nicht „schon dort". Was passiert: Next.js navigiert, die
Projekt-Übersicht mountet — und `ProjectWorkspace` schreibt beim Verlassen noch
`sessionStorage['goblin:wsTab:<id>'] = 'code'` (`project-workspace.tsx:51-56`).
Ich konnte **nicht** verifizieren, dass der Push tatsächlich abgebrochen wird; das
verlangt einen Browser. Was ich belegen kann, ist ein realer Kandidat mit
Repo-Vorgeschichte: `useCodeSessions.ts:145-150` dokumentiert, dass eine
Render-Schleife im Code-Tab „silently aborting every in-app navigation out of the Code
tab (the K3/K4/K7 'trapped' cluster)" verursacht hat. Die Klasse ist in diesem Tab
belegt aufgetreten.

**Status: UNGEKLÄRT für die genaue Ursache des Nicht-Reagierens.** U6 liefert deshalb
keine geratene Reparatur, sondern die verifizierbare Verbesserung: der Sidebar-Eintrag
navigiert **zielgenau** (in den Workspace-Tab, in dem der Nutzer war, statt auf die
Hub-Route, die er nicht gemeint hat) und ist ein echtes `<Link>`-Ziel statt eines
reinen JS-Pushes — ein Klick, der die Route ohnehin erreicht, kann dann nicht mehr an
JS scheitern.

**(2) Kein Weg zurück zur Projektübersicht.**
Belegt und eindeutig: `SessionTabs` rendert `onBackToProject`
(`CodeWorkspace.tsx:228` → `SessionTabs.tsx:97-106`) **ausschließlich im
Mobile-Zweig** (`.gb-sessiontabs-mobile`, sichtbar erst unter 860 px). Der
Desktop-Streifen (`SessionTabs.tsx:43-93`) hat den Knopf nicht. Der Kommentar
`:16-18` sagt sogar, wofür er gedacht war („belt-and-suspenders escape … on mobile").
Auf Desktop existiert der Ausgang schlicht nicht — genau die vom Founder beschriebene
Sackgasse. Das ist eine **Verdrahtung**, kein Redesign: derselbe Callback, derselbe
Zielpfad, im anderen Zweig.

---

## 7. D-F — „Live stellen" meldet eine Ursache, die es nicht geprüft hat

### F1 (Ehrlichkeit) — Root cause belegt, exakt

`apps/web/lib/api.ts:83-88`:

```ts
function friendlyError(status: number, serverMessage?: string): string {
  if (status === 429) return 'Zu viele Anfragen – bitte einen Moment warten und neu laden.'
  if (status >= 500) return 'Server kurz nicht erreichbar – bitte gleich nochmal versuchen.'
  if (serverMessage && serverMessage !== 'Too Many Requests') return serverMessage   // ← zu spät
  …
}
```

Die 5xx-Zeile steht **vor** der Auswertung von `serverMessage`. Jede Antwort mit
Status ≥ 500 verliert damit ihre eigene Begründung.

Und genau dorthin fällt fast jeder Publish-Fehlschlag. `apps/api/src/routes/ops.ts:288-296`
mappt die Fehlercodes so:

| Code | Status | Serverseitige deutsche Meldung |
|---|---|---|
| `scan_review` | 202 | (kein Fehler) |
| `scan_blocked` | 422 | „Diese Veröffentlichung wurde gestoppt." |
| `name_taken` / `name_released` / `invalid_name` | 409 | Namensmeldung |
| `form_unwirable`, `d1_unavailable` | **503** | eigene Meldung |
| `review_unqueued` | **503** | eigene Meldung |
| **alle übrigen** — `empty_artifact`, `not_verified`, `upload_failed`, `route_failed` | **502** | eigene Meldung |

`HostedPublishSheet.publish()` (`apps/web/components/code/HostedPublishSheet.tsx:181-211`)
setzt `outcome = { kind: 'error', message: (e as Error).message }` — und diese Message
ist bereits das Produkt von `friendlyError`. Der Server sagt z. B. „In diesem Projekt
liegen noch keine Dateien, die veröffentlicht werden könnten."
(`apps/api/src/services/ops-publish.ts:352`); der Nutzer liest „Server kurz nicht
erreichbar – bitte gleich nochmal versuchen."

**Das ist der Verstoß in Reinform:** eine erfundene **Ursache** („der Server ist kurz
nicht erreichbar") und eine erfundene **Zeitangabe** („gleich nochmal") ersetzen eine
Antwort, die der Server ehrlich und auf Deutsch bereits gegeben hatte. Vier Versuche
mit identischem Ergebnis sind die Folge: dem Nutzer wurde geraten zu wiederholen, was
nicht wiederholbar helfen konnte.

Nebenbefund, der zum selben Fix gehört: `empty_artifact` ist kein Bad-Gateway. Es ist
eine Vorbedingung, die der Nutzer selbst auflösen kann. Der 502 ist die Zuordnung, die
den Fehler überhaupt erst in den ≥ 500-Zweig fallen lässt.

### F2 (der tatsächliche Fehlschlag) — begründete Hauptvermutung, **nicht belegt**

Ich kann nicht feststellen, welcher Code am 2026-08-18 für
`gitarrenunterricht` zurückkam — dafür braucht es die Railway-Logs
(`hosted_publish_started`, `apps/api/src/routes/ops.ts:269`) oder eine
Wiederholung mit offener Konsole.

Die konsistenteste Erklärung ist `empty_artifact`, und sie hängt direkt an D-A/D-D:
im Chat gebauter Code liegt zunächst nur als **Entwurf** in einer Code-Session. Erst
„Sichern" (`POST /:sessionId/save`) schreibt ihn in den Projektspeicher.
`publishHostedApp` liest den **Projektspeicher** — ein nie gesichertes Projekt hat dort
nichts, und `ops-publish.ts:352` antwortet exakt mit „noch keine Dateien" → 502 →
maskiert als „Server kurz nicht erreichbar". Der Founder hat im Walk kein „Sichern"
beschrieben, und D-A/D-D erklären, warum ihm nie klar wurde, dass es nötig war.

Die zweitplausibelste ist `not_verified` (die bekannte Verifikations-Baustelle,
ebenfalls 502).

**Ich patche keine der beiden auf Verdacht.** F1 macht den Unterschied sichtbar; die
konkrete Zuordnung steht in FOUNDER ACTIONS als ein Handgriff, der eine Minute dauert.
Sollte sich `empty_artifact` bestätigen, ist die richtige Antwort **nicht** ein
Publish-Fix, sondern ein früher, ehrlicher Stopp — „veröffentlichen, was nicht existiert"
muss laut und früh scheitern, nicht generisch.

---

## 8. D-G — Code im Chat ist kaum lesbar  [gemessen]

**Symptom:** „sichtbarkeit vom im chat generierten code ist weiterhin furchtbar".

**Root cause:** Es gibt genau **ein** Shiki-Theme, und es ist ein Light-Theme.

`apps/web/lib/syntax/highlighter.ts:4-5,29` registriert `goblin-light` als einziges
Theme und rendert **jeden** Codeblock damit — unabhängig vom App-Theme. Shiki schreibt
die Token-Farben als Inline-Styles in das HTML. Gleichzeitig entfernt
`apps/web/app/globals.css:789` den Theme-Hintergrund
(`.cb-body .shiki { background: transparent !important; }`), sodass die Token-Farben
auf `--surface-1` landen (`globals.css:791`, `.cb-a`) — hell `#FBF7EC`, dunkel `#133224`.

Gemessen (WCAG 2.1, `apps/web/lib/contrast.ts`; Skript-Ausgabe, Zahlen unverändert):

| Scope | Farbe | auf hell `#FBF7EC` | auf dunkel `#133224` |
|---|---|---|---|
| Standardtext | `#3F3A2C` | 10.59:1 | **1.23:1** |
| keyword | `#1A3A2A` | 11.66:1 | **1.11:1** |
| constant / type | `#A07726` | **3.80:1** | **3.42:1** |
| string | `#8B4A3A` | 6.25:1 | **2.08:1** |
| entity.name.function | `#133224` | 13.00:1 | **1.00:1** |
| variable | `#3F3A2C` | 10.59:1 | **1.23:1** |
| comment | `#74694F` | 5.06:1 | **2.57:1** |
| punctuation | `#B8A988` | **2.16:1** | 6.01:1 |

Zwei getrennte Befunde:

* **Hell:** Interpunktion 2.16:1 und Konstanten/Typen 3.80:1 liegen unter AA (4.5:1).
  Interpunktion ist in HTML/CSS — dem, was Goblin überwiegend erzeugt — der größte
  Anteil der Zeichen (`<`, `>`, `/`, `{`, `}`, `;`, `"`). Das ist der „near-zero
  contrast against the cream panel".
* **Dunkel:** alles außer Interpunktion fällt durch, im Extremfall auf **1.00:1** —
  Funktionsnamen haben exakt die Hintergrundfarbe und sind buchstäblich unsichtbar.

**Warum der bestehende Dark-Contrast-Audit das nicht fangen konnte:**
`apps/web/styles/dark-contrast.test.ts` löst Farbpaare aus den **CSS-Custom-Properties**
auf. Die Codeblock-Farben stehen in `lib/syntax/goblin-light.json` und werden von Shiki
als Inline-Style ausgegeben — sie kommen in keiner CSS-Datei vor. Die Achse des Audits
konnte diese Klasse strukturell nicht erreichen. U8 fügt sie hinzu.

**Betroffene Orte** (alle über denselben `highlight()`-Aufruf, deshalb ein Fix):
`components/chat/CodeBlock.tsx:66` (Chat-Stream + Datei-Karten),
`components/workspace/CodeBlock.tsx` (Workspace-Chat),
sowie jede Stelle, die `lib/syntax/highlighter.ts` benutzt.
Der Editor im Code-Tab ist **nicht** betroffen — er ist CodeMirror mit eigenem Theme
(`hooks/code/useEditorTheme.ts`), und der Fallback ohne Highlighting
(`chat/CodeBlock.tsx:326`) erbt `--ink-2` und ist in beiden Themes korrekt.

---

## 9. Zusammenfassung

| Defekt | Ursache festgestellt? | Fundstelle |
|---|---|---|
| D-A | **Teilweise** — Blindheit belegt, konkrete Insert-Ursache nicht | `code-sessions.ts:205-215` |
| D-B | **UNGEKLÄRT** — kein optimistischer Turn belegt, Auslöser nicht | `SessionPane.tsx:331-358` |
| D-C | **Ja** | `agent/tools.ts:329-334, 357-364` |
| D-D | **Ja** (Klasse belegt; konkreter Status im Lauf nicht) | `useCodeSessionDetail.ts:46-48` |
| D-E | (1) **UNGEKLÄRT**, (2) **Ja** | `projects-list.tsx:76`, `SessionTabs.tsx:43-106` |
| D-F1 | **Ja, exakt** | `lib/api.ts:86` + `ops.ts:288-296` |
| D-F2 | **Nein** — Hauptvermutung `empty_artifact`, unbelegt | `ops-publish.ts:352` |
| D-G | **Ja, gemessen** | `highlighter.ts:4`, `goblin-light.json` |

Gemeinsame Ursache über D-A / D-C / D-D: **unaufgelöst wird als leer gerendert**
(Abschnitt 1). Drei Implementierungen, ein Prinzip, drei Fixes.
