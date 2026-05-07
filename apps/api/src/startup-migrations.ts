// All schema changes are now managed via formal Supabase migrations in /supabase/migrations/.
// Run: npx supabase db push  (or apply in Supabase Studio)
//
// Migrated:
//   0024_build_runs.sql          — build_runs table
//   0025_user_admin_columns.sql  — is_admin, is_suspended on users
//   0026_incidents.sql           — incidents table
//   0027_project_preview_url.sql — preview_url, last_deployed_at on projects

export async function runStartupMigrations(): Promise<void> {
  // No-op: schema is managed by Supabase migration files.
}
