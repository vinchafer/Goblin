// WAVE-J (J3) GATE: feedback privacy + email builders.
// The sanitizeContext assertions are the privacy gate — they prove the auto-context
// can carry ONLY the allow-listed scalar metadata, so a client can never smuggle
// chat/file content through the feedback context payload.

import { describe, it, expect, afterEach } from 'vitest';
import { sanitizeContext, buildFeedbackEmail, buildFeedbackDigest, sendFeedbackDigest, feedbackRecipient } from './feedback';

describe('sanitizeContext — metadata only (content-free)', () => {
  it('keeps only the allow-listed scalar keys', () => {
    const out = sanitizeContext({ page: '/dashboard/project/42', project_id: 'p_42', last_error: 'Deploy 404' });
    expect(out).toEqual({ page: '/dashboard/project/42', project_id: 'p_42', last_error: 'Deploy 404' });
  });

  it('DROPS any non-allow-listed key (e.g. a smuggled message body)', () => {
    const out = sanitizeContext({
      page: '/x',
      message: 'the full chat message the user typed',
      file_contents: 'const secret = 1',
      code: '<html>…</html>',
    });
    expect(out).toEqual({ page: '/x' });
    expect(Object.keys(out)).not.toContain('message');
    expect(Object.keys(out)).not.toContain('file_contents');
    expect(Object.keys(out)).not.toContain('code');
  });

  it('rejects nested objects/arrays even on allow-listed keys', () => {
    const out = sanitizeContext({ page: { nested: 'x' }, project_id: ['a', 'b'], last_error: 'ok' });
    expect(out).toEqual({ last_error: 'ok' });
  });

  it('bounds value length and coerces scalars; ignores non-objects', () => {
    const out = sanitizeContext({ last_error: 'y'.repeat(1000), project_id: 42 });
    expect(out.last_error!.length).toBe(300);
    expect(out.project_id).toBe('42');
    expect(sanitizeContext(null)).toEqual({});
    expect(sanitizeContext('a string')).toEqual({});
  });
});

describe('email builders', () => {
  it('immediate bug email carries category, body, and metadata context', () => {
    const { subject, html } = buildFeedbackEmail({
      userId: 'u1', userEmail: 'u@x.com', category: 'bug',
      body: 'Der Live-Knopf hängt', context: { page: '/p', last_error: '500' }, surface: 'code',
    });
    expect(subject).toContain('Fehler');
    expect(html).toContain('Der Live-Knopf hängt');
    expect(html).toContain('/p');
    expect(html).toContain('code');
  });

  it('escapes HTML in the user body (no injection)', () => {
    const { html } = buildFeedbackEmail({
      userId: 'u', userEmail: '', category: 'idea', body: '<script>alert(1)</script>', context: {},
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('digest groups ideas and other with counts', () => {
    const { subject, html } = buildFeedbackDigest([
      { category: 'idea', body: 'Dark mode toggle', created_at: '2026-07-10T09:00:00Z' },
      { category: 'other', body: 'Danke!', surface: 'help', created_at: '2026-07-10T08:00:00Z' },
    ]);
    expect(subject).toContain('1 Idee');
    expect(html).toContain('Dark mode toggle');
    expect(html).toContain('Danke!');
  });
});

describe('digest gating', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('is a silent no-op unless explicitly opted in', async () => {
    delete process.env.GOBLIN_FEEDBACK_DIGEST;
    expect(await sendFeedbackDigest()).toEqual({ sent: false, reason: 'disabled' });
  });

  it('needs a valid recipient even when enabled', async () => {
    process.env.GOBLIN_FEEDBACK_DIGEST = 'true';
    delete process.env.FEEDBACK_EMAIL; delete process.env.FOUNDER_DIGEST_EMAIL; delete process.env.ADMIN_EMAIL;
    expect(await sendFeedbackDigest()).toEqual({ sent: false, reason: 'no_recipient' });
  });

  it('feedbackRecipient reads the founder envs', () => {
    delete process.env.FEEDBACK_EMAIL; delete process.env.FOUNDER_DIGEST_EMAIL;
    process.env.ADMIN_EMAIL = 'founder@x.com';
    expect(feedbackRecipient()).toBe('founder@x.com');
    process.env.ADMIN_EMAIL = 'not-an-email';
    expect(feedbackRecipient()).toBeNull();
  });
});
