/**
 * AKT 2 · PHASE 4 · U4.1 + U4.2 — one database per app, and what lives in it.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * THIS IS THE FILE WHERE GOBLIN BECOMES A DATA PROCESSOR.
 *
 * Everything before Phase 4 served the builder's own bytes back to the internet.
 * From here on, a stranger types their name and e-mail into somebody's app and
 * Goblin stores it. The app's owner is the controller; Goblin is the processor;
 * the person in the row never agreed to anything with us. That asymmetry is why
 * the rules below are rules and not preferences.
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * ── PER-APP ISOLATION IS PHYSICAL, NOT A WHERE-CLAUSE ────────────────────────
 * Every form-enabled app gets its OWN D1 database. Not a shared table with an
 * `app_id` column — a separate database with its own id, addressed by a URL that
 * contains that id. The isolation therefore does not depend on anybody remembering
 * a filter: there is no query in this codebase that CAN return two apps' rows,
 * because there is no statement that reaches two databases. `submissionStore()`
 * takes the id from the registry row of the app being written to and from nowhere
 * else; a request cannot supply one. U4.8's isolation evidence is a proof about
 * that one fact.
 *
 * ── DATA RESIDENCY ───────────────────────────────────────────────────────────
 * The database is created in the jurisdiction `d1Jurisdiction()` derives from
 * `CF_R2_JURISDICTION` — the same variable that governs R2, so the privacy page's
 * one sentence about where Goblin keeps things stays true for both. A jurisdiction
 * cannot be changed after creation, so provisioning REFUSES rather than creating a
 * database it cannot honestly describe. What Cloudflare says it created is written
 * into the database's own meta table, so the claim is backed by a recorded fact
 * rather than by what we asked for.
 *
 * ── WHAT IS DELIBERATELY NOT STORED ──────────────────────────────────────────
 * No IP address. No user agent. No referrer. No cookie, no fingerprint, nothing
 * that identifies the visitor beyond what they themselves typed into the form.
 *
 * That is a real cost and it is worth naming: it means abuse handling on this path
 * is coarse (Turnstile, a per-app monthly ceiling, and the owner's own delete
 * button) rather than targeted, and a flood from one source cannot be blocked by
 * source. The trade is deliberate. An IP is personal data under the GDPR; storing
 * one would need a legal basis, a disclosure on the privacy page, a retention rule
 * and a deletion path, and it would be collected from someone who came to fill in
 * a contact form. Phase 4 does not need it to work, so it is not taken. If a
 * future phase needs it, that is a founder decision with a privacy-page change
 * attached, not a column somebody adds.
 *
 * ── NO CONTENT IN LOGS, ERRORS OR MODEL CALLS ────────────────────────────────
 * Nothing in this file logs a payload, a field name or a field value. Errors carry
 * counts and byte totals, never content. `queryD1` (cf-deploy.ts) enforces the
 * other half: parameters are parameters, and a failing statement returns a generic
 * message precisely because Cloudflare's own error text can quote the value that
 * failed — and the value that failed is somebody's message.
 *
 * Cost: docs/GOBLIN_CONSUMPTION_LEDGER.md → M-F1 (D1 storage + ops).
 */

import { randomUUID } from 'node:crypto';
import {
  createD1Database,
  deleteD1Database,
  getD1Database,
  queryD1,
  type CfResult,
} from './cf-deploy';
import logger from '../lib/logger';

/**
 * The shape of what a `submissions.payload` holds, versioned IN CODE.
 *
 * 0099 stores the cap profile as a name so numbers can move without a migration;
 * this is the same idea one level down. Every app's database carries the version
 * its rows were written under, in `meta`, so a future reader knows what it is
 * looking at without guessing from the data — and so a fleet of independently
 * provisioned databases has ONE known schema rather than N archaeological layers.
 *
 * v1: `payload` is a JSON object of `{ [fieldName: string]: string }`. Flat,
 * strings only. Not because nesting is hard, but because a form posts strings and
 * inventing types for them here would be guessing about somebody's data.
 */
