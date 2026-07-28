/**
 * AKT 2 · PHASE 2 · U2.3 — the pre-publish scan for the GOBLIN-HOSTED path.
 *
 * Runs BEFORE a single byte reaches R2. A block means nothing was uploaded, no
 * route was written and no registry row was created — not "uploaded and then
 * hidden". That ordering is the whole point: on this path Goblin is the hoster, so
 * "we took it down afterwards" is a worse answer than "it never went up".
 *
 * Deterministic, no external service, $0 per publish (ledger M-H1). See
 * hosted-scan-rules.ts for why the rule set is K3 plus exactly three additions.
 *
 * ── Fail CLOSED, unlike the Vercel path ──────────────────────────────────────
 * K3's runPublishGuard degrades OPEN when it cannot read files: a safety layer
 * must not be the reason an honest publish dies on someone else's hosting. Here
 * the calculus is inverted. If we cannot read what we are about to serve from our
 * own domain, we do not serve it. The AUP promises a check ran; publishing without
 * one would make that sentence false, which is the one outcome this unit exists to
 * prevent.
 */

import { scanFiles, type ScanFile } from './publish-scan';
import { BLOCK_MESSAGE, ABSOLUTE_URL, CREDENTIAL_FIELD, MAILTO_ACTION, SCANNABLE_EXT, type ScanHit } from './scan-rules';
import {
  ALLOWED_EXTENSIONS,
  DRAINER_SIGNATURES,
  HOSTED_BLOCK_MESSAGE,
  HOSTED_MAX_FILES,
  HOSTED_MAX_FILE_BYTES,
  HOSTED_MAX_TOTAL_BYTES,
  INPUT_TAG,
  SEED_FIELD,
  type HostedPolicyArea,
} from './hosted-scan-rules';
import logger from '../../lib/logger';
import { trackEvent } from '../../lib/platform-events';

/** One file of the artifact about to be published. */
export interface HostedScanFile {
  path: string;
  /** Text for scannable types; byte length is all that matters for the rest. */
  content?: string;
  bytes: number;
}

export interface HostedScanVerdict {
  /** pass → the upload may start. block → nothing is uploaded. */
  verdict: 'pass' | 'block';
  /** The category behind a block. Drives the German message; never the rule id. */
  area?: HostedPolicyArea;
  /** German, user-facing. Names the category and the appeal path, never the rule. */
  message?: string;
  /** Rule ids of every blocking hit — for the log, the audit row and the appeal. */
  ruleIds: string[];
  /** Every hit, blocking or not. Log-only hits inform without punishing. */
  hits: ScanHit[];
  /** Files inspected as text (the rest were size/type-checked only). */
  scannedFiles: number;
  scannedBytes: number;
}

function ext(path: string): string {
  const i = path.lastIndexOf('.');
  return i >= 0 ? path.slice(i).toLowerCase() : '';
}

/**
 * Artifact sanity: what a static host may serve, and how much of it. Returns the
 * blocking hits, which are deliberately about the ARTIFACT rather than the intent
 * — the message says so, so nobody reads a size limit as an accusation.
 */
function checkArtifact(files: HostedScanFile[]): ScanHit[] {
  const hits: ScanHit[] = [];

  if (files.length > HOSTED_MAX_FILES) {
    hits.push({
      ruleId: 'ART-TOO-MANY-FILES', policyArea: 'malware', confidence: 'high', path: '(artifact)',
      evidence: `${files.length} files exceeds the ${HOSTED_MAX_FILES} limit`,
    });
  }

  let total = 0;
  for (const f of files) {
    total += f.bytes;
    const e = ext(f.path);
    if (!ALLOWED_EXTENSIONS.has(e)) {
      hits.push({
        ruleId: 'ART-DISALLOWED-TYPE', policyArea: 'malware', confidence: 'high', path: f.path,
        evidence: `extension ${e || '(none)'} is not servable by the static host`,
      });
    }
    if (f.bytes > HOSTED_MAX_FILE_BYTES) {
      hits.push({
        ruleId: 'ART-FILE-TOO-LARGE', policyArea: 'malware', confidence: 'high', path: f.path,
        evidence: `${f.bytes} bytes exceeds the ${HOSTED_MAX_FILE_BYTES}-byte per-file limit`,
      });
    }
  }

  if (total > HOSTED_MAX_TOTAL_BYTES) {
    hits.push({
      ruleId: 'ART-TOTAL-TOO-LARGE', policyArea: 'malware', confidence: 'high', path: '(artifact)',
      evidence: `${total} bytes exceeds the ${HOSTED_MAX_TOTAL_BYTES}-byte artifact limit`,
    });
  }

  return hits;
}

