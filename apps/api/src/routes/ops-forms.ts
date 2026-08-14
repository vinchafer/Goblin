/**
 * AKT 2 · PHASE 4 · U4.3 — the public ingest endpoint.
 *
 * `POST /f/:appName/:formId` — the only route in Act 2 that anybody on the
 * internet may call, and the only one that writes without a session.
 *
 * ── Why it is mounted OUTSIDE /api/ops ───────────────────────────────────────
 * `/api/ops` is behind `opsGate`, which ANDs in `OPS_HOSTING_ENABLED` and the beta
 * allowlist. A visitor filling in somebody's contact form has no Goblin account and
 * never will. Putting this behind that gate would mean either weakening the gate or
 * having no forms. It gets its OWN mount, its own switch (`OPS_FORMS_ENABLED`) and
 * its own layered refusals (services/ops-forms.ts), which is the honest shape.
 *
 * COHORT PROTECTION IS STILL TOTAL, and it comes from the data rather than from a
 * flag: this route resolves only app names that have a registry row with a
 * database, and the only way to get one is a form-enabled publish from an
 * allowlisted account. For every Act-1 user, every project and every hostname that
 * is not a published Living App with a form, this route is a 404 — the same 404 as
 * a path that does not exist.
 *
 * ── Why the appName is in the URL rather than the app id ─────────────────────
 * Because the snippet Goblin injects into the generated app must be a CONSTANT.
 * The publish path wires forms BEFORE the pre-publish scan (so what is scanned is
 * what is uploaded), and at that moment the app id does not exist yet — the
 * registry row is claimed two steps later. The hostname label, on the other hand,
 * is something the page can read off its own address. So the snippet posts to
 * `/f/${location.hostname.split('.')[0]}/…` and carries no per-app value at all.
 *
 * A rename follows automatically: the registry moves the name, the old hostname
 * becomes a 410 tombstone, and a form on the new address resolves to the same app.
 *
 * ── The response is JSON and it is for a human ───────────────────────────────
 * Every refusal carries a German (or English) sentence the injected snippet renders
 * verbatim next to the form. No status code is left to speak for itself, no
 * internal is named, and there is no branch where a submission that did not land is
 * answered with a thank-you.
 */

import { Hono } from 'hono';
import {
  ingestSubmission,
  sourceKey,
  MAX_BODY_BYTES,
  type IngestRefusalCode,
} from '../services/ops-forms';
import { opsAppsDomain } from '../services/cf-deploy';
import logger from '../lib/logger';

const opsForms = new Hono();

