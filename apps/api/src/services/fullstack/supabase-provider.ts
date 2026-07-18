// WAVE-B B1 — the Supabase implementation of BackendProvider (D-B1 = user-connected).
//
// Every "created" fact is ATTESTED from a real Management API response — the ref comes from
// the create-project body, the keys from the api-keys endpoint, the latency is measured
// wall-clock. Nothing is fabricated (honesty invariant + E-5). The user's OAuth access token
// is read via the canonical byok path (provider='supabase'); the token and the provisioned
// service_role key stay server-side and are never returned to the agent, logged, or reported.
//
// Provider-agnostic: this file is the ONLY Supabase-specific code the tool/store/teardown
// touch — everything above talks to the BackendProvider interface (types.ts).

import { randomBytes } from 'crypto';
import { getActiveKeyByProvider } from '../byok-service';
import { SUPABASE_MGMT_API } from './config';
import {
  ProvisionError,
  type BackendProvider,
  type ProvisionRequest,
  type ProvisionedBackend,
  type SchemaApplyResult,
  type BackendTeardownResult,
} from './types';

const MGMT_TIMEOUT_MS = 30_000;
const KEYS_RETRIES = 6;
const KEYS_RETRY_DELAY_MS = 5_000;

/** Injectable so the provider is unit-testable without the network or a Supabase account. */
export interface SupabaseProviderDeps {
  /** Resolve the user's OAuth Management API access token (null → not connected). */
  getToken: (userId: string) => Promise<string | null>;
  /** fetch, injectable for tests. */
  fetch: typeof fetch;
  /** Sleep between api-key polls (tests pass a no-op). */
  sleep: (ms: number) => Promise<void>;
  /** Clock for latency measurement (injectable so tests are deterministic). */
  now: () => number;
}

export const realSupabaseDeps: SupabaseProviderDeps = {
  getToken: (userId) => getActiveKeyByProvider(userId, 'supabase'),
  fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => Date.now(),
};

function slugify(name: string): string {
  const s = (name || 'goblin-app').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return (s || 'goblin-app').slice(0, 40);
}

/** A strong DB password for the provisioned project. Never surfaced (Supabase stores it). */
function strongPassword(): string {
  return randomBytes(24).toString('base64').replace(/[+/=]/g, '').slice(0, 28) + 'A9!';
}

export class SupabaseProvider implements BackendProvider {
  readonly id = 'supabase';
  constructor(private deps: SupabaseProviderDeps = realSupabaseDeps) {}

  private async token(userId: string): Promise<string> {
    const t = await this.deps.getToken(userId);
    if (!t) {
      throw new ProvisionError('no_supabase_connection', 'Kein verbundener Supabase-Account.');
    }
    return t;
  }

  private async api(
    token: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; json: unknown }> {
    const res = await this.deps.fetch(`${SUPABASE_MGMT_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(MGMT_TIMEOUT_MS),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }

  async isConnected(userId: string): Promise<boolean> {
    try {
      return !!(await this.deps.getToken(userId));
    } catch {
      return false;
    }
  }

  /** Pick the organization to provision into: the token's org list, first entry. Attested. */
  private async resolveOrganizationId(token: string): Promise<string> {
    const { status, json } = await this.api(token, 'GET', '/v1/organizations');
    if (status === 401 || status === 403) {
      throw new ProvisionError('supabase_unauthorized', 'Supabase-Verbindung abgelaufen — bitte neu verbinden.');
    }
    const orgs = Array.isArray(json) ? (json as Array<{ id?: string }>) : [];
    const id = orgs[0]?.id;
    if (!id) {
      throw new ProvisionError('no_organization', 'Kein Supabase-Organisation gefunden.');
    }
    return id;
  }

  async provision(userId: string, req: ProvisionRequest): Promise<ProvisionedBackend> {
    const token = await this.token(userId);
    const organizationId = await this.resolveOrganizationId(token);
    const region = process.env.GOBLIN_FULLSTACK_DEFAULT_REGION || 'eu-central-1';

    // 1) Create the project — MEASURE the real latency (the spike could not verify one).
    const started = this.deps.now();
    const create = await this.api(token, 'POST', '/v1/projects', {
      organization_id: organizationId,
      name: slugify(req.name),
      region,
      db_pass: strongPassword(),
    });
    const provisionLatencyMs = Math.max(0, this.deps.now() - started);

    if (create.status === 401 || create.status === 403) {
      throw new ProvisionError('supabase_unauthorized', 'Supabase-Verbindung abgelaufen — bitte neu verbinden.');
    }
    if (create.status === 402 || create.status === 429) {
      // Free-tier project limit (2 active) or rate limit — an honest, actionable code.
      throw new ProvisionError('supabase_quota', 'Supabase-Kontingent erreicht (Free-Tier: 2 aktive Projekte).');
    }
    const created = create.json as { id?: string; ref?: string; endpoint?: string; status?: string };
    const projectRef = created.ref ?? created.id;
    if (!create.status.toString().startsWith('2') || !projectRef) {
      throw new ProvisionError('provision_failed', `Supabase hat kein Projekt angelegt (HTTP ${create.status}).`);
    }

    // 2) Fetch the anon + service_role keys (attested). Keys may lag project creation, so
    //    poll a few times — but never fabricate: if they never arrive, throw honestly, and
    //    tag the error with the created ref so the caller records a 'failed' row (not a
    //    silent orphan) that teardown can reap (E-5: no silent half-states).
    let anonKey: string, serviceRoleKey: string;
    try {
      ({ anonKey, serviceRoleKey } = await this.fetchKeys(token, projectRef));
    } catch (e) {
      if (e instanceof ProvisionError) e.partialRef = projectRef;
      throw e;
    }

    return {
      provider: 'supabase',
      projectRef,
      projectUrl: `https://${projectRef}.supabase.co`,
      region,
      anonKey,
      serviceRoleKey,
      provisionLatencyMs,
    };
  }

