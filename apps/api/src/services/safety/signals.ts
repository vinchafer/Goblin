// K4 (Wave-K, Layer 4) — velocity & pattern signals (the behavioral layer).
//
// Cheap, deterministic flags into platform_events (event_type = 'abuse_signal'). They
// INFORM — they NEVER auto-punish. Account actions (lock, terminate) stay founder
// decisions (OS escalation table: user data / irreversible). The three flags:
//   1. new-account high publish velocity   (n publishes in the account's first hour)
//   2. near-identical content fan-out       (same content hash across N projects —
//                                            the phishing-kit pattern)
//   3. repeated policy blocks per user      (probing: many K3 publish_blocks in a window)
//
// Everything here is METADATA ONLY — counts, hashes, thresholds. Never file contents.

import { createHash } from 'node:crypto';
import logger from '../../lib/logger';
import { trackEvent } from '../../lib/platform-events';

export type AbuseSignalKind = 'publish_velocity' | 'content_fanout' | 'repeated_policy_blocks';

export interface AbuseSignal {
  kind: AbuseSignalKind;
  /** Metadata-only detail (counts / hash prefix / thresholds). */
  detail: Record<string, unknown>;
}

// ── Thresholds (env-knobbed; conservative defaults). ──────────────────────────
function intEnv(name: string, dflt: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : dflt;
}
/** "New account" window: the first hour of the account's life. */
export const NEW_ACCOUNT_WINDOW_MS = 60 * 60 * 1000;
/** Publishes within the new-account window that trip the velocity flag. */
export const publishVelocityThreshold = () => intEnv('ABUSE_PUBLISH_VELOCITY', 5);
/** Distinct projects sharing one content hash that trip the fan-out flag. */
export const contentFanoutThreshold = () => intEnv('ABUSE_CONTENT_FANOUT', 3);
/** publish_blocked events in the window that trip the repeated-blocks flag. */
export const repeatedBlockThreshold = () => intEnv('ABUSE_REPEATED_BLOCKS', 3);

/** Stable content fingerprint of the deployed artifact (sha256, hex). Metadata only. */
export function hashContent(parts: string[]): string {
  const h = createHash('sha256');
  for (const p of parts) h.update(p);
  return h.digest('hex');
}

// ── Pure evaluators (no I/O — the unit under test). ───────────────────────────

/** New-account publish velocity. Fires only inside the first-hour window. */
export function evalPublishVelocity(accountAgeMs: number | null, publishesInWindow: number): AbuseSignal | null {
  if (accountAgeMs === null || accountAgeMs > NEW_ACCOUNT_WINDOW_MS) return null;
  const threshold = publishVelocityThreshold();
  if (publishesInWindow < threshold) return null;
  return { kind: 'publish_velocity', detail: { publishes: publishesInWindow, threshold, account_age_ms: accountAgeMs } };
}

/** Near-identical content fan-out: the new hash already appears on ≥ threshold-1 OTHER projects. */
export function evalContentFanout(newHash: string, priorHashes: Array<{ projectId: string; hash: string }>): AbuseSignal | null {
  const projects = new Set<string>();
  for (const p of priorHashes) if (p.hash === newHash) projects.add(p.projectId);
  const distinct = projects.size + 1; // +1 for the project being published now
  const threshold = contentFanoutThreshold();
  if (distinct < threshold) return null;
  return { kind: 'content_fanout', detail: { distinct_projects: distinct, threshold, hash_prefix: newHash.slice(0, 12) } };
}

/** Repeated K3 policy blocks (probing behavior). */
export function evalRepeatedBlocks(blockCount: number): AbuseSignal | null {
  const threshold = repeatedBlockThreshold();
  if (blockCount < threshold) return null;
  return { kind: 'repeated_policy_blocks', detail: { blocks: blockCount, threshold } };
}

/** Emit one flag as an abuse_signal event (+ a warn log). Fire-and-forget, never throws. */
export function emitAbuseSignal(userId: string, projectId: string | null, signal: AbuseSignal): void {
  logger.warn({ signal: signal.kind, projectId, ...signal.detail }, `K4 abuse_signal: ${signal.kind}`);
  trackEvent({ eventType: 'abuse_signal', userId, projectId, meta: { signal: signal.kind, ...signal.detail } });
}

export interface PublishSignalDeps {
  /** Account age in ms (now − users.created_at), or null if unknown. */
  accountAgeMs: (userId: string) => Promise<number | null>;
  /** Count of this user's publishes within the new-account window. */
  publishesInWindow: (userId: string) => Promise<number>;
  /** Recent (projectId, contentHash) pairs for this user's OTHER projects. */
  priorContentHashes: (userId: string, excludeProjectId: string) => Promise<Array<{ projectId: string; hash: string }>>;
}

/**
 * Evaluate the velocity + fan-out flags for one publish and emit any that fire. Best-effort:
 * every dependency is wrapped so a query failure degrades to "no signal" — a behavioral flag
 * must never slow or break an honest publish. (repeated_policy_blocks is emitted separately,
 * at the K3 block site, where the block count is already at hand.)
 */
export async function collectPublishSignals(
  deps: PublishSignalDeps,
  userId: string,
  projectId: string,
  contentHash: string,
): Promise<void> {
  try {
    const [ageMs, count] = await Promise.all([
      deps.accountAgeMs(userId).catch(() => null),
      deps.publishesInWindow(userId).catch(() => 0),
    ]);
    const velocity = evalPublishVelocity(ageMs, count);
    if (velocity) emitAbuseSignal(userId, projectId, velocity);

    const prior = await deps.priorContentHashes(userId, projectId).catch(() => []);
    const fanout = evalContentFanout(contentHash, prior);
    if (fanout) emitAbuseSignal(userId, projectId, fanout);
  } catch (e) {
    logger.debug({ err: (e as Error).message, projectId }, 'K4 collectPublishSignals skipped');
  }
}