export const SUBMISSION_SHAPE_VERSION = 1;

/** The DDL, in the order it is applied. Idempotent — a re-provision is a no-op. */
const SCHEMA: readonly string[] = [
  `create table if not exists submissions (
     id            text    primary key,
     form_id       text    not null,
     created_at    text    not null,
     shape_version integer not null,
     payload       text    not null,
     field_count   integer not null,
     bytes         integer not null,
     read_at       text
   )`,
  `create index if not exists idx_submissions_created on submissions (created_at desc)`,
  `create index if not exists idx_submissions_form on submissions (form_id, created_at desc)`,
  // The cap counter. SEPARATE from the rows, and monotonic, because the cap counts
  // what was ACCEPTED in a month and not what is still stored. Counting rows would
  // mean "delete all" hands the app a fresh allowance — a ceiling that resets when
  // you empty the drawer is not a ceiling.
  `create table if not exists usage_months (
     month    text    primary key,
     accepted integer not null default 0,
     refused  integer not null default 0
   )`,
  // Per-app settings and provenance. Lives HERE rather than in a new Postgres
  // column on purpose: it is one row per app about that app's own data, it needs
  // no migration, and it is deleted by the same teardown that deletes the data it
  // describes.
  `create table if not exists meta (
     k text primary key,
     v text not null
   )`,
];

export interface ProvisionedDatabase {
  databaseId: string;
  /** What Cloudflare reported, not what was requested. `null` = default namespace. */
  jurisdiction: string | null;
}

export interface ProvisionFailure {
  ok: false;
  code: 'jurisdiction_refused' | 'limit_reached' | 'create_failed' | 'schema_failed';
  /** German, for the builder. Never a stack trace, never an upstream blob. */
  message: string;
  /** Technical, redacted, for the log and the operator. */
  detail?: string;
}

export type ProvisionResult = ({ ok: true } & ProvisionedDatabase) | ProvisionFailure;

/**
 * The Workers FREE plan allows 10 D1 databases per account.
 *
 * Checked against live docs on 2026-08-13
 * (https://developers.cloudflare.com/d1/platform/limits/): "Number of databases —
 * 10 (Free) / 50,000 (Workers Paid)". This is the one hard ceiling Phase 4 adds to
 * the lean plane, and it is stated rather than discovered: the eleventh
 * form-enabled app is REFUSED with a sentence a human can act on, instead of
 * failing somewhere inside a Cloudflare error nobody reads.
 *
 * It is not a cost decision anybody has taken yet — going past it means Workers
 * Paid. That escalation belongs to the founder (docs/ACT2_PHASE4_DECISIONS.md,
 * P4-a), which is exactly why the number lives here where it can be raised in one
 * line the day the plan changes.
 */
export const D1_FREE_PLAN_DATABASE_LIMIT = 10;

/**
 * Create and prepare the database for one app.
 *
 * Called at most once per app, from the publish path, and ONLY when the artifact
 * actually declares a form. An app without a form never gets a database — the
 * ceiling above is scarce, and provisioning storage for data nobody is going to
 * send would spend it on nothing.
 */
