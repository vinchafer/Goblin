/**
 * AKT 2 · PHASE 4 · U4.7 — a form in a generated app just works.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * THE PRODUCT PROMISE THIS UNIT IS: the builder describes a contact form, Goblin
 * builds one, and it RECEIVES MESSAGES. No endpoint to paste, no service to sign
 * up for, no key to configure. If any of that were required, the form would be a
 * picture of a form — the exact phantom affordance this codebase refuses to ship.
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * ── THE DETECTION RULE, and why it is this one ───────────────────────────────
 * A `<form>` is Goblin's if it does not say where it posts.
 *
 *   • no `action` attribute, or `action=""`, or `action="#"`  → wired to Goblin
 *   • `action="https://…"` / any other value                   → LEFT ALONE
 *   • a form that already carries `data-goblin-form`           → already wired
 *
 * That is the whole rule, and it is deliberately not cleverer. The alternative —
 * guessing from field names which forms "look like" contact forms — is the fragile
 * heuristic U4.7 warns about: it would hijack a search box, a filter, a newsletter
 * form pointed at somebody's existing provider. A form with an explicit action is a
 * form whose author said where it goes, and Goblin does not get to overrule that.
 *
 * The rule is also EXPLAINABLE in one sentence to a non-technical builder, which
 * matters more than coverage: "a form that doesn't say where it sends things,
 * sends them to Goblin."
 *
 * ── HTML IS PARSED WITH REGEXES HERE, AND THAT IS A LIMITATION ───────────────
 * Not a hidden one. This module reads well-formed `<form …> … </form>` and refuses
 * anything it cannot read cleanly, reporting the file as UNWIRED rather than
 * guessing. A form built by client-side JavaScript at runtime is invisible to it
 * and always will be. Both facts are in the phase report under HONEST LIMITATIONS
 * and both are reported back to the builder in the publish result, so nobody
 * discovers them from an empty inbox.
 *
 * ── WHY THE WIRING RUNS BEFORE THE PRE-PUBLISH SCAN ─────────────────────────
 * Phase 2's order is not negotiable: nothing is uploaded that the scan has not
 * read. So the transform happens between "load the artifact" and "scan" — WHAT IS
 * SCANNED IS EXACTLY WHAT IS UPLOADED, injected bytes included. That is why the
 * snippet had to become a CONSTANT: at that moment the app id does not exist (the
 * registry row is claimed two steps later), so nothing per-app can be baked in.
 * The snippet reads the app's own hostname off `location` instead, which also
 * means a rename needs no re-wiring.
 */

import { envString } from '../lib/env-value';
import { turnstileSiteKey } from './ops-turnstile';

export interface WiredForm {
  /** The file it lives in. */
  path: string;
  /** The id the submission is filed under, and what the owner sees in their inbox. */
  formId: string;
}

export interface WiringResult {
  /** The artifact, with the wired files rewritten. Untouched files are the same objects. */
  files: Array<{ path: string; bytes: Buffer }>;
  wired: WiredForm[];
  /**
   * Files that contain something form-shaped this module would not touch, with the
   * reason. Reported to the builder rather than silently skipped — "your form is
   * not connected" is something they have to be able to find out BEFORE a visitor
   * does.
   */
  skipped: Array<{ path: string; why: 'has_action' | 'already_wired' | 'unparseable' }>;
}

export type WiringRefusal = {
  ok: false;
  /**
   * `bad_endpoint` is separate from `no_endpoint` because the founder's next action
   * differs completely: one is "set a variable", the other is "you set it, and it
   * has a path on the end". Collapsing them would send somebody looking for a
   * missing variable that is right there.
   */
  code: 'no_site_key' | 'no_endpoint' | 'bad_endpoint';
  message: string;
  /** Technical, for the log and the founder. Never the value. */
  detail?: string;
};

const HTML_EXT = /\.html?$/i;

/** A form id must survive a URL path segment and a database column. */
const FORM_ID_SHAPE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/**
 * Where the injected snippet posts.
 *
 * `OPS_FORMS_ENDPOINT` first so the founder can point it somewhere explicit;
 * `NEXT_PUBLIC_API_URL` as the fallback, because the API already carries that
 * variable and asking for a second one that always holds the same value is a
 * second thing to get wrong.
 *
 * Empty means the publish path REFUSES to wire a form. A snippet posting to a
 * relative URL would post to the app's own hostname, where nothing is listening —
 * a form that silently swallows every message.
 */