/** Same rule as the router Worker: DE is the default and the fallback. */
function pickLang(header: string | undefined): 'de' | 'en' {
  const first = (header ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('en') ? 'en' : 'de';
}

/**
 * Every sentence a visitor can be shown, in both languages.
 *
 * Written for somebody who has never heard of Goblin, does not know what a form
 * endpoint is, and has just lost the message they typed. Each one says what
 * happened, says whether it is worth trying again, and — where it is true — says it
 * was not their fault. None of them names a database, a status code or a rule.
 */
const MESSAGES: Record<IngestRefusalCode | 'ok', { de: string; en: string }> = {
  ok: {
    de: 'Danke — deine Nachricht ist angekommen.',
    en: 'Thank you — your message has arrived.',
  },
  forms_disabled: {
    de: 'Dieses Formular nimmt gerade nichts entgegen. Das liegt an uns, nicht an dir — bitte versuch es später noch einmal.',
    en: 'This form is not accepting anything right now. That is on us, not on you — please try again later.',
  },
  unknown_form: {
    de: 'Dieses Formular gibt es nicht. Vielleicht ist die Seite veraltet.',
    en: 'This form does not exist. The page may be out of date.',
  },
  bad_origin: {
    de: 'Diese Einsendung kam nicht von der Seite, zu der das Formular gehört. Bitte lade die Seite neu und versuch es noch einmal.',
    en: 'This submission did not come from the page the form belongs to. Please reload the page and try again.',
  },
  bad_shape: {
    de: 'Mit dieser Einsendung konnten wir nichts anfangen. Bitte lade die Seite neu und fülle das Formular noch einmal aus.',
    en: 'We could not make sense of this submission. Please reload the page and fill the form in again.',
  },
  too_large: {
    de: 'Diese Nachricht ist zu lang. Bitte kürze sie und versuch es noch einmal.',
    en: 'This message is too long. Please shorten it and try again.',
  },
  rate_limited: {
    de: 'Von hier kamen gerade sehr viele Einsendungen. Bitte warte ein paar Minuten und versuch es noch einmal.',
    en: 'A lot of submissions just came from here. Please wait a few minutes and try again.',
  },
  challenge_failed: {
    de: 'Die Sicherheitsprüfung ist nicht durchgegangen. Bitte lade die Seite neu und versuch es noch einmal.',
    en: 'The security check did not pass. Please reload the page and try again.',
  },
  challenge_unavailable: {
    de: 'Wir konnten die Sicherheitsprüfung gerade nicht durchführen und nehmen deshalb nichts entgegen. Deine Nachricht ist NICHT angekommen — bitte versuch es später noch einmal.',
    en: 'We could not run the security check just now, so we are not accepting anything. Your message has NOT arrived — please try again later.',
  },
  not_configured: {
    de: 'Dieses Formular kann im Moment nichts entgegennehmen. Das liegt an uns, nicht an dir. Deine Nachricht ist NICHT angekommen.',
    en: 'This form cannot accept anything at the moment. That is on us, not on you. Your message has NOT arrived.',
  },
  over_cap: {
    // P4-b. The first sentence Goblin ever says to a stranger to turn them away.
    // It does not blame them, does not promise a date nobody has, and does not
    // pretend the message went through.
    de: 'Dieses Formular hat für diesen Monat so viele Einsendungen bekommen, wie es annehmen kann. Deine Nachricht ist deshalb NICHT angekommen — die Betreiberin oder der Betreiber der Seite wurde darüber informiert.',
    en: 'This form has received as many submissions this month as it can accept. Your message has therefore NOT arrived — the person who runs this site has been told.',
  },
  cap_unknown: {
    de: 'Wir konnten gerade nicht feststellen, ob dieses Formular noch etwas annehmen kann, und nehmen deshalb nichts entgegen. Deine Nachricht ist NICHT angekommen — bitte versuch es später noch einmal.',
    en: 'We could not establish whether this form can still accept anything, so we are not accepting it. Your message has NOT arrived — please try again later.',
  },
  storage_failed: {
    de: 'Deine Nachricht konnte nicht gespeichert werden. Sie ist NICHT angekommen — bitte versuch es später noch einmal.',
    en: 'Your message could not be saved. It has NOT arrived — please try again later.',
  },
};

/**
 * The one origin this endpoint ever answers with.
 *
 * Never `*`: this route accepts credentials-free POSTs from exactly one hostname
 * per app, and echoing an arbitrary origin back would make every page on the
 * internet a legal caller. The shape is checked here without a database lookup so
 * a preflight costs nothing; the REAL check — that the origin belongs to the app
 * being written to — happens inside `ingestSubmission` and is the one that matters.
 */
function allowedOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  const domain = opsAppsDomain().toLowerCase();
  if (!domain) return null;
  let host: string;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') return null;
    host = url.hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host.endsWith(`.${domain}`)) return null;
  const label = host.slice(0, host.length - domain.length - 1);
  if (!label || label.includes('.')) return null;
  return `https://${host}`;
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  const allowed = allowedOrigin(origin);
  if (!allowed) return {};
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

/** Preflight. Deliberately does not touch the registry — a browser asking is not a submission. */
opsForms.options('/:appName/:formId', (c) => {
  const headers = corsHeaders(c.req.header('origin'));
  return new Response(null, { status: Object.keys(headers).length ? 204 : 403, headers });
});

opsForms.post('/:appName/:formId', async (c) => {
  const origin = c.req.header('origin');
  const lang = pickLang(c.req.header('accept-language'));
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders(origin) };

  const say = (code: IngestRefusalCode | 'ok', status: number, extra: Record<string, unknown> = {}) =>
    new Response(
      JSON.stringify({ ok: code === 'ok', ...(code === 'ok' ? {} : { code }), message: MESSAGES[code][lang], ...extra }),
      { status, headers },
    );

  // The body is read as TEXT first, so its size is a measured number before
  // anything parses it. A 40 MB "form post" must be refused by its length, not by
  // whatever JSON.parse does with it.
  const raw = await c.req.text().catch(() => '');
  const bodyBytes = Buffer.byteLength(raw, 'utf8');
  if (bodyBytes > MAX_BODY_BYTES) return say('too_large', 413);

  let parsed: Record<string, unknown>;
  try {
    const value = raw ? (JSON.parse(raw) as unknown) : {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return say('bad_shape', 400);
    parsed = value as Record<string, unknown>;
  } catch {
    return say('bad_shape', 400);
  }

  const appName = c.req.param('appName') ?? '';
  const formId = c.req.param('formId') ?? '';
  const token = typeof parsed['cf-turnstile-response'] === 'string' ? (parsed['cf-turnstile-response'] as string) : null;

  // The source identifier is hashed IMMEDIATELY and the raw value is not bound to a
  // variable that outlives this expression. Nothing downstream of here can see an
  // address, which is what makes "no visitor IP is stored" a property of the code
  // rather than a promise about it.
  const rateKey = sourceKey(
    appName,
    (c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown')
      .split(',')[0]!
      .trim(),
  );

  const result = await ingestSubmission({
    appName,
    formId,
    origin: origin ?? null,
    token,
    fields: parsed,
    bodyBytes,
    rateKey,
  });

  if (!result.ok) {
    // Counts and codes. The submission is not here and must never be.
    logger.info({ code: result.code, appId: result.app?.appId ?? null }, 'ops_form_refused');
    return say(result.code, result.status);
  }

  return say('ok', 200);
});

export { opsForms, MESSAGES as FORM_MESSAGES };
