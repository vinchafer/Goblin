// WAVE-B B1 — persistence for provisioned backends (supabase_backends). Pre-migration
// tolerant (feature-detect the table → honest degrade before 0096 is applied). The
// service_role key is SEALED with the user's Vault KEK (same envelope as byok_keys, R5);
// the anon key + project URL are public and stored plaintext (they ship in client code).
//
// This is where the trial cap is COUNTED (D-B2 = 2/trial): a total-count cap on a user's
// live backends, enforced before provisioning.

import { getSupabaseAdmin } from '../../lib/supabase';
import { encryptApiKeyV2 } from '../../lib/byok-encryption';
import logger from '../../lib/logger';
import type { ProvisionedBackend } from './types';

type Sb = ReturnType<typeof getSupabaseAdmin>;

/** A stored backend row as the teardown/cap paths need it (no secret material). */
export interface StoredBackend {
  id: string;
  projectId: string;
  supabaseProjectRef: string;
  projectUrl: string;
  region: string;
  anonKey: string | null;
  status: string;
}

/** True if migration 0096 has been applied (the table exists). Probed, never assumed. */
export async function backendsTableAvailable(sb: Sb = getSupabaseAdmin()): Promise<boolean> {
  const { error } = await sb.from('supabase_backends').select('id').limit(1);
  if (!error) return true;
  // 42P01 = undefined_table; PGRST205 = schema cache miss (table absent).
  const code = `${error.code ?? ''} ${error.message ?? ''}`;
  if (/42P01|PGRST205|does not exist|schema cache/i.test(code)) return false;
  // A different error (RLS/permission) still means the table exists.
  return true;
}

/** Count a user's live (provisioning|active) backends — the trial-cap basis. */
export async function countUserBackends(userId: string, sb: Sb = getSupabaseAdmin()): Promise<number> {
  const { count, error } = await sb
    .from('supabase_backends')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['provisioning', 'active']);
  if (error) {
    logger.warn({ reason: error.message }, 'fullstack: countUserBackends failed');
    return 0;
  }
  return count ?? 0;
}

/** Does this Goblin project already have a live backend? (Idempotency check.) */
export async function getProjectBackend(
  userId: string,
  projectId: string,
  sb: Sb = getSupabaseAdmin(),
): Promise<StoredBackend | null> {
  const { data } = await sb
    .from('supabase_backends')
    .select('id, project_id, supabase_project_ref, project_url, region, anon_key, status')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .in('status', ['provisioning', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    projectId: data.project_id as string,
    supabaseProjectRef: data.supabase_project_ref as string,
    projectUrl: data.project_url as string,
    region: data.region as string,
    anonKey: (data.anon_key as string | null) ?? null,
    status: data.status as string,
  };
}

/**
 * Persist a freshly provisioned backend. Seals the service_role key with the user's KEK
 * (best-effort v2; a KEK failure stores the row without the secret rather than losing the
 * whole record — the anon key still lets the app run, and teardown still works by ref).
 * Returns the new row id.
 */
export async function recordProvisionedBackend(
  userId: string,
  projectId: string,
  backend: ProvisionedBackend,
  sb: Sb = getSupabaseAdmin(),
): Promise<string> {
  let serviceRoleEncrypted: string | null = null;
  let vaultSecretId: string | null = null;
  let encryptionVersion = 2;
  try {
    const sealed = await encryptApiKeyV2(userId, backend.serviceRoleKey);
    serviceRoleEncrypted = sealed.ciphertextB64;
    vaultSecretId = sealed.vaultSecretId;
    encryptionVersion = sealed.version;
  } catch (e) {
    logger.warn({ reason: (e as Error).message }, 'fullstack: service_role seal failed (row stored without secret)');
  }

  const { data, error } = await sb
    .from('supabase_backends')
    .insert({
      user_id: userId,
      project_id: projectId,
      provider: 'supabase',
      supabase_project_ref: backend.projectRef,
      project_url: backend.projectUrl,
      region: backend.region,
      anon_key: backend.anonKey,
      service_role_encrypted: serviceRoleEncrypted,
      vault_secret_id: vaultSecretId,
      encryption_version: encryptionVersion,
      status: 'active',
      provision_latency_ms: backend.provisionLatencyMs,
    })
    .select('id')
    .single();
  if (error) throw new Error(`record backend failed: ${error.message}`);
  return data!.id as string;
}

/**
 * Record a backend that was CREATED at the provider but could not be finished (keys not
 * ready, schema failed). Stored as 'failed' — never a silent orphan (E-5) — so teardown
 * reaps it and the user sees an honest "not ready, retry". No secret material.
 */
export async function recordFailedBackend(
  userId: string,
  projectId: string,
  ref: string,
  sb: Sb = getSupabaseAdmin(),
): Promise<void> {
  try {
    await sb.from('supabase_backends').insert({
      user_id: userId,
      project_id: projectId,
      provider: 'supabase',
      supabase_project_ref: ref,
      project_url: `https://${ref}.supabase.co`,
      status: 'failed',
    });
  } catch (e) {
    logger.error({ ref, reason: (e as Error).message }, 'fullstack: could not record FAILED backend — possible orphan');
  }
}

/** Mark a backend row as active|failed|torn_down (honest state, never a silent half-state). */
export async function setBackendStatus(
  backendId: string,
  status: 'active' | 'failed' | 'torn_down',
  sb: Sb = getSupabaseAdmin(),
): Promise<void> {
  await sb.from('supabase_backends').update({ status }).eq('id', backendId);
}

/**
 * List a user's teardown-eligible backends (provisioning|active|failed) — for the FW6 purge.
 * Fully defensive: ANY failure (absent table pre-0096, RLS, a stubbed client) → [] so the
 * account-deletion cascade is never blocked by this lookup. Filters status in JS so it needs
 * only .select().eq() from the client (no .in()), keeping the pre-migration/no-op path robust.
 */
export async function listUserBackendsForTeardown(
  userId: string,
  sb: Sb = getSupabaseAdmin(),
): Promise<Array<{ id: string; ref: string }>> {
  try {
    const { data, error } = await sb
      .from('supabase_backends')
      .select('id, supabase_project_ref, status')
      .eq('user_id', userId);
    if (error || !data) return [];
    return (data as Array<{ id: string; supabase_project_ref: string; status: string }>)
      .filter((r) => ['provisioning', 'active', 'failed'].includes(r.status))
      .map((r) => ({ id: r.id, ref: r.supabase_project_ref }));
  } catch {
    // Absent table (pre-0096) or a stubbed client → nothing to tear down.
    return [];
  }
}
