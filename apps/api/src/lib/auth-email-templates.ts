/**
 * Auth email templates — DE + EN in one mail, rendered by OUR code.
 *
 * Why these live here and not in the Supabase dashboard (U3): the Supabase
 * defaults are a bare line of text plus a naked link, which is the textbook
 * phishing signature — that is why the founder's auth mails land in spam even
 * with DKIM and SPF green. Templates in the repo are versioned, reviewable and
 * testable; the Send-Email auth hook (routes/auth-email-hook.ts) routes every
 * auth mail through them and out via the existing hardened Resend service.
 *
 * Honesty invariants that bind every string here:
 *  - No validity DURATION is stated. The hook payload carries no expiry, so a
 *    concrete "valid for 60 minutes" would be an invented time claim. We say
 *    the link is limited and single-use, which is true of every Supabase OTP.
 *  - Nothing claims an action that has not happened. The mail is sent only in
 *    response to a real request, so "a reset was requested" is truthful; we
 *    never say the password HAS changed.
 *  - No tracking pixel, no redirect wrapper, no open/click beacon.
 *
 * ── DELIVERABILITY PASS (2026-08-17, after a real invitee's confirmation mail
 *    landed in JUNK) ─────────────────────────────────────────────────────────
 * Four content-side changes, each one a signal a filter can score without
 * knowing anything about our reputation:
 *
 *  1. A PLAIN-TEXT alternative part (`renderAuthEmail().text`). HTML-only mail is
 *     the single strongest purely-structural spam signal we were still sending;
 *     every mainstream filter scores it (SpamAssassin: MIME_HTML_ONLY).
 *  2. ONE raw link, not two. The mail carries both languages, and each half used
 *     to repeat the button URL as a visible fallback anchor — four anchors on the
 *     same URL plus three footer links. The fallback URL is now printed once,
 *     shared by both languages, and the bare-domain footer link is gone: five
 *     anchors over three distinct URLs, with the same text around them.
 *  3. Brand-first subjects. "Bestätige deine E-Mail-Adresse" from an unknown
 *     domain is indistinguishable from a phishing subject; "Goblin — E-Mail
 *     bestätigen · Confirm your email" names the sender before the ask and fits
 *     a phone's subject column.
 *  4. The copy says "Link", not "Button", so the HTML and the text part can share
 *     one sentence and neither describes something the reader cannot see.
 *
 * What this file CANNOT fix, stated so nobody reads the above as a delivery
 * guarantee: domain reputation, SPF/DKIM/DMARC alignment and sending volume all
 * live in DNS and in Resend, not here. See docs/WAVE_MAIL_LANDING_AUDIT.md.
 */

export type AuthEmailType = 'recovery' | 'signup' | 'email_change' | 'magiclink' | 'invite';

const BRAND_GREEN = '#1A3A2A';
const BRAND_GOLD = '#D4A737';
const PAPER = '#FBF7EC';
const INK = '#1B2A22';
const META = '#5F6F65';
const RULE = '#DFD8C6';

/** Same convention as the rest of the API (see routes/chat-sessions.ts). */
export function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://justgoblin.com';
}

/** Minimal HTML-attribute/-text escape. URLs here are built by us, but the
 *  email address comes from the hook payload and is rendered into the body. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Copy {
  subject: string;
  /** Preheader — the inbox preview line. Real content, not filler. */
  preheader: string;
  heading: string;
  /** Why this mail exists, naming the account it concerns. */
  context: string;
  cta: string;
  /** What happens if the recipient did not ask for this. */
  ignore: string;
  fallback: string;
}

interface Pair { de: Copy; en: Copy }

