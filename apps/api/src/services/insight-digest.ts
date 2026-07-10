// I4 (WAVE-I insight): the OPTIONAL daily founder digest — the loop-closer for
// stuck users. Uses ONLY existing infrastructure (the Resend account via
// lib/email + the in-process cron), so it adds NO new service. One summary per
// day, env-toggled, OFF by default. Metadata only, like every insight surface.
//
// Enable (founder-side): GOBLIN_FOUNDER_DIGEST=true and a recipient
// (FOUNDER_DIGEST_EMAIL, or ADMIN_EMAIL as a fallback). RESEND_API_KEY must be
// set (already used for transactional mail). With any of these missing the
// digest silent-no-ops — it can never block or crash the cron.

import { buildInsight, type InsightPayload } from './insight';
import { sendEmail } from '../lib/email';
import logger from '../lib/logger';

export interface Digest { subject: string; html: string }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Render the daily digest from a computed insight payload. Pure + deterministic
 * (no I/O, no clock beyond the payload's generatedAt) so it is unit-testable and
 * the numbers can be cross-checked against /admin/insight.
 */
export function buildDigest(insight: InsightPayload): Digest {
  const f = insight.funnel7;
  const live = f.stages.find((s) => s.key === 'first_publish_verified');
  const upgraded = f.stages.find((s) => s.key === 'upgraded');
  const stuck = insight.journeys.filter((j) => j.stuck);
  const p = insight.pulse;
  const date = insight.generatedAt.slice(0, 10);

  const liveCount = live?.count ?? 0;
  const livePct = live?.conversionPct ?? 0;

  const stuckRows = stuck.length
    ? stuck
        .map(
          (j) =>
            `<li style="margin:4px 0"><strong>${esc(j.email ?? j.userId)}</strong> — ${esc(j.currentStageLabel)}, seit ${j.hoursSinceLast ?? '?'}h still</li>`,
        )
        .join('')
    : '<li style="color:#6b7280">Niemand hängt ≥24h. 🎉</li>';

  const html = `
  <div style="font-family:-apple-system,system-ui,sans-serif;max-width:520px;color:#1a1c19">
    <h2 style="color:#2e6d43;margin:0 0 4px">Goblin Insight — Tagesdigest</h2>
    <div style="color:#6b7280;font-size:13px;margin-bottom:16px">${esc(date)} · letzte 7 Tage · Test-Accounts ausgeblendet</div>

    <p style="font-size:15px;line-height:1.5">
      <strong>${f.cohortSize}</strong> registriert ·
      <strong>${liveCount}</strong> erreichten eine Live-App (<strong>${livePct}%</strong>) ·
      <strong>${upgraded?.count ?? 0}</strong> upgegradet.
    </p>

    <h3 style="margin:18px 0 6px;font-size:14px">Hängt ≥24h (${stuck.length})</h3>
    <ul style="margin:0;padding-left:18px;font-size:14px">${stuckRows}</ul>

    <h3 style="margin:18px 0 6px;font-size:14px">Pulse</h3>
    <p style="font-size:14px;line-height:1.5;margin:0">
      Agent-Läufe: <strong>${p.runsFinished}</strong>${p.runSuccessPct != null ? ` (${p.runSuccessPct}% ok)` : ''} ·
      Publish-Erfolg: <strong>${p.publishSuccessPct != null ? `${p.publishSuccessPct}%` : '—'}</strong>
      (${p.publishVerified}✓/${p.publishFailed}✗) ·
      Feedback: <strong>${p.feedbackCount}</strong>
    </p>

    <div style="color:#9aa0a6;font-size:11px;margin-top:20px">
      Nur Metadaten — welche Funktion wann, nie Inhalte. Vollansicht: /admin/insight
    </div>
  </div>`;

  const subject = `Goblin Insight ${date} — ${liveCount}/${f.cohortSize} live · ${stuck.length} hängen`;
  return { subject, html };
}

function digestRecipient(): string | null {
  const to = process.env.FOUNDER_DIGEST_EMAIL || process.env.ADMIN_EMAIL;
  return to && to.includes('@') ? to : null;
}

/**
 * Build + send today's digest. Silent-no-op unless explicitly enabled and a
 * recipient is configured. Never throws (best-effort, like all insight I/O).
 * Returns a small status for the cron log / tests.
 */
export async function sendFounderDigest(): Promise<{ sent: boolean; reason?: string }> {
  if (process.env.GOBLIN_FOUNDER_DIGEST !== 'true') return { sent: false, reason: 'disabled' };
  const to = digestRecipient();
  if (!to) return { sent: false, reason: 'no_recipient' };

  try {
    const insight = await buildInsight({ days: 7, includeTest: false });
    const { subject, html } = buildDigest(insight);
    const res = await sendEmail({ to, subject, html });
    if (!res.ok) {
      logger.warn({ error: res.error }, 'founder digest send failed');
      return { sent: false, reason: res.error ?? 'send_failed' };
    }
    logger.info({ to, cohort: insight.funnel7.cohortSize }, 'founder digest sent');
    return { sent: true };
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'founder digest threw');
    return { sent: false, reason: (e as Error).message };
  }
}
