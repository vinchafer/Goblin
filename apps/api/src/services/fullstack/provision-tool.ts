// WAVE-B B1 — the provision_backend tool logic. Mirrors runPublish: NEVER throws, every
// failure path is a structured, verbatim-reason ToolResult; every success fact is ATTESTED
// from the provider (types.ts ProvisionedBackend). Idempotent (a project that already has a
// live backend reuses it). The trial cap (D-B2) is enforced HERE, before any provider call,
// from the very first commit. The service_role key never enters the ToolResult — only the
// public anon key + URL (R5), which the agent wires into the generated client (B2).

import logger from '../../lib/logger';
import { maxProvisionedBackends } from '../../lib/goblin-cap';
import { generateSchemaSQL, auditRlsCoverage } from './schema-sql';
import { ProvisionError, type BackendProvider, type TableSpec } from './types';
import {
  backendsTableAvailable,
  countUserBackends,
  getProjectBackend,
  recordProvisionedBackend,
  recordFailedBackend,
} from './backend-store';
import { supabaseProvider } from './supabase-provider';
import { resolveUserPlanKey } from '../storage-usage';
import type { ToolContext, ToolResult } from '../agent/types';

/** Injectable deps so the tool is unit-testable without Supabase, the DB, or the network. */
export interface ProvisionDeps {
  provider: BackendProvider;
  resolvePlan: (userId: string) => Promise<string>;
  tableAvailable: () => Promise<boolean>;
  countUserBackends: (userId: string) => Promise<number>;
  getProjectBackend: typeof getProjectBackend;
  recordProvisioned: typeof recordProvisionedBackend;
  recordFailed: typeof recordFailedBackend;
}

export const realProvisionDeps: ProvisionDeps = {
  provider: supabaseProvider,
  resolvePlan: (userId) => resolveUserPlanKey(userId).catch(() => 'none'),
  tableAvailable: () => backendsTableAvailable(),
  countUserBackends: (userId) => countUserBackends(userId),
  getProjectBackend,
  recordProvisioned: recordProvisionedBackend,
  recordFailed: recordFailedBackend,
};

/** Per-run provisioning memory (one executor per run). */
export interface ProvisionState {
  provisionedThisRun: number;
}
export function newProvisionState(): ProvisionState {
  return { provisionedThisRun: 0 };
}

// ── honest DE+EN copy (inline, mirroring publish.ts buildFailureMessage) ─────────────
const COPY: Record<string, string> = {
  fullstack_unavailable:
    'Datenbank-Funktion ist gerade nicht verfügbar. Deine Dateien sind sicher — die App läuft weiter ohne Backend.' +
    '\n\n[EN] The database feature is not available right now. Your files are safe — the app still runs without a backend.',
  no_supabase_connection:
    'Für Login und gespeicherte Daten brauchst du einen eigenen Supabase-Account (kostenlos). ' +
    'Verbinde ihn einmalig, dann lege ich Datenbank + Login an.' +
    '\n\n[EN] For login and saved data you need your own Supabase account (free). Connect it once, then I set up the database + login.',
  trial_cap:
    'Im Test kannst du bis zu 2 Apps mit Datenbank anlegen — dieses Limit ist erreicht. ' +
    'Lösche eine App mit Datenbank oder hol dir einen Plan, dann geht es weiter.' +
    '\n\n[EN] During the trial you can create up to 2 apps with a database — that limit is reached. ' +
    'Delete a database-backed app or pick a plan to continue.',
  supabase_quota:
    'Dein Supabase-Konto hat sein Kontingent erreicht (Free-Tier: 2 aktive Projekte). ' +
    'Lösche ein Projekt in Supabase oder upgrade dort, dann versuche ich es erneut.' +
    '\n\n[EN] Your Supabase account hit its quota (free tier: 2 active projects). ' +
    'Delete a project in Supabase or upgrade there, then I retry.',
  supabase_unauthorized:
    'Die Supabase-Verbindung ist abgelaufen. Bitte verbinde deinen Supabase-Account neu, dann lege ich das Backend an.' +
    '\n\n[EN] The Supabase connection expired. Reconnect your Supabase account and I set up the backend.',
  keys_unavailable:
    'Das Projekt wurde bei Supabase angelegt, aber die Schlüssel sind noch nicht bereit. ' +
    'Deine Dateien sind sicher — versuch es gleich noch einmal.' +
    '\n\n[EN] The project was created at Supabase, but its keys are not ready yet. Your files are safe — try again shortly.',
  provision_failed:
    'Das Backend konnte nicht angelegt werden. Deine Dateien sind sicher — versuch es gleich noch einmal, ' +
    'oder sag mir, was die App speichern soll.' +
    '\n\n[EN] The backend could not be created. Your files are safe — try again, or tell me what the app should store.',
  schema_failed:
    'Das Backend steht, aber die Tabellen konnten nicht angelegt werden. Ich habe nichts Halbes stehen lassen — ' +
    'versuch es gleich noch einmal.' +
    '\n\n[EN] The backend is up, but the tables could not be created. I did not leave a half-built state — try again shortly.',
};

function fail(code: string, summary: string, data?: Record<string, unknown>): ToolResult {
  return { ok: false, summary, error: { code, message: COPY[code] ?? summary }, data };
}

function parseTables(raw: unknown): TableSpec[] | null {
  if (!Array.isArray(raw)) return null;
  return raw as TableSpec[];
}

/**
 * Provision (or reuse) a backend for this project and apply the RLS-always schema. Returns
 * an attested ToolResult. `no_supabase_connection` is the JIT signal the frontend catches
 * to open the connect sheet (mirroring NO_VERCEL_TOKEN).
 */
