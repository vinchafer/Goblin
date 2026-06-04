// Sprint 10.9-2 — Daily Per-User Provider-Discovery Refresh (OPTION B).
//
// For each active LLM BYOK key, re-ask the provider's own /models what the key
// unlocks, refresh byok_keys.discovered_models + last_validated_at, and record
// the validation outcome. Non-destructive: a key that now fails validation is
// MARKED (last_validation_result='invalid') and surfaced in Settings — never
// deleted. Gentle: keys are staggered; a provider that rate-limits is backed off
// for the rest of the cycle (its keys are NOT marked invalid on a 429).
//
// Source-of-truth note: this is the routing catalog refresh. discovered_models is
// stored VERBATIM as the provider returned it (hard slug rule). No proxy, no
// canonicalization.

import { getSupabaseAdmin } from '../lib/supabase';
import { decryptApiKey } from '../lib/byok-encryption';
import { discoverModelsDetailed } from './provider-discovery';
import type { ByokProvider } from '@goblin/shared/src/schemas';

interface KeyRow {
  id: string;
  user_id: string;
  provider: ByokProvider;
  base_url: string | null;
  discovered_models: string[] | null;
  key_encrypted: string;
  encryption_version: number | null;
  vault_secret_id: string | null;
}

interface ProviderTally {
  checked: number;
  added: number;
  removed: number;
  invalid: number;
  rateLimited: number;
}

export interface RefreshSummary {
  keysChecked: number;
  keysValidated: number;
  keysInvalid: number;
  keysRateLimited: number;
  modelsAdded: number;
  modelsRemoved: number;
  perProvider: Record<string, ProviderTally>;
  startedAt: string;
  finishedAt: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function tally(map: Record<string, ProviderTally>, provider: string): ProviderTally {
  return (map[provider] ??= { checked: 0, added: 0, removed: 0, invalid: 0, rateLimited: 0 });
}

function diffCounts(prev: string[], next: string[]): { added: number; removed: number } {
  const a = new Set(prev);
  const b = new Set(next);
  let added = 0;
  let removed = 0;
  for (const x of b) if (!a.has(x)) added++;
  for (const x of a) if (!b.has(x)) removed++;
  return { added, removed };
}

/**
 * Re-validate every active LLM key and refresh its discovered model list.
 * `source` is recorded in catalog_sync_log ('cron' | 'manual').
 */
export async function refreshAllUserDiscovery(
  opts: { staggerMs?: number; source?: string } = {},
): Promise<RefreshSummary> {
  const stagger = opts.staggerMs ?? 150;
  const source = opts.source ?? 'cron';
  const supabase = getSupabaseAdmin();
  const startedAt = new Date().toISOString();

  const summary: RefreshSummary = {
    keysChecked: 0,
    keysValidated: 0,
    keysInvalid: 0,
    keysRateLimited: 0,
    modelsAdded: 0,
    modelsRemoved: 0,
    perProvider: {},
    startedAt,
    finishedAt: startedAt,
  };

  const { data: rows } = await supabase
    .from('byok_keys')
    .select('id, user_id, provider, base_url, discovered_models, key_encrypted, encryption_version, vault_secret_id')
    .eq('status', 'active')
    .neq('provider', 'vercel');
  const keys = (rows ?? []) as KeyRow[];

  if (keys.length === 0) {
    summary.finishedAt = new Date().toISOString();
    await writeSyncLog(summary, source);
    return summary;
  }

  // Batch-fetch per-user salts (needed by the v1 legacy decrypt path).
  const userIds = [...new Set(keys.map((k) => k.user_id))];
  const saltMap = new Map<string, string | null>();
  const { data: users } = await supabase.from('users').select('id, encryption_salt').in('id', userIds);
  for (const u of (users ?? []) as Array<{ id: string; encryption_salt: string | null }>) {
    saltMap.set(u.id, u.encryption_salt);
  }

  // A provider that rate-limits gets backed off for the rest of the cycle.
  const backedOff = new Set<string>();

  for (const k of keys) {
    const pt = tally(summary.perProvider, k.provider);
    if (backedOff.has(k.provider)) continue;

    summary.keysChecked++;
    pt.checked++;

    let plaintext: string;
    try {
      const res = await decryptApiKey(
        k.user_id,
        k.id,
        {
          ciphertextB64: k.key_encrypted,
          version: k.encryption_version ?? 1,
          vaultSecretId: k.vault_secret_id,
          userSaltB64: saltMap.get(k.user_id) ?? null,
        },
        { provider: k.provider },
      );
      plaintext = res.plaintext;
    } catch {
      // Can't decrypt — the key needs re-entry; leave it for the user-facing
      // re-entry flow. Don't count as invalid (not a provider verdict).
      continue;
    }

    const result = await discoverModelsDetailed(k.provider, plaintext, k.base_url ?? undefined);

    if (result.status === 'rate_limited') {
      summary.keysRateLimited++;
      pt.rateLimited++;
      backedOff.add(k.provider);
      await updateKeyValidation(supabase, k.id, 'rate_limited', null);
      continue;
    }

    if (result.status === 'invalid') {
      summary.keysInvalid++;
      pt.invalid++;
      // Mark, do NOT delete. Surfaced in Settings.
      await updateKeyValidation(supabase, k.id, 'invalid', null);
      await sleep(stagger);
      continue;
    }

    if (result.status === 'error') {
      // Transient/unknown — don't penalise the key, don't update models.
      await updateKeyValidation(supabase, k.id, 'error', null);
      await sleep(stagger);
      continue;
    }

    // status === 'ok'
    summary.keysValidated++;
    const prev = Array.isArray(k.discovered_models) ? k.discovered_models : [];
    const { added, removed } = diffCounts(prev, result.models);
    summary.modelsAdded += added;
    summary.modelsRemoved += removed;
    pt.added += added;
    pt.removed += removed;
    await updateKeyValidation(supabase, k.id, 'valid', result.models);

    await sleep(stagger);
  }

  summary.finishedAt = new Date().toISOString();
  await writeSyncLog(summary, source);
  return summary;
}

async function updateKeyValidation(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  keyId: string,
  result: 'valid' | 'invalid' | 'rate_limited' | 'error',
  models: string[] | null,
): Promise<void> {
  const patch: Record<string, unknown> = {
    last_validated_at: new Date().toISOString(),
    last_validation_result: result,
  };
  if (models) patch.discovered_models = models;
  try {
    await supabase.from('byok_keys').update(patch).eq('id', keyId);
  } catch {
    // last_validation_result column may not exist yet (0062 unapplied) — retry
    // with just the always-present fields so discovery still refreshes.
    try {
      const fallback: Record<string, unknown> = { last_validated_at: patch.last_validated_at };
      if (models) fallback.discovered_models = models;
      await supabase.from('byok_keys').update(fallback).eq('id', keyId);
    } catch { /* non-fatal */ }
  }
}

async function writeSyncLog(summary: RefreshSummary, source: string): Promise<void> {
  try {
    await getSupabaseAdmin().from('catalog_sync_log').insert({
      source: source === 'manual' ? 'manual' : 'provider-discovery',
      added: summary.modelsAdded,
      updated: summary.keysValidated,
      deactivated: summary.keysInvalid,
      details: summary,
    });
  } catch {
    // catalog_sync_log may not exist yet (0062 unapplied) — non-fatal.
  }
}
