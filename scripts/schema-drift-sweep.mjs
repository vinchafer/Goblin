#!/usr/bin/env node
/**
 * FOUNDER-WALK-5 · U2 — find objects the CODE reads that NO migration in this repo creates.
 *
 * ── The class of defect ──────────────────────────────────────────────────────
 *
 * `users.deleted_at` was read at five call sites and written at two, and
 * `grep -rn deleted_at supabase/migrations/` matched NOTHING across 0001–0100. Nobody
 * noticed for as long as production happened to tolerate it, and it surfaced as a 500 on a
 * founder walk. `supabase/checks/migration_status.sql` could never have caught it: that
 * probe asks "did the migrations I wrote land?", and here there was no migration to check.
 *
 * This sweep asks the other question — "does every object the code reads have DDL
 * somewhere?" — from the repo alone, with no database. Run it before believing the schema
 * is complete:
 *
 *     node scripts/schema-drift-sweep.mjs
 *
 * Exits 1 when it finds anything, so it can gate a job.
 *
 * ── What it is and is not ────────────────────────────────────────────────────
 *
 * It is a lexical sweep, deliberately. It reads the Supabase query-builder calls
 * (`.from('t').select('a, b').eq('c', …)`) and checks each identifier against the text of
 * every migration. That means:
 *
 *   · A column is "covered" if its NAME appears anywhere in the migration set. A name that
 *     is created on one table and read on another therefore passes — this finds the
 *     completely-unauthored objects (the `deleted_at` class), not every mis-typed column.
 *   · Dynamic table/column names, RPC bodies and raw SQL are invisible to it.
 *
 * Both limits are stated because a sweep that silently under-reports is exactly the kind of
 * false assurance this repo has been paying for. A clean run means "no completely
 * unauthored object was found", not "the schema is proven correct".
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION_DIR = 'supabase/migrations';
const SOURCE_DIRS = ['apps/api/src', 'apps/web'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo']);

/** Builder methods whose first string argument names columns. */
const COLUMN_METHODS = 'select|eq|is|neq|gt|gte|lt|lte|in|order|ilike|like';

/**
 * Identifiers that are never database objects but do appear in these call positions:
 * PostgREST embedded-resource syntax, wildcards, and the `count` option shorthand.
 */
const NOT_A_COLUMN = new Set(['count', 'exact', 'planned', 'estimated', 'head', 'true', 'false', 'null']);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    // Tests carry deliberate fixtures for missing schema — they are not production reads.
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) out.push(path);
  }
  return out;
}

const migrationSql = readdirSync(MIGRATION_DIR)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(MIGRATION_DIR, f), 'utf8'))
  .join('\n')
  .toLowerCase();

/** Does ANY migration create this relation? */
function tableHasDdl(table) {
  const pattern = new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?(?:table|(?:materialized\\s+)?view)\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?${table}\\b`,
  );
  return pattern.test(migrationSql);
}

/** Does the column name appear anywhere in the migration set? (See the caveat above.) */
function columnNameAppears(column) {
  return new RegExp(`\\b${column}\\b`).test(migrationSql);
}

const missingTables = new Map();
const missingColumns = new Map();

function record(map, key, location) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(location);
}

for (const dir of SOURCE_DIRS) {
  for (const file of walk(dir)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // Comment lines are skipped: `prompts/goblin-chat-system.ts` shows the MODEL example
      // Supabase code for the apps it generates (`.from('tasks')`), and those tables belong
      // to a user's project, not to Goblin's schema. Reading them as our own reads would
      // put permanent false positives in a report meant to be believed.
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      const at = `${file}:${i + 1}`;

      for (const m of line.matchAll(/\.from\(\s*['"]([a-z][a-z0-9_]*)['"]/g)) {
        if (!tableHasDdl(m[1])) record(missingTables, m[1], at);
      }

      for (const m of line.matchAll(new RegExp(`\\.(?:${COLUMN_METHODS})\\(\\s*['"]([^'"]+)['"]`, 'g'))) {
        for (const raw of m[1].split(',')) {
          // `select('a, b, rel(x)')` and `order('a', { ascending })` both land here.
          const column = raw.trim().replace(/\s.*$/, '').replace(/[({].*$/, '');
          if (!/^[a-z][a-z0-9_]{2,}$/.test(column)) continue;
          if (NOT_A_COLUMN.has(column)) continue;
          if (!columnNameAppears(column)) record(missingColumns, column, at);
        }
      }
    });
  }
}

function report(title, map) {
  if (map.size === 0) return 0;
  console.log(`\n${title}`);
  for (const [name, locations] of [...map].sort()) {
    console.log(`  ${name}`);
    for (const location of [...locations].sort()) console.log(`      ${location}`);
  }
  return map.size;
}

const found =
  report('TABLES the code reads with no CREATE in supabase/migrations/:', missingTables) +
  report('COLUMN NAMES the code reads that appear in no migration:', missingColumns);

if (found === 0) {
  console.log('No unauthored table or column found.');
  console.log('(Lexical sweep — see the header for what it cannot see. Not a proof of schema correctness.)');
  process.exit(0);
}

console.log(`\n${found} object(s) with no DDL in this repo.`);
console.log('Each one needs a migration authored for it, or the read removed.');
console.log('supabase/checks/migration_status.sql (Part 2) tracks the known set against a live database.');
process.exit(1);
