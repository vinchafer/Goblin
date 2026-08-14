/**
 * AKT 2 · PHASE 4 · U4.5 — telling the owner something arrived.
 *
 * ── Why this is not "just an e-mail" ─────────────────────────────────────────
 * A form nobody is told about is a form that does not work. The row in D1 is the
 * record; this is the only thing that makes it a TOOL rather than a filing cabinet
 * somebody has to remember to open. It is also the first mail Goblin sends that
 * carries content Goblin did not write and did not check, which is why the
 * template says so.
 *
 * ── What the mail is honest about ────────────────────────────────────────────
 * It names the app, the form, the time and the fields, and then says plainly what
 * it is NOT: nothing here has been checked, verified or scanned. Phase 3's
 * pre-publish scan reads the ARTIFACT at publish time; what a stranger types
 * afterwards is read by nothing at all (carry-forward A7). An owner who believes
 * Goblin vetted an incoming message would trust a link in it. So the mail says the
 * opposite, in one sentence, every time.
 *
 * ── The content is in the mail, and that is a decision ───────────────────────
 * The alternative — "you have a new submission, log in to read it" — is safer in
 * one narrow sense and worse in every other: it is what makes a contact form
 * useless on a phone, and it trains people to click through to a login from an
 * e-mail, which is the exact shape of a phishing mail. The owner is the controller
 * of this data and it is being sent to the address they signed up with. It goes in
 * the mail, HTML-escaped, and the owner can turn the whole thing off per app.
 *
 * ── BURST PROTECTION, and its honest limit ───────────────────────────────────
 * Past NOTIFY_BURST_THRESHOLD mails in an hour for one app, individual sends stop
 * and ONE notice goes out saying so. Nothing is lost: every submission is in the
 * inbox either way, and the notice says where to look. The counter is IN-PROCESS,
 * so with several Railway instances the effective threshold is (instances × N) —
 * the same honest caveat as the ingest rate limiter, and for the same reason. It
 * is a courtesy brake on a mailbox, not a quota.
 *
 * Cost: docs/GOBLIN_CONSUMPTION_LEDGER.md → M-F3 (Resend volume).
 */

import { sendEmail } from '../lib/email';
import { getSupabaseAdmin } from '../lib/supabase';
import { notificationsEnabled } from './ops-d1';
import { appUrl } from './ops-app-names';
import { opsAppsDomain } from './cf-deploy';
import type { OpsApp } from './ops-apps-store';
import logger from '../lib/logger';

/** Individual mails per app per hour before the digest notice takes over. */
export const NOTIFY_BURST_THRESHOLD = 10;
const BURST_WINDOW_MS = 60 * 60 * 1000;

const sentInWindow = new Map<string, number[]>();

/** Test seam — the window is process-global by design. */
export function __resetNotifyWindowForTest(): void {
  sentInWindow.clear();
}

type BurstState = 'send' | 'first_over' | 'suppressed';

function burstState(appId: string, now: number): BurstState {
  const seen = (sentInWindow.get(appId) ?? []).filter((t) => now - t < BURST_WINDOW_MS);
  seen.push(now);
  sentInWindow.set(appId, seen);
  if (seen.length <= NOTIFY_BURST_THRESHOLD) return 'send';
  // Exactly one notice per window, on the first submission past the threshold.
  return seen.length === NOTIFY_BURST_THRESHOLD + 1 ? 'first_over' : 'suppressed';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Berlin-readable, and it says which zone it is rather than implying one. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 10)}, ${d.toISOString().slice(11, 16)} UTC`;
}

/**
 * The owner's e-mail address.
 *
 * `null` when it cannot be established — which is REPORTED rather than swallowed,
 * because "we could not tell anyone" is a different fact from "nobody wanted to be
 * told", and only one of them is a defect.
 */
async function ownerEmail(userId: string): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin().from('users').select('email').eq('id', userId).single();
  if (error || !data?.email) {
    logger.warn({ userId, reason: error?.message }, 'ops_form_owner_email_unavailable');
    return null;
  }
  return String(data.email);
}

const SHELL = (title: string, inner: string, footer: string) => `<!doctype html>
<html lang="de"><body style="margin:0;padding:24px;background:#F4ECD8;font-family:-apple-system,'Segoe UI',sans-serif;color:#0F2B1E;">
  <div style="max-width:34rem;margin:0 auto;background:#FBF7EC;border:1px solid rgba(15,43,30,.12);border-radius:14px;padding:28px 24px;">
    <h1 style="margin:0 0 14px;font-size:1.25rem;font-weight:600;color:#1A3A2A;">${escapeHtml(title)}</h1>
    ${inner}
    <p style="margin:22px 0 0;padding-top:16px;border-top:1px solid rgba(15,43,30,.12);font-size:.8125rem;color:#5E8973;">${footer}</p>
  </div>
