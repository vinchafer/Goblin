import { createClient } from '@supabase/supabase-js';

/**
 * Startup migrations that run automatically when the API starts.
 * These are idempotent and safe to run multiple times.
 * They ensure the database schema is up-to-date even if regular migrations haven't been applied.
 */
export async function runStartupMigrations() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Missing Supabase credentials, skipping startup migrations');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('Running startup migrations...');

    // Check if preview_url column exists in projects table
    const { data: columnCheck, error: checkError } = await supabase
      .from('projects')
      .select('preview_url')
      .limit(1);

    if (checkError && checkError.message.includes('column "preview_url" does not exist')) {
      console.log('Adding preview_url column to projects table...');
      
      // Use raw SQL to add the column
      const { error: alterError } = await supabase.rpc('exec_sql', {
        sql: `
          ALTER TABLE projects 
          ADD COLUMN IF NOT EXISTS preview_url TEXT,
          ADD COLUMN IF NOT EXISTS last_deployed_at TIMESTAMPTZ;
        `
      });

      if (alterError) {
        // Fallback to direct SQL if RPC is not available
        console.log('RPC exec_sql not available, trying direct connection...');
        // Note: In production, you'd use a direct PostgreSQL connection
        // For now, we'll just log and rely on regular migrations
        console.warn('Could not run migration via RPC:', alterError.message);
      } else {
        console.log('Successfully added preview_url and last_deployed_at columns');
      }
    } else if (!checkError) {
      console.log('preview_url column already exists');
    }

    // Add more startup migrations here as needed
    // Each should be idempotent and check if the change is needed first

    console.log('Startup migrations completed');
  } catch (error) {
    console.error('Error running startup migrations:', error);
    // Don't throw - startup migrations are optional safety net
  }
}

// Alternative: Use a simpler approach with a direct check
export async function checkAndMigrate() {
  // This is a simpler version that just logs if migrations might be needed
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Try to select from projects with preview_url
    const { error } = await supabase
      .from('projects')
      .select('preview_url')
      .limit(1);

    if (error && error.message.includes('column "preview_url" does not exist')) {
      console.warn('⚠️  Database migration needed: preview_url column missing from projects table');
      console.warn('⚠️  Please run migration 0016_preview_url.sql or redeploy to apply migrations');
    }
  } catch (error) {
    // Ignore errors
  }
}