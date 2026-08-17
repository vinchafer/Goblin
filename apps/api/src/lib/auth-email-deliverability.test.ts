// DELIVERABILITY GATE (2026-08-17) — the content-layer properties that decided
// junk-vs-inbox for a real invitee's confirmation mail.
//
// These are guards, not decoration: each one pins a signal a spam filter can
// score WITHOUT knowing anything about our domain reputation. If a future edit
// re-introduces an HTML-only body or a wall of repeated links, this suite is
// what says so — instead of a friend's junk folder saying it three weeks later.
//
// What these tests deliberately do NOT claim: that a mail reaches the inbox.
// Authentication, alignment and reputation live in DNS and at Resend. See
// docs/WAVE_MAIL_LANDING_AUDIT.md for the per-layer verdict.

import { describe, it, expect } from 'vitest';
import { renderAuthEmail, buildConfirmUrl, type AuthEmailType } from './auth-email-templates';

const TYPES: AuthEmailType[] = ['recovery', 'signup', 'email_change', 'magiclink', 'invite'];
const EMAIL = 'vinc.hafner3@gmail.com';

function render(type: AuthEmailType) {
  return renderAuthEmail(type, {
    email: EMAIL,
    actionUrl: buildConfirmUrl({ origin: 'https://www.justgoblin.com', tokenHash: 'h', type }),
  });
}

/** Visible words in the HTML body, tags and style attributes removed. */
function visibleWordCount(html: string): number {
  const body = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
  return body.split(/\s+/).filter(Boolean).length;
}

describe('auth mail — multipart', () => {
  for (const type of TYPES) {
    it(`${type} ships a plain-text alternative part`, () => {
      const { text } = render(type);
      expect(text.length).toBeGreaterThan(200);
      // A text part that is really stripped HTML is worse than none — a filter
      // comparing the two parts scores the mismatch.
      expect(text).not.toMatch(/<[a-z/][^>]*>/i);
      // It must carry the one thing the mail exists for.
      expect(text).toContain('/auth/confirm?token_hash=h');
      // ... and the address it is about, unescaped.
      expect(text).toContain(EMAIL);
    });

    it(`${type} text part says the same thing as the HTML part`, () => {
      const { html, text } = render(type);
      // Both halves of the bilingual body are present in both parts.
      expect(text).toContain('Goblin-Konto');
      expect(text).toMatch(/Goblin account/);
      // No invented validity duration leaked into the text part either.
      expect(text).not.toMatch(/\b\d+\s*(Minuten|Stunden|minutes|hours)\b/i);
      expect(html).not.toMatch(/\b\d+\s*(Minuten|Stunden|minutes|hours)\b/i);
    });
  }
});

describe('auth mail — link density', () => {
  for (const type of TYPES) {
    it(`${type} keeps the action URL to three anchors and the footer to two`, () => {
      const { html } = render(type);
      const anchors = html.match(/<a\s/g) ?? [];
      // 2 CTA buttons (DE + EN) + 1 shared raw-URL fallback + imprint + privacy.
      expect(anchors.length).toBe(5);

      const confirmAnchors = html.match(/<a href="[^"]*\/auth\/confirm/g) ?? [];
      expect(confirmAnchors.length).toBe(3);

      // The raw URL is printed ONCE as visible text, not once per language.
      const rawVisible = html.match(/>https:\/\/[^<]*\/auth\/confirm[^<]*<\/a>/g) ?? [];
      expect(rawVisible.length).toBe(1);
    });

    it(`${type} has more prose than links`, () => {
      const { html } = render(type);
      const anchors = (html.match(/<a\s/g) ?? []).length;
      // A generous floor: ~40 visible words per anchor. The mails run well above
      // it; the guard exists to catch a future "just add one more link".
      expect(visibleWordCount(html) / anchors).toBeGreaterThan(40);
    });
  }
});

describe('auth mail — subject', () => {
  it('names the sender before the ask, in both languages', () => {
    for (const type of TYPES) {
      const { subject } = render(type);
      expect(subject.startsWith('Goblin — ')).toBe(true);
      expect(subject).toContain('·');
      // Fits a phone subject column without the German half swallowing the English.
      expect(subject.length).toBeLessThanOrEqual(60);
    }
  });

  it('the signup subject is the exact one a new user meets at the door', () => {
    expect(render('signup').subject).toBe('Goblin — E-Mail bestätigen · Confirm your email');
  });
});

describe('auth mail — no filter bait', () => {
  for (const type of TYPES) {
    it(`${type} carries no image, pixel or remote asset of any kind`, () => {
      const { html } = render(type);
      expect(html).not.toMatch(/<img\b/i);
      expect(html).not.toMatch(/background-image/i);
      // Every href is either our own origin or the confirm link.
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) expect(href.startsWith('https://')).toBe(true);
      for (const href of hrefs) expect(href).toContain('justgoblin.com');
    });
  }
});
