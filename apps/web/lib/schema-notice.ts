/**
 * FOUNDER-WALK-5 · U2 — the pending-migration notice, said correctly.
 *
 * ── The two false statements this replaces ───────────────────────────────────
 *
 * `/admin/insight` rendered one hard-coded sentence for every schema gap:
 *
 *     Die Tabelle `{table}` fehlt in der Datenbank.
 *     Spiel Migration `{migration}` im Supabase-SQL-Editor ein …
 *
 * On the founder's device that came out as "Die Tabelle `users` fehlt" with the migration
 * named as `(users.deleted_at — added out of band, no migration in repo)`. Both halves were
 * wrong, in different ways:
 *
 *   ① WRONG CAUSE. The `users` table was not missing — `/admin/users` and the whole app read
 *      it constantly. One COLUMN (`deleted_at`) was absent. Sending the founder to look for
 *      a missing table sends him to look for something that is not wrong.
 *   ② A PLACEHOLDER IN A USER-FACING SLOT. That parenthetical was an engineering note about
 *      the repo's own history, rendered verbatim where a filename belongs. It is not
 *      something anyone can open, paste or apply. A notice whose action is unactionable is
 *      worse than no notice: it looks like an instruction.
 *
 * So the shape is fixed rather than the string: the API now says WHAT is missing (table vs.
 * named column) and names a real file, and this module renders each case in its own words.
 *
 * Kept as a pure function, outside the page, so both languages and both cases are unit-
 * testable — the class of defect here is wording, and wording is exactly what a rendered
 * React page does not let you assert cheaply.
 */

export type MissingObject =
  | { kind: 'table'; table: string }
  | { kind: 'column'; table: string; column: string };

export interface SchemaNoticeCopy {
  /** The bold lead line. */
  title: string;
  /** What is missing, in prose — the sentence that used to name the wrong object. */
  cause: string;
  /** What to do about it, naming the migration file. */
  action: string;
  /** Why no numbers are shown. An empty chart must never read as "nobody is there". */
  why: string;
}

/** The dotted identifier the notice shows in a code span: `users` or `users.deleted_at`. */
export function missingIdentifier(missing: MissingObject): string {
  return missing.kind === 'column' ? `${missing.table}.${missing.column}` : missing.table;
}

/**
 * Is this a filename we can honestly tell someone to open?
 *
 * The guard against ② coming back in another form. Anything that is not a plain
 * `NNNN_name.sql` — a placeholder, a prose note, an empty string — must not be printed as
 * "apply migration X"; the notice degrades to naming the object and pointing at the folder,
 * which is still actionable and, unlike the placeholder, true.
 */
export function isRealMigrationFile(migration: string | null | undefined): boolean {
  return !!migration && /^\d{4}_[a-z0-9_]+\.sql$/i.test(migration.trim());
}

export function schemaNoticeCopy(
  missing: MissingObject,
  migration: string,
  lang: 'de' | 'en',
): SchemaNoticeCopy {
  const en = lang === 'en';
  const ident = missingIdentifier(missing);
  const real = isRealMigrationFile(migration);

  const cause = missing.kind === 'column'
    // The correction: the table is explicitly said to EXIST, so nobody goes looking for it.
    ? (en
        ? `The table \`${missing.table}\` is there — the column \`${missing.column}\` is not. This view reads it.`
        : `Die Tabelle \`${missing.table}\` ist da — die Spalte \`${missing.column}\` fehlt. Diese Ansicht liest sie.`)
    : (en
        ? `The table \`${missing.table}\` is not in the database. This view reads it.`
        : `Die Tabelle \`${missing.table}\` ist nicht in der Datenbank. Diese Ansicht liest sie.`);

  const action = real
    ? (en
        ? `Apply \`supabase/migrations/${migration}\` in the Supabase SQL editor, then this page loads.`
        : `Spiel \`supabase/migrations/${migration}\` im Supabase-SQL-Editor ein, dann lädt diese Seite.`)
    // No file to name: say so plainly instead of printing a placeholder as if it were one.
    : (en
        ? `No migration in this repo creates \`${ident}\` yet — it has to be authored in supabase/migrations/ before it can be applied.`
        : `Keine Migration in diesem Repo legt \`${ident}\` an — sie muss erst in supabase/migrations/ geschrieben werden, bevor sie eingespielt werden kann.`);

  return {
    title: en
      ? 'This view needs a migration that has not been applied yet.'
      : 'Diese Ansicht braucht eine Migration, die noch nicht eingespielt ist.',
    cause,
    action,
    why: en
      ? 'Until then I show no numbers — an empty curve would not mean "nobody is here", it would mean "I cannot look".'
      : 'Solange zeige ich keine Zahlen — eine leere Kurve wäre nicht „niemand da“, sondern „ich kann nicht nachsehen“.',
  };
}