export async function provisionAppDatabase(
  appId: string,
  deps: {
    create?: typeof createD1Database;
    query?: typeof queryD1;
    countExisting?: () => Promise<number | null>;
  } = {},
): Promise<ProvisionResult> {
  const create = deps.create ?? createD1Database;
  const query = deps.query ?? queryD1;

  // The ceiling, checked BEFORE creating rather than discovered by a 400. A
  // count that cannot be taken is not a reason to refuse — Cloudflare enforces the
  // real limit and its error is mapped below — but when we CAN count, the refusal
  // is the honest, specific one.
  if (deps.countExisting) {
    const existing = await deps.countExisting();
    if (existing !== null && existing >= D1_FREE_PLAN_DATABASE_LIMIT) {
      return {
        ok: false,
        code: 'limit_reached',
        message:
          'Goblin kann gerade keine weitere App mit Formular veröffentlichen — die Beta hat Platz für '
          + `${D1_FREE_PLAN_DATABASE_LIMIT} Formular-Apps und der ist belegt. Deine App ohne Formular zu `
          + 'veröffentlichen geht weiterhin. Wir haben eine Nachricht bekommen.',
        detail: `d1 database count ${existing} >= ${D1_FREE_PLAN_DATABASE_LIMIT}`,
      };
    }
  }

  const created = await create(appId);
  if (!created.ok) {
    if (created.error.code === 'not_configured' && /jurisdiction|residency/i.test(created.error.message)) {
      return {
        ok: false,
        code: 'jurisdiction_refused',
        message:
          'Die Datenablage für Formulare ist nicht sauber eingerichtet — Goblin legt hier lieber gar nichts an, '
          + 'als die Daten deiner Besucher an einem Ort zu speichern, den wir auf der Datenschutzseite nicht so beschreiben.',
        detail: created.error.message,
      };
    }
    logger.warn({ appId, reason: created.error.code }, 'ops_d1_create_failed');
    return {
      ok: false,
      code: 'create_failed',
      message:
        'Die Datenablage für die Formulare dieser App konnte nicht angelegt werden. '
        + 'Die App wurde deshalb NICHT veröffentlicht — ein sichtbares Formular, das nichts entgegennimmt, wäre schlimmer.',
      detail: created.error.message,
    };
  }

  const databaseId = created.value.id;

  for (const statement of SCHEMA) {
    const res = await query(databaseId, statement);
    if (!res.ok) {
      logger.warn({ appId, reason: res.error.code }, 'ops_d1_schema_failed');
      return {
        ok: false,
        code: 'schema_failed',
        message:
          'Die Datenablage für die Formulare dieser App konnte nicht fertig eingerichtet werden. '
          + 'Die App wurde deshalb NICHT veröffentlicht. Bitte versuch es gleich noch einmal.',
        detail: res.error.message,
      };
    }
  }

  // Provenance, written into the database itself. `jurisdiction` is what Cloudflare
  // REPORTED — so if the privacy page's claim is ever questioned, the answer is a
  // row and not a memory of what we asked for.
  await setMeta(databaseId, 'shape_version', String(SUBMISSION_SHAPE_VERSION), query);
  await setMeta(databaseId, 'jurisdiction', created.value.jurisdiction ?? '(default)', query);
  await setMeta(databaseId, 'app_id', appId, query);
  await setMeta(databaseId, 'created_at', new Date().toISOString(), query);

  logger.info({ appId, jurisdiction: created.value.jurisdiction }, 'ops_d1_provisioned');
  return { ok: true, databaseId, jurisdiction: created.value.jurisdiction };
}

// ── meta ────────────────────────────────────────────────────────────────────

async function setMeta(
  databaseId: string,
  key: string,
  value: string,
  query: typeof queryD1 = queryD1,
): Promise<boolean> {
  const res = await query(
    databaseId,
    'insert into meta (k, v) values (?, ?) on conflict(k) do update set v = excluded.v',
    [key, value],
  );
  return res.ok;
}

async function getMeta(
  databaseId: string,
  key: string,
  query: typeof queryD1 = queryD1,
): Promise<string | null> {
  const res = await query(databaseId, 'select v from meta where k = ? limit 1', [key]);
  if (!res.ok) return null;
  const row = res.value.rows[0];
  return row && typeof row.v === 'string' ? row.v : null;
}

/**
 * Does the owner want an e-mail for every submission of this app? (U4.5 opt-out.)
 *
 * DEFAULTS TO YES, and a failed read also answers yes. The failure mode of
 * "notified when you did not want to be" is an unwanted e-mail; the failure mode
 * of the other direction is a submission nobody ever learns about, which is the
 * silent-drop class this whole phase is built to avoid.
 */
export async function notificationsEnabled(databaseId: string, query: typeof queryD1 = queryD1): Promise<boolean> {
  return (await getMeta(databaseId, 'notify', query)) !== 'off';
}

