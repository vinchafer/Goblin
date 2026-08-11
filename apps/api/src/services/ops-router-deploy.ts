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
  r2Jurisdiction,
  redactSecrets,
  R2_JURISDICTIONS,
  type CfBinding,
  type CfError,
} from './cf-deploy';
import { ROUTER_SCRIPT_NAME, ROUTER_WORKER_SOURCE } from './ops-router/worker-source.generated';
import { envString } from '../lib/env-value';
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
    // Listed beside the KV line for the same reason: the upload attaches an R2
    // binding, and a binding needs the permission for the resource it binds.
    '  • Account → Workers R2 Storage → Edit',
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
  /**
   * Cloudflare error 10085 — "R2 bucket '<name>' not found".
   *
   * This used to fall through to `token`, which told the founder to add three
   * permissions the token demonstrably already had (the upload got far enough for
   * Cloudflare to answer about a BUCKET, which needs the R2 scope to even ask).
   * Sending someone back to a dashboard page that is already correct is worse than
   * saying nothing: it burns the one thing they have, and it teaches them the
   * report is guessing.
   *
   * The real cause, in the order it is worth checking: the bucket exists but in a
   * JURISDICTION namespace, and the binding did not name it. "Not found" is
   * literally true from the default namespace's point of view — the bucket is not
   * there. It is in the EU one.
   */
  bucketNotFound: [
    'Cloudflare says the R2 bucket does not exist. The token is NOT the problem —',
    'an upload that gets an answer about a bucket already passed authorization.',
    '',
    'Most likely: the bucket has a JURISDICTION and the binding did not name it.',
    'A jurisdiction bucket (EU / FedRAMP) lives in a separate namespace, so from the',
    'default namespace it genuinely is "not found".',
    '',
    'Check: Cloudflare Dashboard → R2 → the bucket → its Location / Jurisdiction.',
    '',
    '  • It says "Jurisdiction: EU"  → Railway → the Goblin API service → Variables →',
    '    set  CF_R2_JURISDICTION=eu   (lower case), save, wait for the redeploy.',
    '  • It says no jurisdiction      → CF_R2_JURISDICTION must be UNSET or empty.',
    '    A jurisdiction set here for a default-namespace bucket causes this same error.',
    '  • The name differs from CF_R2_BUCKET → fix the variable. It is the bucket NAME',
    '    (e.g. goblin-apps), not its id and not the S3 endpoint URL.',
    '',
    'A jurisdiction cannot be changed after a bucket is created — so the variable is',
    'what moves, never the bucket.',
    '',
    'Then re-run POST /api/ops/router/provision.',
  ].join('\n'),
};

/**
 * `CF_R2_JURISDICTION` is set to something R2 does not define.
 *
 * A refusal rather than a fallback. See `r2Jurisdiction()` in the adapter: the
 * founder was saying something about where user data lives, and the only honest
 * responses are to do it or to say it did not happen.
 */
function invalidJurisdictionAction(raw: string): string {
  return [
    `CF_R2_JURISDICTION is set to ${JSON.stringify(redactSecrets(raw))}, which is not an R2 jurisdiction.`,
    'The router was NOT uploaded — binding an EU bucket to the default namespace, or',
    'the reverse, is a data-residency question and this refuses to guess at it.',
    '',
    'Railway → the Goblin API service → Variables → CF_R2_JURISDICTION:',
    `  • the bucket shows "Jurisdiction: EU" in the R2 dashboard → set it to one of: ${R2_JURISDICTIONS.join(', ')}`,
    '  • the bucket shows no jurisdiction → DELETE the variable (empty is also fine)',
    '',
    'Then re-run POST /api/ops/router/provision.',
  ].join('\n');
}

/**
 * Which environment variable each env-backed binding's value comes from.
 *
 * ONE table, and the refusal message reads FROM it, because the only thing that
 * makes this particular refusal actionable is naming the variable that is really
 * empty. The message used to name both candidates unconditionally —
 * `CF_KV_NAMESPACE_ID / CF_R2_BUCKET missing` — which is a lie in the common case
 * where exactly one of them is set, and it costs the founder a trip through a
 * variable that was never the problem. The code already knows which binding came
 * up empty; there is no reason to make the reader guess.
 *
 * Where a correct value comes from is written down beside the name for the same
 * reason: `CF_R2_BUCKET` is the bucket's NAME, not its id and not its S3 URL, and
 * that is exactly the kind of thing a dashboard makes easy to get subtly wrong.
 */