export type FormsEndpointSource = 'OPS_FORMS_ENDPOINT' | 'NEXT_PUBLIC_API_URL' | 'none';

/**
 * What the endpoint variable says, as a SHAPE — never as a value.
 *
 * ── Why this is a three-way read and not a string ────────────────────────────
 * `/f/{label}/{formId}` is appended to whatever this returns. So the difference
 * between an origin and an origin-with-a-path is the difference between a form
 * that posts to Goblin and a form that posts to a URL nobody serves — and the
 * second one fails identically to the first right up until a visitor loses their
 * message. Three shapes get three different answers:
 *
 *   • bare origin                  → fine
 *   • one trailing slash           → NORMALISED, and reported as normalised.
 *     Stripping it is unambiguous (`https://x/` and `https://x` address the same
 *     origin), so refusing would be pedantry — but staying silent about it would
 *     hide a paste that was one character off from being wrong in a way that
 *     matters.
 *   • a path, a query, a fragment  → MALFORMED. Refused, loudly, because
 *     `https://api.example.com/v1` + `/f/…` is a different URL from the one the
 *     founder meant and there is no honest way to guess which they wanted.
 *
 * ── Why http is refused except on localhost ──────────────────────────────────
 * The page carrying the form is served over https from `*.justgoblin.app`. A
 * browser blocks a mixed-content POST outright, so an http endpoint is a form that
 * cannot work — it just fails in the browser instead of in our code. localhost is
 * exempted because that is the dev loop and nothing there is mixed content.
 *
 * NOTHING IN THIS TYPE CARRIES THE VALUE. `source` names which variable answered,
 * and the booleans describe the shape. The host never appears, so this can be
 * rendered on a health surface without becoming the one place a hostname leaks.
 */
export type FormsEndpointRead =
  | {
      ok: true;
      /** Not for reporting — for composing the URL. The health surface must not echo it. */
      origin: string;
      source: FormsEndpointSource;
      /** Did the pasted value carry a trailing slash we removed? */
      normalizedTrailingSlash: boolean;
      scheme: 'https' | 'http';
    }
  | {
      ok: false;
      source: FormsEndpointSource;
      problem: 'unset' | 'unparseable' | 'not_absolute' | 'insecure_scheme' | 'has_path' | 'has_query';
    };

export function readFormsEndpoint(): FormsEndpointRead {
  const explicit = envString('OPS_FORMS_ENDPOINT');
  const source: FormsEndpointSource = explicit
    ? 'OPS_FORMS_ENDPOINT'
    : envString('NEXT_PUBLIC_API_URL')
      ? 'NEXT_PUBLIC_API_URL'
      : 'none';
  const raw = explicit || envString('NEXT_PUBLIC_API_URL');
  if (!raw) return { ok: false, source: 'none', problem: 'unset' };

  const trimmed = raw.replace(/\/+$/, '');
  const normalizedTrailingSlash = trimmed !== raw;

  if (!/^https?:\/\//i.test(trimmed)) return { ok: false, source, problem: 'not_absolute' };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, source, problem: 'unparseable' };
  }

  const scheme = url.protocol === 'https:' ? 'https' : 'http';
  const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (scheme === 'http' && !localhost) return { ok: false, source, problem: 'insecure_scheme' };
  if (url.search) return { ok: false, source, problem: 'has_query' };
  // `new URL('https://x').pathname` is '/', which is the bare-origin case.
  if (url.pathname !== '/' && url.pathname !== '') return { ok: false, source, problem: 'has_path' };

  return { ok: true, origin: url.origin, source, normalizedTrailingSlash, scheme };
}

/** The origin the snippet posts to, or `''` when there is not a usable one. */
export function formsEndpoint(): string {
  const read = readFormsEndpoint();
  return read.ok ? read.origin : '';
}

