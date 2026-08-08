'use client';

/**
 * AKT 2 · PHASE 2.5 · U-C2/C3/C4/C5 — the founder console itself.
 *
 * The page's server half (page.tsx) has already established that whoever is
 * looking is the founder; this component's job is to be honest about what it
 * knows, and to never claim more.
 *
 * ── The rules this file is built to keep ─────────────────────────────────────
 * • UNKNOWN IS A VALUE. Every tri-state from the API (`true | false | null`)
 *   renders through `<State/>`, which gives null its own dashed, colourless pill
 *   reading UNBEKANNT. There is no branch anywhere that turns a null into green.
 * • NO PHANTOM AFFORDANCES. A button that cannot work is rendered disabled AND
 *   accompanied by a sentence saying why — never hidden, never clickable-dead,
 *   never a tooltip (there is no hover on a phone).
 * • NO RAW STACK TRACES. Every failure becomes an honest German sentence plus a
 *   copyable detail block. `call()` is the single place a response or a thrown
 *   value becomes text, so there is one place to audit and no second path that
 *   could leak an exception into the page.
 * • NO INVENTED PROGRESS. Nothing advances on a timer. The E2E step list grows
 *   only when the API reports a step; the propagation figure is counted from real
 *   answers to real polls. There is deliberately no percentage bar — see
 *   `strings.e2e.noProgressBar`.
 *
 * ── What it does not do ──────────────────────────────────────────────────────
 * It re-implements nothing. Router provisioning, publishing, name checks,
 * suspension and teardown are the EXISTING endpoints, called with the ordinary
 * session bearer token. The only reason the admin calls work at all is U-C1's
 * second authorization path — note that CORS on the API allows `Authorization`
 * and not `x-admin-key`, so a browser could not have used the key path even if
 * the founder were willing to type it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL, getAuthHeaders } from '@/lib/api';
import { useLang } from '@/lib/use-lang';
import { STR, summaryLine, scrubForCopy, type Lang } from './strings';
import { explainFailure, explainNetworkFailure, whereLine, type HonestError } from './refusal';

// ── shapes the API hands us ─────────────────────────────────────────────────

type Tri = boolean | null;

interface StatusPayload {
  founder: { email: string };
  hosting: { enabled: boolean; betaAccountCount: number };
  router: {
    domain: string;
    pattern: string;
    workerDeployed: Tri;
    zoneFound: Tri;
    wildcardProxied: Tri;
    routeBound: Tri;
    notes: string[];
  } | null;
  migrations: { registry: Tri; audit: Tri };
  appsDomain: string;
  e2e: { confirm: string; running: string | null };
  timestamp: string;
}

interface HostedApp {
  appId: string;
  name: string;
  url: string;
  status: string;
  lastPublishedAt: string | null;
}

interface RouterStep {
  step: string;
  status: string;
  detail: string;
  founderAction?: string;
}

interface E2EStep {
  step: string;
  ok: boolean;
  detail: string;
  propagationSec?: number;
}

interface E2EJobView {
  id: string;
  status: 'running' | 'done' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  steps: E2EStep[];
  stepsCompleted: number;
  elapsedSec: number;
  error: string | null;
  report: {
    passed: boolean;
    numbers: { publishLoops: string; scanBattery: string; suspensionRoundTrip: string };
    steps: E2EStep[];
    notes: string[];
    tookMs: number;
    url?: string;
  } | null;
}

type CallResult<T> = { ok: true; data: T } | { ok: false; error: HonestError; status: number };

// ── talking to the API ──────────────────────────────────────────────────────

/**
 * The single place a response — or a thrown value — becomes text the founder reads.
 *
 * The translation itself lives in ./refusal.ts, where it is a pure function and
 * therefore actually testable; this wrapper is only the fetch around it. The rule it
 * enforces — a gate refusal is NAMED as a refusal, a handler's own 404 keeps its own
 * German sentence, and neither ever guesses a cause — is documented there.
 */
function makeCall(lang: Lang) {
  return async function call<T>(path: string, init: RequestInit = {}): Promise<CallResult<T>> {
    const where = whereLine(init.method, path);
    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...(await getAuthHeaders()), ...(init.headers ?? {}) } });
    } catch (err) {
      return { ok: false, status: 0, error: explainNetworkFailure(lang, where, err) };
    }

    const raw = await res.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      /* not JSON — the raw text IS the detail, which is the honest thing to show */
    }

    if (!res.ok) return { ok: false, status: res.status, error: explainFailure(lang, where, res.status, raw, parsed) };
    return { ok: true, data: (parsed ?? {}) as T };
  };
}

