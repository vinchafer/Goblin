// AKT 2 · PHASE 2.5 · U-C6 — mounts the REAL console for the screenshot harness.
//
// Two scenarios, because one screenshot cannot prove both things the gates ask for:
//
//   HEALTHY   — everything provisioned, a live app, a finished E2E run with real
//               numbers. This is what "every card readable, nothing clipped" is
//               checked against, and it exercises the widest content: long
//               hostnames, step details, the three headline numbers.
//   DEGRADED  — the router probe failed, 0100 is missing, the registry cannot be
//               read, hosting is off. This is what proves UNKNOWN renders as
//               UNKNOWN and that disabled actions carry their reason. It is the
//               screenshot that would expose a null quietly rendering as green.
//
// The language comes from localStorage, exactly as it does in the product
// (lib/use-lang.ts) — the harness sets it before the bundle runs, so DE and EN are
// produced by the same code path a real user goes through, not by an override.

import { createRoot } from 'react-dom/client';
import { OpsConsole } from '../../app/dashboard/konsole/console-client';

declare global {
  interface Window {
    __KONSOLE_SCENARIO__: 'healthy' | 'degraded';
  }
}

const HEALTHY_STATUS = {
  founder: { email: 'vinc.hafner3@gmail.com' },
  hosting: { enabled: true, betaAccountCount: 1 },
  router: {
    domain: 'justgoblin.app',
    pattern: '*.justgoblin.app/*',
    workerDeployed: true,
    zoneFound: true,
    wildcardProxied: true,
    routeBound: true,
    notes: [],
  },
  migrations: { registry: true, audit: true },
  appsDomain: 'justgoblin.app',
  e2e: { confirm: 'RUN-E2E', running: 'e2e-demo-1' },
  timestamp: '2026-07-29T09:14:00.000Z',
};

const DEGRADED_STATUS = {
  founder: { email: 'vinc.hafner3@gmail.com' },
  hosting: { enabled: false, betaAccountCount: 0 },
  // The probe itself failed — the whole router block is UNKNOWN, not "not there".
  router: null,
  migrations: { registry: null, audit: false },
  appsDomain: 'justgoblin.app',
  e2e: { confirm: 'RUN-E2E', running: null },
  timestamp: '2026-07-29T09:14:00.000Z',
};

const APPS_HEALTHY = {
  available: true,
  apps: [
    {
      appId: '7f3c1a2b-9d4e-4f10-8a55-1c2d3e4f5a6b',
      name: 'goblin-test-app',
      url: 'https://goblin-test-app.justgoblin.app',
      status: 'active',
      lastPublishedAt: '2026-07-29T09:02:00.000Z',
    },
    {
      appId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
      name: 'ein-sehr-langer-app-name-zum-testen',
      url: 'https://ein-sehr-langer-app-name-zum-testen.justgoblin.app',
      status: 'suspended',
      lastPublishedAt: '2026-07-28T18:40:00.000Z',
    },
  ],
};

/**
 * PHASE 3 · U3.3 — the review queue's two states.
 *
 * The HEALTHY set is deliberately not one comfortable row. It carries the two
 * shapes an operator has to be able to tell apart at a glance and that the card
 * would most easily blur:
 *   • a FLAGGED item with a category and a confidence — the model read it,
 *   • an item held because the check could NOT run (over budget, no category,
 *     unknown confidence) — which must never look like a suspicion.
 */
const REVIEWS_HEALTHY = {
  available: true,
  items: [
    {
      id: 'rv-1',
      requestedName: 'gewinnspiel-2026',
      userId: 'u-builder',
      projectId: 'p-2',
      stage1: { verdict: 'pass', ruleIds: [] },
      stage2: { verdict: 'review', reason: 'flagged', confidence: 'medium' },
      categories: ['deception'],
      scannedFiles: 3,
      scannedBytes: 4210,
      tokens: { input: 812, output: 21 },
      createdAt: '2026-08-13T07:41:00.000Z',
    },
    {
      id: 'rv-2',
      requestedName: 'ein-sehr-langer-kandidaten-name-zum-testen',
      userId: 'u-builder',
      projectId: 'p-3',
      stage1: { verdict: 'pass', ruleIds: [] },
      stage2: { verdict: 'review', reason: 'over_budget', confidence: 'unknown' },
      categories: [],
      scannedFiles: 41,
      scannedBytes: 1_204_880,
      tokens: { input: 0, output: 0 },
      createdAt: '2026-08-13T06:02:00.000Z',
    },
  ],
};

const PREVIEW_STUB = {
  id: 'rv-1',
  requestedName: 'gewinnspiel-2026',
  available: true,
  totalFiles: 3,
  binaryFiles: ['logo.png'],
  omittedFiles: [],
  // Deliberately hostile-looking source: the screenshot is the proof that it
  // arrives as visible text and is not parsed, embedded or executed.
  files: [
    {
      path: 'index.html',
      text: '<!doctype html>\n<h1>Du hast gewonnen!</h1>\n<script>document.title = "x"</script>\n<form action="https://beispiel.invalid/collect">\n  <input name="iban">\n</form>',
      bytes: 152,
      truncated: false,
    },
  ],
  note: 'Roher Quelltext, als Text ausgeliefert. Er wird nirgends ausgeführt oder als HTML eingebettet.',
};

