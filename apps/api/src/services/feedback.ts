// WAVE-J (J3): in-app feedback.
//
// PRIVACY: the user's free-text `body` is intentional, user-authored feedback. The
// auto-attached `context` is METADATA ONLY — current page, project id, last error
// string — NEVER chat content, file contents, or generated code. `sanitizeContext`
// enforces that server-side (allow-list of scalar keys, bounded), so even a hostile
// client cannot turn feedback into a content exfiltration channel. Feedback rows
// join the account-deletion purge.
//
// EMAIL: 'bug' (Fehler) → immediate founder email; 'idea'/'other' → a once-daily
// digest (cron, env-gated). Both are best-effort and never block the request.

import { sendEmail } from '../lib/email';
import logger from '../lib/logger';
import { getSupabaseAdmin } from '../lib/supabase';

export type FeedbackCategory = 'bug' | 'idea' | 'other';

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: 'Fehler',
  idea: 'Idee',
  other: 'Sonstiges',
};

// The ONLY context keys we accept — everything else is dropped. All values are
// coerced to short strings; objects/arrays never survive (metadata-only law).
const ALLOWED_CONTEXT_KEYS = ['page', 'project_id', 'last_error'] as const;

export function sanitizeContext(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const obj = raw as Record<string, unknown>;
  for (const key of ALLOWED_CONTEXT_KEYS) {
    const v = obj[key];
    if (v == null) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[key] = String(v).slice(0, 300);
    }
    // objects/arrays intentionally ignored
  }
  return out;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface FeedbackInput {
  userId: string;
  userEmail: string;
  category: FeedbackCategory;
  body: string;
  context: Record<string, string>;
  surface?: string;
}

/** Founder recipient — reuses the Wave-I founder envs. */
export function feedbackRecipient(): string | null {
  const to = process.env.FEEDBACK_EMAIL ?? process.env.FOUNDER_DIGEST_EMAIL ?? process.env.ADMIN_EMAIL;
  return to && to.includes('@') ? to : null;
}

export function buildFeedbackEmail(input: FeedbackInput): { subject: string; html: string } {
  const label = CATEGORY_LABEL[input.category];
  const ctxRows = Object.entries(input.context)
    .map(([k, v]) => `<tr><td style="color:#71717a;padding:2px 8px 2px 0">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join('') || '<tr><td style="color:#a1a1aa">—</td></tr>';
  const subject = `[Goblin Feedback · ${label}] ${input.body.slice(0, 60).replace(/\s+/g, ' ')}`;
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#18181b;max-width:640px;margin:0 auto;padding:24px">
  <h2 style="margin:0 0 4px">Neues Feedback — ${esc(label)}</h2>
  <p style="color:#71717a;margin:0 0 16px;font-size:13px">von ${esc(input.userEmail || input.userId)}${input.surface ? ` · ${esc(input.surface)}` : ''}</p>
  <p style="background:#f4f4f5;border-radius:6px;padding:12px 14px;white-space:pre-wrap;margin:0 0 16px">${esc(input.body)}</p>
  <h3 style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px">Kontext (nur Metadaten)</h3>
  <table style="font-size:13px;border-collapse:collapse">${ctxRows}</table>
  <p style="margin-top:16px;font-size:12px;color:#a1a1aa">Antworte direkt auf diese E-Mail, um der Person zu schreiben.</p>
  </body></html>`;
  return { subject, html };
}

/**
 * Immediate founder email for a bug report. Best-effort; never throws. No-op (and
 * returns a reason) when no recipient / no Resend key is configured — the row is
 * still persisted and the digest can still surface it.
 */
export async function sendImmediateFeedback(input: FeedbackInput): Promise<{ sent: boolean; reason?: string }> {
  const to = feedbackRecipient();
  if (!to) return { sent: false, reason: 'no_recipient' };
  try {
    const { subject, html } = buildFeedbackEmail(input);
    const res = await sendEmail({ to, subject, html, replyTo: input.userEmail || undefined });
    return { sent: res.ok, reason: res.error };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : 'unknown' };
  }
}

// ── daily digest (idea/other) ────────────────────────────────────────────────
interface DigestRow { category: FeedbackCategory; body: string; surface?: string | null; created_at: string; }

export function buildFeedbackDigest(rows: DigestRow[]): { subject: string; html: string } {
  const ideas = rows.filter((r) => r.category === 'idea');
  const other = rows.filter((r) => r.category === 'other');
  const section = (title: string, list: DigestRow[]) =>
    `<h3 style="font-size:13px;color:#18181b;margin:16px 0 6px">${title} (${list.length})</h3>` +
    (list.length
      ? `<ul style="margin:0;padding-left:18px">${list
          .map((r) => `<li style="margin:4px 0;white-space:pre-wrap">${esc(r.body.slice(0, 400))}${r.surface ? ` <span style="color:#a1a1aa">· ${esc(r.surface)}</span>` : ''}</li>`)
          .join('')}</ul>`
      : '<p style="color:#a1a1aa;margin:0">—</p>');
  const subject = `[Goblin Feedback] Tagesdigest — ${ideas.length} Idee(n), ${other.length} Sonstiges`;
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#18181b;max-width:640px;margin:0 auto;padding:24px">
  <h2 style="margin:0 0 4px">Feedback-Tagesdigest</h2>
  <p style="color:#71717a;margin:0;font-size:13px">Fehler werden sofort separat gemeldet — hier nur Ideen & Sonstiges der letzten 24 h.</p>
  ${section('Ideen', ideas)}
  ${section('Sonstiges', other)}
  </body></html>`;
  return { subject, html };
}

/**
 * Cron entry: send the daily feedback digest. Strict opt-in (GOBLIN_FEEDBACK_DIGEST
 * === 'true' + a recipient + Resend key), silent no-op otherwise, never throws.
 */
export async function sendFeedbackDigest(now = new Date()): Promise<{ sent: boolean; reason?: string }> {
  if (process.env.GOBLIN_FEEDBACK_DIGEST !== 'true') return { sent: false, reason: 'disabled' };
  const to = feedbackRecipient();
  if (!to) return { sent: false, reason: 'no_recipient' };
  try {
    const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    const { data, error } = await getSupabaseAdmin()
      .from('feedback')
      .select('category, body, surface, created_at')
      .in('category', ['idea', 'other'])
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    if (error) return { sent: false, reason: error.message };
    const rows = (data ?? []) as DigestRow[];
    if (rows.length === 0) return { sent: false, reason: 'nothing_to_send' };
    const { subject, html } = buildFeedbackDigest(rows);
    const res = await sendEmail({ to, subject, html });
    if (res.ok) logger.info({ count: rows.length }, 'feedback digest sent');
    return { sent: res.ok, reason: res.error };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : 'unknown' };
  }
}
