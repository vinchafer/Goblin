// P0.2 (feel-sprint-1): deploy truth-gating. "Veröffentlicht / Live" must not
// be claimed until the deployed URL demonstrably serves the right content:
//   (a) the entry HTML answers 200 and matches the artifact we deployed, and
//   (b) every asset the entry HTML references answers 200.
// D2 diagnosis (see _sprint/feel-1/DIAGNOSIS.md) showed Vercel serves the
// complete, correct file from the first second after READY — so this loop is
// short: a handful of retries, then an honest German failure message.

import { extractLocalRefs } from '@goblin/shared/src/html-refs';
import { downloadFile } from './file-storage';

export interface DeployVerification {
  ok: boolean;
  /** German, user-facing reason when ok === false. */
  reason?: string;
  /** Asset paths that failed their check (for logging/UI detail). */
  failedAssets: string[];
}

const ATTEMPTS = 6;
const RETRY_DELAY_MS = 10_000; // 6 × 10s ≈ 1 min window, calibrated by D2
const FETCH_TIMEOUT_MS = 10_000;

async function fetchOk(url: string): Promise<{ ok: boolean; status: number; body?: string }> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'goblin-deploy-verify/1.0' },
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, status: res.status, body: await res.text() };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Find the entry HTML filename among the project's deployed files. */
export function pickEntryFile(paths: string[]): string | null {
  if (paths.includes('index.html')) return 'index.html';
  return paths.find((p) => p.endsWith('.html') && !p.includes('/')) ?? paths.find((p) => p.endsWith('.html')) ?? null;
}

/**
 * Verify one deployment. `projectFiles` is the list of storage paths that were
 * deployed. Never throws; returns an honest verdict.
 */
export async function verifyDeployment(
  baseUrl: string,
  projectId: string,
  projectFiles: string[],
  onProgress?: (msg: string) => void | Promise<void>,
  opts?: { attempts?: number; retryDelayMs?: number },
): Promise<DeployVerification> {
  const attempts = opts?.attempts ?? ATTEMPTS;
  const retryDelayMs = opts?.retryDelayMs ?? RETRY_DELAY_MS;
  const entryPath = pickEntryFile(projectFiles);
  const base = baseUrl.replace(/\/$/, '');

  // Expected entry content for the byte-truth comparison. Best-effort: if the
  // read fails we still check reachability + assets.
  let expectedEntry: string | null = null;
  if (entryPath) {
    try {
      expectedEntry = await downloadFile(projectId, entryPath);
    } catch { /* verify without content compare */ }
  }

  let lastReason = 'Die veröffentlichte Seite ist nicht erreichbar.';
  let failedAssets: string[] = [];

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, retryDelayMs));
    await onProgress?.(`Wird veröffentlicht… (wird geprüft, ${attempt}/${attempts})`);

    // (a) entry HTML: reachable + matches the deployed artifact
    const entry = await fetchOk(!entryPath || entryPath === 'index.html' ? base : `${base}/${entryPath}`);
    if (!entry.ok) {
      lastReason = `Die veröffentlichte Seite antwortet nicht (HTTP ${entry.status || 'Netzwerkfehler'}).`;
      continue;
    }
    const servedHtml = entry.body ?? '';
    if (expectedEntry !== null && servedHtml !== expectedEntry) {
      lastReason = 'Die veröffentlichte Seite entspricht noch nicht dem gespeicherten Stand.';
      continue;
    }

    // (b) every locally referenced asset answers 200
    const refs = extractLocalRefs(servedHtml);
    const missing: string[] = [];
    for (const ref of refs) {
      const res = await fetchOk(`${base}/${ref}`);
      if (!res.ok) missing.push(ref);
    }
    if (missing.length > 0) {
      failedAssets = missing;
      lastReason = `Veröffentlichung hat ein Problem: ${missing.join(', ')} nicht erreichbar`;
      continue;
    }

    return { ok: true, failedAssets: [] };
  }

  return { ok: false, reason: lastReason, failedAssets };
}
