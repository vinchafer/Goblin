# Goblin Setup & Deployment Guide

## Database Migrations

### Migration 0016: Add Preview URL Support

The migration `0016_preview_url.sql` adds two columns to the `projects` table to support preview URLs and deployment tracking:

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS preview_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_deployed_at TIMESTAMPTZ;
```

#### How to Apply the Migration

**Option 1: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the SQL from `supabase/migrations/0016_preview_url.sql`
4. Click **Run**

**Option 2: Using Supabase CLI**
```bash
# Apply all pending migrations
supabase db push

# Or apply specific migration
supabase migration up 0016_preview_url.sql
```

**Option 3: Direct SQL Execution**
```bash
# Connect to your database and run:
psql "postgresql://[YOUR_CONNECTION_STRING]"
\i supabase/migrations/0016_preview_url.sql
```

#### Verification
After applying the migration, verify the columns exist:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' 
AND column_name IN ('preview_url', 'last_deployed_at');
```

### What These Columns Do

- **preview_url**: Stores the live preview URL after deploying to Vercel/Netlify
- **last_deployed_at**: Timestamp of the last successful deployment

These columns are automatically populated when:
1. A project is pushed to GitHub
2. Vercel/Netlify deployment completes
3. The webhook returns the live URL

### Troubleshooting

If the migration fails:
1. Check if columns already exist (they may have been added manually)
2. Ensure you have proper permissions on the `projects` table
3. Verify your database connection

### Rollback
If needed, you can rollback the migration:
```sql
ALTER TABLE projects DROP COLUMN IF EXISTS preview_url;
ALTER TABLE projects DROP COLUMN IF EXISTS last_deployed_at;
```

## Environment Variables

Make sure your `.env` file includes:
```
# Vercel/Netlify webhook URLs (for preview URL updates)
NEXT_PUBLIC_VERCEL_WEBHOOK_URL=
NEXT_PUBLIC_NETLIFY_WEBHOOK_URL=
```

## Testing the Feature

1. Create a new project
2. Generate some code
3. Push to GitHub
4. Connect Vercel/Netlify
5. Check that the preview URL appears in the project workspace