function copyFor(type: AuthEmailType, email: string): Pair {
  const e = esc(email);
  switch (type) {
    case 'recovery':
      return {
        de: {
          subject: 'Passwort zurücksetzen',
          preheader: `Passwort-Reset für ${email} — bestätige über den Link.`,
          heading: 'Neues Passwort setzen',
          context: `Du erhältst diese E-Mail, weil für dein Goblin-Konto (${e}) ein Passwort-Reset angefordert wurde. Über den Link unten kommst du zu einer Seite, auf der du ein neues Passwort vergibst. Der Link ist nur begrenzt gültig und lässt sich nur einmal verwenden.`,
          cta: 'Neues Passwort setzen →',
          ignore: 'Wenn du das nicht angefordert hast, ignoriere diese E-Mail. Dein Passwort bleibt dann unverändert, und niemand erhält Zugriff auf dein Konto.',
          fallback: 'Wenn der Button nicht funktioniert, kopiere diese Adresse in deinen Browser:',
        },
        en: {
          subject: 'Reset your password',
          preheader: `Password reset for ${email} — confirm with the link.`,
          heading: 'Set a new password',
          context: `You are receiving this email because a password reset was requested for your Goblin account (${e}). The link below takes you to a page where you choose a new password. The link is valid for a limited time and can only be used once.`,
          cta: 'Set a new password →',
          ignore: 'If you did not request this, ignore this email. Your password stays unchanged and nobody gains access to your account.',
          fallback: 'If the button does not work, copy this address into your browser:',
        },
      };
    case 'signup':
      return {
        de: {
          subject: 'E-Mail bestätigen',
          preheader: `Bestätige ${email}, um dein Goblin-Konto zu aktivieren.`,
          heading: 'E-Mail-Adresse bestätigen',
          context: `Du erhältst diese E-Mail, weil mit dieser Adresse (${e}) ein Goblin-Konto angelegt wurde. Bestätige über den Link unten, dass die Adresse dir gehört — danach kannst du dich anmelden. Der Link ist nur begrenzt gültig und lässt sich nur einmal verwenden.`,
          cta: 'E-Mail bestätigen →',
          ignore: 'Wenn du kein Konto angelegt hast, ignoriere diese E-Mail. Ohne Bestätigung wird das Konto nicht aktiv.',
          fallback: 'Wenn der Button nicht funktioniert, kopiere diese Adresse in deinen Browser:',
        },
        en: {
          subject: 'Confirm your email',
          preheader: `Confirm ${email} to activate your Goblin account.`,
          heading: 'Confirm your email address',
          context: `You are receiving this email because a Goblin account was created with this address (${e}). Confirm with the link below that the address is yours — then you can sign in. The link is valid for a limited time and can only be used once.`,
          cta: 'Confirm email →',
          ignore: 'If you did not create an account, ignore this email. Without confirmation the account does not become active.',
          fallback: 'If the button does not work, copy this address into your browser:',
        },
      };
    case 'email_change':
      return {
        de: {
          subject: 'Neue Adresse bestätigen',
          preheader: `Bestätige ${email} als neue Adresse deines Goblin-Kontos.`,
          heading: 'Adressänderung bestätigen',
          context: `Du erhältst diese E-Mail, weil für dein Goblin-Konto eine Änderung der E-Mail-Adresse auf ${e} angefordert wurde. Bestätige über den Link unten, dass die neue Adresse dir gehört. Der Link ist nur begrenzt gültig und lässt sich nur einmal verwenden.`,
          cta: 'Neue Adresse bestätigen →',
          ignore: 'Wenn du das nicht angefordert hast, ignoriere diese E-Mail. Die Adresse deines Kontos bleibt dann unverändert.',
          fallback: 'Wenn der Button nicht funktioniert, kopiere diese Adresse in deinen Browser:',
        },
        en: {
          subject: 'Confirm your new address',
          preheader: `Confirm ${email} as the new address of your Goblin account.`,
          heading: 'Confirm the address change',
          context: `You are receiving this email because a change of email address to ${e} was requested for your Goblin account. Confirm with the link below that the new address is yours. The link is valid for a limited time and can only be used once.`,
          cta: 'Confirm new address →',
          ignore: 'If you did not request this, ignore this email. Your account address stays unchanged.',
          fallback: 'If the button does not work, copy this address into your browser:',
        },
      };
    case 'invite':
      return {
        de: {
          subject: 'Deine Einladung',
          preheader: `Einladung für ${email} — Konto über den Link einrichten.`,
          heading: 'Einladung annehmen',
          context: `Du erhältst diese E-Mail, weil diese Adresse (${e}) zu Goblin eingeladen wurde. Über den Link unten richtest du dein Konto ein. Der Link ist nur begrenzt gültig und lässt sich nur einmal verwenden.`,
          cta: 'Einladung annehmen →',
          ignore: 'Wenn du damit nichts anfangen kannst, ignoriere diese E-Mail. Es wird kein Konto für dich aktiv.',
          fallback: 'Wenn der Button nicht funktioniert, kopiere diese Adresse in deinen Browser:',
        },
        en: {
          subject: 'Your invitation',
          preheader: `Invitation for ${email} — set up your account with the button.`,
          heading: 'Accept your invitation',
          context: `You are receiving this email because this address (${e}) was invited to Goblin. The link below sets up your account. The link is valid for a limited time and can only be used once.`,
          cta: 'Accept invitation →',
          ignore: 'If this means nothing to you, ignore this email. No account becomes active for you.',
          fallback: 'If the button does not work, copy this address into your browser:',
        },
      };
    case 'magiclink':
    default:
      return {
        de: {
          subject: 'Dein Anmeldelink',
          preheader: `Anmeldelink für ${email} — nur einmal verwendbar.`,
          heading: 'Bei Goblin anmelden',
          context: `Du erhältst diese E-Mail, weil für dein Goblin-Konto (${e}) ein Anmeldelink angefordert wurde. Über den Link unten meldest du dich an. Der Link ist nur begrenzt gültig und lässt sich nur einmal verwenden.`,
          cta: 'Anmelden →',
          ignore: 'Wenn du das nicht angefordert hast, ignoriere diese E-Mail. Ohne diesen Link wird niemand angemeldet.',
          fallback: 'Wenn der Button nicht funktioniert, kopiere diese Adresse in deinen Browser:',
        },
        en: {
          subject: 'Your sign-in link',
          preheader: `Sign-in link for ${email} — single use.`,
          heading: 'Sign in to Goblin',
          context: `You are receiving this email because a sign-in link was requested for your Goblin account (${e}). The link below signs you in. The link is valid for a limited time and can only be used once.`,
          cta: 'Sign in →',
          ignore: 'If you did not request this, ignore this email. Without this link nobody gets signed in.',
          fallback: 'If the button does not work, copy this address into your browser:',
        },
      };
  }
}

