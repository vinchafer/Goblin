/**
 * Dev-Safety Shield — Supabase write-guard (B3, 2026-05-30).
 *
 * Wraps a Supabase admin (service-role) client so that, while GOBLIN_DEV_MODE=true, any
 * INSERT / UPDATE / UPSERT / DELETE that is NOT demonstrably scoped to the test user is
 * refused. Reads (SELECT) pass through untouched.
 *
 * Design notes / honest limitations:
 *  - The guard FAILS CLOSED: a mutation that does not clearly target the test user is
 *    blocked, even if it would have been harmless. In dev that is the safe failure mode.
 *  - Ownership is inferred from common column names (user_id / owner_id / created_by / id /
 *    email). A dev write that scopes ownership by some other column will be blocked — scope
 *    it by one of these, add the table to DEV_SAFE_TABLES, or disable the shield.
 *  - INSERT/UPSERT are validated from their payload up front. UPDATE/DELETE are validated
 *    from their filter chain at await-time (the `.eq()/.match()` filters that follow the
 *    verb), via a recording proxy over the Postgrest filter builder.
 *
 * Pure module: no direct dependency on the live client singleton (avoids an import cycle and
 * makes the guard unit-testable against a fake client).
 */
import { DEV_SAFE_TABLES } from './env.js';

export interface GuardConfig {
  /** When false, wrapClient returns the client untouched. */
  isDevMode: boolean;
  /** Resolved UUID of the test user, or null if not yet/never resolved. */
  testUserId: () => string | null;
  /** Email of the test user (lower-cased internally). */
  testUserEmail: string | undefined;
  /** Tables exempt from the guard. */
  safeTables?: ReadonlySet<string>;
  /**
   * Async owner resolver for project-scoped UPDATE/DELETE that filter by `id`/`project_id`
   * rather than `user_id` (e.g. deploy.ts `projects.update().eq('id', projectId)` and
   * builds.ts `build_runs.update().eq('id', jobId)`). Returns true iff the targeted row's
   * owner is the test user. Optional; if absent, such writes fail closed.
   */
  resolveOwnerIsTestUser?: (table: string, idColumn: string, idValue: string) => Promise<boolean>;
}

const OWNER_ID_COLUMNS = ['user_id', 'owner_id', 'created_by', 'id'] as const;
const FILTER_METHODS = new Set([
  'eq', 'match', 'in', 'is', 'filter', 'or', 'contains', 'neq', 'gt', 'gte', 'lt', 'lte',
  'like', 'ilike', 'not', 'order', 'limit', 'range', 'select', 'single', 'maybeSingle',
  'csv', 'returns', 'throwOnError', 'abortSignal',
]);

function blockMessage(op: string, table: string): string {
  return (
    `[DEV-GUARD] Blocked ${op} on ${table}: not test user. ` +
    'Set GOBLIN_DEV_MODE=false to disable shield.'
  );
}

function rowBelongsToTestUser(row: unknown, cfg: GuardConfig): boolean {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  const uid = cfg.testUserId();
  if (uid) {
    for (const col of OWNER_ID_COLUMNS) {
      if (r[col] === uid) return true;
    }
  }
  const email = cfg.testUserEmail?.toLowerCase();
  if (email && typeof r.email === 'string' && r.email.toLowerCase() === email) return true;
  return false;
}

function payloadBelongsToTestUser(values: unknown, cfg: GuardConfig): boolean {
  const rows = Array.isArray(values) ? values : [values];
  if (rows.length === 0) return false;
  return rows.every((row) => rowBelongsToTestUser(row, cfg));
}

/** A filter call recorded from the chain, e.g. ['eq', ['user_id', '<uuid>']]. */
type RecordedFilter = [string, unknown[]];

function filtersTargetTestUser(filters: RecordedFilter[], cfg: GuardConfig): boolean {
  const uid = cfg.testUserId();
  const email = cfg.testUserEmail?.toLowerCase();
  for (const [method, args] of filters) {
    if (method === 'eq') {
      const [col, val] = args as [string, unknown];
      if (uid && (OWNER_ID_COLUMNS as readonly string[]).includes(col) && val === uid) return true;
      if (email && col === 'email' && typeof val === 'string' && val.toLowerCase() === email) {
        return true;
      }
    }
    if (method === 'match') {
      const obj = args[0] as Record<string, unknown> | undefined;
      if (obj && rowBelongsToTestUser(obj, cfg)) return true;
    }
  }
  return false;
}

