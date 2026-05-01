import { getSupabaseAdmin } from './lib/supabase';

export async function runStartupMigrations() {
  const supabase = getSupabaseAdmin();

  try {
    console.log('Running startup migrations...');

    // preview_url on projects
    const { data: columnCheck, error: checkError } = await supabase
      .from('projects')
      .select('preview_url')
      .limit(1);

    if (checkError && checkError.message.includes('column "preview_url" does not exist')) {
      console.log('Adding preview_url column to projects table...');
      const { error: alterError } = await supabase.rpc('exec_sql', {
        sql: `
          ALTER TABLE projects
          ADD COLUMN IF NOT EXISTS preview_url TEXT,
          ADD COLUMN IF NOT EXISTS last_deployed_at TIMESTAMPTZ;
        `
      });
      if (alterError) console.warn('Could not run migration via RPC:', alterError.message);
      else console.log('Successfully added preview_url and last_deployed_at columns');
    } else if (!checkError) {
      console.log('preview_url column already exists');
    }

    // build_runs table
    const { error: buildRunsCheck } = await supabase
      .from('build_runs')
      .select('id')
      .limit(1);

    if (buildRunsCheck && buildRunsCheck.message?.includes('does not exist')) {
      console.log('Creating build_runs table…');
      const { error: createErr } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS build_runs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL,
            user_id UUID NOT NULL,
            type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            progress_pct INTEGER NOT NULL DEFAULT 0,
            message TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            completed_at TIMESTAMPTZ
          );
          CREATE INDEX IF NOT EXISTS build_runs_project_id_idx ON build_runs (project_id);
          CREATE INDEX IF NOT EXISTS build_runs_user_id_idx ON build_runs (user_id);
        `,
      });
      if (createErr) console.warn('[migration] build_runs rpc failed:', createErr.message);
    }

    // is_admin column on users
    const { error: adminColCheck } = await supabase
      .from('users')
      .select('is_admin')
      .limit(1);

    if (adminColCheck && adminColCheck.message?.includes('column "is_admin" does not exist')) {
      console.log('Adding is_admin column to users table...');
      const { error } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;`
      });
      if (error) console.warn('[migration] is_admin column failed:', error.message);
      else console.log('Added is_admin column');
    }

    // is_suspended column on users
    const { error: suspendedColCheck } = await supabase
      .from('users')
      .select('is_suspended')
      .limit(1);

    if (suspendedColCheck && suspendedColCheck.message?.includes('column "is_suspended" does not exist')) {
      console.log('Adding is_suspended column to users table...');
      const { error } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;`
      });
      if (error) console.warn('[migration] is_suspended column failed:', error.message);
    }

    // incidents table
    const { error: incidentsCheck } = await supabase
      .from('incidents')
      .select('id')
      .limit(1);

    if (incidentsCheck && incidentsCheck.message?.includes('does not exist')) {
      console.log('Creating incidents table...');
      const { error } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS incidents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'investigating',
            severity TEXT NOT NULL DEFAULT 'minor',
            description TEXT,
            resolved_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS incidents_created_at_idx ON incidents (created_at DESC);
        `
      });
      if (error) console.warn('[migration] incidents table failed:', error.message);
      else console.log('Created incidents table');
    }

    console.log('Startup migrations completed');
  } catch (error) {
    console.error('Error running startup migrations:', error);
  }
}
