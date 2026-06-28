// Per-plan storage figures — the user-facing mirror of the server's enforced
// caps (apps/api/src/lib/storage-cap.ts STORAGE_LIMIT_BYTES). The pricing /
// billing / upgrade copy DERIVES every "X GB" from here so the displayed number
// can never drift from what the API actually enforces — the same single-source
// discipline plan-builds.ts uses for the "≈ N Builds / month" figures.
//
// Founder-locked 2026-06-28: trial 2 · build 10 · pro 40 · power 100 (GB).
// 'none' = 0 (locked / read-only). Keep IN SYNC with storage-cap.ts.

export const STORAGE_GB: Record<'trial' | 'build' | 'pro' | 'power', number> = {
  trial: 2,
  build: 10,
  pro: 40,
  power: 100,
};

const GB = 1024 * 1024 * 1024;

/** Per-plan limit in bytes (mirror of the server STORAGE_LIMIT_BYTES). */
export function storageLimitBytes(plan: keyof typeof STORAGE_GB): number {
  return STORAGE_GB[plan] * GB;
}

/** "10 GB Speicher" / "10 GB storage" — the BillingPage feature line. */
export function storageLabel(plan: keyof typeof STORAGE_GB, lang: 'de' | 'en'): string {
  return lang === 'en' ? `${STORAGE_GB[plan]} GB storage` : `${STORAGE_GB[plan]} GB Speicher`;
}

/** "10 GB Cloud-Storage" / "10 GB cloud storage" — the pricing/upgrade feature line. */
export function storageLabelCloud(plan: keyof typeof STORAGE_GB, lang: 'de' | 'en'): string {
  return lang === 'en' ? `${STORAGE_GB[plan]} GB cloud storage` : `${STORAGE_GB[plan]} GB Cloud-Storage`;
}

/** Bare "10 GB" — for comparison-table cells. */
export function storageGbLabel(plan: keyof typeof STORAGE_GB): string {
  return `${STORAGE_GB[plan]} GB`;
}

/**
 * Format a raw byte total as a calm "X.X GB" (1 decimal, GB unit). Used by the
 * real-usage bar ("X.X / Y GB used"). Sub-0.1 GB still reads "0.0 GB" — fine for
 * a storage gauge (no false "MB" precision noise).
 */
export function formatGb(bytes: number): string {
  const gb = (Number.isFinite(bytes) && bytes > 0 ? bytes : 0) / GB;
  return `${gb.toFixed(1)} GB`;
}
