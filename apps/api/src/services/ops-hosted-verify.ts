/**
 * AKT 2 · PHASE 2 · U2.4 — the truth gate for a hosted publish.
 *
 * "Live" is a claim about the public internet, so it is only ever made after the
 * public internet has been asked. This REUSES the existing P0.2 verifier
 * (deploy-verification.ts) rather than growing a second definition of "verified":
 * the entry document must answer 200 and match what we stored, and every asset it
 * references must answer 200.
 *
 * On top of that it adds the one check the Vercel path cannot make. There, Vercel
 * builds the artifact and the served bytes legitimately differ from storage. Here
 * WE uploaded the bytes, so we can demand that what comes back through the router
 * is byte-for-byte what we put in R2. That closes the gap between "the URL answers"
 * and "the URL answers with the right thing" — a half-uploaded app, a mangled
 * content type or a stale cached object all answer 200 perfectly happily.
 */

import { verifyDeployment } from './deploy-verification';
import logger from '../lib/logger';

/** How many assets get the byte comparison. Publishes stay fast; the entry is always checked. */
export const BYTE_CHECK_ASSETS = 5;

const FETCH_TIMEOUT_MS = 10_000;

export interface UploadedFile {
  path: string;
  bytes: Buffer;
}

export interface HostedVerification {
  ok: boolean;
  /** German, user-facing, when ok === false. */
  reason?: string;
  /** Entry reachable + matching (the reused P0.2 gate). */
  entryOk: boolean;
  /** How many assets were compared byte-for-byte, and how many matched. */
  assetsChecked: number;
  assetsMatched: number;
  mismatched: string[];
}

async function fetchBytes(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'goblin-hosted-verify/1.0' },
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Pick the assets worth comparing: real files, not the entry document, largest
 * first. Largest first because a truncated or partially-propagated upload shows up
 * in the big bundle long before it shows up in a 300-byte favicon.
 */
export function pickAssetsToCheck(files: UploadedFile[], limit = BYTE_CHECK_ASSETS): UploadedFile[] {
  return files
    .filter((f) => f.path !== 'index.html' && f.bytes.length > 0)
    .sort((a, b) => b.bytes.length - a.bytes.length)
    .slice(0, limit);
}

/**
 * Verify a hosted publish. Never throws; the verdict is the answer.
 *
 * `attempts`/`retryDelayMs` default lower than the Vercel path's 6×10s: there is no
 * build to wait for here, only KV route propagation and R2 read-after-write, both
 * of which settle in seconds. A publish that has not come up in ~20s has a real
 * problem, and saying so quickly is kinder than a minute of "wird geprüft".
 */
export async function verifyHostedPublish(
  url: string,
  projectId: string,
  uploaded: UploadedFile[],
  opts: { attempts?: number; retryDelayMs?: number; assetLimit?: number } = {},
): Promise<HostedVerification> {
  const paths = uploaded.map((f) => f.path);

  // 1. The existing truth gate, unchanged: entry 200 + matches storage + every
  //    referenced asset answers 200.
  const base = await verifyDeployment(url, projectId, paths, undefined, {
    attempts: opts.attempts ?? 5,
    retryDelayMs: opts.retryDelayMs ?? 4_000,
  });

  if (!base.ok) {
    return {
      ok: false,
      reason: base.reason ?? 'Die veröffentlichte Seite ist nicht erreichbar.',
      entryOk: false,
      assetsChecked: 0,
      assetsMatched: 0,
      mismatched: base.failedAssets,
    };
  }

  // 2. Byte-for-byte, on the assets we actually uploaded.
  const toCheck = pickAssetsToCheck(uploaded, opts.assetLimit ?? BYTE_CHECK_ASSETS);
  const mismatched: string[] = [];
  let matched = 0;

  for (const asset of toCheck) {
    const served = await fetchBytes(`${url.replace(/\/$/, '')}/${asset.path}`);
    if (served && served.equals(asset.bytes)) matched += 1;
    else mismatched.push(asset.path);
  }

  if (mismatched.length > 0) {
    logger.warn({ url, mismatched }, 'hosted_verify_byte_mismatch');
    return {
      ok: false,
      reason: `Die App ist erreichbar, liefert aber noch nicht den hochgeladenen Stand aus (${mismatched.join(', ')}).`,
      entryOk: true,
      assetsChecked: toCheck.length,
      assetsMatched: matched,
      mismatched,
    };
  }

  return { ok: true, entryOk: true, assetsChecked: toCheck.length, assetsMatched: matched, mismatched: [] };
}
