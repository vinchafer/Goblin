/**
 * AKT 2 · PHASE 2 · U2.2 — putting the router on the internet.
 *
 * Four things have to be true before `{name}.justgoblin.app` reaches the Worker:
 *
 *   1. the router script is uploaded, WITH its KV + R2 bindings
 *   2. `justgoblin.app` is a zone on this Cloudflare account
 *   3. `*.justgoblin.app` resolves, PROXIED (an unproxied record is worse than
 *      none — it looks configured and the Worker never runs)
 *   4. a Workers route `*.justgoblin.app/*` points at the script
 *
 * ── Why this runs on the deployed API and not in a CC session ─────────────────
 * Exactly the Phase-1 self-test reasoning (OPS_SPIKE_0 §4.4): the Cloudflare
 * credentials live only in the Railway environment. A cloud CC session is not a
 * vault, so the founder triggers ONE authorized request and reads the result
 * instead of a human or a session ever handling the token.
 *
 * ── Why every step is reported instead of thrown ──────────────────────────────
 * Steps 2–4 need token scopes Phase 1 never exercised (Zone:Read, DNS:Edit,
 * Workers Routes:Edit). If the token lacks one, that is not a bug to crash on —
 * it is a founder action with a precise dashboard equivalent. So each step reports
 * ok/fail/skip with the exact manual steps attached, the units that CAN be built
 * carry on, and the phase reports BLOCKED-ON-DNS honestly rather than claiming an
 * end-to-end that never happened.
 *
 * Every write here is idempotent: re-running a provision that already succeeded
 * changes nothing and says what it found.
 */

import {
  deployWorker,
  ensureWildcardDns,
  ensureWorkerRoute,
  findZoneId,
  getWorker,
  listDnsRecords,
  listWorkerRoutes,
  opsAppsDomain,
  opsSiteUrl,
  type CfBinding,
  type CfError,
} from './cf-deploy';
import { ROUTER_SCRIPT_NAME, ROUTER_WORKER_SOURCE } from './ops-router/worker-source.generated';
import logger from '../lib/logger';

export { ROUTER_SCRIPT_NAME };

/** The Workers route pattern that hands every app hostname to the router. */
export function routerRoutePattern(domain: string = opsAppsDomain()): string {
  return `*.${domain}/*`;
}

export type RouterStepStatus = 'ok' | 'fail' | 'skip';

export interface RouterStep {
  step: 'worker' | 'zone' | 'dns' | 'route';
  status: RouterStepStatus;
  /** Human-readable, already redacted by the adapter. Safe for an evidence file. */
  detail: string;
  code?: CfError['code'];
  /** What the founder must do in the dashboard when this step could not be done by API. */
  founderAction?: string;
}

export interface RouterProvisionReport {
  /** True only when all four steps are ok — the router really is reachable. */
  provisioned: boolean;
  /** True when DNS or the Workers route could not be set: E2E is BLOCKED-ON-DNS. */
  blockedOnDns: boolean;
  scriptName: string;
  domain: string;
  pattern: string;
  steps: RouterStep[];
  timestamp: string;
}

/**
 * The dashboard equivalents, written out so the founder never has to reverse-
 * engineer them from an error code. Deliberately click-by-click: this is the path
 * that gets used at the worst possible moment.
 */
const FOUNDER_ACTIONS = {
  token: [
    'Cloudflare Dashboard → My Profile → API Tokens → edit the token used by Goblin.',
    'Add these permissions, then Save:',
    '  • Account → Workers Scripts → Edit',
    '  • Account → Workers KV Storage → Edit',
    '  • Zone → Zone → Read            (for justgoblin.app)',
    '  • Zone → DNS → Edit             (for justgoblin.app)',
    '  • Zone → Workers Routes → Edit  (for justgoblin.app)',
    'Then re-run POST /api/ops/router/provision.',
  ].join('\n'),
  zone: [
    'justgoblin.app is not a zone on this Cloudflare account.',
    'Cloudflare Dashboard → Add a site → justgoblin.app → follow the nameserver steps at the registrar.',
    'Wait until the zone shows "Active", then re-run POST /api/ops/router/provision.',
  ].join('\n'),
  dns: [
    'Cloudflare Dashboard → justgoblin.app → DNS → Records → Add record:',
    '  Type: A · Name: * · IPv4: 192.0.2.1 · Proxy status: Proxied (orange cloud) · TTL: Auto',
    '(192.0.2.1 is the RFC 5737 documentation address — it must never route anywhere real;',
    ' the Worker is the origin, so the record only exists to bring traffic through the proxy.)',
  ].join('\n'),
  dnsUnproxied: [
    'The wildcard record exists but is NOT proxied (grey cloud), so the Worker never runs.',
    'Cloudflare Dashboard → justgoblin.app → DNS → Records → edit the `*` record →',
    'set Proxy status to Proxied (orange cloud) → Save.',
  ].join('\n'),
  route: [
    'Cloudflare Dashboard → justgoblin.app → Workers Routes → Add route:',
    `  Route: *.justgoblin.app/*  ·  Worker: ${ROUTER_SCRIPT_NAME}`,
  ].join('\n'),
};

