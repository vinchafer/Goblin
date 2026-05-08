// All schema changes are now managed via formal Supabase migrations in /supabase/migrations/.
// Run: npx supabase db push  (or apply in Supabase Studio)
//
// Migrated:
//   0024_build_runs.sql          — build_runs table
//   0025_user_admin_columns.sql  — is_admin, is_suspended on users
//   0026_incidents.sql           — incidents table
//   0027_project_preview_url.sql — preview_url, last_deployed_at on projects

import { createClient } from '@supabase/supabase-js';

const EXPECTED_USER_COLUMNS = ['id', 'email', 'is_admin', 'is_suspended', 'plan', 'created_at'];

export async function runStartupMigrations(): Promise<void> {
  // Validate critical schema — log warnings but never crash the API
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    const supabase = createClient(url, key);

    // Check users table has expected columns by selecting one row
    const { data, error } = await supabase.from('users').select(EXPECTED_USER_COLUMNS.join(',')).limit(1);
    if (error) {
      const missing = EXPECTED_USER_COLUMNS.filter(c => error.message?.includes(c));
      if (missing.length > 0) {
        console.error('[SCHEMA] Missing columns in users table:', missing.join(', '));
        console.error('[SCHEMA] Run: npx supabase db push to apply pending migrations');
      } else {
        console.warn('[SCHEMA] users table check failed:', error.message);
      }
    } else {
      console.log('[SCHEMA] users table OK');
      void data; // suppress unused warning
    }

    // Check projects table
    const { error: projErr } = await supabase.from('projects').select('id,name,preview_url').limit(1);
    if (projErr && projErr.message?.includes('preview_url')) {
      console.error('[SCHEMA] projects.preview_url missing — run migration 0027_project_preview_url.sql');
    }
  } catch (err) {
    console.error('[SCHEMA] Startup schema check failed:', err);
  }
}
