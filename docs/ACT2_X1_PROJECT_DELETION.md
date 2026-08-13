# X1 — eine gelöschte App bleibt nicht mehr live

**Geschrieben: 2026-08-13 · Autor: CC · Branch `claude/project-deletion-orphans-r4ewk7` · gegen master `246f6be` (enthält PR #89)**

Eine Einheit, ein zurücknehmbarer Commit, PR, kein Merge.

---

## 1. Was kaputt war

`ops_apps.project_id` ist `on delete cascade` (Migration `0099:39`). Ein Projekt zu löschen hat
damit **die Registry-Zeile** entfernt und sonst nichts:

| | vorher | nachher |
|---|---|---|
| `ops_apps`-Zeile | da | **weg** (Kaskade) |
| R2-Präfix `apps/{app_id}/` | da | **da** |
| KV-Record `route:{name}` | da | **da** |
| `{name}.justgoblin.app` | erreichbar | **erreichbar** |

Der Router liest KV und R2 und fragt die API nie. Die Seite lief also weiter — und **jede**
Betreiber-Handlung (suspend, unsuspend, teardown, Konsole) beginnt bei einer `ops_apps`-Zeile, die
es nicht mehr gab. Nicht auffindbar, nicht sperrbar, nicht abrechenbar, nur noch von Hand im
Cloudflare-Dashboard zu erreichen.

`0099:32-38` benennt genau das als **PHASE-2 OBLIGATION**. Sie war nicht erfüllt: `deleteAppFiles`
und `deleteRoute` existierten seit Phase 1, und kein Löschpfad rief sie.

---

## 2. Die Entscheidung: Vorbedingung, nicht bloß Reihenfolge

Der Auftrag stellt zwei Formen zur Wahl — *erst abbauen, dann löschen* oder *Abbau zur Vorbedingung
des Löschens machen*. Gewählt: **beides**, und die zweite ist die tragende.

**Warum Reihenfolge allein nicht reicht.** Die Reihenfolge gab es bereits — für Vercel. `DELETE
/projects/:id` baut die Vercel-Seite seit Wave D **vor** der Kaskade ab, best-effort, und löscht
danach in jedem Fall. Genau diese Konstruktion erzeugt Waisen: Reihenfolge legt nur fest, welcher
Schritt zuerst läuft; sie sagt nichts darüber, was passiert, wenn er fehlschlägt. Ein erster
Schritt, dessen Fehlschlag ignoriert wird, ist kein Schutz, sondern eine Vorliebe.

`ACT2_PHASE4_PREFLIGHT.md` §1 Punkt 1 empfiehlt ausdrücklich, diese Best-effort-Regel zu kopieren:
„ein Teardown-Fehler blockiert das Löschen nicht, sondern kommt als `orphanUrl` zurück". **Das ist
hier begründet abgelehnt**, aus zwei Gründen:

1. **Best-effort ist der Defekt, nicht die Lösung.** Bei einem fehlgeschlagenen Abbau plus
   erfolgreicher Löschung ist das Ergebnis exakt X1: eine erreichbare Adresse ohne Zeile. Eine
   `orphanUrl` in der Antwort ist keine Behebung, sondern eine Meldung an jemanden, der nichts mehr
   damit tun kann — die Zeile, über die jede Betreiber-Handlung liefe, ist in derselben Antwort
   gerade gelöscht worden.
2. **Die beiden Waisen sind nicht dieselbe Sache.** Ein verwaister Vercel-Deploy liegt auf dem
   **Konto des Nutzers**: er sieht ihn, er kann ihn löschen, er zahlt ihn. Ein verwaistes Living App
   liegt auf **Goblins** Ebene — nach der Kaskade kann buchstäblich niemand mehr heran.
   Best-effort ist vertretbar, solange am Ende noch jemand die Sache in der Hand hält.

**Was die Vorbedingung kostet und warum das der bessere Preis ist.** Ein Bauer, dessen Abbau gerade
nicht durchgeht, kann sein Projekt in diesem Moment nicht löschen und bekommt **409** mit einer
deutschen Erklärung. Dafür bleibt die Projektzeile stehen — und die ist nach dem Wegfall der
Registry-Zeile die einzige Verbindung zwischen der App und ihrem Besitzer. Sie zu behalten ist das,
was aus dem Fehlschlag einen **Wiederholungsversuch** macht statt eines dauerhaften Waisenkinds.

Das ist keine neue Regel. `account-deletion.ts` fährt sie seit FW6-U3 für Vercel und seit WAVE-B für
Supabase-Backends, wörtlich: *„teardown not confirmed → BLOCK the cascade, retry next cron pass"*.
X1 ist diese Regel, angekommen auf einer Ebene, die nach ihr gebaut wurde.

---

## 3. Was gebaut wurde

**`apps/api/src/services/ops-project-teardown.ts`** — neu, der ganze Mechanismus an einer Stelle.

1. **Nachsehen.** `findOpsAppForProjectTeardown(projectId)`. Kein App → `{ attempted: false,
   ok: true }` und der Löschpfad läuft unverändert weiter.
2. **Abbauen** über `teardownApp` — den **Phase-2-Pfad, unverändert**: Route **vor** Dateien (nichts
   liefert je eine halb gelöschte App aus), Dateien in ≤1000er-Stapeln (das #18-Antimuster wird
   nicht wiederholt), dann `markOpsAppDeleted`.
3. **Nachschauen, nicht behaupten.** Präfix neu gelistet, Route neu gelesen. `ok` ist nur wahr bei
   `orphansRemaining === 0 && routeGone === true`.
4. **Audit.** Eine Zeile `project_delete_teardown` mit `actor` = Nutzer-ID (**nicht** Betreiber),
   `meta.trigger = 'project_delete'` und dem Waisen-Beweis. Eigener Action-String, weil „wir haben
   deine App entfernt" und „du hast deine App entfernt" in einem Widerspruchsverfahren niemals
   verwechselt werden dürfen.
5. **Grabstein losbinden.** `detachOpsAppFromProject` setzt `project_id = NULL`. Ohne diesen Schritt
   nähme die Kaskade Sekunden später die Zeile mit, die `markOpsAppDeleted` ausdrücklich **behält** —
   und der Name fiele zurück in den Umlauf. Ein Fehlschlag hier blockiert **nicht**: die App ist
   bereits offline und ihre Dateien sind weg, der Preis ist ein freigegebener Name, kein Waisenkind.

**`apps/api/src/routes/projects.ts`** — `DELETE /:id` und `POST /bulk-delete`. Der Abbau läuft vor
allem anderen; ohne bestätigten Abbau **409** und nichts wird gelöscht. Im Bulk gilt das **pro
Projekt**: die anderen gehen durch, das blockierte kommt in `blocked` zurück. Der Vercel-Abbau läuft
erst nach dem Gate — eine Vercel-Seite abzureißen für ein Projekt, das man dann doch behält, wäre
sein eigenes Halb-Löschen.

Nebenbei behoben: das `projects.delete` prüfte seinen Fehler **nicht** und antwortete auch dann
`success: true`, wenn die Zeile stehen blieb. Jetzt **500** — und die Meldung sagt ausdrücklich, dass
die App bereits offline ist, weil das der nicht rücknehmbare Teil ist.

**`apps/api/src/services/account-deletion.ts`** — dieselbe Lücke eine Ebene höher (`ops_apps`
kaskadiert auch von `users`), dieselbe blockierende Haltung wie bei Vercel und Supabase daneben. Bei
einer Kontolöschung ist der Waise schlimmer: es bleibt kein Konto, das man fragen könnte, und Art. 17
endet nicht an der Datenbank.

**Die Falle, die der Test gefunden hat.** `teardownApp` schreibt den Endzustand `deleted`
**unabhängig** davon, ob die Substrat-Löschungen geklappt haben. Über die *Publish*-Suche
(`findOpsAppByProject`, die `deleted` herausfiltert) hätte der **zweite** Versuch geantwortet „dieses
Projekt hat keine App", die Zeile freigegeben und genau das Waisenkind erzeugt, das der erste
Versuch verhindert hatte — ein fehlgeschlagenes Gate hätte den Fehler für den nächsten Durchlauf
**scharf gemacht**. Deshalb die eigene Suche `findOpsAppForProjectTeardown`, die den Status ignoriert:
`project_id IS NOT NULL AND status = 'deleted'` heißt „Abbau begonnen, nie bestätigt" — ein
bestätigter Abbau hat sich losgebunden und wird hier nie gefunden.

### Kohortenschutz

Unverändert, und das ist eine Eigenschaft der Konstruktion, keine Zusage: ein Projekt ohne Living App
kostet **eine** indizierte Abfrage, die auf einer Prä-0099-Datenbank ohnehin `null` liefert. Kein
Cloudflare-Aufruf, keine Audit-Zeile, dieselbe Antwort wie vorher. Das gilt für jedes Akt-1-Projekt,
jedes Konto außerhalb der Allowlist und jede Datenbank ohne `0099`.

**Nicht** an `OPS_HOSTING_ENABLED` oder die Beta-Allowlist gehängt — mit Absicht. Beide regeln, wer
**veröffentlichen** darf. Der Router bedient sich aus KV und R2 und fragt die API nie; Akt 2 dunkel
zu schalten nimmt keine einzige App vom Netz. Wäre der Abbau an den Kill-Switch gehängt, würde jedes
Dunkelschalten X1 für alle folgenden Löschungen wieder aufreißen. Dieselbe Begründung, aus der die
Betreiber-Vollmachten mit ausgeschaltetem Flag weiterarbeiten (`ops-operator.ts`, Kopf).

---

## 4. Tests

`apps/api/src/routes/project-delete-orphans.test.ts` — 17 Tests. Sie prüfen **nicht**, dass
Löschaufrufe abgesetzt wurden; sie stellen ein **In-Memory-R2 und -KV** hinter die `cf-deploy`-Naht,
fahren die **echte** Route durch den **echten** Abbaupfad und **lesen das Substrat danach zurück**.

- Löschen **mit** veröffentlichter App → `r2` leer, `kv` leer, und `findOrphanedApps()` — dieselbe
  Frage, die ein Betreiber in Produktion stellt — kommt sauber zurück. Stapelung sichtbar
  (`[1000, 200]` bei 1200 Dateien). Audit-Zeile mit Bauer als `actor`. Grabstein `deleted` und
  losgebunden.
- Löschen **ohne** App → kein Cloudflare-Aufruf, keine Audit-Zeile, Projekt weg. Die Kohorte merkt
  nichts.
- **Fehlerpfad**, vier Formen: R2 leert nicht → 409, Projektzeile steht; KV-Route überlebt → 409;
  Registry nicht lesbar → 409 („unbekannt" ist nicht „nichts"); Abbau okay, aber DB-Löschung
  scheitert → 500, das ehrlich sagt, dass die App bereits unten ist.
- Der Wiederholungsversuch nach einem Fehlschlag findet die App **wieder** und läuft danach sauber
  durch.
- Bulk: eins blockiert, das andere gelöscht — und das blockierte hat seinen Vercel-Abbau **nicht**
  bekommen.

Dazu: `cf-deploy.test.ts` (KV-Listing inkl. Cursor und der Verweigerung einer Teil-Antwort),
`ops-operator.test.ts` (die neue KV-Hälfte des Sweeps), `account-deletion-teardown.security.test.ts`
(Kontolöschung baut ab, blockiert bei Nichtbestätigung, protokolliert als `system`),
`delete-project-wording.test.tsx` (der Wortlaut, DE **und** EN).

**Gesamtlauf:** `apps/api` 1946/1946 grün · `apps/web` 466/466 grün · beide Typecheck sauber.
Die drei Fixtures, die vorher keine `ops_apps`-Tabelle kannten, haben jetzt eine — leer, was für sie
der ehrliche Zustand ist.

---

## 5. Der Bestands-Sweep — GRÜNDER-AKTION, hier nicht gelaufen

**Die Frage:** gibt es heute eine KV-Route oder ein R2-Präfix ohne lebende `ops_apps`-Zeile?

**Die Antwort aus dieser Sitzung: unbekannt, und das wird hier nicht anders behauptet.** Der Sweep
liest das echte Cloudflare-Konto und die echte Datenbank. In diesem Container liegt weder ein
`CF_*`- noch ein `SUPABASE_*`-Wert (nachgeprüft: null gesetzte Variablen). Eine Zahl zu nennen wäre
erfunden.

**Was dieser Fix dafür beigetragen hat:** die **KV-Hälfte des Sweeps existierte bisher nicht.**
`findOrphanedApps()` verglich R2-Präfixe gegen die Registry und konnte damit nur „gespeichert, aber
unbekannt" finden — Speicherkosten. Ob eine **Adresse** noch auflöst, hat es nie gefragt, und das ist
die Hälfte, die tatsächlich etwas ausliefert. Eine Route, deren Dateien gelöscht wurden, deren
KV-Record aber blieb, war für den alten Sweep unsichtbar. Neu: `listRouteNames()` (paginiert; ein
abgeschnittenes Listing ist ein **Fehler**, keine kurze Antwort) und zwei getrennte Befunde.

**So läuft er — ein Aufruf:**

```bash
curl -s -H "x-admin-key: $ADMIN_API_KEY" \
  https://<api-host>/api/admin/ops/orphans | jq
```

**So wird die Antwort gelesen:**

| Feld | Bedeutung | Was zu tun ist |
|---|---|---|
| `routeOrphans` | KV-Route, die die Registry **nicht kennt** — eine **öffentlich erreichbare** Adresse ohne Zeile | Der eigentliche X1-Befund. Jede einzeln ansehen, bevor irgendetwas gelöscht wird |
| `routesOnDeletedApps` | Route auf einer Zeile mit Status `deleted` — Abbau nicht fertig geworden | Erneuter Teardown über die Konsole |
| `orphans` | R2-Präfix ohne Zeile | Speicherkosten; kein öffentlicher Zugang, solange keine Route darauf zeigt |
| `null` in einem Feld | **die Prüfung konnte nicht abgeschlossen werden** | Niemals als „keine gefunden" lesen |

**Es wird nichts gelöscht.** Der Report ist reiner Report; `purgeOrphans` verlangt **benannte** IDs
(es gibt bewusst kein „alle löschen"), einen Grund fürs Protokoll, und prüft jede ID unmittelbar vor
dem Löschen noch einmal gegen die Registry, damit eine Minuten alte Liste keine inzwischen
veröffentlichte App trifft. **Ohne Gründer-Bestätigung wird kein einziges Objekt angefasst.**

Ein Vorbehalt zur erwarteten Zahl: bekannt ist genau eine echte gehostete App
(`anmeldeformular.justgoblin.app`, vom Gründer online gehalten). Wenn der Sweep `routeOrphans: []`
liefert, ist X1 nie ausgelöst worden — das ist plausibel, aber **nicht** dasselbe wie bewiesen, und
der Unterschied ist genau der Aufruf oben.

---

## 6. Was bewusst nicht angefasst wurde

Keine Migration (der Fix braucht keine; `0099` und `0100` bleiben, wie sie sind) · das
Betreiber-Teardown und seine Semantik · der Publish-Pfad · `ops-review-queue` · Akt-1-Code ·
`anmeldeformular.justgoblin.app` · Merge.

Eine Sache ist **absichtlich** offen geblieben: `teardownApp` schreibt weiterhin `status = 'deleted'`
auch bei fehlgeschlagenem Abbau. Das für den Betreiber-Pfad zu ändern wäre eine
Verhaltensänderung an einer Notfallvollmacht und gehört nicht in diese Einheit. Auf dem X1-Pfad ist
es durch die eigene Suche entschärft (§3), und die neue Sweep-Kategorie `routesOnDeletedApps` macht
genau diesen Zustand jetzt **sichtbar** — vorher war er es nicht.
