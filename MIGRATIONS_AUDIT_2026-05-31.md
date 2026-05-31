# Migrations Idempotency Audit (2026-05-31, Sprint 2 Phase 0)

Pre-flight for routing `pnpm dev` through the local API against PROD Supabase. Founder
condition: confirm every migration `runStartupMigrations()` executes is idempotent; if any
isn't, add a *targeted* dev-skip.

## Decisive finding: nothing fires at boot

`runStartupMigrations()` (`apps/api/src/startup-migrations.ts`) **does not run any migrations.**
It performs two **read-only** `SELECT`s:
- `users` — checks expected columns exist (`id,email,is_admin,is_suspended,plan,created_at`).
- `projects` — checks `preview_url` exists.
It logs warnings if columns are missing. No `CREATE` / `ALTER` / `INSERT` / `UPDATE` /
`DELETE` / `DROP`. Migrations are applied out-of-band via `npx supabase db push`.

`startCron()` (`apps/api/src/lib/cron.ts`) is a **no-op unless `ENABLE_CRON=true`** — not set in
`.env.local`. So no scheduled job (including the destructive `hardDeletePendingAccounts`) runs
in dev. Even when enabled it fires on UTC-time windows via `setInterval`, never immediately at
boot, and its writes route through the guarded admin client.

`resolveTestUserId()` (added in B3) runs at boot but only calls `auth.admin.listUsers` (read).

**→ Booting the local API against PROD performs only reads. Safe. No targeted skip needed.**

## Idempotency of the migration files (the `supabase db push` path)

Not in the boot path, but audited per the founder's request. `supabase db push` records applied
migrations in `supabase_migrations.schema_migrations` and runs each file **exactly once**, so
per-file non-idempotency is contained by the runner. Static scan of all 53 files (0001–0053):

| Pattern | Files | Verdict |
|---|---|---|
| `DELETE` / `TRUNCATE` | **none** | ✅ No destructive data ops anywhere |
| `DROP …` | all `IF EXISTS` (policies/constraints; the standard drop-then-recreate-policy idiom) | ✅ Idempotent |
| `CREATE TABLE` without `IF NOT EXISTS` | `0001_initial_schema`, `0007_oauth_states` | ⚠️ Not self-idempotent; contained by runner (runs once) |
| `ADD COLUMN` without `IF NOT EXISTS` | `0003_github` | ⚠️ Same — contained by runner |
| Bare `INSERT` (no `ON CONFLICT`) | `0001` (trigger/seed user), `0002` (storage bucket), `0043` (vault.secrets in DO block) | ⚠️ Contained by runner; would only double-insert if run by hand twice |
| `UPDATE` (data-transform) | `0005` (inside `CREATE OR REPLACE FUNCTION` — runtime, not migration data), `0033` (`plan='seed'→'build'` etc.), `0041` (model_sources flag) | ✅ Effect-idempotent: re-running matches no rows (0033) or sets the same value (0041) |

### Notable: `0033_plan_names.sql`
```sql
UPDATE users SET plan = 'build' WHERE plan = 'seed';
UPDATE users SET plan = 'pro'   WHERE plan = 'craft';
UPDATE users SET plan = 'power' WHERE plan = 'forge';
```
A one-time rename. After the first run no `seed/craft/forge` rows remain, so re-running is a
no-op. Idempotent in effect. Non-destructive (no data loss).

## Verdict

- **Boot path: SAFE (read-only).** Routing `pnpm dev` → local API will not fire any migration
  or destructive op against PROD.
- **`db push` path: SAFE.** No destructive ops; runner-level idempotency handles the
  non-self-idempotent DDL; the only data-transforms are effect-idempotent.
- **No targeted dev-skip added** — there is nothing to skip. Phase 1 proceeds.

## Mental trace — one PROD startup (dev)
`load-env` → env validated → B3 shield banner → `resolveTestUserId()` (1 read) →
`runStartupMigrations()` (2 reads, log only) → `startCron()` (disabled, no-op) → server listens.
Zero writes. No destructive migration fires. ✓