export async function setNotifications(
  databaseId: string,
  enabled: boolean,
  query: typeof queryD1 = queryD1,
): Promise<boolean> {
  return setMeta(databaseId, 'notify', enabled ? 'on' : 'off', query);
}

/** What jurisdiction this app's database was actually created in, as recorded at provisioning. */
export async function recordedJurisdiction(databaseId: string, query: typeof queryD1 = queryD1): Promise<string | null> {
  return getMeta(databaseId, 'jurisdiction', query);
}

// ── submissions ─────────────────────────────────────────────────────────────

export interface StoredSubmission {
  id: string;
  formId: string;
  createdAt: string;
  /** The visitor's own fields. Never logged; never sent to a model. */
  fields: Record<string, string>;
  fieldCount: number;
  bytes: number;
  readAt: string | null;
  shapeVersion: number;
}

export interface SubmissionPage {
  submissions: StoredSubmission[];
  /** Total rows currently stored — what the inbox counts, not the cap. */
  total: number;
}

function toSubmission(row: Record<string, unknown>): StoredSubmission {
  let fields: Record<string, string> = {};
  try {
    const parsed = JSON.parse(String(row.payload ?? '{}')) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      fields = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'string' ? v : String(v)]),
      );
    }
  } catch {
    // A row we cannot parse is shown as EMPTY rather than dropped from the list.
    // The owner must be able to see that something arrived even when we can no
    // longer read it — the count is the honest part, and a missing row would be a
    // silent loss dressed as a clean inbox.
    fields = {};
  }
  return {
    id: String(row.id ?? ''),
    formId: String(row.form_id ?? ''),
    createdAt: String(row.created_at ?? ''),
    fields,
    fieldCount: Number(row.field_count ?? 0) || 0,
    bytes: Number(row.bytes ?? 0) || 0,
    readAt: row.read_at ? String(row.read_at) : null,
    shapeVersion: Number(row.shape_version ?? SUBMISSION_SHAPE_VERSION) || SUBMISSION_SHAPE_VERSION,
  };
}

/** The UTC month a counter belongs to. UTC, not local — the same rule as the router's day. */
export function usageMonth(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 7);
}

/**
 * How many submissions this app has ACCEPTED in the given month.
 *
 * `null` means the counter could not be read — which the caller must not treat as
 * zero. Accepting because we could not count is how a cap silently stops existing.
 */
export async function acceptedThisMonth(
  databaseId: string,
  month: string,
  query: typeof queryD1 = queryD1,
): Promise<number | null> {
  const res = await query(databaseId, 'select accepted from usage_months where month = ? limit 1', [month]);
  if (!res.ok) return null;
  const row = res.value.rows[0];
  if (!row) return 0;
  const n = Number(row.accepted);
  return Number.isFinite(n) ? n : 0;
}

/** Count a refusal. Refusals are counted so "we turned people away" is a number, not a feeling. */
export async function countRefusal(
  databaseId: string,
  month: string,
  query: typeof queryD1 = queryD1,
): Promise<void> {
  await query(
    databaseId,
    'insert into usage_months (month, accepted, refused) values (?, 0, 1) '
    + 'on conflict(month) do update set refused = refused + 1',
    [month],
  );
}

export interface InsertResult {
  ok: boolean;
  id?: string;
  detail?: string;
}

/**
 * Store one submission, then count it.
 *
 * The order matters and the reason is the phase's own rule: NOTHING is silently
 * dropped. The row lands first; the counter is bumped after. A crash between the
 * two under-counts the month — the owner keeps the submission and the cap is a
 * shade more generous than it says. The reverse order would lose the submission
 * while claiming the allowance, which is the failure this codebase does not ship.
 */