/**
 * Find a project-scoped id lookup in the filter chain, preferring `project_id` over `id`.
 * Used to resolve row ownership for UPDATE/DELETE that don't filter by user_id directly.
 */
function findOwnerLookup(filters: RecordedFilter[]): { idColumn: string; idValue: string } | null {
  let byId: { idColumn: string; idValue: string } | null = null;
  for (const [method, args] of filters) {
    if (method !== 'eq') continue;
    const [col, val] = args as [string, unknown];
    if (col === 'project_id' && typeof val === 'string') return { idColumn: 'project_id', idValue: val };
    if (col === 'id' && typeof val === 'string') byId = { idColumn: 'id', idValue: val };
  }
  return byId;
}

/**
 * Wrap a Postgrest filter builder (returned by .update()/.delete()) so the filter chain is
 * recorded and validated when the query is awaited.
 */
function guardFilterBuilder(realBuilder: any, op: string, table: string, cfg: GuardConfig): any {
  const safeTables = cfg.safeTables ?? DEV_SAFE_TABLES;
  const filters: RecordedFilter[] = [];

  const proxy: any = new Proxy(realBuilder, {
    get(target, prop, receiver) {
      if (prop === 'then') {
        return (onFulfilled?: any, onRejected?: any) => {
          if (safeTables.has(table) || filtersTargetTestUser(filters, cfg)) {
            return (target as PromiseLike<unknown>).then(onFulfilled, onRejected);
          }
          // Filter isn't user-scoped. Try async project→owner resolution before blocking.
          const lookup = findOwnerLookup(filters);
          if (lookup && cfg.resolveOwnerIsTestUser) {
            return cfg
              .resolveOwnerIsTestUser(table, lookup.idColumn, lookup.idValue)
              .then((ownerIsTest) =>
                ownerIsTest
                  ? (target as PromiseLike<unknown>)
                  : Promise.reject(new Error(blockMessage(op, table))),
              )
              .then(onFulfilled, onRejected);
          }
          return Promise.reject(new Error(blockMessage(op, table))).then(onFulfilled, onRejected);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          if (typeof prop === 'string' && FILTER_METHODS.has(prop)) {
            filters.push([prop, args]);
          }
          const result = value.apply(target, args);
          // Postgrest builders return `this` for chaining — keep wrapping so we keep recording.
          return result === target ? proxy : result;
        };
      }
      return value;
    },
  });

  return proxy;
}

/** Wrap a Postgrest query builder (returned by client.from(table)) to gate the mutators. */
function guardQueryBuilder(realQB: any, table: string, cfg: GuardConfig): any {
  const safeTables = cfg.safeTables ?? DEV_SAFE_TABLES;

  return new Proxy(realQB, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;

      // INSERT / UPSERT — validate payload up front, then hand back the real builder.
      if (prop === 'insert' || prop === 'upsert') {
        return (values: unknown, ...rest: unknown[]) => {
          if (!safeTables.has(table) && !payloadBelongsToTestUser(values, cfg)) {
            throw new Error(blockMessage(prop, table));
          }
          return value.apply(target, [values, ...rest]);
        };
      }

      // UPDATE / DELETE — filter comes after the verb; validate at await-time.
      if (prop === 'update' || prop === 'delete') {
        return (...args: unknown[]) => {
          const realBuilder = value.apply(target, args);
          return guardFilterBuilder(realBuilder, prop, table, cfg);
        };
      }

      // SELECT and everything else: pass through.
      return value.bind(target);
    },
  });
}

/**
 * Return a guarded view of `client`. In prod (isDevMode=false) returns the client unchanged.
 */
export function wrapWithDevGuard<T extends object>(client: T, cfg: GuardConfig): T {
  if (!cfg.isDevMode) return client;

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => {
          const realQB = (target as any).from(table);
          return guardQueryBuilder(realQB, table, cfg);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as T;
}
