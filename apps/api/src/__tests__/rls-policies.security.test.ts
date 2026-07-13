// F-26 (FIX-WAVE 2) GATE — RLS ownership policies (deterministic, secretless).
//
// The cross-account guarantee for the four resources the founder cares about
// (project · file · chat · deployment) rests on Postgres RLS: even if the anon
// client is handed another account's row id, the row is invisible/again-denied
// because every policy is keyed on auth.uid(). This test parses the committed
// migration SQL and asserts, per table: RLS is ENABLED and at least one policy
// ties access to auth.uid() (directly or via the owning project). It runs in CI
// with no DB and no secrets; the live JWT probe (rls-cross-account.mjs) is the
// prod complement.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIG = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../../../supabase/migrations/${name}`, import.meta.url)), 'utf8');

interface TableExpectation {
  resource: string;
  table: string;
  migration: string;
  /** A regex proving a policy ties the table to the authenticated user. */
  ownershipProof: RegExp;
}

const EXPECTATIONS: TableExpectation[] = [
  {
    resource: 'project',
    table: 'projects',
    migration: '0001_initial_schema.sql',
    ownershipProof: /create policy[^;]*on projects[\s\S]*?auth\.uid\(\)\s*=\s*user_id/i,
  },
  {
    resource: 'chat',
    table: 'chat_messages',
    migration: '0001_initial_schema.sql',
    // chat rows are owned transitively via their project.
    ownershipProof: /create policy[^;]*on chat_messages[\s\S]*?projects\.user_id\s*=\s*auth\.uid\(\)/i,
  },
  {
    resource: 'deployment',
    table: 'deployments',
    migration: '0056_deployments.sql',
    ownershipProof: /create policy[^;]*on public\.deployments[\s\S]*?auth\.uid\(\)\s*=\s*user_id/i,
  },
  {
    resource: 'file',
    table: 'project_file_meta',
    migration: '0066_project_file_meta.sql',
    ownershipProof: /create policy[^;]*on public\.project_file_meta[\s\S]*?auth\.uid\(\)\s*=\s*user_id/i,
  },
];

describe('RLS ownership policies (F-26 cross-account defense)', () => {
  for (const exp of EXPECTATIONS) {
    describe(`${exp.resource} → ${exp.table}`, () => {
      const sql = MIG(exp.migration).toLowerCase();

      it('has ROW LEVEL SECURITY enabled', () => {
        const enabled = new RegExp(
          `alter table\\s+(public\\.)?${exp.table}\\s+enable row level security`,
          'i',
        ).test(MIG(exp.migration));
        expect(enabled, `${exp.table} must ENABLE ROW LEVEL SECURITY`).toBe(true);
      });

      it('has an ownership policy keyed on auth.uid()', () => {
        expect(
          exp.ownershipProof.test(MIG(exp.migration)),
          `${exp.table} must have a policy tying access to auth.uid()`,
        ).toBe(true);
      });

      it('does not weaken access with a USING (true) blanket policy', () => {
        // A policy body of `using (true)` would expose every row to any caller.
        expect(sql).not.toMatch(new RegExp(`on\\s+(public\\.)?${exp.table}[\\s\\S]*?using\\s*\\(\\s*true\\s*\\)`, 'i'));
      });
    });
  }
});
