import { getSupabaseAdmin } from './lib/supabase';

export async function runStartupMigrations() {
  const supabase = getSupabaseAdmin();

  try {
    console.log('Running startup migrations...');

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

      if (alterError) {
        console.warn('Could not run migration via RPC:', alterError.message);
      } else {
        console.log('Successfully added preview_url and last_deployed_at columns');
      }
    } else if (!checkError) {
      console.log('preview_url column already exists');
    }

    console.log('Startup migrations completed');
  } catch (error) {
    console.error('Error running startup migrations:', error);
  }
}
