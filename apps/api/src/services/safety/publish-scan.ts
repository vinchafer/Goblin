// K3 (Wave-K, Layer 3) — the publish-time deterministic scan (the pipeline layer).
//
// Runs INSIDE the publish flow, BEFORE the deploy, alongside the P0.2 truth-gate. It is
// deterministic, fast, and uses NO external service: a fixed rule list (scan-rules.ts)
// over the project's HTML/JS. High-confidence phishing/malware HARD-BLOCKS the publish
// (D-K1 Option A); softer signals are LOGGED with their rule-id and never block.
//
// Honesty + false-positive discipline (Wave-K hard rules): every blocking rule ships
// with a legitimate-case fixture proving it does NOT block honest use. The block message
// names the policy area AND the appeal path (Wave-J feedback) — never a bare refusal.

import logger from '../../lib/logger';
import { trackEvent } from '../../lib/platform-events';
import {
  BRAND_TOKENS, MINER_SIGNATURES, CREDENTIAL_FIELD, CARD_FIELD, MAILTO_ACTION,
  ABSOLUTE_URL, HIDDEN_MARKER, AUTH_URL, OBFUSCATED_EVAL, SCANNABLE_EXT,
  MAX_FILE_BYTES, MAX_TOTAL_BYTES, BLOCK_MESSAGE,
  type ScanHit, type PolicyArea,
} from './scan-rules';

export interface ScanFile {
  path: string;
  content: string;
}

export interface ScanResult {
  hits: ScanHit[];
  /** True when at least one HIGH-confidence hit exists (D-K1 Option A). */
  blocked: boolean;
  /** The policy area of the first high-confidence hit (drives the block message). */
  blockArea?: PolicyArea;
}

/** Lowercased text inside <title>, <h1>, <h2> — the brand-impersonation surface. */
function impersonationSurface(html: string): string {
  const parts: string[] = [];
  const re = /<(title|h1|h2)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) parts.push(m[2] ?? '');
  return parts.join(' ').toLowerCase();
}

/** True when the document frames the brand as a legitimate OAuth provider ("sign in with X"). */
function hasOAuthContext(lower: string): boolean {
  return /(sign\s*in|log\s*in|anmelden|continue|weiter)\s*(with|mit)\s+/i.test(lower)
    || /oauth|openid|"?sso"?/i.test(lower);
}

/** Scan one file's content, appending any hits. Pure + deterministic. */
function scanOne(path: string, content: string, hits: ScanHit[]): void {
  const lower = content.toLowerCase();

  // ── Malware / miner (HIGH): a known miner signature is unambiguous. ──
  const miner = MINER_SIGNATURES.find((sig) => lower.includes(sig));
  if (miner) {
    hits.push({ ruleId: 'MW-MINER-SIG', policyArea: 'malware', confidence: 'high', path,
      evidence: `known miner signature: ${miner}` });
  }

  // ── Malware (LOW, log-only): obfuscated eval chain. Obfuscation alone ≠ block. ──
  if (OBFUSCATED_EVAL.test(content)) {
    hits.push({ ruleId: 'MW-OBFUSCATED-EVAL', policyArea: 'malware', confidence: 'low', path,
      evidence: 'obfuscated eval/packer chain (logged, not blocked)' });
  }

  const hasCredField = CREDENTIAL_FIELD.test(content);

  // ── Phishing (HIGH): third-party brand in title/heading + a credential field, and NOT
  //    a legitimate "sign in with <brand>" OAuth framing. This is brand-imitation
  //    credential harvesting. A user's OWN-app login names itself, not a foreign brand. ──
  if (hasCredField) {
    const surface = impersonationSurface(content);
    const brand = BRAND_TOKENS.find((b) => surface.includes(b));
    if (brand && !hasOAuthContext(lower)) {
      hits.push({ ruleId: 'PH-BRAND-CRED', policyArea: 'phishing', confidence: 'high', path,
        evidence: `credential field + foreign brand "${brand}" in title/heading` });
    }
  }

  // ── Phishing (HIGH): a hidden iframe pointing at a login/auth URL. ──
  const iframeRe = /<iframe\b[^>]*>/gi;
  let ifm: RegExpExecArray | null;
  while ((ifm = iframeRe.exec(content)) !== null) {
    const tag = ifm[0];
    const src = /src\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? '';
    if (AUTH_URL.test(src) && HIDDEN_MARKER.test(tag)) {
      hits.push({ ruleId: 'PH-HIDDEN-IFRAME-AUTH', policyArea: 'phishing', confidence: 'high', path,
        evidence: 'hidden iframe targeting a login/auth URL' });
      break;
    }
  }

  // ── Payment (HIGH): own card form that exfiltrates via mailto: — the "mail me the
  //    card data" pattern. Legit checkouts use Stripe/PayPal, not a mailto action. ──
  if (CARD_FIELD.test(content) && MAILTO_ACTION.test(content)) {
    hits.push({ ruleId: 'PH-CARD-MAILTO', policyArea: 'payment', confidence: 'high', path,
      evidence: 'card-capture field(s) + form action mailto: (self-collected payment data)' });
  }

  // ── Phishing (LOW, log-only): a credential field in a form posting to an absolute
  //    (possibly foreign) URL. Could be a legit external backend → logged, not blocked. ──
  if (hasCredField) {
    const formRe = /<form\b[^>]*action\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let fm: RegExpExecArray | null;
    while ((fm = formRe.exec(content)) !== null) {
      if (ABSOLUTE_URL.test(fm[1] ?? '') && !MAILTO_ACTION.test(fm[0])) {
        hits.push({ ruleId: 'PH-CRED-FOREIGN-POST', policyArea: 'phishing', confidence: 'low', path,
          evidence: 'credential field + form posting to an absolute URL (logged, not blocked)' });
        break;
      }
    }
  }
}

