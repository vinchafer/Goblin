/**
 * Sprint 9 Phase 1 — create the Max fresh-signup test account.
 *
 * Vincent authorized this prod write explicitly (Sprint 9 §6.1). Creates
 * vinc.hafner4@gmail.com with a confirmed email + password so the account is
 * immediately usable via the password login flow — no magic-link email needed.
 *
 * NO BYOK keys are attached (§6.2): Max must encounter onboarding as a real new
 * user would. Run: pnpm --filter @goblin/api exec tsx src/scripts/create-max-test-user.ts
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'node:path';

// load root .env.local (service role key lives there)
config({ path: resolve(process.cwd(), '../../.env.local') });
config({ path: resolve(process.cwd(), '.env.local') });

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const EMAIL = 'vinc.hafner4@gmail.com';
const PASSWORD = 'MaxBerlin#2026';

async function main() {
  const admin = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });

  // idempotent: if the user already exists, just report it
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email === EMAIL);
  if (existing) {
    console.log(`ALREADY EXISTS  id=${existing.id}  email=${EMAIL}  password=${PASSWORD}`);
    return;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Max', sprint9_test_persona: true },
  });
  if (error) {
    console.error('createUser failed:', error.message);
    process.exit(1);
  }
  console.log(`CREATED  id=${data.user?.id}  email=${EMAIL}  password=${PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