const BINDING_ENV_VAR = {
  ROUTES: 'CF_KV_NAMESPACE_ID',
  APPS: 'CF_R2_BUCKET',
} as const;

type EnvBackedBinding = keyof typeof BINDING_ENV_VAR;

const BINDING_VALUE_SOURCE: Record<EnvBackedBinding, string> = {
  ROUTES:
    'CF_KV_NAMESPACE_ID — Cloudflare Dashboard → Storage & Databases → KV → the namespace → its Namespace ID (a 32-character hex string).',
  APPS:
    'CF_R2_BUCKET — Cloudflare Dashboard → R2 → the bucket → its NAME (e.g. goblin-apps). Not the bucket id, not the S3 endpoint URL.',
};

function isEnvBacked(name: string): name is EnvBackedBinding {
  return Object.prototype.hasOwnProperty.call(BINDING_ENV_VAR, name);
}

/**
 * The router's runtime bindings — how it reaches KV and R2 without a credential.
 *
 * Read through `envString` (PR #77's shared helper), not `process.env` directly.
 * Every one of these is a Railway dashboard field, and a dashboard field is
 * filled by pasting: `CF_R2_BUCKET="goblin-apps"` copied out of a `.env` file or
 * a doc code block keeps its quotes, and a raw `.trim()` leaves them on. That
 * would not land here as "missing" — it is worse than that. A quoted value is
 * NON-empty, so it sails past `emptyBindings()` and gets uploaded to
 * Cloudflare as a bucket literally named `"goblin-apps"`, quotes included, which
 * fails at the API with a message about a bucket nobody ever created. Unwrapping
 * here means a value the founder plainly meant to set is read as the value it
 * plainly is.
 */
function routerBindings(): CfBinding[] {
  // Jurisdiction rides ON the R2 binding, and only when set. An EU bucket lives in
  // a different namespace from the default one, so a binding that omits it asks
  // Cloudflare for a bucket that genuinely is not where it looked — which is the
  // 10085 exactly. An unrecognised value never reaches here: provisionRouter()
  // refuses the upload first rather than quietly falling back to the default
  // namespace. See `r2Jurisdiction()` for why that distinction matters.
  const jurisdiction = r2Jurisdiction();
  return [
    { type: 'kv_namespace', name: 'ROUTES', namespace_id: envString('CF_KV_NAMESPACE_ID') },
    {
      type: 'r2_bucket',
      name: 'APPS',
      bucket_name: envString('CF_R2_BUCKET'),
      // Spread rather than `jurisdiction: x ?? undefined`: the binding object is
      // JSON-serialised onto the upload, and an explicit `undefined` is a key the
      // next reader has to reason about for no gain.
      ...(jurisdiction.ok && jurisdiction.jurisdiction ? { jurisdiction: jurisdiction.jurisdiction } : {}),
    },
    { type: 'plain_text', name: 'APPS_DOMAIN', text: opsAppsDomain() },
    { type: 'plain_text', name: 'SITE_URL', text: opsSiteUrl() },
  ];
}

/** Every env-backed binding whose value came back empty, paired with its variable. */
function emptyBindings(bindings: CfBinding[]): Array<{ binding: EnvBackedBinding; envVar: string }> {
  const out: Array<{ binding: EnvBackedBinding; envVar: string }> = [];
  for (const b of bindings) {
    const isEmpty =
      (b.type === 'kv_namespace' && !b.namespace_id) || (b.type === 'r2_bucket' && !b.bucket_name);
    if (isEmpty && isEnvBacked(b.name)) out.push({ binding: b.name, envVar: BINDING_ENV_VAR[b.name] });
  }
  return out;
}

/**
 * The refusal, naming the variable that is actually empty — and only that one.
 *
 * `/api/ops/health` is quoted at the end on purpose: it reports env PRESENCE by
 * name without ever touching a value, so the founder can settle "is it really not
 * set?" against the running process instead of against the dashboard they already
 * believe they filled in. That disagreement — dashboard says set, process says
 * empty — is what a variable on the wrong Railway service looks like.
 */