function block(c: Copy, actionUrl: string, isSecondary: boolean): string {
  const url = esc(actionUrl);
  return `
      <tr><td style="padding:${isSecondary ? '28' : '0'}px 0 0">
        <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:${isSecondary ? '20' : '24'}px;line-height:1.25;font-weight:400;color:${INK}">${c.heading}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:${INK}">${c.context}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px">
          <tr><td style="border-radius:10px;background:${BRAND_GREEN}">
            <a href="${url}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:600;color:${BRAND_GOLD};text-decoration:none;border-radius:10px">${c.cta}</a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:13px;line-height:1.65;color:${META}">${c.ignore}</p>
      </td></tr>`;
}

/**
 * The raw URL, printed ONCE for both languages. It used to appear inside each
 * language block, which meant the same address was an anchor four times in a
 * mail of ~230 words — the link density a filter reads as a link farm, and the
 * repetition a reader reads as clutter.
 */
function sharedLinkBlock(de: Copy, en: Copy, actionUrl: string): string {
  const url = esc(actionUrl);
  return `
      <tr><td style="padding:26px 0 0">
        <div style="height:1px;background:${RULE};margin:0 0 18px"></div>
        <p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:${META}">${de.fallback}</p>
        <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:${META}">${en.fallback}</p>
        <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all"><a href="${url}" style="color:${BRAND_GREEN}">${url}</a></p>
      </td></tr>`;
}

export interface RenderedAuthEmail {
  subject: string;
  html: string;
  /** The plain-text alternative part — see the deliverability note up top. */
  text: string;
}

/**
 * The plain-text alternative. Hand-written rather than stripped from the HTML:
 * a tag-stripped body reads like debris, and a filter comparing the two parts
 * scores a mismatch. Same sentences, same single URL, same footer facts.
 */
