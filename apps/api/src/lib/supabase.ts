import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { IS_DEV_MODE, TEST_USER_EMAIL } from './env.js';
import { wrapWithDevGuard } from './supabase-guard.js';

let _supabaseRaw: SupabaseClient | null = null;
let _supabaseGuarded: SupabaseClient | null = null;
let _testUserId: string | null = null;
const _ownerCache = new Map<string, boolean>();

/**
 * Resolve whether a project-scoped row (filtered by id/project_id) belongs to the test user.
 * Used by the dev-guard to permit deploy/build UPDATEs that filter by project id rather than
 * user_id. Cached per (table,column,value) for the process lifetime (dev only). Fails closed.
 */
async function resolveOwnerIsTestUser(table: string, idColumn: string, idValue: string): Promise<boolean> {
  const tid = _testUserId;
  if (!tid) return false;
  const cacheKey = `${table}:${idColumn}:${idValue}`;
  if (_ownerCache.has(cacheKey)) return _ownerCache.get(cacheKey)!;
  let result = false;
  try {
    const raw = getSupabaseAdminRaw();
    const targetTable = idColumn === 'project_id' ? 'projects' : table;
    const { data } = await raw.from(targetTable).select('user_id').eq('id', idValue).single();
    result = !!data && (data as { user_id?: string }).user_id === tid;
  } catch {
    result = false; // fail closed
  }
  _ownerCache.set(cacheKey, result);
  return result;
}

function createRawClient(): SupabaseClient {
  return createClient(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

/**
 * Raw, UNGUARDED admin client. Internal use only (e.g. resolving the test user id, prod paths
 * where the guard is off anyway). Application code should use getSupabaseAdmin().
 */
export function getSupabaseAdminRaw(): SupabaseClient {
  if (!_supabaseRaw) _supabaseRaw = createRawClient();
  return _supabaseRaw;
}

/**
 * Admin client. In prod (GOBLIN_DEV_MODE!=='true') this is the raw service-role client.
 * In dev it is wrapped by the dev-safety shield, which blocks writes to anything other than
 * the test user's data. Same signature as before — every existing caller is guarded in dev
 * with zero call-site changes (chosen over codemod find/replace: a single chokepoint cannot
 * miss a call site).
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!IS_DEV_MODE) return getSupabaseAdminRaw();
  if (!_supabaseGuarded) {
    _supabaseGuarded = wrapWithDevGuard(getSupabaseAdminRaw(), {
      isDevMode: true,
      testUserId: () => _testUserId,
      testUserEmail: TEST_USER_EMAIL,
      resolveOwnerIsTestUser,
    });
  }
  return _supabaseGuarded;
}

/**
 * Resolve and cache the test user's UUID so the shield can allow writes scoped by user_id.
 * Best-effort: if resolution fails, the guard still blocks by email and fails closed.
 * No-op outside dev mode. Call once at startup.
 */
export async function resolveTestUserId(): Promise<string | null> {
  if (!IS_DEV_MODE || !TEST_USER_EMAIL) return null;
  if (_testUserId) return _testUserId;
  try {
    const raw = getSupabaseAdminRaw();
    const { data, error } = await raw.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (!error && data?.users) {
      const match = data.users.find(
        (u) => u.email?.toLowerCase() === TEST_USER_EMAIL!.toLowerCase(),
      );
      if (match) _testUserId = match.id;
    }
  } catch {
    /* fail closed — guard blocks by email + missing id */
  }
  return _testUserId;
}