function missingBindingAction(missing: Array<{ binding: EnvBackedBinding; envVar: string }>): string {
  const names = missing.map((m) => m.envVar);
  return [
    `The router was NOT uploaded: ${names.join(' and ')} ${names.length === 1 ? 'has' : 'have'} no value in the API's environment.`,
    '',
    'Railway → the Goblin API service → Variables. Check the name letter for letter —',
    'the variable is read by this exact spelling, and it is case-sensitive:',
    ...names.map((n) => `  • ${n}`),
    '',
    'Where a correct value comes from:',
    ...missing.map((m) => `  • ${BINDING_VALUE_SOURCE[m.binding]}`),
    '',
    'Three things that look set and are not:',
    '  • the variable sits on a DIFFERENT Railway service or environment than the API',
    '  • it was saved but the redeploy has not finished — the old process still has the old env',
    '  • the value is blank or whitespace only',
    '(A pasted value with surrounding quotes is fine — the API strips one pair.)',
    '',
    'Settle it without guessing: GET /api/ops/health → `checks.env.missing` lists every',
    'variable this running API cannot see, by name and never by value.',
    '',
    'Then re-run POST /api/ops/router/provision.',
  ].join('\n');
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
 * Cloudflare's own error number for "R2 bucket not found", as it arrives inside
 * the message the adapter assembles (`"10085 R2 bucket 'goblin-apps' not found."`).
 *
 * Matched on the NUMBER, not on the prose: the number is Cloudflare's stable
 * identifier for this condition and the sentence around it is not. The word-shaped
 * fallback is there only for the day the code stops being prefixed, and is kept
 * narrow enough that it cannot swallow an unrelated 404.
 */
const BUCKET_NOT_FOUND = /\b10085\b|R2 bucket .* not found/i;

/**
 * The founder action for a failed script upload.
 *
 * Auth is still auth. But 10085 is NOT an auth failure and must stop being told
 * it is — the token already proved itself by getting an answer about a bucket.
 */
function workerUploadAction(error: CfError): string {
  if (error.code === 'auth') return FOUNDER_ACTIONS.token;
  if (BUCKET_NOT_FOUND.test(error.message)) return FOUNDER_ACTIONS.bucketNotFound;
  return FOUNDER_ACTIONS.token;
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
  const missing = emptyBindings(bindings);
  const jurisdiction = r2Jurisdiction();
  if (!jurisdiction.ok) {
    // Its own branch, and reported ahead of an empty binding: an unreadable
    // jurisdiction is not a missing value. If both are wrong at once, the
    // jurisdiction is the one that cannot be guessed at, and folding it into the
    // empty-binding refusal would send the founder to the wrong variable.
    steps.push(
      step(
        'worker',
        'skip',
        `CF_R2_JURISDICTION is not an R2 jurisdiction — expected one of ${R2_JURISDICTIONS.join(', ')}, or unset for the default namespace`,
        { founderAction: invalidJurisdictionAction(jurisdiction.raw) },
      ),
    );
  } else if (missing.length > 0) {
    // Name the variable that is EMPTY, not the pair it could have been, and carry
    // the founder action — a skipped upload used to arrive with no action at all,
    // so the console rendered a red step and nothing to do about it.
    const names = missing.map((m) => m.envVar).join(', ');
    const labels = missing.map((m) => m.binding).join(', ');
    steps.push(
      step(
        'worker',
        'skip',
        missing.length === 1
          ? `binding ${labels} has no value — ${names} is empty or unset in this API's environment`
          : `bindings ${labels} have no value — ${names} are empty or unset in this API's environment`,
        { founderAction: missingBindingAction(missing) },
      ),
    );
  } else {
    const deployed = await deployWorker(ROUTER_SCRIPT_NAME, ROUTER_WORKER_SOURCE, { bindings });
    steps.push(
      deployed.ok
        ? step(
            'worker',
            'ok',
            // The jurisdiction is named in the success line, not only in failures:
            // this string ends up in an evidence file, and "which namespace did the
            // router actually get bound to" is precisely the question a data-residency
            // claim on the privacy page has to be answerable from.
            `uploaded ${ROUTER_SCRIPT_NAME} (${deployed.value.bytes} bytes) with ${bindings.length} bindings` +
              (jurisdiction.jurisdiction
                ? ` (R2 jurisdiction: ${jurisdiction.jurisdiction})`
                : ' (R2 default namespace)'),
          )
        : step('worker', 'fail', deployed.error.message, {
            code: deployed.error.code,
            founderAction: workerUploadAction(deployed.error),
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