/**
 * The client snippet — a CONSTANT, modulo two platform values.
 *
 * It is deliberately small, dependency-free and framework-free: it runs inside
 * somebody else's page, which may be anything from hand-written HTML to a React
 * build, and it must not assume, break or style anything it did not create.
 *
 * What it does NOT do, on purpose: it does not read cookies, does not set any, does
 * not measure anything, and does not phone home when nobody submits. The only
 * request it ever makes is the one a person caused by pressing a button.
 */
export function formSnippet(endpoint: string): string {
  return `<script>
(function () {
  var ENDPOINT = ${JSON.stringify(endpoint)};
  var DE = (document.documentElement.lang || 'de').toLowerCase().indexOf('en') !== 0;
  var SENDING = DE ? 'Wird gesendet …' : 'Sending …';
  var OFFLINE = DE
    ? 'Wir konnten das gerade nicht abschicken. Deine Nachricht ist NICHT angekommen — bitte versuch es noch einmal.'
    : 'We could not send this just now. Your message has NOT arrived — please try again.';
  function statusEl(form) {
    var el = form.querySelector('[data-goblin-status]');
    if (!el) {
      el = document.createElement('p');
      el.setAttribute('data-goblin-status', '');
      el.setAttribute('role', 'status');
      el.style.margin = '12px 0 0';
      form.appendChild(el);
    }
    return el;
  }
  function wire(form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var out = statusEl(form);
      out.textContent = SENDING;
      var data = new FormData(form);
      var body = {};
      data.forEach(function (value, key) { if (typeof value === 'string') body[key] = value; });
      var label = location.hostname.split('.')[0];
      fetch(ENDPOINT + '/f/' + encodeURIComponent(label) + '/' + encodeURIComponent(form.getAttribute('data-goblin-form')), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function (res) { return res.json().catch(function () { return null; }); })
        .then(function (answer) {
          // The server's own sentence, verbatim. This snippet authors no message
          // about what happened to somebody's submission except when it never
          // reached the server at all.
          out.textContent = (answer && answer.message) || OFFLINE;
          if (answer && answer.ok) { form.reset(); if (window.turnstile) window.turnstile.reset(); }
          else if (window.turnstile) { window.turnstile.reset(); }
        })
        .catch(function () { out.textContent = OFFLINE; });
    });
  }
  var forms = document.querySelectorAll('form[data-goblin-form]');
  for (var i = 0; i < forms.length; i++) wire(forms[i]);
})();
</script>`;
}

const TURNSTILE_SCRIPT = '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>';

function widget(siteKey: string): string {
  return `<div class="cf-turnstile" data-sitekey="${siteKey}" data-appearance="interaction-only"></div>`;
}

/** Read `id`/`name` off the opening tag so the owner's inbox says "kontakt", not "formular-1". */
function idFromTag(tag: string, fallback: string): string {
  const match = /\s(?:id|name)\s*=\s*"([^"]*)"/i.exec(tag) ?? /\s(?:id|name)\s*=\s*'([^']*)'/i.exec(tag);
  const candidate = (match?.[1] ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return FORM_ID_SHAPE.test(candidate) ? candidate : fallback;
}

/** Does the opening tag declare where it posts? */
function hasRealAction(tag: string): boolean {
  const match = /\saction\s*=\s*"([^"]*)"/i.exec(tag) ?? /\saction\s*=\s*'([^']*)'/i.exec(tag);
  if (!match) return false;
  const value = (match[1] ?? '').trim();
  return value !== '' && value !== '#';
}

/**
 * Wire every Goblin-owned form in an artifact.
 *
 * Returns a refusal — not a partial job — when the platform is not configured to
 * host a form at all. Publishing an app whose form cannot work is the failure this
 * whole unit exists to prevent, so the caller turns this into a refused publish
 * with an honest German sentence, and the builder's app stays exactly as it was.
 */