function renderText(
  de: Copy,
  en: Copy,
  opts: { email: string; actionUrl: string },
  origin: string,
): string {
  // The copy carries the address already HTML-escaped (it is rendered into an
  // HTML body); the text part must show the address as the user typed it.
  const plain = (s: string) => s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

  return [
    'GOBLIN',
    '',
    de.heading.toUpperCase(),
    plain(de.context),
    '',
    plain(de.ignore),
    '',
    '—',
    '',
    en.heading.toUpperCase(),
    plain(en.context),
    '',
    plain(en.ignore),
    '',
    '—',
    '',
    'Link:',
    opts.actionUrl,
    '',
    '—',
    '',
    `Diese E-Mail wurde an ${opts.email} gesendet, weil diese Adresse zu einem Goblin-Konto gehört oder für eines verwendet wurde. Wir versenden an diese Adresse keine Werbung.`,
    `This email was sent to ${opts.email} because the address belongs to, or was used for, a Goblin account. We do not send marketing to this address.`,
    '',
    `Impressum / Imprint: ${origin}/imprint`,
    `Datenschutz / Privacy: ${origin}/privacy`,
    '',
  ].join('\n');
}

/**
 * Render an auth email. DE first, EN below the rule — one mail, both languages,
 * because the hook payload carries no language preference and guessing one
 * would risk sending a German security mail to an English-speaking user.
 */
export function renderAuthEmail(
  type: AuthEmailType,
  opts: { email: string; actionUrl: string },
): RenderedAuthEmail {
  const { de, en } = copyFor(type, opts.email);
  const preheader = `${de.preheader} · ${en.preheader}`;
  const origin = esc(siteOrigin());

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(de.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER}">
    <tr><td align="center" style="padding:28px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#FFFFFF;border:1px solid ${RULE};border-radius:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
        <tr><td style="padding:22px 28px;background:${BRAND_GREEN};border-radius:13px 13px 0 0">
          <span style="font-size:19px;font-weight:700;letter-spacing:-0.02em;color:${BRAND_GOLD}">Goblin</span>
        </td></tr>
        <tr><td style="padding:28px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${block(de, opts.actionUrl, false)}
            <tr><td style="padding:26px 0 0"><div style="height:1px;background:${RULE}"></div></td></tr>
            ${block(en, opts.actionUrl, true)}
            ${sharedLinkBlock(de, en, opts.actionUrl)}
          </table>
        </td></tr>
        <tr><td style="padding:20px 28px 26px;border-top:1px solid ${RULE}">
          <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:${META}">
            Diese E-Mail wurde an ${esc(opts.email)} gesendet, weil diese Adresse zu einem Goblin-Konto gehört oder für eines verwendet wurde. Wir versenden an diese Adresse keine Werbung.<br>
            This email was sent to ${esc(opts.email)} because the address belongs to, or was used for, a Goblin account. We do not send marketing to this address.
          </p>
          <p style="margin:0;font-size:12px;line-height:1.6;color:${META}">
            <a href="${origin}/imprint" style="color:${BRAND_GREEN};text-decoration:none">Impressum / Imprint</a>
            &nbsp;·&nbsp;
            <a href="${origin}/privacy" style="color:${BRAND_GREEN};text-decoration:none">Datenschutz / Privacy</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // Brand first: the recipient must be able to tell WHO is asking before they
  // read WHAT is being asked. An unbranded "Confirm your email address" from an
  // unknown domain is the exact shape of a phishing subject.
  return {
    subject: `Goblin — ${de.subject} · ${en.subject}`,
    html,
    text: renderText(de, en, opts, siteOrigin()),
  };
}

/**
 * The URL the mail's button points at. NOT the Supabase verify endpoint and
 * NOT a link that redeems on GET: it lands on our interstitial, where the user
 * must click once more before the one-time token is spent (U2). That is what
 * makes a mail-scanner's preflight GET harmless.
 */
export function buildConfirmUrl(opts: {
  origin: string;
  tokenHash: string;
  type: AuthEmailType;
  next?: string;
}): string {
  const url = new URL('/auth/confirm', opts.origin);
  url.searchParams.set('token_hash', opts.tokenHash);
  url.searchParams.set('type', opts.type);
  // Only same-origin relative paths are ever forwarded — an absolute or
  // protocol-relative `next` from the payload would be an open redirect.
  if (opts.next && /^\/(?!\/)/.test(opts.next)) url.searchParams.set('next', opts.next);
  return url.toString();
}
