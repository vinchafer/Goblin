// WAVE-B B1 — provider-agnostic backend-provisioning contract.
//
// Founder-ratified: v1 ships Supabase ONLY, but the provisioning layer is provider-AGNOSTIC
// by design so a second provider can be added later as its own wave WITHOUT a rewrite. The
// agent tool, the store, and the teardown wiring all talk to `BackendProvider` — never to
// Supabase directly. `docs/FULLSTACK.md` records this as the v2 extension point.

/** A column in a generated table. Types are a small safe allow-set (no arbitrary DDL). */
export interface ColumnSpec {
  name: string;
  /** Allowed logical types → mapped to Postgres by the schema generator. */
  type: 'text' | 'integer' | 'boolean' | 'timestamptz' | 'uuid' | 'numeric' | 'jsonb';
  /** Column is NOT NULL. */
  notNull?: boolean;
  /** A safe default: 'now' → now(), 'false'/'true' → boolean, 'gen_random_uuid' → uuid. */
  default?: 'now' | 'true' | 'false' | 'gen_random_uuid';
}

/**
 * A per-user table to create. RLS is NON-OPTIONAL and ALWAYS generated (R2 / B2): every
 * table carries an owner column (`user_id uuid` referencing auth.users) and owner-scoped
 * SELECT/INSERT/UPDATE/DELETE policies. There is no "no-RLS" option — a table without
 * per-user isolation cannot be expressed by this type.
 */
export interface TableSpec {
  /** snake_case table name (validated). */
  name: string;
  /** Non-owner columns (an `id uuid pk` and `user_id uuid` owner column are added automatically). */
  columns: ColumnSpec[];
}

/** What the agent asks the tool to provision. `tables` is the schema (RLS auto-generated). */
export interface ProvisionRequest {
  /** Human project name (used to name the Supabase project; slugified by the provider). */
  name: string;
  /** The per-user tables to create. Every table gets RLS (see TableSpec). */
  tables: TableSpec[];
}

/**
 * A provisioned backend — every field ATTESTED from a real provider API response, never
 * fabricated. The service_role key is carried in-process only long enough to seal it into
 * the store; it is NEVER returned to the agent, put in generated code, logged, or reported.
 */
export interface ProvisionedBackend {
  provider: 'supabase';
  /** The provider project ref (attested from the create-project response). */
  projectRef: string;
  /** https://<ref>.supabase.co — public; safe in generated client code. */
  projectUrl: string;
  region: string;
  /** The public anon key — safe in generated client code (behind RLS). */
  anonKey: string;
  /** The SECRET service_role key — sealed immediately, never surfaced. */
  serviceRoleKey: string;
  /** MEASURED wall-clock of the create-project call (honest telemetry; never invented). */
  provisionLatencyMs: number;
}

/** Result of applying the schema — attested counts from the query response. */
export interface SchemaApplyResult {
  ok: boolean;
  tablesCreated: number;
  rlsEnabled: boolean;
  error?: string;
}

/** Idempotent teardown result, mirroring the Vercel teardown posture. */
export interface BackendTeardownResult {
  ok: boolean;          // true = backend removed or already gone
  status: number;       // last provider HTTP status (0 = network/no-token)
  alreadyGone: boolean; // provider 404 → nothing left to remove
  error?: string;
}

/**
 * The provider abstraction. A second provider (v2) implements this and is registered
 * without touching the tool / store / teardown wiring.
 */
export interface BackendProvider {
  readonly id: string;
  /** Has the user connected this provider (OAuth token present + valid shape)? */
  isConnected(userId: string): Promise<boolean>;
  /** Create the backend. Attested from the API response; measures latency. May throw a coded error. */
  provision(userId: string, req: ProvisionRequest): Promise<ProvisionedBackend>;
  /** Apply the RLS-always schema SQL to the provisioned backend. */
  applySchema(userId: string, projectRef: string, sql: string): Promise<SchemaApplyResult>;
  /** Idempotent teardown of a provisioned backend (404 / no-token → ok:true). */
  teardown(userId: string, projectRef: string): Promise<BackendTeardownResult>;
}

/** A coded provisioning error the tool maps to honest DE+EN copy. `partialRef` is set when
 *  a backend WAS created before a later step failed (keys not ready, schema failed) — so the
 *  tool records a 'failed' row (never a silent half-state, E-5) that teardown can reap. */
export class ProvisionError extends Error {
  constructor(public code: string, message: string, public partialRef?: string) {
    super(message);
    this.name = 'ProvisionError';
  }
}
