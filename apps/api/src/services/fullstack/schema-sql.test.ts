// WAVE-B B1 — the RLS-always invariant is a DETERMINISTIC property of the generator, proven
// here (not hoped about model output). If any change ever lets a table through without RLS +
// four owner policies, these tests go red.

import { describe, it, expect } from 'vitest';
import { generateSchemaSQL, auditRlsCoverage } from './schema-sql';
import { ProvisionError, type TableSpec } from './types';

const tasks: TableSpec = {
  name: 'tasks',
  columns: [
    { name: 'title', type: 'text', notNull: true },
    { name: 'done', type: 'boolean', default: 'false' },
  ],
};

describe('generateSchemaSQL — RLS is ALWAYS generated', () => {
  it('enables RLS + all four owner policies on every table', () => {
    const sql = generateSchemaSQL([tasks]);
    expect(sql).toContain('alter table public."tasks" enable row level security;');
    expect(sql).toContain('"tasks_select_own"');
    expect(sql).toContain('"tasks_insert_own"');
    expect(sql).toContain('"tasks_update_own"');
    expect(sql).toContain('"tasks_delete_own"');
    // Policies key on the owner column.
    expect(sql).toContain('auth.uid() = user_id');
    // auditRlsCoverage confirms full coverage → no gaps.
    expect(auditRlsCoverage([tasks], sql)).toEqual([]);
  });

  it('auto-adds id / user_id / created_at and forbids redefining them', () => {
    const sql = generateSchemaSQL([tasks]);
    expect(sql).toContain('id uuid primary key default gen_random_uuid()');
    expect(sql).toContain('user_id uuid not null references auth.users(id) on delete cascade');
    expect(sql).toContain('created_at timestamptz not null default now()');
    expect(() =>
      generateSchemaSQL([{ name: 'x', columns: [{ name: 'user_id', type: 'uuid' }] }]),
    ).toThrow(ProvisionError);
  });

  it('rejects unsafe identifiers instead of emitting unsafe DDL', () => {
    expect(() => generateSchemaSQL([{ name: 'tasks; drop table users;--', columns: [{ name: 'a', type: 'text' }] }])).toThrow(
      ProvisionError,
    );
    expect(() => generateSchemaSQL([{ name: 'ok', columns: [{ name: 'A Bad Col', type: 'text' }] }])).toThrow(ProvisionError);
  });

  it('is idempotent-shaped (drops policies before creating them)', () => {
    const sql = generateSchemaSQL([tasks]);
    expect(sql).toContain('drop policy if exists "tasks_select_own"');
    expect(sql).toContain('create table if not exists public."tasks"');
  });

  it('throws on empty / oversized schemas', () => {
    expect(() => generateSchemaSQL([])).toThrow(ProvisionError);
    const many = Array.from({ length: 21 }, (_, i) => ({ name: `t${i}`, columns: [{ name: 'a', type: 'text' as const }] }));
    expect(() => generateSchemaSQL(many)).toThrow(ProvisionError);
  });
});

describe('auditRlsCoverage — catches a table missing isolation', () => {
  it('reports missing RLS + missing policies', () => {
    const missing = auditRlsCoverage([tasks], 'create table public."tasks" ();');
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.some((m) => m.includes('RLS not enabled'))).toBe(true);
  });
});