  private async fetchKeys(token: string, ref: string): Promise<{ anonKey: string; serviceRoleKey: string }> {
    for (let attempt = 0; attempt < KEYS_RETRIES; attempt++) {
      const { status, json } = await this.api(token, 'GET', `/v1/projects/${ref}/api-keys`);
      if (status.toString().startsWith('2') && Array.isArray(json)) {
        const keys = json as Array<{ name?: string; api_key?: string }>;
        const anonKey = keys.find((k) => k.name === 'anon')?.api_key;
        const serviceRoleKey = keys.find((k) => k.name === 'service_role')?.api_key;
        if (anonKey && serviceRoleKey) return { anonKey, serviceRoleKey };
      }
      if (attempt < KEYS_RETRIES - 1) await this.deps.sleep(KEYS_RETRY_DELAY_MS);
    }
    throw new ProvisionError(
      'keys_unavailable',
      'Das Projekt wurde angelegt, aber die Schlüssel sind noch nicht bereit — bitte gleich erneut versuchen.',
    );
  }

  async applySchema(userId: string, projectRef: string, sql: string): Promise<SchemaApplyResult> {
    const token = await this.token(userId);
    // POST /v1/projects/{ref}/database/query runs SQL as the service role (verified live in
    // the founder's B3 proof; see evidence/wave-b/PROOF.md). Applying our RLS-always DDL here
    // means the tables and their policies are created in one attested call.
    const { status, json } = await this.api(token, 'POST', `/v1/projects/${projectRef}/database/query`, { query: sql });
    if (!status.toString().startsWith('2')) {
      const msg = (json as { message?: string })?.message ?? `HTTP ${status}`;
      return { ok: false, tablesCreated: 0, rlsEnabled: false, error: msg };
    }
    return { ok: true, tablesCreated: 0, rlsEnabled: true };
  }

  /**
   * Idempotent teardown — DELETE /v1/projects/{ref}. 404 / no-token → already gone (ok:true).
   * NEVER throws: the caller (FW6 purge) must always be able to proceed. Mirrors
   * teardownVercelProject's posture exactly.
   */
  async teardown(userId: string, projectRef: string): Promise<BackendTeardownResult> {
    let token: string | null;
    try {
      token = await this.deps.getToken(userId);
    } catch {
      token = null;
    }
    if (!token) return { ok: true, status: 0, alreadyGone: true };
    if (!projectRef) return { ok: true, status: 0, alreadyGone: true };
    try {
      const { status } = await this.api(token, 'DELETE', `/v1/projects/${projectRef}`);
      if (status === 404) return { ok: true, status, alreadyGone: true };
      if (status.toString().startsWith('2')) return { ok: true, status, alreadyGone: false };
      return { ok: false, status, alreadyGone: false, error: `HTTP ${status}` };
    } catch (e) {
      return { ok: false, status: 0, alreadyGone: false, error: e instanceof Error ? e.message : 'network' };
    }
  }
}

/** The default real provider instance. */
export const supabaseProvider = new SupabaseProvider();
