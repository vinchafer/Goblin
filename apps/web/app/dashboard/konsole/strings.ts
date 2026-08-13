// AKT 2 · PHASE 2.5 · U-C2 — every word the founder console says, in DE and EN.
//
// Same shape as app/welcome/_components/i18n.ts: a typed map keyed by language,
// no i18n library. The `Dict` type is derived from `de`, so TypeScript refuses to
// compile an `en` block that is missing a key or has an extra one — parity is a
// compile error here, not something a grep has to catch later. (There is a grep
// too, in strings.test.ts, because a type can be satisfied by an empty string and
// an empty string is not a translation.)
//
// German is the source language and English is the translation, matching the rest
// of the app: the founder operates in German.
//
// A note on tone, because this file is the console's whole voice. These strings
// describe an operator surface that writes to production. They do not reassure.
// Where something is unknown they say UNBEKANNT, where something is irreversible
// they say so in the sentence the founder reads before confirming, and where a
// button cannot work they explain why instead of disappearing.

export type Lang = 'de' | 'en';

const de = {
  meta: {
    title: 'Gründer-Konsole',
    subtitle: 'Akt 2 · Ops',
    signedInAs: 'Angemeldet als',
  },

  status: {
    heading: 'Zustand',
    refresh: 'Neu laden',
    refreshing: 'lädt …',
    lastRefreshed: 'Zuletzt geladen',
    never: 'noch nie',
    unknown: 'UNBEKANNT',
    unknownHint: 'Der Wert konnte nicht ermittelt werden — nicht verwechseln mit „nicht vorhanden".',
    hosting: 'Hosting-Schalter',
    hostingOn: 'an',
    hostingOff: 'aus',
    hostingOffNote:
      'OPS_HOSTING_ENABLED ist aus. Die Ops-Ebene (/api/ops) antwortet damit für alle mit 404 — Veröffentlichen und Router-Aktionen funktionieren erst, wenn der Schalter an ist. Sperren und Teardown funktionieren trotzdem: sie hängen bewusst nicht an diesem Schalter.',
    router: 'Router',
    workerDeployed: 'Worker deployt',
    wildcardProxied: 'Wildcard proxied',
    wildcardTrap:
      'Der dokumentierte Stolperstein: ein *-Eintrag kann existieren und trotzdem nicht proxied sein (graue Wolke). Dann läuft der Worker nie.',
    routeBound: 'Route gebunden',
    zoneFound: 'Zone gefunden',
    routerNotes: 'Hinweise vom Router-Check',
    migrations: 'Migrationen',
    registry: '0099 · Registry (ops_apps)',
    audit: '0100 · Protokoll (ops_app_audit)',
    applied: 'angewendet',
    notApplied: 'nicht angewendet',
    auditMissingNote:
      'Ohne 0100 funktionieren Sperren weiterhin, aber jede Aktion meldet „audit: unavailable" statt eine Beweiszeile zu schreiben.',
    registryMissingNote:
      'Ohne 0099 verweigert der Veröffentlichungs-Pfad die Arbeit — absichtlich: hochgeladene Dateien ohne Registry-Zeile wären ein Waisenkind.',
    appsDomain: 'App-Domain',
    yes: 'ja',
    no: 'nein',
  },

  router: {
    heading: 'Router ausrollen',
    lead: 'Lädt den Worker hoch, sucht die Zone, setzt den Wildcard-Eintrag und bindet die Route. Idempotent — mehrfach ausführen ist ausdrücklich in Ordnung.',
    action: 'Router ausrollen',
    running: 'rollt aus …',
    provisioned: 'Alle Schritte grün — der Router steht.',
    blocked: 'Mindestens ein Schritt hat nicht funktioniert.',
    // Nicht mehr nur Cloudflare: fehlt einem Binding sein Wert, zeigt der Schritt
    // auf die Railway-Variable, die leer ist — namentlich.
    founderActions: 'Das musst du selbst erledigen (Cloudflare-Dashboard bzw. Railway):',
    steps: 'Schritte',
    disabledNoHosting: 'Nicht möglich, solange OPS_HOSTING_ENABLED aus ist — /api/ops antwortet dann mit 404.',
  },

  publish: {
    heading: 'Test-App veröffentlichen',
    lead: 'Veröffentlicht ein Projekt dieses Kontos unter einem eigenen Namen. Der Scan läuft vorher, die Prüfung danach.',
    project: 'Projekt',
    projectPlaceholder: 'Projekt wählen …',
    noProjects: 'Dieses Konto hat noch keine Projekte.',
    projectsUnavailable: 'Die Projektliste konnte nicht geladen werden.',
    name: 'Name',
    namePlaceholder: 'z. B. goblin-test',
    nameChecking: 'wird geprüft …',
    nameFree: 'Dieser Name ist frei.',
    nameTaken: 'Dieser Name ist vergeben.',
    nameInvalid: 'Dieser Name geht nicht.',
    nameHint: 'Kleinbuchstaben, Ziffern und Bindestriche. Die Prüfung ist keine Reservierung — erst das Veröffentlichen entscheidet.',
    action: 'Veröffentlichen',
    running: 'veröffentlicht …',
    published: 'Live.',
    open: 'Öffnen',
    // ── C7 (2026-08-13): drei Ausgänge, drei Sätze ──────────────────────────
    // Vorher rannte jede 2xx-Antwort in „Live." — auch die 202 einer gehaltenen
    // Veröffentlichung, die NICHTS hochgeladen hat. Jeder Ausgang hat jetzt seine
    // eigene Zeile, und der unbekannte Fall sagt „unklar" statt „live".
    heldTitle: 'Angehalten — nichts veröffentlicht.',
    heldPointer: 'Der Eintrag steht unten in der Prüfliste. Dort kannst du ihn ansehen und entscheiden.',
    refusedTitle: 'Abgelehnt von der festen Regelliste — nichts veröffentlicht.',
    unclearTitle: 'UNKLAR — die Antwort war nicht eindeutig.',
    unclearBody:
      'Die API hat etwas geantwortet, das diese Karte nicht sicher deuten kann. Das heißt NICHT „live" und nicht „fehlgeschlagen". Sieh in „Gehostete Apps" und in der Prüfliste nach, was tatsächlich passiert ist, und ruf die Adresse selbst auf.',
    notRecordedTitle: 'Angehalten — und nicht vorgemerkt.',
    disabledNoHosting: 'Nicht möglich, solange OPS_HOSTING_ENABLED aus ist.',
    disabledNoProject: 'Erst ein Projekt wählen.',
    disabledNoName: 'Erst einen Namen eingeben.',
    disabledNameTaken: 'Dieser Name ist vergeben — bitte einen anderen.',
  },

  apps: {
    heading: 'Gehostete Apps',
    lead: 'Alle Apps aus der Registry. Sperren und Teardown wirken auf die App von jedem Konto — das ist Betreiber-Werkzeug.',
    none: 'Es ist noch keine App veröffentlicht.',
    unavailable:
      'Die Registry konnte nicht gelesen werden. Das heißt NICHT „keine Apps" — es heißt, dass hier gerade niemand nachsehen kann. Prüfe Migration 0099.',
    status: 'Status',
    statusActive: 'aktiv',
    statusSuspended: 'gesperrt',
    statusProvisioning: 'wird eingerichtet',
    statusFailed: 'fehlgeschlagen',
    lastPublished: 'Zuletzt veröffentlicht',
    open: 'Öffentliche URL öffnen',
    suspend: 'Sperren',
    unsuspend: 'Entsperren',
    teardown: 'Teardown',
    reason: 'Grund',
    reasonPlaceholder: 'Wird protokolliert und dem Nutzer gezeigt.',
    reasonRequired: 'Eine Sperre braucht einen Grund — der Nutzer bekommt ihn zu lesen.',
    confirm: 'Bestätigen',
    cancel: 'Abbrechen',
    teardownWarnTitle: 'Teardown ist endgültig.',
    teardownWarnBody:
      'Alle Dateien werden aus R2 gelöscht und die Route wird entfernt. Die öffentliche Adresse antwortet danach mit 404. Das lässt sich nicht rückgängig machen — es gibt keine Wiederherstellung.',
    teardownConfirmPrompt: 'Tippe den App-Namen, um den Teardown zu bestätigen:',
    teardownConfirmMismatch: 'Der Name stimmt nicht überein.',
    teardownFinal: 'Endgültig löschen',
    measuring: 'Messe, wann die Änderung öffentlich sichtbar wird …',
    measuredVisible: 'Öffentlich sichtbar nach',
    measuredSeconds: 'Sekunden',
    measuredTimeout:
      'Innerhalb des Messfensters war die Änderung öffentlich noch nicht sichtbar. Die Aktion selbst ist trotzdem ausgeführt — KV-Routen sind erst nach kurzer Zeit überall gültig.',
    measuredNote: 'Gemessen, nicht angenommen: die API hat die öffentliche URL wiederholt abgefragt.',
    auditWritten: 'Protokollzeile geschrieben.',
    auditUnavailable: 'Keine Protokollzeile — Migration 0100 fehlt. Die Aktion steht im Anwendungs-Log.',
    auditFailed: 'Die Protokollzeile konnte nicht geschrieben werden.',
  },

  // ── X1-S — die Waisen-Prüfung ─────────────────────────────────────────────
  // Nur-Lesen. Der Ton hier trägt eine einzige Last: der Unterschied zwischen
  // „nichts gefunden" und „konnte nicht nachsehen" darf nirgends verschwimmen —
  // weder im Wort noch in der Farbe.
  orphans: {
    heading: 'Waisen-Prüfung',
    lead: 'Fragt Cloudflare (KV, R2 und D1) und die Registry und meldet, was auf dem Substrat liegt, ohne dass eine Registry-Zeile darauf zeigt. Reiner Bericht — diese Karte löscht nichts.',
    action: 'Prüfung starten',
    running: 'prüft …',
    notRun:
      'Noch nicht geprüft. Die Prüfung läuft absichtlich nicht beim Öffnen der Seite: sie listet KV und R2 vollständig auf, und das gehört ausgelöst statt nebenbei getan.',
    checkedAt: 'Geprüft am',
    verdictRow: 'Befund',
    verdictClean: 'Nichts gefunden — und jede einzelne Prüfung ist durchgelaufen.',
    verdictFound: 'Es gibt einen Befund. Jede Zeile einzeln ansehen, bevor irgendetwas passiert.',
    verdictIncomplete:
      'UNVOLLSTÄNDIG — ein Teil der Prüfung ist nicht durchgelaufen. Was durchgelaufen ist, steht unten; der Rest ist offen, nicht sauber.',
    verdictUnknown:
      'UNBEKANNT — es konnte gar nichts geprüft werden. Das ist keine Entwarnung, das ist eine ausgefallene Prüfung.',
    routeOrphans: 'Verwaiste KV-Routen',
    routeOrphansMeaning:
      'Eine Adresse, die auflöst, ohne dass die Registry sie kennt: öffentlich erreichbar, für die Konsole unsichtbar, nicht sperrbar. Das ist der eigentliche X1-Befund.',
    routesOnDeletedApps: 'Routen auf gelöschten Apps',
    routesOnDeletedAppsMeaning:
      'Hier gibt es eine Zeile, und sie sagt „gelöscht" — die Adresse löst trotzdem noch auf. Der Abbau ist nicht fertig geworden; er lässt sich über „Gehostete Apps" wiederholen.',
    r2Orphans: 'Verwaiste R2-Präfixe',
    r2OrphansMeaning:
      'Dateien ohne Zeile. Kein öffentlicher Zugang, solange keine Route darauf zeigt — es sind Speicherkosten, die niemandem zugeordnet sind.',
    d1Orphans: 'Verwaiste Formular-Datenbanken',
    d1OrphansMeaning:
      'Eine Datenbank, die Goblin für eine App angelegt hat, ohne dass die Registry diese App noch kennt. Darin liegen möglicherweise Einsendungen von Besuchern — fremde personenbezogene Daten, für die niemand mehr zuständig ist. Von den Zeilen auf dieser Karte ist das die schwerste.',
    d1OnDeletedApps: 'Datenbanken gelöschter Apps',
    d1OnDeletedAppsMeaning:
      'Hier gibt es eine Zeile, und sie sagt „gelöscht" — die Datenbank steht trotzdem noch. Der Abbau ist nicht fertig geworden; er lässt sich über „Gehostete Apps" wiederholen.',
    clean: 'keine gefunden',
    found: 'gefunden',
    notChecked: 'NICHT GEPRÜFT',
    notCheckedNote:
      'Dieses Feld kam leer im Sinne von „unbekannt" zurück (null). Das heißt NICHT „keine gefunden" — es heißt, dass die Prüfung nicht abgeschlossen werden konnte. Der Grund steht in den Hinweisen.',
    counts: 'Gezählt',
    knownApps: 'Registry-Zeilen',
    prefixesInR2: 'Präfixe in R2',
    routesInKv: 'Routen in KV',
    d1InCloudflare: 'Formular-Datenbanken bei Cloudflare',
    notes: 'Hinweise der Prüfung',
    noPurge:
      'Es gibt hier bewusst keinen Lösch-Knopf. Aufräumen verlangt benannte App-IDs, einen Grund fürs Protokoll und eine erneute Prüfung gegen die Registry unmittelbar vor dem Löschen — das bleibt ein eigener, ausdrücklicher Schritt und kein Knopf neben einem Bericht.',
  },

  // ── PHASE 3 · U3.3 — die Prüfliste ────────────────────────────────────────
  // Der Ton hier ist bewusst anders als bei „Gehostete Apps": dort geht es um
  // etwas, das live ist. Hier geht es um etwas, das NICHT live ist und auch
  // nicht war. Jede Zeile, die klingt wie „abschalten", wäre falsch.
  reviews: {
    heading: 'Prüfliste',
    lead: 'Veröffentlichungen, die die feste Regelliste bestanden haben und die der Klassifizierer angehalten hat. Es ist nichts hochgeladen und nichts online — es wartet auf deine Entscheidung.',
    none: 'Es wartet nichts auf Prüfung.',
    unavailable:
      'Die Prüfliste konnte nicht gelesen werden. Das heißt NICHT „nichts wartet" — es heißt, dass hier gerade niemand nachsehen kann. Prüfe Migration 0102.',
    requestedName: 'Gewünschter Name',
    waitingSince: 'Wartet seit',
    stage1: 'Stufe 1 (feste Regeln)',
    stage2: 'Stufe 2 (Klassifizierer)',
    categories: 'Kategorien',
    noCategories: 'keine — die Prüfung konnte nicht abgeschlossen werden',
    confidence: 'Sicherheit',
    scanned: 'Geprüft',
    files: 'Dateien',
    tokens: 'Tokens (rein/raus)',
    // Die fünf Gründe, in Klartext. „Angehalten" ist nicht dasselbe wie „verdächtig".
    reasonFlagged: 'Der Klassifizierer hat die Seite gelesen und etwas gefunden, das ein Mensch ansehen sollte.',
    reasonOverBudget:
      'Die Seite war größer als das Prüf-Budget. Sie wurde NICHT gekürzt und beurteilt — sie wurde gar nicht beurteilt. Das sagt nichts über den Inhalt aus.',
    reasonUnavailable: 'Der Klassifizierer war nicht erreichbar oder nicht konfiguriert. Eine Prüfung, die nicht laufen konnte, ist nicht bestanden.',
    reasonTimeout: 'Der Klassifizierer hat nicht rechtzeitig geantwortet. Das sagt nichts über den Inhalt aus.',
    reasonUnparseable: 'Die Antwort des Klassifizierers war nicht auswertbar. Das sagt nichts über den Inhalt aus.',
    reasonUnknown: 'UNBEKANNT — der Grund wurde nicht mitgeliefert.',
    preview: 'Inhalt ansehen',
    previewHide: 'Inhalt einklappen',
    previewLoading: 'lädt …',
    previewNote:
      'Roher Quelltext, als Text dargestellt. Er wird hier nirgends ausgeführt, nicht als HTML eingebettet und lädt nichts nach — deshalb siehst du Markup und keine Seite.',
    previewUnavailable:
      'Die Dateien konnten nicht gelesen werden — das Projekt wurde womöglich gelöscht. Das heißt NICHT „die App ist leer".',
    previewTruncated: 'Gekürzt — die Datei ist länger als hier gezeigt.',
    previewBinary: 'Nicht-Text-Dateien (nur Namen)',
    previewOmitted: 'Weitere Text-Dateien, hier nicht gezeigt',
    approve: 'Freigeben',
    approving: 'gibt frei …',
    block: 'Ablehnen',
    blocking: 'lehnt ab …',
    reason: 'Grund',
    reasonPlaceholder: 'Wird protokolliert und dem Nutzer gezeigt.',
    reasonRequiredBlock: 'Eine Ablehnung braucht einen Grund — der Nutzer bekommt ihn zu lesen.',
    reasonOptionalApprove: 'Bei einer Freigabe optional — steht trotzdem im Protokoll.',
    approveNote:
      'Die Freigabe startet die Veröffentlichung sofort. Die feste Regelliste läuft dabei erneut: eine Freigabe überstimmt den Klassifizierer, nicht die harten Regeln.',
    blockNote: 'Eine Ablehnung nimmt nichts vom Netz — es war nie etwas online. Sie schließt den Eintrag und schreibt die Protokollzeile.',
    approved: 'Freigegeben.',
    blocked: 'Abgelehnt.',
    publishFailed:
      'Die Freigabe steht und ist protokolliert — die Veröffentlichung selbst ist nicht durchgelaufen. Der Eintrag geht dadurch nicht zurück in die Warteschlange.',
    published: 'Freigegeben und live.',
    auditWritten: 'Protokollzeile geschrieben.',
    auditUnavailable: 'Keine Protokollzeile — Migration 0100 fehlt. Die Entscheidung steht im Anwendungs-Log.',
    auditFailed: 'Die Protokollzeile konnte nicht geschrieben werden.',
    // ── C8 (2026-08-13): der Entscheidungs-Verlauf, ohne SQL ─────────────────
    decidedHeading: 'Zuletzt entschieden',
    decidedNone: 'Es wurde noch nichts entschieden.',
    decidedBy: 'Entschieden von',
    decidedAt: 'Entschieden am',
    decidedReason: 'Grund',
    decidedNoReason: 'kein Grund hinterlegt',
    statusApproved: 'freigegeben',
    statusBlocked: 'abgelehnt',
    decidedNote:
      'Gelesen aus der Prüfliste selbst. Die Beweiszeile in ops_app_audit ist davon unberührt und bleibt 12 Monate — sie überlebt auch das Löschen des Kontos, diese Liste nicht.',
  },

  e2e: {
    heading: 'Ende-zu-Ende-Lauf',
    lead: 'Fährt die komplette Schleife auf der echten Infrastruktur: Preflight, Scan-Batterie, fünf Veröffentlichungen, Umbenennen mit 410, feindliche Datei, Sperren und Entsperren, Teardown. Dauert 5–15 Minuten.',
    start: 'E2E starten',
    starting: 'startet …',
    running: 'läuft',
    done: 'fertig',
    failed: 'abgebrochen',
    elapsed: 'Laufzeit',
    stepsCompleted: 'Schritte gemeldet',
    noProgressBar:
      'Keine Fortschrittsanzeige in Prozent: wie viele Schritte ein Lauf hat, steht erst am Ende fest — ein blockierter Preflight endet nach zwei. Angezeigt wird, was gemeldet wurde.',
    memoryWarning:
      'Der Fortschritt liegt im Arbeitsspeicher der API. Ein Redeploy löscht diese ANSICHT — der Lauf selbst kann trotzdem weiterlaufen und fertig werden, denn seine Schreibvorgänge gehen direkt an Cloudflare und Supabase. Kopiere das Ergebnis, bevor du etwas neu deployst.',
    unknownJob:
      'Dieser Lauf ist der API nicht (mehr) bekannt. Das heißt nicht, dass er fehlgeschlagen ist — die Ansicht ist weg, das Ergebnis steht in der App-Liste und im Protokoll.',
    numbers: 'Die Zahlen',
    publishLoops: 'Veröffentlichungen',
    scanBattery: 'Scan-Batterie',
    suspensionRoundTrip: 'Sperr-Runde',
    propagation: 'Propagation',
    passed: 'Alle Schritte grün.',
    notPassed: 'Mindestens ein Schritt ist rot.',
    disabledRunning: 'Es läuft bereits ein Lauf.',
    disabledNoHosting: 'Nicht möglich, solange OPS_HOSTING_ENABLED aus ist — der Lauf käme über den Preflight nicht hinaus.',
    notes: 'Hinweise',
  },

  copy: {
    heading: 'Ergebnis kopieren',
    lead: 'Kopiert das Ergebnis als JSON in die Zwischenablage — ohne Tokens, Schlüssel und Adressen.',
    action: 'Ergebnis kopieren',
    copied: 'Kopiert.',
    failed: 'Das Kopieren hat nicht funktioniert. Der Text steht unten und lässt sich markieren.',
    summary: 'Zusammenfassung',
    nothing: 'Es gibt noch kein Ergebnis zum Kopieren.',
    scrubbed: 'Bereinigt: E-Mail-Adressen und alles, was nach einem Schlüssel aussieht, sind entfernt.',
  },

  error: {
    title: 'Das hat nicht funktioniert.',
    detail: 'Details',
    copyDetail: 'Details kopieren',
    network: 'Die API war nicht erreichbar.',
    unauthorized: 'Die Sitzung wurde nicht akzeptiert. Melde dich neu an.',
    notFound: 'Diese Aktion gibt es hier nicht.',
    generic: 'Die API hat mit einem Fehler geantwortet.',

    // ── U-A3: was eine Abweisung bedeutet ────────────────────────────────────
    // Die Ops-Routen weisen ab, indem sie antworten wie eine Route, die es nie
    // gab: Status 404, Text „404 Not Found". Das ist für die Kohorte gedacht und
    // bleibt so. Diese Konsole sieht aber nur der Betreiber — deshalb darf hier
    // stehen, was diese Antwort heißt, statt sie roh durchzureichen.
    refusedTitle: 'Diese Aktion wurde abgelehnt.',
    refused:
      'Die Route hat diese Sitzung nicht angenommen und antwortet deshalb wie eine Route, die es gar nicht gibt. Das gilt absichtlich auch für dich.',
    // Zwei Ursachen, die von außen gleich aussehen — und genau so bleiben sollen.
    // Hier steht deshalb beides, ohne zu raten, welche davon zutrifft.
    refusedWhy:
      'Zwei Ursachen sehen von hier aus gleich aus, und die Antwort unterscheidet sie mit Absicht nicht: entweder steht dieses Konto für diese Route nicht auf der Liste (OPS_FOUNDER_ACCOUNTS bzw. OPS_BETA_ACCOUNTS), oder der Hosting-Schalter steht auf aus (OPS_HOSTING_ENABLED). Welche von beiden es war, steht im Server-Log — hier steht es bewusst nicht.',
    noDetail: 'Die API hat kein Detail mitgeschickt.',
  },
};