/** True when an absolute form action points somewhere that is not this platform. */
function isForeignAction(action: string, appsDomain: string): boolean {
  if (!ABSOLUTE_URL.test(action)) return false;
  try {
    const host = new URL(action).hostname.toLowerCase();
    const domain = appsDomain.toLowerCase();
    return !(host === domain || host.endsWith(`.${domain}`));
  } catch {
    // An action we cannot parse is not evidence of anything. Say nothing.
    return false;
  }
}

/** The hosted-only rules, over one file's text. */
function scanHostedOne(path: string, content: string, appsDomain: string, hits: ScanHit[]): void {
  const lower = content.toLowerCase();

  // ── Wallet (HIGH): a known drainer kit. Code shapes only, so prose cannot trip it. ──
  const sig = DRAINER_SIGNATURES.find((s) => lower.includes(s));
  if (sig) {
    hits.push({
      ruleId: 'WD-DRAINER-SIG', policyArea: 'malware', confidence: 'high', path,
      evidence: `known wallet-drainer signature: ${sig}`,
    });
  }

  // ── Wallet (HIGH): an INPUT that asks for a recovery secret. A page that
  //    explains seed phrases matches nothing here; one that asks you to type it
  //    matches. No legitimate app asks for a seed phrase. ──
  const tags = content.match(INPUT_TAG) ?? [];
  const seedTag = tags.find((t) => SEED_FIELD.test(t));
  if (seedTag) {
    hits.push({
      ruleId: 'WD-SEED-FIELD', policyArea: 'malware', confidence: 'high', path,
      evidence: 'input field harvesting a wallet seed phrase / private key',
    });
  }

  // ── Phishing (HIGH on the hosted path only): credentials posted to a foreign
  //    domain. K3 logs this and does not block, because on the builder's own
  //    Vercel it may well be their own backend and the call is theirs. Under
  //    justgoblin.app it is Goblin's domain, Goblin's certificate and Goblin's
  //    liability, so the same pattern blocks. A form WITHOUT a credential field
  //    (a newsletter signup posting to Mailchimp) is untouched — benign-03. ──
  if (CREDENTIAL_FIELD.test(content)) {
    const formRe = /<form\b[^>]*action\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = formRe.exec(content)) !== null) {
      const action = m[1] ?? '';
      if (MAILTO_ACTION.test(m[0]) || isForeignAction(action, appsDomain)) {
        hits.push({
          ruleId: 'HP-CRED-FOREIGN-POST', policyArea: 'phishing', confidence: 'high', path,
          evidence: 'credential field posted to a domain outside the app',
        });
        break;
      }
    }
  }

  // ── Malware (LOW, log-only): a hidden iframe to an external origin that is NOT
  //    an auth URL (K3 already blocks the auth case). Hidden external iframes are
  //    also how legitimate payment SDKs and analytics pixels work, so this informs
  //    a human rather than punishing a builder. ──
  const iframeRe = /<iframe\b[^>]*>/gi;
  let ifm: RegExpExecArray | null;
  while ((ifm = iframeRe.exec(content)) !== null) {
    const tag = ifm[0];
    const src = /src\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? '';
    const hidden = /display\s*:\s*none|visibility\s*:\s*hidden|\bhidden\b|width\s*=\s*["']?0|height\s*=\s*["']?0/i.test(tag);
    if (hidden && ABSOLUTE_URL.test(src)) {
      hits.push({
        ruleId: 'HP-HIDDEN-EXTERNAL-IFRAME', policyArea: 'malware', confidence: 'low', path,
        evidence: 'hidden iframe with an external source (logged, not blocked)',
      });
      break;
    }
  }
}

