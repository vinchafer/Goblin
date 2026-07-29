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
    founderActions: 'Das musst du selbst im Cloudflare-Dashboard tun:',
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
    founderActions: 'This part you have to do yourself in the Cloudflare dashboard:',
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