const en: typeof de = {
  meta: {
    title: 'Founder console',
    subtitle: 'Act 2 · Ops',
    signedInAs: 'Signed in as',
  },

  status: {
    heading: 'State',
    refresh: 'Reload',
    refreshing: 'loading …',
    lastRefreshed: 'Last loaded',
    never: 'never',
    unknown: 'UNKNOWN',
    unknownHint: 'The value could not be determined — not to be confused with "not there".',
    hosting: 'Hosting switch',
    hostingOn: 'on',
    hostingOff: 'off',
    hostingOffNote:
      'OPS_HOSTING_ENABLED is off. The ops plane (/api/ops) therefore answers 404 for everyone — publishing and router actions only work once the switch is on. Suspend and teardown still work: they deliberately do not hang on this switch.',
    router: 'Router',
    workerDeployed: 'Worker deployed',
    wildcardProxied: 'Wildcard proxied',
    wildcardTrap:
      'The documented trap: a * record can exist and still not be proxied (grey cloud). Then the Worker never runs.',
    routeBound: 'Route bound',
    zoneFound: 'Zone found',
    routerNotes: 'Notes from the router check',
    migrations: 'Migrations',
    registry: '0099 · registry (ops_apps)',
    audit: '0100 · audit (ops_app_audit)',
    applied: 'applied',
    notApplied: 'not applied',
    auditMissingNote:
      'Without 0100 suspensions still work, but every action reports "audit: unavailable" instead of writing an evidence row.',
    registryMissingNote:
      'Without 0099 the publish path refuses to work — deliberately: uploaded files with no registry row would be an orphan.',
    appsDomain: 'Apps domain',
    yes: 'yes',
    no: 'no',
  },

  router: {
    heading: 'Provision the router',
    lead: 'Uploads the Worker, finds the zone, sets the wildcard record and binds the route. Idempotent — running it repeatedly is explicitly fine.',
    action: 'Provision the router',
    running: 'provisioning …',
    provisioned: 'Every step green — the router is up.',
    blocked: 'At least one step did not work.',
    founderActions: 'This part you have to do yourself (Cloudflare dashboard or Railway):',
    steps: 'Steps',
    disabledNoHosting: 'Not possible while OPS_HOSTING_ENABLED is off — /api/ops answers 404 then.',
  },

  publish: {
    heading: 'Publish a test app',
    lead: 'Publishes a project of this account under its own name. The scan runs before, the verification after.',
    project: 'Project',
    projectPlaceholder: 'Choose a project …',
    noProjects: 'This account has no projects yet.',
    projectsUnavailable: 'The project list could not be loaded.',
    name: 'Name',
    namePlaceholder: 'e.g. goblin-test',
    nameChecking: 'checking …',
    nameFree: 'This name is free.',
    nameTaken: 'This name is taken.',
    nameInvalid: 'This name will not work.',
    nameHint: 'Lower-case letters, digits and hyphens. The check is not a reservation — only publishing decides.',
    action: 'Publish',
    running: 'publishing …',
    published: 'Live.',
    open: 'Open',
    heldTitle: 'Held — nothing published.',
    heldPointer: 'The item is in the review queue below. You can look at it and decide there.',
    refusedTitle: 'Refused by the fixed rule list — nothing published.',
    unclearTitle: 'UNCLEAR — the answer was not conclusive.',
    unclearBody:
      'The API answered something this card cannot read with confidence. That does NOT mean "live" and does not mean "failed". Check "Hosted apps" and the review queue for what actually happened, and open the address yourself.',
    notRecordedTitle: 'Held — and not recorded.',
    disabledNoHosting: 'Not possible while OPS_HOSTING_ENABLED is off.',
    disabledNoProject: 'Choose a project first.',
    disabledNoName: 'Enter a name first.',
    disabledNameTaken: 'This name is taken — please pick another.',
  },

  apps: {
    heading: 'Hosted apps',
    lead: 'Every app in the registry. Suspend and teardown act on any account’s app — this is operator tooling.',
    none: 'No app has been published yet.',
    unavailable:
      'The registry could not be read. That does NOT mean "no apps" — it means nobody can look right now. Check migration 0099.',
    status: 'Status',
    statusActive: 'active',
    statusSuspended: 'suspended',
    statusProvisioning: 'provisioning',
    statusFailed: 'failed',
    lastPublished: 'Last published',
    open: 'Open the public URL',
    suspend: 'Suspend',
    unsuspend: 'Unsuspend',
    teardown: 'Teardown',
    reason: 'Reason',
    reasonPlaceholder: 'Recorded, and shown to the user.',
    reasonRequired: 'A suspension needs a reason — the user gets to read it.',
    confirm: 'Confirm',
    cancel: 'Cancel',
    teardownWarnTitle: 'Teardown is final.',
    teardownWarnBody:
      'Every file is deleted from R2 and the route is removed. The public address answers 404 afterwards. This cannot be undone — there is no restore.',
    teardownConfirmPrompt: 'Type the app name to confirm the teardown:',
    teardownConfirmMismatch: 'The name does not match.',
    teardownFinal: 'Delete for good',
    measuring: 'Measuring when the change becomes publicly visible …',
    measuredVisible: 'Publicly visible after',
    measuredSeconds: 'seconds',
    measuredTimeout:
      'Within the measurement window the change was not yet publicly visible. The action itself has still been carried out — KV routes take a short while to be valid everywhere.',
    measuredNote: 'Measured, not assumed: the API polled the public URL repeatedly.',
    auditWritten: 'Audit row written.',
    auditUnavailable: 'No audit row — migration 0100 is missing. The action is in the application log.',
    auditFailed: 'The audit row could not be written.',
  },

  orphans: {
    heading: 'Orphan check',
    lead: 'Asks Cloudflare (KV, R2 and D1) and the registry, and reports whatever sits on the substrate with no registry row pointing at it. Report only — this card deletes nothing.',
    action: 'Run the check',
    running: 'checking …',
    notRun:
      'Not checked yet. The sweep deliberately does not run when the page opens: it lists KV and R2 in full, which belongs to a deliberate tap rather than to a page load.',
    checkedAt: 'Checked at',
    verdictRow: 'Finding',
    verdictClean: 'Nothing found — and every single check completed.',
    verdictFound: 'There is a finding. Look at each line individually before anything happens to it.',
    verdictIncomplete:
      'INCOMPLETE — part of the sweep did not complete. What did complete is below; the rest is open, which differs from clear.',
    verdictUnknown: 'UNKNOWN — nothing at all could be checked. That is a failed sweep, never an all-clear.',
    routeOrphans: 'Orphaned KV routes',
    routeOrphansMeaning:
      'A hostname that resolves while the registry has never heard of it: publicly reachable, invisible to this console, impossible to suspend. This is the actual X1 finding.',
    routesOnDeletedApps: 'Routes on deleted apps',
    routesOnDeletedAppsMeaning:
      'Here a row does exist, and it says "deleted" — yet the hostname still resolves. The teardown never finished; it can be retried from "Hosted apps".',
    r2Orphans: 'Orphaned R2 prefixes',
    r2OrphansMeaning:
      'Files with no row. No public access as long as no route points at them — this is storage cost nobody is billed for.',
    d1Orphans: 'Orphaned form databases',
    d1OrphansMeaning:
      'A database Goblin created for an app the registry no longer knows about. It may hold visitors\' submissions — other people\'s personal data, with nobody accountable for it. Of every line on this card, this is the heaviest.',
    d1OnDeletedApps: 'Databases of deleted apps',
    d1OnDeletedAppsMeaning:
      'Here a row does exist, and it says "deleted" — yet the database is still standing. The teardown never finished; it can be retried from "Hosted apps".',
    clean: 'none found',
    found: 'found',
    notChecked: 'NOT CHECKED',
    notCheckedNote:
      'This field came back as null, i.e. unknown. That does NOT mean "none found" — it means the check could not be completed. The reason appears in the notes.',
    counts: 'Counted',
    knownApps: 'Registry rows',
    prefixesInR2: 'Prefixes in R2',
    routesInKv: 'Routes in KV',
    d1InCloudflare: 'Form databases at Cloudflare',
    notes: 'Notes from the sweep',
    noPurge:
      'There is deliberately no delete button here. Cleaning up demands named app ids, a reason for the audit log, and a fresh registry check immediately before deletion — that stays its own explicit step, not a button beside a report.',
  },

  reviews: {
    heading: 'Review queue',
    lead: 'Publishes that cleared the fixed rule list and were then held by the classifier. Nothing was uploaded and nothing is online — it is waiting on your decision.',
    none: 'Nothing is waiting for review.',
    unavailable:
      'The review queue could not be read. That does NOT mean "nothing is waiting" — it means nobody can look right now. Check migration 0102.',
    requestedName: 'Requested name',
    waitingSince: 'Waiting since',
    stage1: 'Stage 1 (fixed rules)',
    stage2: 'Stage 2 (classifier)',
    categories: 'Categories',
    noCategories: 'none — the check could not be completed',
    confidence: 'Confidence',
    scanned: 'Scanned',
    files: 'files',
    tokens: 'Tokens (in/out)',
    reasonFlagged: 'The classifier read the page and found something a human should look at.',
    reasonOverBudget:
      'The page was larger than the scan budget. It was NOT truncated and judged — it was not judged at all. That says nothing about its content.',
    reasonUnavailable: 'The classifier was unreachable or unconfigured. A check that could not run has not passed.',
    reasonTimeout: 'The classifier did not answer in time. That says nothing about the content.',
    reasonUnparseable: 'The classifier’s answer could not be parsed. That says nothing about the content.',
    reasonUnknown: 'UNKNOWN — no reason was supplied.',
    preview: 'Show the content',
    previewHide: 'Hide the content',
    previewLoading: 'loading …',
    previewNote:
      'Raw source, shown as text. Nothing here is executed, embedded as HTML, or allowed to fetch anything — which is why you see markup and not a page.',
    previewUnavailable:
      'The files could not be read — the project may have been deleted. That does NOT mean "the app is empty".',
    previewTruncated: 'Truncated — the file is longer than shown here.',
    previewBinary: 'Non-text files (names only)',
    previewOmitted: 'Further text files, not shown here',
    approve: 'Approve',
    approving: 'approving …',
    block: 'Reject',
    blocking: 'rejecting …',
    reason: 'Reason',
    reasonPlaceholder: 'Recorded, and shown to the user.',
    reasonRequiredBlock: 'A rejection needs a reason — the user gets to read it.',
    reasonOptionalApprove: 'Optional for an approval — recorded either way.',
    approveNote:
      'Approving starts the publish immediately. The fixed rule list runs again: an approval overrides the classifier, not the hard rules.',
    blockNote: 'A rejection takes nothing offline — nothing ever was. It closes the item and writes the audit row.',
    approved: 'Approved.',
    blocked: 'Rejected.',
    publishFailed:
      'The approval stands and is recorded — the publish itself did not go through. The item does not return to the queue because of that.',
    published: 'Approved and live.',
    auditWritten: 'Audit row written.',
    auditUnavailable: 'No audit row — migration 0100 is missing. The decision is in the application log.',
    auditFailed: 'The audit row could not be written.',
    decidedHeading: 'Recently decided',
    decidedNone: 'Nothing has been decided yet.',
    decidedBy: 'Decided by',
    decidedAt: 'Decided at',
    decidedReason: 'Reason',
    decidedNoReason: 'no reason recorded',
    statusApproved: 'approved',
    statusBlocked: 'rejected',
    decidedNote:
      'Read from the review queue itself. The evidence row in ops_app_audit is untouched by this and is kept for 12 months — it outlives account deletion, this list does not.',
  },

  e2e: {
    heading: 'End-to-end run',
    lead: 'Drives the whole loop on the real infrastructure: preflight, scan battery, five publishes, rename with 410, hostile file, suspend and unsuspend, teardown. Takes 5–15 minutes.',
    start: 'Start E2E',
    starting: 'starting …',
    running: 'running',
    done: 'finished',
    failed: 'aborted',
    elapsed: 'Elapsed',
    stepsCompleted: 'steps reported',
    noProgressBar:
      'No percentage progress bar: how many steps a run has is only settled at the end — a blocked preflight ends after two. What is shown is what was reported.',
    memoryWarning:
      'Progress is held in the API’s memory. A redeploy wipes this VIEW — the run itself may well carry on and finish, because its writes go straight to Cloudflare and Supabase. Copy the result before you deploy anything.',
    unknownJob:
      'This run is not (or no longer) known to the API. That does not mean it failed — the view is gone; the outcome is in the app list and in the audit log.',
    numbers: 'The numbers',
    publishLoops: 'Publish loops',
    scanBattery: 'Scan battery',
    suspensionRoundTrip: 'Suspension round-trip',
    propagation: 'Propagation',
    passed: 'Every step green.',
    notPassed: 'At least one step is red.',
    disabledRunning: 'A run is already in flight.',
    disabledNoHosting: 'Not possible while OPS_HOSTING_ENABLED is off — the run would not get past the preflight.',
    notes: 'Notes',
  },

  copy: {
    heading: 'Copy the result',
    lead: 'Copies the result as JSON to the clipboard — without tokens, keys and addresses.',
    action: 'Copy the result',
    copied: 'Copied.',
    failed: 'Copying did not work. The text is below and can be selected.',
    summary: 'Summary',
    nothing: 'There is no result to copy yet.',
    scrubbed: 'Scrubbed: email addresses and anything that looks like a key have been removed.',
  },

  error: {
    title: 'That did not work.',
    detail: 'Details',
    copyDetail: 'Copy details',
    network: 'The API was not reachable.',
    unauthorized: 'The session was not accepted. Sign in again.',
    notFound: 'This action does not exist here.',
    generic: 'The API answered with an error.',

    refusedTitle: 'This action was refused.',
    refused:
      'The route declined this session, so it answers exactly like a route that never existed. That applies to you as well, on purpose.',
    refusedWhy:
      'Two causes look the same from out here, and the answer separates them deliberately: either this account is missing from the list for that route (OPS_FOUNDER_ACCOUNTS / OPS_BETA_ACCOUNTS), or the hosting switch sits at off (OPS_HOSTING_ENABLED). Which of the two it was appears in the server log, on purpose only there.',
    noDetail: 'The API sent no detail along.',
  },
};