export async function runProvisionBackend(
  deps: ProvisionDeps,
  ctx: ToolContext,
  state: ProvisionState,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const tables = parseTables(args.tables);
  const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : 'app';

  if (!tables || tables.length === 0) {
    return fail('bad_schema', 'Kein Schema angegeben — mindestens eine Tabelle nötig.', undefined);
  }

  // 0) Feature-detect the registry (pre-0096 → honest degrade, never a crash).
  if (!(await deps.tableAvailable())) {
    return fail('fullstack_unavailable', 'Datenbank-Funktion noch nicht verfügbar');
  }

  // 1) Generate the schema SQL FIRST — this validates identifiers and GUARANTEES RLS on
  //    every table before we touch the provider. A bad spec fails here, cheaply.
  let sql: string;
  try {
    sql = generateSchemaSQL(tables);
  } catch (e) {
    if (e instanceof ProvisionError) return fail(e.code, e.message);
    return fail('bad_schema', 'Schema ungültig.');
  }
  const missing = auditRlsCoverage(tables, sql);
  if (missing.length > 0) {
    // Defensive: the generator guarantees this can't happen; if it ever does, refuse rather
    // than create tables without isolation (R2 is non-negotiable).
    logger.error({ missing }, 'fullstack: RLS coverage audit failed — refusing to provision');
    return fail('schema_failed', 'Interner Schema-Fehler (RLS) — nichts wurde angelegt.');
  }
  const tableNames = tables.map((t) => t.name);

  // 2) Idempotency — a project that already has a live backend reuses it (apply schema only).
  const existing = await deps.getProjectBackend(ctx.userId, ctx.projectId).catch(() => null);
  if (existing && existing.status === 'active') {
    const applied = await deps.provider.applySchema(ctx.userId, existing.supabaseProjectRef, sql);
    if (!applied.ok) return fail('schema_failed', `Schema-Update fehlgeschlagen: ${applied.error ?? ''}`.trim());
    return {
      ok: true,
      summary: `Backend vorhanden · Schema aktualisiert: ${tables.length} Tabellen, RLS aktiv`,
      data: {
        provider: 'supabase',
        projectUrl: existing.projectUrl,
        anonKey: existing.anonKey,
        tables: tableNames,
        rlsEnabled: true,
        reused: true,
      },
    };
  }

  // 3) Connection check — the JIT gate (mirrors NO_VERCEL_TOKEN). No token → the frontend
  //    opens the Supabase connect sheet, then the run resumes.
  if (!(await deps.provider.isConnected(ctx.userId))) {
    return fail('no_supabase_connection', 'Supabase-Account verbinden');
  }

  // 4) Trial cap (D-B2) — enforced BEFORE any provider call, from commit 1.
  const plan = await deps.resolvePlan(ctx.userId);
  const max = maxProvisionedBackends(plan);
  const count = await deps.countUserBackends(ctx.userId);
  if (count >= max) {
    return fail('trial_cap', `Datenbank-Limit erreicht (${max})`);
  }

  // 5) Provision — attested from the provider API response; latency measured.
  let backend;
  try {
    backend = await deps.provider.provision(ctx.userId, { name, tables });
  } catch (e) {
    if (e instanceof ProvisionError) {
      if (e.partialRef) {
        // A backend was created but couldn't be finished — record it 'failed' (reapable),
        // never a silent orphan (E-5), and log loud.
        await deps.recordFailed(ctx.userId, ctx.projectId, e.partialRef).catch(() => {});
        logger.error({ ref: e.partialRef, code: e.code }, 'fullstack: provision left a created-but-unfinished backend — recorded FAILED for teardown');
      }
      return fail(e.code in COPY ? e.code : 'provision_failed', e.message);
    }
    logger.error({ reason: (e as Error).message }, 'fullstack: provision threw');
    return fail('provision_failed', 'Provisionierung fehlgeschlagen');
  }

  // 6) Apply the RLS-always schema.
  const applied = await deps.provider.applySchema(ctx.userId, backend.projectRef, sql);
  if (!applied.ok) {
    await deps.recordFailed(ctx.userId, ctx.projectId, backend.projectRef).catch(() => {});
    logger.error({ ref: backend.projectRef, error: applied.error }, 'fullstack: schema apply failed after provision — recorded FAILED for teardown');
    return fail('schema_failed', `Schema konnte nicht angelegt werden${applied.error ? `: ${applied.error}` : ''}`);
  }

  // 7) Record the live backend (seals service_role). A record failure does NOT fabricate a
  //    non-live state, but it IS a teardown-tracking gap → log loud (honest limitation).
  try {
    await deps.recordProvisioned(ctx.userId, ctx.projectId, backend);
  } catch (e) {
    logger.error({ ref: backend.projectRef, reason: (e as Error).message }, 'fullstack: backend is LIVE but its row was not stored — teardown-tracking gap');
  }

  state.provisionedThisRun += 1;

  // 8) Attested success. R7 copy shape ("Datenbank angelegt: N Tabellen, RLS aktiv"), with
  //    the MEASURED latency (never invented). service_role is NOT here — only the public
  //    anon key + URL for client wiring (R5).
  return {
    ok: true,
    summary: `Datenbank angelegt: ${tables.length} Tabellen, RLS aktiv (${backend.provisionLatencyMs} ms)`,
    data: {
      provider: 'supabase',
      projectUrl: backend.projectUrl,
      anonKey: backend.anonKey,
      tables: tableNames,
      rlsEnabled: true,
      region: backend.region,
      provisionLatencyMs: backend.provisionLatencyMs,
    },
  };
}