</body></html>`;

export interface NotifyResult {
  /** Did a mail go out? */
  sent: boolean;
  /** Why not, when not — an honest reason, never a silent false. */
  why?: 'opted_out' | 'no_owner_email' | 'burst_suppressed' | 'send_failed';
}

export interface NotifyDeps {
  send: typeof sendEmail;
  owner: (userId: string) => Promise<string | null>;
  enabled: (databaseId: string) => Promise<boolean>;
  appsDomain: () => string;
}

export const defaultNotifyDeps: NotifyDeps = {
  send: sendEmail,
  owner: ownerEmail,
  enabled: (databaseId) => notificationsEnabled(databaseId),
  appsDomain: opsAppsDomain,
};

/**
 * One submission arrived — tell the owner.
 *
 * Never throws and never blocks the visitor's response: the ingest route answers
 * the visitor the moment the row is stored, and this runs after. A mail that fails
 * is a mail that fails; the submission is already safe and visible in the inbox,
 * and pretending otherwise to the visitor would be the worse lie.
 */
export async function notifyOwnerOfSubmission(
  app: OpsApp,
  submission: { formId: string; createdAt: string; fields: Record<string, string> },
  deps: NotifyDeps = defaultNotifyDeps,
  now: number = Date.now(),
): Promise<NotifyResult> {
  if (!app.d1DatabaseId) return { sent: false, why: 'opted_out' };
  if (!(await deps.enabled(app.d1DatabaseId))) return { sent: false, why: 'opted_out' };

  const to = await deps.owner(app.userId);
  if (!to) return { sent: false, why: 'no_owner_email' };

  const url = appUrl(app.appName, deps.appsDomain());
  const inbox = `${(process.env.NEXT_PUBLIC_APP_URL ?? 'https://justgoblin.com').replace(/\/$/, '')}/dashboard`;
  const state = burstState(app.appId, now);

  if (state === 'suppressed') return { sent: false, why: 'burst_suppressed' };

  if (state === 'first_over') {
    const html = SHELL(
      'Es kommen gerade viele Einsendungen',
      `<p style="margin:0 0 12px;">Bei <strong>${escapeHtml(app.appName)}</strong> sind in der letzten Stunde mehr als `
      + `${NOTIFY_BURST_THRESHOLD} Einsendungen eingegangen.</p>`
      + '<p style="margin:0 0 12px;">Wir schicken dir für die nächste Stunde keine einzelnen E-Mails mehr, damit dein '
      + 'Postfach nicht zuläuft. <strong>Es geht dabei nichts verloren</strong> — jede Einsendung liegt in deinem '
      + 'Posteingang bei Goblin.</p>'
      + `<p style="margin:0;"><a href="${escapeHtml(inbox)}" style="color:#1A3A2A;">Posteingang öffnen</a></p>`,
      'Wenn das nicht nach echten Anfragen aussieht: Du kannst die Benachrichtigungen für diese App abschalten, '
      + 'und wir schauen uns das an, wenn du dich meldest.',
    );
    const res = await deps.send({ to, subject: `Viele Einsendungen bei ${app.appName}`, html });
    return res.ok ? { sent: true } : { sent: false, why: 'send_failed' };
  }

  const rows = Object.entries(submission.fields)
    .map(
      ([key, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;color:#5E8973;font-size:.875rem;white-space:nowrap;">`
        + `${escapeHtml(key)}</td><td style="padding:6px 0;white-space:pre-wrap;">${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  const html = SHELL(
    'Eine neue Einsendung',
    `<p style="margin:0 0 4px;">Über das Formular <strong>${escapeHtml(submission.formId)}</strong> auf `
    + `<a href="${escapeHtml(url)}" style="color:#1A3A2A;">${escapeHtml(app.appName)}</a>.</p>`
    + `<p style="margin:0 0 18px;color:#5E8973;font-size:.875rem;">Eingegangen am ${escapeHtml(formatWhen(submission.createdAt))}</p>`
    + `<table style="width:100%;border-collapse:collapse;font-size:.9375rem;">${rows}</table>`
    + `<p style="margin:20px 0 0;"><a href="${escapeHtml(inbox)}" style="color:#1A3A2A;">Im Posteingang ansehen</a></p>`,
    // The sentence that keeps this mail honest. It is here on EVERY send, not once
    // in an onboarding e-mail nobody re-reads.
    'Diese Nachricht hat jemand in dein Formular geschrieben. Goblin hat den Inhalt nicht geprüft und weiß nicht, '
    + 'ob die Angaben stimmen — behandle Links und Anhänge darin so vorsichtig wie jede fremde Nachricht. '
    + 'Du kannst diese Benachrichtigungen für diese App abschalten.',
  );

  const res = await deps.send({ to, subject: `Neue Einsendung — ${app.appName}`, html });
  if (!res.ok) {
    logger.warn({ appId: app.appId }, 'ops_form_notify_failed');
    return { sent: false, why: 'send_failed' };
  }
  return { sent: true };
}

/**
 * The form is full — tell the owner, because the visitor was turned away.
 *
 * P4-b's other half. A refusal the owner never hears about is the same silent
 * failure as a dropped submission from where they are standing: people stopped
 * getting through and nobody said so. This mail is deliberately NOT subject to the
 * per-submission opt-out — "do not mail me every message" is a different wish from
 * "do not tell me my form has stopped accepting messages" — but it IS subject to
 * the burst window, so a flood against a full form does not produce a flood of
 * these.
 */
export async function notifyOwnerOverCap(
  app: OpsApp,
  facts: { cap: number; month: string },
  deps: NotifyDeps = defaultNotifyDeps,
  now: number = Date.now(),
): Promise<NotifyResult> {
  const to = await deps.owner(app.userId);
  if (!to) return { sent: false, why: 'no_owner_email' };
  if (burstState(`over-cap:${app.appId}`, now) !== 'send') return { sent: false, why: 'burst_suppressed' };

  const url = appUrl(app.appName, deps.appsDomain());
  const html = SHELL(
    'Dein Formular nimmt gerade nichts mehr an',
    `<p style="margin:0 0 12px;">Das Formular auf <a href="${escapeHtml(url)}" style="color:#1A3A2A;">`
    + `${escapeHtml(app.appName)}</a> hat in diesem Monat (${escapeHtml(facts.month)}) die Obergrenze von `
    + `${facts.cap} Einsendungen erreicht.</p>`
    + '<p style="margin:0 0 12px;"><strong>Wer jetzt etwas abschickt, bekommt eine ehrliche Absage</strong> — '
    + 'die Nachricht kommt nicht bei dir an und wird auch nicht heimlich weggeworfen. Wir sagen den Leuten, '
    + 'dass sie nicht durchgekommen sind, und dass du Bescheid weißt.</p>'
    + '<p style="margin:0;">Wenn dein Formular mehr braucht: melde dich, dann heben wir die Grenze für deine App an.</p>',
    'Die Obergrenze ist eine Beta-Zahl und keine Preisstufe. Sie steht dort, damit ein einzelnes Formular nicht '
    + 'unbemerkt sehr viel fremde Daten sammelt — nicht, um dir etwas zu verkaufen.',
  );

  const res = await deps.send({ to, subject: `Formular voll — ${app.appName}`, html });
  return res.ok ? { sent: true } : { sent: false, why: 'send_failed' };
}