export const STR: Record<Lang, typeof de> = { de, en };

/**
 * The one-line German summary that rides along with the copied JSON (U-C5).
 *
 * Deliberately built from the report's own numbers and nothing else — no
 * rounding, no "erfolgreich" unless every step was green. A summary that reads
 * better than the run went would be the exact lie this console exists to avoid.
 */
export function summaryLine(report: {
  passed?: boolean;
  numbers?: { publishLoops?: string; scanBattery?: string; suspensionRoundTrip?: string };
  steps?: Array<{ ok: boolean }>;
  tookMs?: number;
}): string {
  const n = report.numbers ?? {};
  const steps = report.steps ?? [];
  const green = steps.filter((s) => s.ok).length;
  const verdict = report.passed ? 'BESTANDEN' : 'NICHT BESTANDEN';
  const minutes = report.tookMs ? ` · ${Math.round(report.tookMs / 60000)} min` : '';
  return (
    `E2E ${verdict} · Veröffentlichungen ${n.publishLoops ?? 'UNBEKANNT'}` +
    ` · Scan-Batterie ${n.scanBattery ?? 'UNBEKANNT'}` +
    ` · Sperr-Runde ${n.suspensionRoundTrip ?? 'UNBEKANNT'}` +
    ` · Schritte ${green}/${steps.length}${minutes}`
  );
}