// ── small presentational pieces ─────────────────────────────────────────────

function State({ value, labels, unknownLabel }: { value: Tri; labels: { yes: string; no: string }; unknownLabel: string }) {
  // The whole point: null is its own visual class and its own word.
  if (value === null || value === undefined) return <span className="oc-state unknown">{unknownLabel}</span>;
  return <span className={`oc-state ${value ? 'ok' : 'bad'}`}>{value ? labels.yes : labels.no}</span>;
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="oc-row">
      <span className="k">{k}</span>
      <span className="v">{children}</span>
    </div>
  );
}

function ErrorBlock({ error, title, detailLabel, copyLabel }: { error: HonestError; title: string; detailLabel: string; copyLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="oc-error" role="alert">
      {/* A refusal brings its own title: "das hat nicht funktioniert" would be
          wrong for an answer the API gave on purpose. */}
      <span className="t">{error.title ?? title}</span>
      <span className="m">{error.message}</span>
      {error.hint ? <p className="oc-why">{error.hint}</p> : null}
      <details>
        <summary className="oc-note" style={{ cursor: 'pointer' }}>
          {detailLabel}
        </summary>
        <pre className="oc-detail">{error.detail}</pre>
      </details>
      <button
        type="button"
        className="gobl-btn secondary sm"
        onClick={() => {
          navigator.clipboard?.writeText(error.detail).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        {copied ? '✓' : copyLabel}
      </button>
    </div>
  );
}

/**
 * A disabled action always says why, right next to itself. `reason` being present
 * IS the disabled condition — the two cannot drift apart.
 */
function Action({
  label,
  busyLabel,
  busy,
  reason,
  onClick,
  variant = 'primary',
}: {
  label: string;
  busyLabel?: string;
  busy?: boolean;
  reason?: string | null;
  onClick: () => void;
  variant?: string;
}) {
  return (
    <>
      <div className="oc-actions">
        <button type="button" className={`gobl-btn ${variant}`} disabled={busy || !!reason} onClick={onClick}>
          {busy && busyLabel ? busyLabel : label}
        </button>
      </div>
      {reason ? <p className="oc-why">{reason}</p> : null}
    </>
  );
}

// ── the console ─────────────────────────────────────────────────────────────

export function OpsConsole({ initialStatus }: { initialStatus: StatusPayload }) {
  const lang = useLang();
  const s = STR[lang];

  // Bound to the language, so a refusal explains itself in the language the
  // operator is reading. The raw detail block is not translated — it is the
  // exchange itself, and paraphrasing it would defeat the point of copying it.
  const call = useMemo(() => makeCall(lang), [lang]);

  const [status, setStatus] = useState<StatusPayload>(initialStatus);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<HonestError | null>(null);

  const hostingOn = status.hosting.enabled;

  // ── status ────────────────────────────────────────────────────────────────

  const refreshStatus = useCallback(async () => {
    setStatusBusy(true);
    const res = await call<StatusPayload>('/api/ops-console/status');
    setStatusBusy(false);
    if (res.ok) {
      setStatus(res.data);
      setStatusError(null);
    } else {
      // The header keeps showing the LAST known values with their old timestamp.
      // Blanking them would be a loss of information; pretending they are current
      // would be a lie. The visible "last loaded" time is what keeps this honest.
      setStatusError(res.error);
    }
  }, [call]);

  // ── apps ──────────────────────────────────────────────────────────────────

  const [apps, setApps] = useState<HostedApp[]>([]);
  const [appsAvailable, setAppsAvailable] = useState<Tri>(null);
  const [appsError, setAppsError] = useState<HonestError | null>(null);

  const refreshApps = useCallback(async () => {
    const res = await call<{ available: boolean; apps: HostedApp[] }>('/api/ops-console/apps');
    if (res.ok) {
      setApps(res.data.apps);
      setAppsAvailable(res.data.available);
      setAppsError(null);
    } else {
      setAppsAvailable(null); // unknown, NOT "no apps"
      setAppsError(res.error);
    }
  }, [call]);

  // ── projects (the picker) ─────────────────────────────────────────────────

  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [projectsAvailable, setProjectsAvailable] = useState<Tri>(null);
  const [projectsError, setProjectsError] = useState<HonestError | null>(null);

  const refreshProjects = useCallback(async () => {
    const res = await call<{ available: boolean; detail?: string | null; projects: Array<{ id: string; name: string }> }>(
      '/api/ops-console/projects',
    );
    if (res.ok) {
      setProjects(res.data.projects);
      setProjectsAvailable(res.data.available);
      // `available:false` is a 200 whose payload says "we could not read them".
      // The API knows why (it carries the database's own words); showing the
      // sentence without them is what left a schema error invisible for a week.
      setProjectsError(
        res.data.available
          ? null
          : { message: s.publish.projectsUnavailable, detail: `GET /api/ops-console/projects → 200 available:false\n${res.data.detail ?? s.error.noDetail}` },
      );
    } else {
      setProjectsAvailable(null);
      setProjectsError(res.error);
    }
  }, [call, s]);

  // The first load of the two lists the console needs but the server half did not
  // fetch. Both setState only after their awaits; the IIFE makes that explicit to
  // a reader (and to the lint rule) rather than leaving it to be inferred.
  useEffect(() => {
    void (async () => {
      await refreshApps();
      await refreshProjects();
    })();
  }, [refreshApps, refreshProjects]);

  // ── router ────────────────────────────────────────────────────────────────

  const [routerBusy, setRouterBusy] = useState(false);
  const [routerReport, setRouterReport] = useState<{ provisioned: boolean; steps: RouterStep[] } | null>(null);
  const [routerError, setRouterError] = useState<HonestError | null>(null);

  const provisionRouter = useCallback(async () => {
    setRouterBusy(true);
    setRouterError(null);
    const res = await call<{ provisioned: boolean; steps: RouterStep[] }>('/api/ops/router/provision', { method: 'POST' });
    setRouterBusy(false);
    if (res.ok) {
      setRouterReport(res.data);
      void refreshStatus();
    } else {
      setRouterError(res.error);
    }
  }, [call, refreshStatus]);

  // ── publish ───────────────────────────────────────────────────────────────

  const [projectId, setProjectId] = useState('');
  const [appName, setAppName] = useState('');
  const [nameCheck, setNameCheck] = useState<{ name: string; result: 'free' | 'taken' | 'invalid' | 'unknown' } | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [published, setPublished] = useState<{ url: string; files: number } | null>(null);
  const [publishError, setPublishError] = useState<HonestError | null>(null);

  const typedName = appName.trim().toLowerCase();

  // Debounced availability check. It is explicitly NOT a reservation, and the
  // hint under the field says so — two people can both be told "frei".
  //
  // The effect only SCHEDULES; it never sets state in its own body. The answer is
  // stored together with the name it belongs to, and what the field displays is
  // derived below. That is not just to satisfy the lint rule: it makes a stale
  // answer structurally impossible, because a result whose `name` no longer
  // matches what is in the box can never be shown.
  useEffect(() => {
    if (!typedName || !hostingOn) return; // the check lives behind /api/ops and would 404
    const timer = setTimeout(async () => {
      const res = await call<{ available: boolean; reason?: string }>(`/api/ops/apps/name-check?name=${encodeURIComponent(typedName)}`);
      setNameCheck({
        name: typedName,
        // A failed check is 'unknown' and shows the neutral hint. Claiming "frei"
        // because the request died would be the worst of the three answers.
        result: !res.ok ? 'unknown' : res.data.available ? 'free' : res.data.reason === 'invalid' ? 'invalid' : 'taken',
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [call, typedName, hostingOn]);

  const nameState: 'idle' | 'checking' | 'free' | 'taken' | 'invalid' =
    !typedName || !hostingOn
      ? 'idle'
      : nameCheck?.name !== typedName
        ? 'checking'
        : nameCheck.result === 'unknown'
          ? 'idle'
          : nameCheck.result;

  const publish = useCallback(async () => {
    setPublishBusy(true);
    setPublishError(null);
    const res = await call<{ url: string; files: number }>('/api/ops/apps/publish', {
      method: 'POST',
      body: JSON.stringify({ projectId, name: typedName }),
    });
    setPublishBusy(false);
    if (res.ok) {
      setPublished(res.data);
      void refreshApps();
    } else {
      setPublishError(res.error);
    }
  }, [call, projectId, typedName, refreshApps]);

  const publishBlockedBecause = !hostingOn
    ? s.publish.disabledNoHosting
    : !projectId
      ? s.publish.disabledNoProject
      : !appName.trim()
        ? s.publish.disabledNoName
        : nameState === 'taken'
          ? s.publish.disabledNameTaken
          : null;

  // ── per-app operator actions ──────────────────────────────────────────────

  const [openApp, setOpenApp] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [teardownTyped, setTeardownTyped] = useState('');
  const [appBusy, setAppBusy] = useState<string | null>(null);
  const [appError, setAppError] = useState<HonestError | null>(null);
  const [measured, setMeasured] = useState<Record<string, { sec: number | null; running: boolean; audit?: string }>>({});
  const cancelled = useRef(false);
  useEffect(() => () => {
    cancelled.current = true;
  }, []);

  /**
   * Poll the PUBLIC url until it answers `want`, and report how many seconds that
   * actually took. Nothing here is estimated: the clock starts at the call, each
   * tick is a real request the API made to the real hostname, and a window that
   * expires reports `null` rather than a number nobody observed.
   */
  const measureUntil = useCallback(async (app: HostedApp, want: number) => {
    const started = Date.now();
    setMeasured((m) => ({ ...m, [app.appId]: { sec: null, running: true } }));
    for (let i = 0; i < 24; i++) {
      if (cancelled.current) return;
      if (i > 0) await new Promise((r) => setTimeout(r, 5000));
      const res = await call<{ status: number | null }>(`/api/ops-console/probe?name=${encodeURIComponent(app.name)}`);
      if (res.ok && res.data.status === want) {
        const sec = Math.round((Date.now() - started) / 1000);
        setMeasured((m) => ({ ...m, [app.appId]: { sec, running: false } }));
        return;
      }
    }
    // Window expired. The action still happened; we simply did not see it land.
    setMeasured((m) => ({ ...m, [app.appId]: { sec: null, running: false } }));
  }, [call]);

  const operate = useCallback(
    async (app: HostedApp, what: 'suspend' | 'unsuspend' | 'teardown') => {
      setAppBusy(`${app.appId}:${what}`);
      setAppError(null);
      const path = what === 'teardown' ? `/api/admin/ops/apps/${app.appId}` : `/api/admin/ops/apps/${app.appId}/${what}`;
      const res = await call<{ audit?: string }>(path, {
        method: what === 'teardown' ? 'DELETE' : 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setAppBusy(null);
      if (!res.ok) {
        setAppError(res.error);
        return;
      }
      setOpenApp(null);
      setReason('');
      setTeardownTyped('');
      setMeasured((m) => ({ ...m, [app.appId]: { sec: null, running: true, audit: res.data.audit } }));
      void refreshApps();
      // 403 = the suspended page · 200 = restored · 404 = torn down.
      void measureUntil(app, what === 'suspend' ? 403 : what === 'unsuspend' ? 200 : 404);
    },
    [call, reason, refreshApps, measureUntil],
  );

  // ── E2E ───────────────────────────────────────────────────────────────────

  const [job, setJob] = useState<E2EJobView | null>(null);
  const [jobId, setJobId] = useState<string | null>(initialStatus.e2e.running);
  const [jobStarting, setJobStarting] = useState(false);
  const [jobError, setJobError] = useState<HonestError | null>(null);
  const [jobLost, setJobLost] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    let live = true;
    const tick = async () => {
      const res = await call<E2EJobView>(`/api/ops-console/e2e/status/${jobId}`);
      if (!live) return;
      if (res.ok) {
        setJob(res.data);
        setJobLost(false);
        if (res.data.status !== 'running') {
          void refreshApps();
          return; // terminal — stop polling
        }
      } else if (res.status === 404) {
        // The API does not know this id. NOT a failure — see strings.e2e.unknownJob.
        setJobLost(true);
        return;
      }
      timer = setTimeout(tick, 5000);
    };
    let timer = setTimeout(tick, 0);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [call, jobId, refreshApps]);

  const startE2E = useCallback(async () => {
    setJobStarting(true);
    setJobError(null);
    const res = await call<{ jobId: string }>(`/api/ops-console/e2e/start?confirm=${encodeURIComponent(status.e2e.confirm)}`, { method: 'POST' });
    setJobStarting(false);
    if (res.ok) {
      setJob(null);
      setJobLost(false);
      setJobId(res.data.jobId);
    } else {
      setJobError(res.error);
    }
  }, [call, status.e2e.confirm]);

  const e2eBlockedBecause = !hostingOn ? s.e2e.disabledNoHosting : job?.status === 'running' ? s.e2e.disabledRunning : null;

  // ── copy-out (U-C5) ───────────────────────────────────────────────────────

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copyPayload = useMemo(() => {
    if (!job?.report) return null;
    return scrubForCopy({
      phase: 'AKT 2 · Phase 2 — Gründer-Fenster',
      producedBy: 'ops-console',
      producedAt: new Date().toISOString(),
      hostingEnabled: status.hosting.enabled,
      appsDomain: status.appsDomain,
      router: status.router,
      migrations: status.migrations,
      run: {
        passed: job.report.passed,
        numbers: job.report.numbers,
        steps: job.report.steps,
        notes: job.report.notes,
        tookMs: job.report.tookMs,
      },
      summary: summaryLine(job.report),
    });
  }, [job, status]);

  const copyText = useMemo(() => (copyPayload ? JSON.stringify(copyPayload, null, 2) : ''), [copyPayload]);

  const doCopy = useCallback(() => {
    if (!copyText) return;
    navigator.clipboard?.writeText(copyText).then(
      () => setCopyState('copied'),
      () => setCopyState('failed'),
    );
  }, [copyText]);

  // ── render ────────────────────────────────────────────────────────────────

  const yesNo = { yes: s.status.yes, no: s.status.no };
  const U = s.status.unknown;

  return (
    <div className="ops-console">
      <header className="oc-head">
        <span className="gobl-eyebrow">
          <span className="tick" />
          {s.meta.subtitle}
        </span>
        <h1>{s.meta.title}</h1>
        <span className="oc-who">
          {s.meta.signedInAs} {status.founder.email}
        </span>
      </header>

      {/* ── STATUS ─────────────────────────────────────────────────────── */}
      <section className="gobl-panel oc-card">
        <h2>{s.status.heading}</h2>

        <div className="oc-rows">
          <Row k={s.status.hosting}>
            <span className={`oc-state ${hostingOn ? 'ok' : 'warn'}`}>{hostingOn ? s.status.hostingOn : s.status.hostingOff}</span>
          </Row>
          <Row k={s.status.workerDeployed}>
            <State value={status.router?.workerDeployed ?? null} labels={yesNo} unknownLabel={U} />
          </Row>
          <Row k={s.status.zoneFound}>
            <State value={status.router?.zoneFound ?? null} labels={yesNo} unknownLabel={U} />
          </Row>
          <Row k={s.status.wildcardProxied}>
            <State value={status.router?.wildcardProxied ?? null} labels={yesNo} unknownLabel={U} />
          </Row>
          <Row k={s.status.routeBound}>
            <State value={status.router?.routeBound ?? null} labels={yesNo} unknownLabel={U} />
          </Row>
          <Row k={s.status.registry}>
            <State
              value={status.migrations.registry}
              labels={{ yes: s.status.applied, no: s.status.notApplied }}
              unknownLabel={U}
            />
          </Row>
          <Row k={s.status.audit}>
            <State value={status.migrations.audit} labels={{ yes: s.status.applied, no: s.status.notApplied }} unknownLabel={U} />
          </Row>
          <Row k={s.status.appsDomain}>
            <span className="oc-who">{status.appsDomain || U}</span>
          </Row>
        </div>

        <p className="oc-note">{s.status.wildcardTrap}</p>
        {!hostingOn ? <p className="oc-note">{s.status.hostingOffNote}</p> : null}
        {status.migrations.registry === false ? <p className="oc-note">{s.status.registryMissingNote}</p> : null}
        {status.migrations.audit === false ? <p className="oc-note">{s.status.auditMissingNote}</p> : null}
        {status.router?.notes?.length ? (
          <>
            <p className="oc-note">{s.status.routerNotes}</p>
            <pre className="oc-detail">{status.router.notes.join('\n')}</pre>
          </>
        ) : null}
        {status.router === null ? <p className="oc-note">{s.status.unknownHint}</p> : null}

        {/* Always visible, never hidden behind a hover — the founder must be able
            to see how stale what they are reading is. */}
        <p className="oc-note">
          {s.status.lastRefreshed}: {new Date(status.timestamp).toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB')}
        </p>

        <Action label={s.status.refresh} busyLabel={s.status.refreshing} busy={statusBusy} onClick={() => void refreshStatus()} variant="secondary" />
        {statusError ? (
          <ErrorBlock error={statusError} title={s.error.title} detailLabel={s.error.detail} copyLabel={s.error.copyDetail} />
        ) : null}
      </section>

      {/* ── ROUTER ─────────────────────────────────────────────────────── */}
      <section className="gobl-panel oc-card">
        <h2>{s.router.heading}</h2>
        <p className="oc-lead">{s.router.lead}</p>

        <Action
          label={s.router.action}
          busyLabel={s.router.running}
          busy={routerBusy}
          reason={hostingOn ? null : s.router.disabledNoHosting}
          onClick={() => void provisionRouter()}
        />

        {routerReport ? (
          <>
            <p className="oc-lead">{routerReport.provisioned ? s.router.provisioned : s.router.blocked}</p>
            <div className="oc-steps">
              {routerReport.steps.map((st) => (
                <div className="oc-step" key={st.step}>
                  <span className={`mark ${st.status === 'ok' ? 'ok' : 'bad'}`}>{st.status === 'ok' ? '✓' : '✗'}</span>
                  <span className="body">
                    <span className="name">{st.step}</span>
                    <span className="detail">{st.detail}</span>
                  </span>
                </div>
              ))}
            </div>
            {/* The endpoint's own founderAction text, VERBATIM — these are the
                dashboard clicks, and paraphrasing them would cost the founder the
                exact wording they need. */}
            {routerReport.steps.some((st) => st.founderAction) ? (
              <>
                <p className="oc-note">{s.router.founderActions}</p>
                <pre className="oc-detail">
                  {routerReport.steps
                    .filter((st) => st.founderAction)
                    .map((st) => `[${st.step}] ${st.founderAction}`)
                    .join('\n\n')}
                </pre>
              </>
            ) : null}
          </>
        ) : null}

        {routerError ? <ErrorBlock error={routerError} title={s.error.title} detailLabel={s.error.detail} copyLabel={s.error.copyDetail} /> : null}
      </section>

      {/* ── PUBLISH ────────────────────────────────────────────────────── */}
      <section className="gobl-panel oc-card">
        <h2>{s.publish.heading}</h2>
        <p className="oc-lead">{s.publish.lead}</p>

        <div className="oc-field">
          <label className="gobl-field-label" htmlFor="oc-project">
            {s.publish.project}
          </label>
          <select id="oc-project" className="gobl-input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{s.publish.projectPlaceholder}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.id}
              </option>
            ))}
          </select>
          {/* Same rule as the app list: not-a-confirmed-true means we could not
              read them, and a silent empty picker would look like "no projects".
              The block below then says what the API said about why — a refusal
              names itself as one, a database error arrives with its own words. */}
          {projectsAvailable !== true ? <p className="oc-why">{s.publish.projectsUnavailable}</p> : null}
          {projectsAvailable !== true && projectsError ? (
            <ErrorBlock error={projectsError} title={s.error.title} detailLabel={s.error.detail} copyLabel={s.error.copyDetail} />
          ) : null}
          {projectsAvailable === true && projects.length === 0 ? <p className="oc-why">{s.publish.noProjects}</p> : null}
        </div>

        <div className="oc-field">
          <label className="gobl-field-label" htmlFor="oc-name">
            {s.publish.name}
          </label>
          <input
            id="oc-name"
            className="gobl-input"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder={s.publish.namePlaceholder}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="url"
          />
          <p className="oc-why">
            {nameState === 'checking'
              ? s.publish.nameChecking
              : nameState === 'free'
                ? s.publish.nameFree
                : nameState === 'taken'
                  ? s.publish.nameTaken
                  : nameState === 'invalid'
                    ? s.publish.nameInvalid
                    : s.publish.nameHint}
          </p>
        </div>

        <Action
          label={s.publish.action}
          busyLabel={s.publish.running}
          busy={publishBusy}
          reason={publishBlockedBecause}
          onClick={() => void publish()}
        />

        {published ? (
          <p className="oc-lead">
            {s.publish.published}{' '}
            <a href={published.url} target="_blank" rel="noreferrer">
              {published.url}
            </a>
          </p>
        ) : null}
        {publishError ? <ErrorBlock error={publishError} title={s.error.title} detailLabel={s.error.detail} copyLabel={s.error.copyDetail} /> : null}
      </section>

      {/* ── HOSTED APPS ────────────────────────────────────────────────── */}
      <section className="gobl-panel oc-card">
        <h2>{s.apps.heading}</h2>
        <p className="oc-lead">{s.apps.lead}</p>

        {/* Anything that is not a confirmed `true` means we could not read the
            registry — whether the API said so (available:false, e.g. pre-0099)
            or the call itself failed (null). Both must say so out loud: an empty
            card here would read as "no apps", which is the one wrong answer. */}
        {appsAvailable !== true ? <p className="oc-why">{s.apps.unavailable}</p> : null}
        {appsAvailable === true && apps.length === 0 ? <p className="oc-why">{s.apps.none}</p> : null}

        {apps.map((app) => {
          const m = measured[app.appId];
          const isOpen = openApp === app.appId;
          const suspended = app.status === 'suspended';
          return (
            <div className="oc-app" key={app.appId}>
              <div className="top">
                <span className="nm">{app.name}</span>
                <span className={`oc-state ${suspended ? 'bad' : app.status === 'active' ? 'ok' : 'warn'}`}>
                  {suspended
                    ? s.apps.statusSuspended
                    : app.status === 'active'
                      ? s.apps.statusActive
                      : app.status === 'provisioning'
                        ? s.apps.statusProvisioning
                        : s.apps.statusFailed}
                </span>
              </div>
              <span className="url">{app.url}</span>

              <div className="oc-actions">
                <a className="gobl-btn secondary sm" href={app.url} target="_blank" rel="noreferrer">
                  {s.apps.open}
                </a>
                <button type="button" className="gobl-btn secondary sm" onClick={() => setOpenApp(isOpen ? null : app.appId)}>
                  {suspended ? s.apps.unsuspend : s.apps.suspend} / {s.apps.teardown}
                </button>
              </div>

              {m?.running ? <p className="oc-why">{s.apps.measuring}</p> : null}
              {m && !m.running && m.sec !== null ? (
                <p className="oc-lead">
                  {s.apps.measuredVisible} {m.sec} {s.apps.measuredSeconds}. <span className="oc-note">{s.apps.measuredNote}</span>
                </p>
              ) : null}
              {m && !m.running && m.sec === null ? <p className="oc-why">{s.apps.measuredTimeout}</p> : null}
              {m?.audit ? (
                <p className="oc-note">
                  {m.audit === 'written' ? s.apps.auditWritten : m.audit === 'unavailable' ? s.apps.auditUnavailable : s.apps.auditFailed}
                </p>
              ) : null}

              {isOpen ? (
                <>
                  <div className="oc-field">
                    <label className="gobl-field-label" htmlFor={`oc-reason-${app.appId}`}>
                      {s.apps.reason}
                    </label>
                    <input
                      id={`oc-reason-${app.appId}`}
                      className="gobl-input"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={s.apps.reasonPlaceholder}
                    />
                    {!reason.trim() ? <p className="oc-why">{s.apps.reasonRequired}</p> : null}
                  </div>

                  <div className="oc-actions">
                    <button
                      type="button"
                      className="gobl-btn primary sm"
                      disabled={!reason.trim() || appBusy !== null}
                      onClick={() => void operate(app, suspended ? 'unsuspend' : 'suspend')}
                    >
                      {suspended ? s.apps.unsuspend : s.apps.suspend}
                    </button>
                  </div>

                  {/* Teardown: two confirmations. The sentence states plainly that
                      it is irreversible and that files AND route are removed, and
                      the name has to be typed — a mis-tap cannot reach it. */}
                  <div className="oc-danger">
                    <span className="t">{s.apps.teardownWarnTitle}</span>
                    <span className="b">{s.apps.teardownWarnBody}</span>
                    <label className="gobl-field-label" htmlFor={`oc-td-${app.appId}`}>
                      {s.apps.teardownConfirmPrompt}
                    </label>
                    <input
                      id={`oc-td-${app.appId}`}
                      className="gobl-input"
                      value={teardownTyped}
                      onChange={(e) => setTeardownTyped(e.target.value)}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    {teardownTyped && teardownTyped !== app.name ? <p className="oc-why">{s.apps.teardownConfirmMismatch}</p> : null}
                    <div className="oc-actions">
                      <button
                        type="button"
                        className="gobl-btn danger sm"
                        disabled={teardownTyped !== app.name || !reason.trim() || appBusy !== null}
                        onClick={() => void operate(app, 'teardown')}
                      >
                        {s.apps.teardownFinal}
                      </button>
                    </div>
                    {teardownTyped !== app.name || !reason.trim() ? (
                      <p className="oc-why">{!reason.trim() ? s.apps.reasonRequired : s.apps.teardownConfirmPrompt}</p>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          );
        })}

        {appError ? <ErrorBlock error={appError} title={s.error.title} detailLabel={s.error.detail} copyLabel={s.error.copyDetail} /> : null}
      </section>

      {/* ── E2E ────────────────────────────────────────────────────────── */}
      <section className="gobl-panel oc-card">
        <h2>{s.e2e.heading}</h2>
        <p className="oc-lead">{s.e2e.lead}</p>
        <p className="oc-note">{s.e2e.memoryWarning}</p>

        <Action
          label={s.e2e.start}
          busyLabel={s.e2e.starting}
          busy={jobStarting}
          reason={e2eBlockedBecause}
          onClick={() => void startE2E()}
          variant="gold"
        />

        {jobLost ? <p className="oc-why">{s.e2e.unknownJob}</p> : null}

        {job ? (
          <>
            <div className="oc-rows">
              <Row k={s.status.heading}>
                <span className={`oc-state ${job.status === 'done' ? 'ok' : job.status === 'failed' ? 'bad' : 'warn'}`}>
                  {job.status === 'running' ? s.e2e.running : job.status === 'done' ? s.e2e.done : s.e2e.failed}
                </span>
              </Row>
              <Row k={s.e2e.elapsed}>
                <span className="oc-who">{job.elapsedSec}s</span>
              </Row>
              <Row k={s.e2e.stepsCompleted}>
                <span className="oc-who">{job.stepsCompleted}</span>
              </Row>
            </div>
            <p className="oc-note">{s.e2e.noProgressBar}</p>

            <div className="oc-steps">
              {job.steps.map((st, i) => (
                <div className="oc-step" key={`${st.step}-${i}`}>
                  <span className={`mark ${st.ok ? 'ok' : 'bad'}`}>{st.ok ? '✓' : '✗'}</span>
                  <span className="body">
                    <span className="name">{st.step}</span>
                    <span className="detail">
                      {st.detail}
                      {st.propagationSec !== undefined ? ` · ${s.e2e.propagation} ${st.propagationSec}s` : ''}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            {job.error ? (
              <ErrorBlock
                error={{ message: s.e2e.failed, detail: job.error }}
                title={s.error.title}
                detailLabel={s.error.detail}
                copyLabel={s.error.copyDetail}
              />
            ) : null}

            {job.report ? (
              <>
                <p className="oc-lead">{job.report.passed ? s.e2e.passed : s.e2e.notPassed}</p>
                <div className="oc-numbers">
                  <div className="oc-number">
                    <span className="lbl">{s.e2e.publishLoops}</span>
                    <span className="val">{job.report.numbers.publishLoops}</span>
                  </div>
                  <div className="oc-number">
                    <span className="lbl">{s.e2e.scanBattery}</span>
                    <span className="val">{job.report.numbers.scanBattery}</span>
                  </div>
                  <div className="oc-number">
                    <span className="lbl">{s.e2e.suspensionRoundTrip}</span>
                    <span className="val">{job.report.numbers.suspensionRoundTrip}</span>
                  </div>
                </div>
                {job.report.notes.length ? (
                  <>
                    <p className="oc-note">{s.e2e.notes}</p>
                    <pre className="oc-detail">{job.report.notes.join('\n\n')}</pre>
                  </>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {jobError ? <ErrorBlock error={jobError} title={s.error.title} detailLabel={s.error.detail} copyLabel={s.error.copyDetail} /> : null}
      </section>

      {/* ── COPY-OUT ───────────────────────────────────────────────────── */}
      <section className="gobl-panel oc-card">
        <h2>{s.copy.heading}</h2>
        <p className="oc-lead">{s.copy.lead}</p>
        <p className="oc-note">{s.copy.scrubbed}</p>

        <Action label={s.copy.action} reason={copyText ? null : s.copy.nothing} onClick={doCopy} variant="secondary" />

        {copyState === 'copied' ? <p className="oc-lead">{s.copy.copied}</p> : null}
        {copyState === 'failed' ? <p className="oc-why">{s.copy.failed}</p> : null}

        {job?.report ? (
          <>
            <p className="oc-note">{s.copy.summary}</p>
            <pre className="oc-detail">{summaryLine(job.report)}</pre>
          </>
        ) : null}

        {/* Shown when the clipboard refused, so the text is still selectable by
            hand — a clipboard permission prompt must not cost the founder the run. */}
        {copyState === 'failed' && copyText ? <pre className="oc-detail">{copyText}</pre> : null}
      </section>
    </div>
  );
}