/**
 * X1-S — the orphan sweep's two answers.
 *
 * HEALTHY is deliberately MIXED rather than all-clear: it is the only way one
 * screenshot can carry all three states of a field side by side — a real finding,
 * an earned zero, and a `null` that means "could not check". A card that renders
 * the third one like the second is the single failure this card must not have, and
 * an all-green stub would never show it.
 *
 * DEGRADED is every field `null`. That is the screenshot that would expose a null
 * quietly turning into "keine gefunden".
 */
const ORPHANS_HEALTHY = {
  // A publicly reachable hostname the registry has never heard of — the actual X1 finding.
  routeOrphans: ['verwaiste-adresse-aus-einer-loeschung'],
  // Checked, and genuinely empty.
  routesOnDeletedApps: [],
  // R2 could not be listed. NOT zero.
  orphans: null,
  knownApps: 2,
  prefixesInR2: null,
  routesInKv: 3,
  notes: [
    'R2 konnte nicht gelesen werden: 10001 Unauthorized',
    '1 verwaiste KV-Route(n) ohne Registry-Zeile — diese Adressen sind öffentlich erreichbar.',
  ],
  timestamp: '2026-08-13T09:20:00.000Z',
};

const ORPHANS_DEGRADED = {
  routeOrphans: null,
  routesOnDeletedApps: null,
  orphans: null,
  knownApps: null,
  prefixesInR2: null,
  routesInKv: null,
  notes: ['Die Registry konnte nicht gelesen werden — ohne sie sähe jede Route wie ein Waisenkind aus.'],
  timestamp: '2026-08-13T09:20:00.000Z',
};

interface EvidenceStep {
  step: string;
  ok: boolean;
  detail: string;
  propagationSec?: number;
}

const E2E_DONE: {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string;
  stepsCompleted: number;
  elapsedSec: number;
  error: string | null;
  steps: EvidenceStep[];
  report: {
    passed: boolean;
    numbers: { publishLoops: string; scanBattery: string; suspensionRoundTrip: string };
    tookMs: number;
    notes: string[];
    steps: EvidenceStep[];
  };
} = {
  id: 'e2e-demo-1',
  status: 'done',
  startedAt: '2026-07-29T08:52:00.000Z',
  finishedAt: '2026-07-29T09:04:00.000Z',
  stepsCompleted: 6,
  elapsedSec: 720,
  error: null,
  steps: [],
  report: {
    passed: true,
    numbers: { publishLoops: '5/5', scanBattery: '9/9', suspensionRoundTrip: '3/3' },
    tookMs: 720_000,
    notes: [],
    steps: [
      { step: 'preflight:router', ok: true, detail: 'router deployed, wildcard proxied, route bound' },
      { step: 'scan:battery', ok: true, detail: '9/9' },
      { step: 'publish:5/5', ok: true, detail: 'live at https://e2e-ab12.justgoblin.app (3 files, verified 3/3 assets byte-identical)' },
      { step: 'rename:old-410', ok: true, detail: 'https://e2e-ab12.justgoblin.app → 410 (no redirect)', propagationSec: 34 },
      { step: 'hostile:blocked', ok: true, detail: 'refused at the scan: AUP-PHISH-01' },
      { step: 'suspend:page-live', ok: true, detail: 'https://e2e-ab12-b.justgoblin.app → 403 with the suspended page', propagationSec: 41 },
    ],
  },
};

E2E_DONE.steps = E2E_DONE.report.steps;

const scenario = window.__KONSOLE_SCENARIO__;
const healthy = scenario === 'healthy';

// Replace the transport only. Every route the component actually calls is answered
// here; anything it does NOT call simply never fires, which is itself informative.
window.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  if (url.startsWith('/api/ops-console/status')) return json(healthy ? HEALTHY_STATUS : DEGRADED_STATUS);
  if (url.startsWith('/api/ops-console/apps')) return healthy ? json(APPS_HEALTHY) : json({ available: false, apps: [] });
  if (url.startsWith('/api/ops-console/projects')) {
    return healthy
      ? json({ available: true, projects: [{ id: 'p1', name: 'Mein Testprojekt' }] })
      : json({ error: 'x' }, 500);
  }
  if (url.includes('/preview')) return json(PREVIEW_STUB);
  if (url.startsWith('/api/ops-console/reviews')) {
    // Degraded: the queue could not be read. Not "nothing is waiting".
    return healthy ? json(REVIEWS_HEALTHY) : json({ available: false, items: [] });
  }
  if (url.startsWith('/api/admin/ops/orphans')) return json(healthy ? ORPHANS_HEALTHY : ORPHANS_DEGRADED);
  if (url.startsWith('/api/ops-console/e2e/status/')) return json(E2E_DONE);
  return json({ error: 'not_stubbed' }, 404);
}) as typeof fetch;

createRoot(document.getElementById('root')!).render(
  <OpsConsole initialStatus={(healthy ? HEALTHY_STATUS : DEGRADED_STATUS) as never} />,
);
