/**
 * FOUNDER-WALK-5 · U2 — the migration notice told the founder two untrue things.
 *
 * On his device, `/admin/insight` said:
 *
 *   "Die Tabelle `users` fehlt in der Datenbank. Spiel Migration
 *    `(users.deleted_at — added out of band, no migration in repo)` im Supabase-SQL-Editor
 *    ein …"
 *
 *   ① The `users` table was NOT missing — the whole app reads it. One column was.
 *   ② The migration was a parenthetical engineering note printed where a filename belongs.
 *
 * These tests pin both corrections, in both languages.
 */
import { describe, it, expect } from 'vitest';
import { schemaNoticeCopy, isRealMigrationFile, missingIdentifier, type MissingObject } from './schema-notice';

const LANGS = ['de', 'en'] as const;
const MISSING_COLUMN: MissingObject = { kind: 'column', table: 'users', column: 'deleted_at' };
const MISSING_TABLE: MissingObject = { kind: 'table', table: 'platform_events' };

describe('① the cause is the real one', () => {
  it('a missing COLUMN never claims the table is missing — it says the table is there', () => {
    for (const lang of LANGS) {
      const { cause } = schemaNoticeCopy(MISSING_COLUMN, '0101_users_deleted_at.sql', lang);
      expect(cause).toContain('deleted_at');
      // The founder's exact false sentence, in both languages, must be impossible.
      expect(cause).not.toMatch(/Die Tabelle `users` fehlt|table `users` is not in the database/i);
      // And it says so positively, so nobody goes hunting for a table that exists.
      expect(cause).toMatch(/ist da|is there/i);
    }
  });

  it('a genuinely missing TABLE still says so', () => {
    for (const lang of LANGS) {
      const { cause } = schemaNoticeCopy(MISSING_TABLE, '0078_platform_events.sql', lang);
      expect(cause).toContain('platform_events');
      expect(cause).toMatch(/nicht in der Datenbank|is not in the database/i);
    }
  });

  it('shows the dotted identifier for a column, the bare name for a table', () => {
    expect(missingIdentifier(MISSING_COLUMN)).toBe('users.deleted_at');
    expect(missingIdentifier(MISSING_TABLE)).toBe('platform_events');
  });
});

describe('② no placeholder ever reaches the user', () => {
  it('recognises a real migration filename', () => {
    expect(isRealMigrationFile('0101_users_deleted_at.sql')).toBe(true);
    expect(isRealMigrationFile('0078_platform_events.sql')).toBe(true);
  });

  it('rejects the exact placeholder the founder was shown, and its family', () => {
    for (const bad of [
      '(users.deleted_at — added out of band, no migration in repo)',
      '0078 + 0085',
      'TODO',
      '',
      null,
      undefined,
    ]) {
      expect(isRealMigrationFile(bad)).toBe(false);
    }
  });

  it('an unnameable migration is admitted, not printed as if it were a file', () => {
    for (const lang of LANGS) {
      const { action } = schemaNoticeCopy(
        MISSING_COLUMN,
        '(users.deleted_at — added out of band, no migration in repo)',
        lang,
      );
      // The placeholder must not survive into the instruction…
      expect(action).not.toContain('out of band');
      expect(action).not.toMatch(/Spiel `\(|Apply `\(/);
      // …and what replaces it is still actionable and true.
      expect(action).toMatch(/supabase\/migrations/);
      expect(action).toMatch(/Keine Migration|No migration/i);
    }
  });

  it('a real file is named with its path so it can simply be opened', () => {
    expect(schemaNoticeCopy(MISSING_COLUMN, '0101_users_deleted_at.sql', 'de').action)
      .toContain('supabase/migrations/0101_users_deleted_at.sql');
    expect(schemaNoticeCopy(MISSING_COLUMN, '0101_users_deleted_at.sql', 'en').action)
      .toContain('supabase/migrations/0101_users_deleted_at.sql');
  });
});

describe('the notice is complete and bilingual', () => {
  it('every part exists in both languages, and they differ', () => {
    const de = schemaNoticeCopy(MISSING_COLUMN, '0101_users_deleted_at.sql', 'de');
    const en = schemaNoticeCopy(MISSING_COLUMN, '0101_users_deleted_at.sql', 'en');
    for (const key of ['title', 'cause', 'action', 'why'] as const) {
      expect(de[key]).toBeTruthy();
      expect(en[key]).toBeTruthy();
      expect(de[key]).not.toBe(en[key]);
    }
  });

  it('still refuses to let an empty chart read as "nobody is here"', () => {
    for (const lang of LANGS) {
      expect(schemaNoticeCopy(MISSING_COLUMN, '0101_users_deleted_at.sql', lang).why)
        .toMatch(/niemand da|nobody is here/i);
    }
  });
});
