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
  opts?: { attempts?: number; retryDelayMs?: number; builtOutput?: boolean; expectedEntryContent?: string },
): Promise<DeployVerification> {
  const attempts = opts?.attempts ?? ATTEMPTS;
  const retryDelayMs = opts?.retryDelayMs ?? RETRY_DELAY_MS;
  const entryPath = pickEntryFile(projectFiles);
  const base = baseUrl.replace(/\/$/, '');

  // WAVE-E E3: for a framework build (D-E1=A), Vercel serves the BUILT output (dist/
  // index.html referencing hashed /assets/*), which legitimately differs from the SOURCE
  // index.html in storage. So the byte-equality compare below must be SKIPPED for a built
  // deploy — otherwise a perfectly good Vite build fails the gate as "entspricht nicht dem
  // gespeicherten Stand". We still fully verify the deploy: the entry answers 200 with real
  // HTML AND every asset the SERVED page references answers 200 (the built JS/CSS bundles).
  const builtOutput = opts?.builtOutput ?? false;

  // Expected entry content for the byte-truth comparison.
  //
  // U1 (founder-walk-6, F4): a caller that already knows the exact bytes it is
  // checking against — because it just uploaded them — passes them directly via
  // `expectedEntryContent`, and this function trusts THAT instead of re-reading
  // storage. A second, independent storage read is exactly how the hosted-apps
  // path went stale: a pipeline step (form-wiring) rewrote the artifact in memory
  // AFTER storage was read and BEFORE upload, without ever writing the rewrite
  // back — so storage and the uploaded bytes silently diverged, and every publish
  // of a form-bearing app failed this gate. Trusting the caller's own bytes makes
  // the two impossible to desync, by construction, the same way `describeForScan`
  // (ops-publish.ts) derives the scan view from final bytes rather than
  // accumulating a second copy alongside them.
  //
  // Callers that do not know this (the Vercel/framework path) are unaffected:
  // omitting the option preserves the original storage-read behaviour exactly.
  let expectedEntry: string | null = null;
  if (opts?.expectedEntryContent !== undefined) {
    expectedEntry = opts.expectedEntryContent;
  } else if (entryPath && !builtOutput) {
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
    // Built deploy (no byte-compare): still require a real HTML document, not an empty
    // 200 or an error page Vercel might briefly serve while the build settles.
    if (builtOutput && !/<html|<!doctype|<div|<script/i.test(servedHtml)) {
      lastReason = 'Der Build ist noch nicht fertig — die Seite liefert noch keinen Inhalt.';
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