/** The router's runtime bindings — how it reaches KV and R2 without a credential. */
function routerBindings(): CfBinding[] {
  return [
    { type: 'kv_namespace', name: 'ROUTES', namespace_id: (process.env.CF_KV_NAMESPACE_ID ?? '').trim() },
    { type: 'r2_bucket', name: 'APPS', bucket_name: (process.env.CF_R2_BUCKET ?? '').trim() },
    { type: 'plain_text', name: 'APPS_DOMAIN', text: opsAppsDomain() },
    { type: 'plain_text', name: 'SITE_URL', text: opsSiteUrl() },
  ];
}

function step(
  name: RouterStep['step'],
  status: RouterStepStatus,
  detail: string,
  extra: { code?: CfError['code']; founderAction?: string } = {},
): RouterStep {
  return { step: name, status, detail, ...extra };
}

/** An auth failure means a missing scope; anything else is Cloudflare's own answer. */
function actionFor(error: CfError, fallback: string): string {
  return error.code === 'auth' ? FOUNDER_ACTIONS.token : fallback;
}

/**
 * Deploy the router and wire the hostname to it. Never throws; the report IS the
 * answer, including when it is a refusal.
 */
export async function provisionRouter(): Promise<RouterProvisionReport> {
  const domain = opsAppsDomain();
  const pattern = routerRoutePattern(domain);
  const steps: RouterStep[] = [];

  if (!domain) {
    steps.push(step('worker', 'skip', 'OPS_APPS_DOMAIN is not set — nothing to provision.'));
    return report(steps, domain, pattern);
  }

  // 1. The script itself, with bindings. Uploaded on every provision so a binding
  //    set can never drift away from the code that needs it.
  const bindings = routerBindings();
  const missingBinding = bindings.find(
    (b) => (b.type === 'kv_namespace' && !b.namespace_id) || (b.type === 'r2_bucket' && !b.bucket_name),
  );
  if (missingBinding) {
    steps.push(
      step('worker', 'skip', `binding ${missingBinding.name} has no value — CF_KV_NAMESPACE_ID / CF_R2_BUCKET missing`),
    );
  } else {
    const deployed = await deployWorker(ROUTER_SCRIPT_NAME, ROUTER_WORKER_SOURCE, { bindings });
    steps.push(
      deployed.ok
        ? step('worker', 'ok', `uploaded ${ROUTER_SCRIPT_NAME} (${deployed.value.bytes} bytes) with ${bindings.length} bindings`)
        : step('worker', 'fail', deployed.error.message, {
            code: deployed.error.code,
            founderAction: actionFor(deployed.error, FOUNDER_ACTIONS.token),
          }),
    );
  }

  // 2. The zone. Everything after this needs its id.
  const zone = await findZoneId(domain);
  if (!zone.ok) {
    steps.push(
      step('zone', 'fail', zone.error.message, {
        code: zone.error.code,
        founderAction: actionFor(zone.error, FOUNDER_ACTIONS.zone),
      }),
    );
    steps.push(step('dns', 'skip', 'zone id unknown'), step('route', 'skip', 'zone id unknown'));
    return report(steps, domain, pattern);
  }
  if (!zone.value) {
    steps.push(step('zone', 'fail', `${domain} is not a zone on this account`, { founderAction: FOUNDER_ACTIONS.zone }));
    steps.push(step('dns', 'skip', 'zone id unknown'), step('route', 'skip', 'zone id unknown'));
    return report(steps, domain, pattern);
  }
  const zoneId = zone.value;
  steps.push(step('zone', 'ok', `zone found for ${domain}`));

  // 3. The wildcard record, proxied.
  const dns = await ensureWildcardDns(zoneId, domain);
  if (!dns.ok) {
    steps.push(
      step('dns', 'fail', dns.error.message, {
        code: dns.error.code,
        founderAction: actionFor(dns.error, FOUNDER_ACTIONS.dns),
      }),
    );
  } else if (!dns.value.proxied) {
    // The one case that looks like success and is not.
    steps.push(step('dns', 'fail', `*.${domain} exists but is NOT proxied — the Worker will never run`, {
      founderAction: FOUNDER_ACTIONS.dnsUnproxied,
    }));
  } else {
    steps.push(step('dns', 'ok', dns.value.created ? `created *.${domain} (proxied)` : `*.${domain} already present (proxied)`));
  }

  // 4. The route.
  const route = await ensureWorkerRoute(zoneId, pattern, ROUTER_SCRIPT_NAME);
  steps.push(
    route.ok
      ? step(
          'route',
          'ok',
          route.value.created
            ? `created route ${pattern} → ${ROUTER_SCRIPT_NAME}`
            : route.value.updated
              ? `re-pointed route ${pattern} → ${ROUTER_SCRIPT_NAME}`
              : `route ${pattern} already points at ${ROUTER_SCRIPT_NAME}`,
        )
      : step('route', 'fail', route.error.message, {
          code: route.error.code,
          founderAction: actionFor(route.error, FOUNDER_ACTIONS.route),
        }),
  );

  return report(steps, domain, pattern);
}

