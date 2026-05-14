/**
 * Phase Z2: Migrate all BYOK keys from static-salt to per-user-salt encryption.
 *
 * Usage:
 *   DRY_RUN=1 npx ts-node --esm scripts/migrate-encryption.ts
 *   npx ts-node --esm scripts/migrate-encryption.ts
 *
 * Safe to run multiple times (idempotent: skips users with encryption_migrated_at set).
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { encryptUserData, decryptData, generateUserSalt } from '../apps/api/src/services/encryption.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env') });

const DRY_RUN = process.env.DRY_RUN === '1';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  console.log(`[migrate-encryption] Starting${DRY_RUN ? ' (DRY RUN)' : ''}`);

  // Fetch all users with BYOK keys that haven't been migrated yet
  const { data: users, error } = await supabase
    .from('users')
    .select('id, encryption_salt, encryption_migrated_at')
    .is('encryption_migrated_at', null);

  if (error) {
    console.error('[migrate-encryption] Failed to fetch users:', error.message);
    process.exit(1);
  }

  console.log(`[migrate-encryption] Users to process: ${users?.length ?? 0}`);

  let migratedUsers = 0;
  let migratedKeys = 0;
  let skippedUsers = 0;
  let errors = 0;

  for (const user of users ?? []) {
    const { data: keys } = await supabase
      .from('byok_keys')
      .select('id, key_encrypted')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (!keys?.length) {
      skippedUsers++;
      continue;
    }

    // Get or generate user salt
    const userSalt = user.encryption_salt ?? generateUserSalt();

    let userHadError = false;
    for (const key of keys) {
      try {
        // Decrypt with legacy key
        const plaintext = decryptData(key.key_encrypted);

        // Re-encrypt with per-user key
        const newEncrypted = encryptUserData(plaintext, userSalt);

        if (!DRY_RUN) {
          // Save legacy value for rollback, then update with new encrypted value
          await supabase
            .from('byok_keys')
            .update({
              key_encrypted_legacy: key.key_encrypted,
              key_encrypted: newEncrypted,
            })
            .eq('id', key.id);
        }

        migratedKeys++;
        console.log(`  ✓ key ${key.id.slice(0, 8)}... re-encrypted`);
      } catch (err) {
        console.error(`  ✗ key ${key.id.slice(0, 8)}... failed:`, err instanceof Error ? err.message : err);
        userHadError = true;
        errors++;
      }
    }

    if (!userHadError && !DRY_RUN) {
      // Save new salt and mark migration complete
      await supabase
        .from('users')
        .update({
          encryption_salt: userSalt,
          encryption_migrated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      migratedUsers++;
      console.log(`[migrate-encryption] User ${user.id.slice(0, 8)}... done (${keys.length} keys)`);
    } else if (DRY_RUN) {
      migratedUsers++;
      console.log(`[migrate-encryption] User ${user.id.slice(0, 8)}... would migrate (${keys.length} keys) [DRY RUN]`);
    }
  }

  console.log('\n[migrate-encryption] Summary:');
  console.log(`  Users migrated: ${migratedUsers}`);
  console.log(`  Keys migrated:  ${migratedKeys}`);
  console.log(`  Users skipped (no keys): ${skippedUsers}`);
  console.log(`  Errors: ${errors}`);

  if (errors > 0) {
    console.error('\n[migrate-encryption] Completed with errors. Review above.');
    process.exit(1);
  }

  console.log('\n[migrate-encryption] Done.');
}

run().catch(err => {
  console.error('[migrate-encryption] Fatal:', err);
  process.exit(1);
});
