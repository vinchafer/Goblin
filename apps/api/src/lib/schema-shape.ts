/**
 * FOUNDER-WALK-4 · U2 — "is this failure the DB being older than the code?"
 *
 * Several migrations in this repo are authored but NOT auto-applied — the founder runs
 * them by hand in the Supabase SQL Editor (0078/0085 platform_events, 0086 support_tickets,
 * 0087 feedback, 0098 promo_codes, …). That is a deliberate choice, and it means "the table
 * is not there yet" is a NORMAL state the API must survive, not a crash.
 *
 * Most of the code already knows this: `insertPlatformEvent` silent-fails by contract,
 * `/api/admin/promo` answers `available: false`, `promo.ts` maps PGRST202 to a decline.
 * They each carried their own copy of the regex. One definition now, because the copies
 * had already drifted (the promo route's did not recognise a missing COLUMN, only a
 * missing table) and a surface that misclassifies this gap reports a config error for a
 * pending migration — which is what sends the founder to the wrong place.
 */

/**
 * Does this Postgres/PostgREST error mean "the schema is older than this code"?
 *
 * Deliberately covers columns as well as tables: a partially-applied migration leaves a
 * table present with a column missing, and that reads as `42703 column … does not exist`.
 * Both are the same actionable fact — apply the migration.
 */
export function isMissingSchema(message: string | null | undefined): boolean {
  if (!message) return false;
  return (
    /does not exist/i.test(message) ||
    /schema cache/i.test(message) ||
    /(find|found) the (table|column|function)/i.test(message) ||
    /\bPGRST(20[0-9]|116)\b/i.test(message) ||
    /\b(42P01|42703|42883)\b/.test(message) // undefined_table / undefined_column / undefined_function
  );
}