export function wireForms(
  files: Array<{ path: string; bytes: Buffer }>,
  opts: { endpoint?: string; siteKey?: string } = {},
): WiringResult | WiringRefusal {
  const read = opts.endpoint === undefined ? readFormsEndpoint() : null;
  const endpoint = opts.endpoint ?? (read?.ok ? read.origin : '');
  const siteKey = opts.siteKey ?? turnstileSiteKey();

  // Nothing to do — and therefore nothing to refuse. An app with no form must not
  // be blocked by a missing Turnstile key it will never use.
  const candidates = files.filter((f) => HTML_EXT.test(f.path) && /<form[\s>]/i.test(f.bytes.toString('utf8')));
  if (candidates.length === 0) return { files, wired: [], skipped: [] };

  if (!siteKey) {
    return {
      ok: false,
      code: 'no_site_key',
      message:
        'Diese App enthält ein Formular, und Goblin kann Formulare gerade nicht absichern. '
        + 'Wir veröffentlichen sie deshalb NICHT — ein Formular, das jeder Bot vollschreiben kann, '
        + 'wäre schlimmer als eines, das noch nicht online ist.',
    };
  }
  if (!endpoint) {
    // A configured-but-malformed endpoint is its own answer. Publishing with a
    // path on the end would produce a form that posts to a URL nobody serves —
    // which fails exactly like a working form until somebody loses a message.
    const malformed = read && !read.ok && read.problem !== 'unset';
    return {
      ok: false,
      code: malformed ? 'bad_endpoint' : 'no_endpoint',
      message: malformed
        ? 'Diese App enthält ein Formular, und die Adresse, an die Einsendungen gehen sollen, ist nicht '
          + 'in Ordnung. Wir veröffentlichen sie deshalb NICHT — ein Formular, das ins Leere schickt, '
          + 'wäre schlimmer als eines, das noch nicht online ist.'
        : 'Diese App enthält ein Formular, und Goblin weiß gerade nicht, wohin die Einsendungen gehen sollen. '
          + 'Wir veröffentlichen sie deshalb NICHT — ein sichtbares Formular, das nichts entgegennimmt, '
          + 'wäre eine Zusage, die wir nicht halten.',
      ...(read && !read.ok ? { detail: `${read.source}: ${read.problem}` } : {}),
    };
  }

  const wired: WiringResult['wired'] = [];
  const skipped: WiringResult['skipped'] = [];
  const out = files.map((file) => {
    if (!HTML_EXT.test(file.path)) return file;
    const html = file.bytes.toString('utf8');
    if (!/<form[\s>]/i.test(html)) return file;

    let rewritten = '';
    let cursor = 0;
    let wiredHere = 0;
    let seen = 0;
    const openTag = /<form(\s[^>]*)?>/gi;
    let match: RegExpExecArray | null;

    while ((match = openTag.exec(html)) !== null) {
      seen += 1;
      const tag = match[0];
      const closeIndex = html.toLowerCase().indexOf('</form>', openTag.lastIndex);
      if (closeIndex === -1) {
        // A form we cannot read to its end is a form we do not touch. Reported, so
        // the builder learns it from us and not from an empty inbox.
        skipped.push({ path: file.path, why: 'unparseable' });
        break;
      }
      if (/\sdata-goblin-form\s*=/i.test(tag)) {
        skipped.push({ path: file.path, why: 'already_wired' });
        continue;
      }
      if (hasRealAction(tag)) {
        skipped.push({ path: file.path, why: 'has_action' });
        continue;
      }

      wiredHere += 1;
      const formId = idFromTag(tag, `formular-${seen}`);
      const newTag = `${tag.slice(0, -1)} data-goblin-form="${formId}">`;

      rewritten += html.slice(cursor, match.index) + newTag;
      // Everything between the tags is the builder's, untouched; the widget goes in
      // immediately before the closing tag so it is inside the form and submits
      // with it.
      rewritten += html.slice(openTag.lastIndex, closeIndex) + widget(siteKey);
      cursor = closeIndex;
      wired.push({ path: file.path, formId });
    }

    if (wiredHere === 0) return file;

    rewritten += html.slice(cursor);

    // The two scripts, once per document. Before `</body>` where there is one;
    // appended otherwise, because a fragment without a body tag is still a page a
    // browser will run.
    const inject = `\n${TURNSTILE_SCRIPT}\n${formSnippet(endpoint)}\n`;
    const bodyClose = rewritten.toLowerCase().lastIndexOf('</body>');
    rewritten =
      bodyClose === -1
        ? rewritten + inject
        : rewritten.slice(0, bodyClose) + inject + rewritten.slice(bodyClose);

    return { path: file.path, bytes: Buffer.from(rewritten, 'utf8') };
  });

  return { files: out, wired, skipped };
}
