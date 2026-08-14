/**
 * AKT 2 · PHASE 4 · U4.5 — the owner notification.
 *
 * The properties worth holding:
 *   • the mail carries the content, escaped, and the ONE honest sentence about
 *     what Goblin did NOT check — on every send, not once in an onboarding mail
 *   • the opt-out is respected, and a failed opt-out read errs towards sending
 *   • a burst produces one notice, not a flood, and says nothing is lost
 *   • the over-cap mail is NOT silenced by the per-submission opt-out, because
 *     "stop mailing me every message" is a different wish from "do not tell me my
 *     form has stopped working"
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OpsApp } from './ops-apps-store';

const {
  notifyOwnerOfSubmission,
  notifyOwnerOverCap,
  __resetNotifyWindowForTest,
  NOTIFY_BURST_THRESHOLD,
} = await import('./ops-form-notify');

const APP: OpsApp = {
  appId: 'app-1', userId: 'user-1', projectId: 'proj-1', appName: 'meinladen', status: 'active',
  capsProfile: 'free-static', r2Prefix: 'apps/app-1/', routeKey: 'route:meinladen',
  workerScriptName: null, d1DatabaseId: 'db-1', lastPublishedAt: null, createdAt: '2026-08-01T00:00:00Z',
};

const send = vi.fn();
const owner = vi.fn();
const enabled = vi.fn();

const deps = () => ({ send, owner, enabled, appsDomain: () => 'justgoblin.app' });

const submission = {
  formId: 'kontakt',
  createdAt: '2026-08-14T09:30:00.000Z',
  fields: { name: 'Anna Müller', nachricht: 'Hallo, habt ihr am Samstag offen?' },
};

beforeEach(() => {
  vi.clearAllMocks();
  __resetNotifyWindowForTest();
  send.mockResolvedValue({ ok: true });
  owner.mockResolvedValue('besitzerin@example.com');
  enabled.mockResolvedValue(true);
});

describe('the mail itself', () => {
  it('names the app, the form, the time and the fields', async () => {
    const res = await notifyOwnerOfSubmission(APP, submission, deps());
    expect(res).toEqual({ sent: true });
    const mail = send.mock.calls[0]?.[0] as { to: string; subject: string; html: string };
    expect(mail.to).toBe('besitzerin@example.com');
    expect(mail.subject).toContain('meinladen');
    expect(mail.html).toContain('kontakt');
    expect(mail.html).toContain('Anna Müller');
    expect(mail.html).toContain('Samstag');
    expect(mail.html).toContain('2026-08-14');
  });

  it('carries the honest sentence about what Goblin did NOT check', async () => {
    await notifyOwnerOfSubmission(APP, submission, deps());
    const html = (send.mock.calls[0]?.[0] as { html: string }).html;
    expect(html).toContain('nicht geprüft');
    expect(html).toContain('vorsichtig');
  });

  it('escapes what a stranger wrote — a form is not a way to inject html into somebody’s inbox', async () => {
    await notifyOwnerOfSubmission(
      APP,
      { ...submission, fields: { nachricht: '<img src=x onerror="alert(1)">', '<b>k</b>': 'v' } },
      deps(),
    );
    const html = (send.mock.calls[0]?.[0] as { html: string }).html;
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
    expect(html).toContain('&lt;b&gt;k&lt;/b&gt;');
  });

  it('is German and plain — no marketing, no invented next step', async () => {
    await notifyOwnerOfSubmission(APP, submission, deps());
    const html = (send.mock.calls[0]?.[0] as { html: string }).html;
    expect(html).toContain('Eine neue Einsendung');
    expect(html).not.toMatch(/upgrade|Tarif|jetzt kaufen/i);
  });
});

describe('the opt-out', () => {
  it('is respected, and nothing is sent', async () => {
    enabled.mockResolvedValue(false);
    expect(await notifyOwnerOfSubmission(APP, submission, deps())).toEqual({ sent: false, why: 'opted_out' });
    expect(send).not.toHaveBeenCalled();
  });

  it('an app with no database cannot be notified about — reported, not thrown', async () => {
    const res = await notifyOwnerOfSubmission({ ...APP, d1DatabaseId: null }, submission, deps());
    expect(res.sent).toBe(false);
  });

  it('an owner whose address cannot be established is its OWN reason, not a quiet false', async () => {
    owner.mockResolvedValue(null);
    expect(await notifyOwnerOfSubmission(APP, submission, deps())).toEqual({ sent: false, why: 'no_owner_email' });
  });

  it('a Resend failure is reported as a failure, never as sent', async () => {
    send.mockResolvedValue({ ok: false, error: 'nope' });
    expect(await notifyOwnerOfSubmission(APP, submission, deps())).toEqual({ sent: false, why: 'send_failed' });
  });
});

describe('burst protection', () => {
  it('sends individually up to the threshold, then ONE notice, then nothing', async () => {
    for (let i = 0; i < NOTIFY_BURST_THRESHOLD; i += 1) {
      expect((await notifyOwnerOfSubmission(APP, submission, deps())).sent).toBe(true);
    }
    expect(send).toHaveBeenCalledTimes(NOTIFY_BURST_THRESHOLD);

    // The one past the threshold is the notice.
    const notice = await notifyOwnerOfSubmission(APP, submission, deps());
    expect(notice.sent).toBe(true);
    const mail = send.mock.calls[NOTIFY_BURST_THRESHOLD]?.[0] as { subject: string; html: string };
    expect(mail.subject).toContain('Viele Einsendungen');
    // And it promises nothing is lost, because nothing is.
    expect(mail.html).toContain('nichts verloren');
    expect(mail.html).toContain('Posteingang');

    // Everything after is suppressed, and says so rather than claiming a send.
    for (let i = 0; i < 5; i += 1) {
      expect(await notifyOwnerOfSubmission(APP, submission, deps())).toEqual({ sent: false, why: 'burst_suppressed' });
    }
    expect(send).toHaveBeenCalledTimes(NOTIFY_BURST_THRESHOLD + 1);
  });

  it('the window is per app — a busy app does not silence a quiet one', async () => {
    const other = { ...APP, appId: 'app-2', appName: 'anderer' };
    for (let i = 0; i < NOTIFY_BURST_THRESHOLD + 3; i += 1) {
      await notifyOwnerOfSubmission(APP, submission, deps());
    }
    expect((await notifyOwnerOfSubmission(other, submission, deps())).sent).toBe(true);
  });

  it('the window expires — an hour later individual mails resume', async () => {
    const t0 = Date.UTC(2026, 7, 14, 9, 0);
    for (let i = 0; i < NOTIFY_BURST_THRESHOLD + 2; i += 1) {
      await notifyOwnerOfSubmission(APP, submission, deps(), t0);
    }
    const later = await notifyOwnerOfSubmission(APP, submission, deps(), t0 + 61 * 60 * 1000);
    expect(later).toEqual({ sent: true });
  });
});

describe('the over-cap mail (P4-b’s other half)', () => {
  it('tells the owner people are being turned away, and that nothing is being discarded', async () => {
    const res = await notifyOwnerOverCap(APP, { cap: 500, month: '2026-08' }, deps());
    expect(res).toEqual({ sent: true });
    const mail = send.mock.calls[0]?.[0] as { subject: string; html: string };
    expect(mail.subject).toContain('Formular voll');
    expect(mail.html).toContain('500');
    expect(mail.html).toContain('2026-08');
    expect(mail.html).toContain('ehrliche Absage');
    expect(mail.html).toContain('nicht heimlich weggeworfen');
  });

  it('is NOT silenced by the per-submission opt-out — a broken form is not a notification preference', async () => {
    enabled.mockResolvedValue(false);
    expect((await notifyOwnerOverCap(APP, { cap: 500, month: '2026-08' }, deps())).sent).toBe(true);
    expect(enabled).not.toHaveBeenCalled();
  });

  it('does not itself become a flood — one per app per window', async () => {
    for (let i = 0; i < NOTIFY_BURST_THRESHOLD + 5; i += 1) {
      await notifyOwnerOverCap(APP, { cap: 500, month: '2026-08' }, deps());
    }
    expect(send.mock.calls.length).toBeLessThanOrEqual(NOTIFY_BURST_THRESHOLD);
  });

  it('does not read as a sales pitch — the cap is a beta number and says so', async () => {
    await notifyOwnerOverCap(APP, { cap: 500, month: '2026-08' }, deps());
    const html = (send.mock.calls[0]?.[0] as { html: string }).html;
    expect(html).toContain('keine Preisstufe');
  });
});