export async function insertSubmission(
  databaseId: string,
  input: { formId: string; fields: Record<string, string>; now?: number },
  query: typeof queryD1 = queryD1,
): Promise<InsertResult> {
  const id = randomUUID();
  const createdAt = new Date(input.now ?? Date.now()).toISOString();
  const payload = JSON.stringify(input.fields);
  const fieldCount = Object.keys(input.fields).length;
  const bytes = Buffer.byteLength(payload, 'utf8');

  const res = await query(
    databaseId,
    'insert into submissions (id, form_id, created_at, shape_version, payload, field_count, bytes, read_at) '
    + 'values (?, ?, ?, ?, ?, ?, ?, null)',
    [id, input.formId, createdAt, SUBMISSION_SHAPE_VERSION, payload, fieldCount, bytes],
  );
  if (!res.ok) {
    // Counts and codes only. `payload` does not appear here and must not.
    logger.warn({ fieldCount, bytes, reason: res.error.code }, 'ops_submission_insert_failed');
    return { ok: false, detail: res.error.message };
  }

  await query(
    databaseId,
    'insert into usage_months (month, accepted, refused) values (?, 1, 0) '
    + 'on conflict(month) do update set accepted = accepted + 1',
    [usageMonth(input.now ?? Date.now())],
  );

  return { ok: true, id };
}

/** Newest first — the only order an inbox is ever read in. */
export async function listSubmissions(
  databaseId: string,
  opts: { limit?: number; offset?: number } = {},
  query: typeof queryD1 = queryD1,
): Promise<SubmissionPage | null> {
  const limit = Math.min(Math.max(Math.floor(opts.limit ?? 50), 1), 200);
  const offset = Math.max(Math.floor(opts.offset ?? 0), 0);

  const rows = await query(
    databaseId,
    'select id, form_id, created_at, shape_version, payload, field_count, bytes, read_at '
    + 'from submissions order by created_at desc limit ? offset ?',
    [limit, offset],
  );
  if (!rows.ok) return null;

  const counted = await query(databaseId, 'select count(*) as n from submissions');
  if (!counted.ok) return null;

  return {
    submissions: rows.value.rows.map(toSubmission),
    total: Number(counted.value.rows[0]?.n ?? 0) || 0,
  };
}

/** Every submission, oldest first — the CSV export's source. Bounded, and it says so. */
export async function allSubmissionsForExport(
  databaseId: string,
  limit = 5000,
  query: typeof queryD1 = queryD1,
): Promise<{ submissions: StoredSubmission[]; truncated: boolean } | null> {
  const res = await query(
    databaseId,
    'select id, form_id, created_at, shape_version, payload, field_count, bytes, read_at '
    + 'from submissions order by created_at asc limit ?',
    [limit + 1],
  );
  if (!res.ok) return null;
  const rows = res.value.rows.map(toSubmission);
  return { submissions: rows.slice(0, limit), truncated: rows.length > limit };
}

export async function markSubmissionRead(
  databaseId: string,
  submissionId: string,
  query: typeof queryD1 = queryD1,
): Promise<boolean> {
  const res = await query(databaseId, 'update submissions set read_at = ? where id = ? and read_at is null', [
    new Date().toISOString(),
    submissionId,
  ]);
  return res.ok;
}

export async function deleteSubmission(
  databaseId: string,
  submissionId: string,
  query: typeof queryD1 = queryD1,
): Promise<boolean> {
  const res = await query(databaseId, 'delete from submissions where id = ?', [submissionId]);
  return res.ok;
}

/**
 * Delete every submission of this app.
 *
 * `usage_months` is deliberately NOT cleared: the cap counts what was accepted in
 * a month, and emptying the drawer must not hand out a second allowance. The
 * owner's data is gone; the fact that it once arrived is not a fact about them.
 */
export async function deleteAllSubmissions(
  databaseId: string,
  query: typeof queryD1 = queryD1,
): Promise<{ ok: boolean; deleted: number | null }> {
  const before = await query(databaseId, 'select count(*) as n from submissions');
  const res = await query(databaseId, 'delete from submissions');
  if (!res.ok) return { ok: false, deleted: null };
  return { ok: true, deleted: before.ok ? Number(before.value.rows[0]?.n ?? 0) || 0 : null };
}

