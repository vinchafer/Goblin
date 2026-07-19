// LAUNCH-ASSIST U2: resolve the comp expiry (users.comped_until) for entitlement
// derivation, PRE-MIGRATION TOLERANT.
//
// comped_until is authored in migration 0098 but the founder applies it later. If we
// simply added `comped_until` to the entitlement SELECTs (trial-gate, model-router,
// billing/status), a pre-0098 DB would ERROR on the missing column and — for the
// paywall gate — fail OPEN for every user. So instead we read it in a SEPARATE
// best-effort query, and ONLY when the row is already is_comped (rare). The 99%
// non-comped path never issues the extra query and is byte-identical to before.
//
// Pre-migration (column absent): the read errors → comped_until stays null →
// derivePlanTruth treats the comp as PERMANENT — which is exactly today's behavior,
// and the only comps that exist before 0098 ARE permanent founder comps. Post-migration:
// the real expiry governs, so a promo comp degrades honestly to the free tier on read.
// This mirrors the F-32 last_confirmed_plan pattern already used in billing/status.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlanTruthRow } from './plan-truth';

/**
 * Return `row` augmented with `comped_until` when it is is_comped and the value wasn't
 * already selected. A no-op (returns the same row) for non-comped rows, null rows, or
 * rows that already carry comped_until.
 */
export async function withCompExpiry<T extends PlanTruthRow>(
  supabase: SupabaseClient,
  userId: string,
  row: T | null | undefined,
): Promise<T | null | undefined> {
  if (!row || !row.is_comped || row.comped_until !== undefined) return row;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('comped_until')
      .eq('id', userId)
      .single();
    // error (pre-migration: column absent) → leave as permanent-comp semantics.
    if (error) return { ...row, comped_until: null };
    return { ...row, comped_until: (data as { comped_until?: string | null } | null)?.comped_until ?? null };
  } catch {
    return { ...row, comped_until: null };
  }
}