/**
 * Remove anything that must not travel in a pasted report (U-C5).
 *
 * Conservative on purpose: it is a redactor, not a parser. Email addresses go
 * (the actor's included — the phase report does not need it, and it is the one
 * personal datum this payload carries), and any long opaque token-shaped string
 * goes. If it over-redacts a harmless value, the founder loses nothing they
 * cannot re-read in the console; if it under-redacts, a secret ends up in a
 * document. The asymmetry decides the setting.
 */
export function scrubForCopy<T>(value: T): T {
  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  // A JWT is matched as ONE unit, header segment included. Matching only the long
  // segments would leave `eyJhbGciOiJIUzI1NiJ9.[entfernt]` behind — which still
  // names the algorithm and still looks like a credential in a pasted document.
  const JWTISH = /\b[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,}){2,}\b/g;
  // A single opaque run this long is a key shape, not prose. 32 rather than 24 so
  // ordinary identifiers (an app id, a run id, a hostname label) survive.
  const TOKENISH = /\b[A-Za-z0-9_-]{32,}\b/g;
  // The one documented exemption. A UUID is 36 characters and would trip the rule
  // above, but app ids and run ids are not secrets — they are already on screen,
  // in the R2 prefix and in the audit row, and a phase report that cannot name the
  // app it is about is a worse artifact than one that does.
  const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const SECRET_KEY = /(token|key|secret|password|authorization|bearer)/i;

  function walk(v: unknown): unknown {
    if (typeof v === 'string') {
      return v
        .replace(EMAIL, '[email entfernt]')
        .replace(JWTISH, '[entfernt]')
        .replace(TOKENISH, (m) => (UUID.test(m) ? m : '[entfernt]'));
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, SECRET_KEY.test(k) ? '[entfernt]' : walk(val)]),
      );
    }
    return v;
  }
  return walk(value) as T;
}