function report(steps: RouterStep[], domain: string, pattern: string): RouterProvisionReport {
  const provisioned = steps.length === 4 && steps.every((s) => s.status === 'ok');
  // BLOCKED-ON-DNS is specifically about reachability: the script can be perfectly
  // uploaded and the hostname still resolve nowhere.
  const blockedOnDns = steps.some((s) => (s.step === 'dns' || s.step === 'route' || s.step === 'zone') && s.status !== 'ok');
  logger.warn({ provisioned, blockedOnDns, steps: steps.map((s) => `${s.step}:${s.status}`) }, 'ops_router_provision');
  return {
    provisioned,
    blockedOnDns,
    scriptName: ROUTER_SCRIPT_NAME,
    domain,
    pattern,
    steps,
    timestamp: new Date().toISOString(),
  };
}

export interface RouterStatusReport {
  scriptName: string;
  domain: string;
  pattern: string;
  /** null = could not tell (an error), not "absent". */
  workerDeployed: boolean | null;
  zoneFound: boolean | null;
  wildcardProxied: boolean | null;
  routeBound: boolean | null;
  notes: string[];
  timestamp: string;
}

/**
 * READ-ONLY: what is actually in place right now. Separate from provisionRouter so
 * "show me the state" never has the side effect of changing it — and so evidence
 * can be gathered without a write.
 *
 * Every field is tri-state on purpose: `null` means the check itself failed, which
 * is not the same as `false`, and reporting them alike is exactly the kind of
 * confident-but-wrong status this codebase refuses to print.
 */
export async function routerStatus(): Promise<RouterStatusReport> {
  const domain = opsAppsDomain();
  const pattern = routerRoutePattern(domain);
  const notes: string[] = [];

  const worker = await getWorker(ROUTER_SCRIPT_NAME);
  let workerDeployed: boolean | null = null;
  if (worker.ok) workerDeployed = worker.value !== null;
  else notes.push(`worker check failed: ${worker.error.message}`);

  if (!domain) {
    notes.push('OPS_APPS_DOMAIN is not set');
    return { scriptName: ROUTER_SCRIPT_NAME, domain, pattern, workerDeployed, zoneFound: null, wildcardProxied: null, routeBound: null, notes, timestamp: new Date().toISOString() };
  }

  const zone = await findZoneId(domain);
  if (!zone.ok) {
    notes.push(`zone lookup failed: ${zone.error.message}`);
    return { scriptName: ROUTER_SCRIPT_NAME, domain, pattern, workerDeployed, zoneFound: null, wildcardProxied: null, routeBound: null, notes, timestamp: new Date().toISOString() };
  }
  if (!zone.value) {
    notes.push(`${domain} is not a zone on this account`);
    return { scriptName: ROUTER_SCRIPT_NAME, domain, pattern, workerDeployed, zoneFound: false, wildcardProxied: null, routeBound: null, notes, timestamp: new Date().toISOString() };
  }

  const records = await listDnsRecords(zone.value, `*.${domain}`);
  let wildcardProxied: boolean | null = null;
  if (records.ok) {
    const match = records.value.find((r) => r.type === 'A' || r.type === 'AAAA' || r.type === 'CNAME');
    wildcardProxied = match ? match.proxied : false;
    if (match && !match.proxied) notes.push(`*.${domain} exists but is not proxied — the Worker will never run`);
  } else notes.push(`dns check failed: ${records.error.message}`);

  const routes = await listWorkerRoutes(zone.value);
  let routeBound: boolean | null = null;
  if (routes.ok) {
    routeBound = routes.value.some((r) => r.pattern === pattern && r.script === ROUTER_SCRIPT_NAME);
    const wrong = routes.value.find((r) => r.pattern === pattern && r.script !== ROUTER_SCRIPT_NAME);
    if (wrong) notes.push(`route ${pattern} points at "${wrong.script}", not ${ROUTER_SCRIPT_NAME}`);
  } else notes.push(`route check failed: ${routes.error.message}`);

  return {
    scriptName: ROUTER_SCRIPT_NAME,
    domain,
    pattern,
    workerDeployed,
    zoneFound: true,
    wildcardProxied,
    routeBound,
    notes,
    timestamp: new Date().toISOString(),
  };
}