/**
 * The area a block is reported under. Artifact rules borrow `malware` internally
 * (ScanHit's policyArea is K3's closed union) but must never TELL a builder their
 * PDF looked like malware — so the mapping back to a user-facing category happens
 * here, off the rule id.
 */
const ARTIFACT_RULES = new Set(['ART-TOO-MANY-FILES', 'ART-DISALLOWED-TYPE', 'ART-FILE-TOO-LARGE', 'ART-TOTAL-TOO-LARGE']);
const WALLET_RULES = new Set(['WD-DRAINER-SIG', 'WD-SEED-FIELD']);

function areaFor(hit: ScanHit): HostedPolicyArea {
  if (ARTIFACT_RULES.has(hit.ruleId)) return 'artifact';
  if (WALLET_RULES.has(hit.ruleId)) return 'wallet';
  return hit.policyArea;
}

function messageFor(area: HostedPolicyArea): string {
  return area === 'wallet' || area === 'artifact' ? HOSTED_BLOCK_MESSAGE[area] : BLOCK_MESSAGE[area];
}

/**
 * Scan an artifact. PURE and deterministic — the unit the fixture battery drives.
 *
 * K3's rules run first and unchanged, so a thing that is blocked on the Vercel
 * path is blocked here for the same reason and with the same sentence.
 */
export function scanHostedArtifact(files: HostedScanFile[], appsDomain = 'justgoblin.app'): HostedScanVerdict {
  const artifactHits = checkArtifact(files);

  const textFiles: ScanFile[] = [];
  let scannedBytes = 0;
  for (const f of files) {
    if (typeof f.content !== 'string') continue;
    if (!SCANNABLE_EXT.has(ext(f.path))) continue;
    textFiles.push({ path: f.path, content: f.content });
    scannedBytes += f.content.length;
  }

  // 1. K3, verbatim. Same rules, same verdicts, same wording.
  const k3 = scanFiles(textFiles);

  // 2. The hosted-only additions.
  const hostedHits: ScanHit[] = [];
  for (const f of textFiles) scanHostedOne(f.path, f.content, appsDomain, hostedHits);

  const hits = [...artifactHits, ...k3.hits, ...hostedHits];
  const blocking = hits.filter((h) => h.confidence === 'high');

  if (blocking.length === 0) {
    return { verdict: 'pass', ruleIds: [], hits, scannedFiles: textFiles.length, scannedBytes };
  }

  const area = areaFor(blocking[0]!);
  return {
    verdict: 'block',
    area,
    message: messageFor(area),
    ruleIds: blocking.map((h) => h.ruleId),
    hits,
    scannedFiles: textFiles.length,
    scannedBytes,
  };
}

/**
 * Scan and record. The side-effecting wrapper the publish path calls: it logs every
 * hit with its rule id and emits the same `publish_blocked` event the Vercel path
 * emits, so both routes to a block land in one funnel instead of two.
 *
 * METADATA ONLY in the event — rule ids, area, counts. Never a path's contents.
 */
export function scanHostedArtifactAndRecord(
  files: HostedScanFile[],
  ctx: { userId: string; projectId?: string | null; appsDomain?: string },
): HostedScanVerdict {
  const result = scanHostedArtifact(files, ctx.appsDomain ?? 'justgoblin.app');

  for (const h of result.hits) {
    logger[h.confidence === 'high' ? 'warn' : 'info'](
      { ruleId: h.ruleId, policyArea: h.policyArea, confidence: h.confidence, path: h.path, evidence: h.evidence },
      `hosted publish-scan hit: ${h.ruleId} (${h.confidence})`,
    );
  }

  if (result.verdict === 'block') {
    trackEvent({
      eventType: 'publish_blocked',
      userId: ctx.userId,
      projectId: ctx.projectId ?? null,
      meta: {
        policy_area: result.area,
        rule_ids: result.ruleIds,
        hit_count: result.hits.length,
        path: 'hosted', // which publish path blocked — the only new field
      },
    });
  }

  return result;
}