/** Scan a set of already-loaded files. Pure + deterministic — the unit under test. */
export function scanFiles(files: ScanFile[]): ScanResult {
  const hits: ScanHit[] = [];
  for (const f of files) {
    const dot = f.path.lastIndexOf('.');
    const ext = dot >= 0 ? f.path.slice(dot).toLowerCase() : '';
    if (!SCANNABLE_EXT.has(ext)) continue;
    scanOne(f.path, f.content, hits);
  }
  const highHit = hits.find((h) => h.confidence === 'high');
  return { hits, blocked: Boolean(highHit), blockArea: highHit?.policyArea };
}

export interface PublishGuardDeps {
  listFiles: (projectId: string) => Promise<string[]>;
  downloadFile: (projectId: string, path: string) => Promise<string | null>;
}

export interface PublishGuardOutcome {
  /** true → publish may proceed. false → blocked (a high-confidence hit). */
  ok: boolean;
  /** German block message (house register) when ok === false. */
  message?: string;
  policyArea?: PolicyArea;
  /** Rule-ids of the high-confidence hits that blocked (for the appeal context). */
  ruleIds?: string[];
}

/**
 * Load the project's scannable files, run the scan, LOG every hit with its rule-id, emit
 * a publish_blocked platform event on a block, and return the guard outcome. Never throws
 * — a scan failure degrades OPEN (publish proceeds) and is logged, because the scan is a
 * safety layer, not a correctness gate: it must never be the reason an honest publish dies.
 */
export async function runPublishGuard(
  deps: PublishGuardDeps,
  userId: string,
  projectId: string,
): Promise<PublishGuardOutcome> {
  let files: ScanFile[] = [];
  try {
    const paths = await deps.listFiles(projectId);
    let total = 0;
    for (const p of paths) {
      const dot = p.lastIndexOf('.');
      const ext = dot >= 0 ? p.slice(dot).toLowerCase() : '';
      if (!SCANNABLE_EXT.has(ext)) continue;
      const content = await deps.downloadFile(projectId, p).catch(() => null);
      if (!content) continue;
      if (content.length > MAX_FILE_BYTES) continue; // skip oversized files
      if (total + content.length > MAX_TOTAL_BYTES) break; // bound total work
      total += content.length;
      files.push({ path: p, content });
    }
  } catch (e) {
    logger.warn({ err: (e as Error).message, projectId }, 'K3 publish-scan: file load failed — degrading open');
    return { ok: true };
  }

  const result = scanFiles(files);

  // Log EVERY hit with its rule-id (metadata only — path + rule + reason, never content).
  for (const h of result.hits) {
    logger[h.confidence === 'high' ? 'warn' : 'info'](
      { ruleId: h.ruleId, policyArea: h.policyArea, confidence: h.confidence, path: h.path, evidence: h.evidence, projectId },
      `K3 publish-scan hit: ${h.ruleId} (${h.confidence})`,
    );
  }

  if (!result.blocked || !result.blockArea) return { ok: true };

  const highRuleIds = result.hits.filter((h) => h.confidence === 'high').map((h) => h.ruleId);
  // publish_blocked funnel/audit signal — METADATA ONLY (rule-ids + policy area + count).
  trackEvent({
    eventType: 'publish_blocked',
    userId,
    projectId,
    meta: { policy_area: result.blockArea, rule_ids: highRuleIds, hit_count: result.hits.length },
  });

  return {
    ok: false,
    message: BLOCK_MESSAGE[result.blockArea],
    policyArea: result.blockArea,
    ruleIds: highRuleIds,
  };
}