/** How many rows are stored right now — for the delete dialog and the teardown warning. */
export async function submissionCount(
  databaseId: string,
  query: typeof queryD1 = queryD1,
): Promise<number | null> {
  const res = await query(databaseId, 'select count(*) as n from submissions');
  if (!res.ok) return null;
  return Number(res.value.rows[0]?.n ?? 0) || 0;
}

// ── export ──────────────────────────────────────────────────────────────────

/**
 * Submissions as CSV — the owner's data, in the format that opens in the thing
 * they already have.
 *
 * ── Two decisions worth stating ──────────────────────────────────────────────
 * 1. The COLUMNS are the union of every field name that ever appeared, in
 *    first-seen order, and a submission missing one gets an empty cell. Forms
 *    change over time; a export that showed only the newest shape would silently
 *    drop the older answers, which is a data loss dressed as a tidy file.
 * 2. A value beginning with `=`, `+`, `-` or `@` is prefixed with an apostrophe.
 *    Excel and Numbers treat those as FORMULAS, and this file is built out of text
 *    that strangers typed into somebody's contact form. Handing an owner a
 *    spreadsheet that executes what a visitor wrote is not an export, it is an
 *    attack delivered by their own tool.
 */
export function submissionsToCsv(submissions: StoredSubmission[]): string {
  const columns: string[] = [];
  for (const s of submissions) {
    for (const key of Object.keys(s.fields)) if (!columns.includes(key)) columns.push(key);
  }

  const cell = (raw: string): string => {
    const guarded = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${guarded.replace(/"/g, '""')}"`;
  };

  const header = ['eingegangen_am', 'formular', 'gelesen_am', ...columns].map(cell).join(',');
  const rows = submissions.map((s) =>
    [s.createdAt, s.formId, s.readAt ?? '', ...columns.map((c) => s.fields[c] ?? '')].map(cell).join(','),
  );
  return [header, ...rows].join('\r\n');
}

// ── teardown (X1's rule, one plane further) ─────────────────────────────────

export interface D1TeardownResult {
  /** Was there a database at all? */
  attempted: boolean;
  /** VERIFIED gone — re-read after the delete, never "the delete did not throw". */
  gone: boolean | null;
  detail?: string;
}

/**
 * Delete an app's database and PROVE it is gone.
 *
 * This is X1's rule reaching the plane Phase 4 created. A KV route that outlives
 * its app is a hostname nobody can take down; a D1 database that outlives its app
 * is worse — it is other people's personal data, on Goblin's account, belonging to
 * an app that no longer exists and with no row pointing at it. The delete path
 * must therefore BLOCK on a failed teardown rather than half-complete, which is
 * what `gone === true` is for: `teardownApp` folds it into its `ok`, and
 * `teardownProjectApp` refuses the project delete when it is not true.
 *
 * `gone: null` is not `false`. "I deleted it and could not check" and "it is still
 * there" are different states, and only one of them is worth retrying immediately
 * — but neither is `true`, and neither may release the row.
 */
export async function teardownAppDatabase(
  databaseId: string | null,
  deps: { del?: typeof deleteD1Database; get?: typeof getD1Database } = {},
): Promise<D1TeardownResult> {
  if (!databaseId) return { attempted: false, gone: null };
  const del = deps.del ?? deleteD1Database;
  const get = deps.get ?? getD1Database;

  const deleted = await del(databaseId);
  const after = await get(databaseId);

  if (!after.ok) {
    return {
      attempted: true,
      gone: null,
      detail: `delete ${deleted.ok ? 'issued' : 'failed'}; verification failed: ${after.error.message}`,
    };
  }
  const gone = after.value === null;
  if (!gone) {
    logger.error({ databaseId }, 'ops_d1_teardown_incomplete');
  }
  return {
    attempted: true,
    gone,
    ...(deleted.ok ? {} : { detail: deleted.error.message }),
  };
}

/** Re-exported so callers do not reach past this module into the adapter. */
export type { CfResult };
