/**
 * AKT 2 · PHASE 4 · U4.7 — form detection and wiring.
 *
 * The rule under test is one sentence — "a form that does not say where it posts,
 * posts to Goblin" — and most of this file is about the forms it must NOT touch.
 * Hijacking a search box or a newsletter form pointed at somebody's existing
 * provider would be worse than not detecting anything at all: it would silently
 * take over a working part of somebody's app.
 */

import { describe, it, expect } from 'vitest';
import { wireForms, formSnippet, type WiringResult } from './ops-form-wiring';

const OPTS = { endpoint: 'https://api.justgoblin.com', siteKey: '0x4AAAsitekey' };

const file = (path: string, html: string) => ({ path, bytes: Buffer.from(html, 'utf8') });
const text = (result: WiringResult, path: string) =>
  result.files.find((f) => f.path === path)!.bytes.toString('utf8');

const wire = (files: Array<{ path: string; bytes: Buffer }>) => wireForms(files, OPTS) as WiringResult;

const PAGE = (form: string) => `<!doctype html><html lang="de"><body><h1>Mein Laden</h1>${form}</body></html>`;

describe('what gets wired', () => {
  it('a form with no action is Goblin’s', () => {
    const r = wire([file('index.html', PAGE('<form><input name="email"><button>Senden</button></form>'))]);
    expect(r.wired).toEqual([{ path: 'index.html', formId: 'formular-1' }]);
    const html = text(r, 'index.html');
    expect(html).toContain('data-goblin-form="formular-1"');
    expect(html).toContain('class="cf-turnstile" data-sitekey="0x4AAAsitekey"');
    expect(html).toContain('challenges.cloudflare.com/turnstile/v0/api.js');
  });

  it('action="" and action="#" count as "no action"', () => {
    for (const form of ['<form action=""><input name="a"></form>', "<form action='#'><input name='a'></form>"]) {
      expect(wire([file('index.html', PAGE(form))]).wired).toHaveLength(1);
    }
  });

  it('takes the form id from id or name, so the owner’s inbox says "kontakt"', () => {
    const r = wire([file('index.html', PAGE('<form id="Kontakt"><input name="a"></form>'))]);
    expect(r.wired[0]?.formId).toBe('kontakt');
    const r2 = wire([file('index.html', PAGE('<form name="anmeldung"><input name="a"></form>'))]);
    expect(r2.wired[0]?.formId).toBe('anmeldung');
  });

  it('falls back to a positional id when the id is unusable', () => {
    const r = wire([file('index.html', PAGE('<form id="  !!  "><input name="a"></form>'))]);
    expect(r.wired[0]?.formId).toBe('formular-1');
  });

  it('wires several forms in one page, and injects the scripts ONCE', () => {
    const r = wire([
      file('index.html', PAGE('<form id="kontakt"><input name="a"></form><form id="newsletter"><input name="b"></form>')),
    ]);
    expect(r.wired.map((w) => w.formId)).toEqual(['kontakt', 'newsletter']);
    const html = text(r, 'index.html');
    expect(html.match(/turnstile\/v0\/api\.js/g)).toHaveLength(1);
    expect(html.match(/data-goblin-form=/g)).toHaveLength(2);
    // One widget per form, though — each has to carry its own challenge.
    expect(html.match(/cf-turnstile/g)).toHaveLength(2);
  });

  it('wires forms across several html files', () => {
    const r = wire([
      file('index.html', PAGE('<form><input name="a"></form>')),
      file('kontakt.html', PAGE('<form><input name="a"></form>')),
      file('app.js', Buffer.from('const form = 1;').toString()),
    ]);
    expect(r.wired.map((w) => w.path)).toEqual(['index.html', 'kontakt.html']);
  });
});

describe('what is deliberately LEFT ALONE', () => {
  it('a form with a real action belongs to whoever wrote it', () => {
    const html = PAGE('<form action="https://formspree.io/f/abc" method="post"><input name="a"></form>');
    const r = wire([file('index.html', html)]);
    expect(r.wired).toEqual([]);
    expect(r.skipped).toEqual([{ path: 'index.html', why: 'has_action' }]);
    // Byte-identical. Not "mostly unchanged".
    expect(text(r, 'index.html')).toBe(html);
  });

  it('a search box pointed at a search page is not a contact form', () => {
    const html = PAGE('<form action="/suche"><input name="q"></form>');
    expect(wire([file('index.html', html)]).wired).toEqual([]);
    expect(text(r0(html), 'index.html')).toBe(html);
  });

  it('a form already wired is not wired twice', () => {
    const html = PAGE('<form data-goblin-form="kontakt"><input name="a"></form>');
    const r = wire([file('index.html', html)]);
    expect(r.wired).toEqual([]);
    expect(r.skipped).toEqual([{ path: 'index.html', why: 'already_wired' }]);
  });

  it('a form it cannot read to the end is reported, never guessed at', () => {
    const html = PAGE('<form><input name="a">');
    const r = wire([file('index.html', html)]);
    expect(r.wired).toEqual([]);
    expect(r.skipped).toEqual([{ path: 'index.html', why: 'unparseable' }]);
    expect(text(r, 'index.html')).toBe(html);
  });

  it('non-html files are never touched, whatever they contain', () => {
    const js = 'document.write("<form><input></form>")';
    const r = wire([file('app.js', js), file('styles.css', 'form { color: red }')]);
    expect(r.wired).toEqual([]);
    expect(text(r, 'app.js')).toBe(js);
  });

  it('an app with no form at all passes through untouched, and refuses nothing', () => {
    const html = PAGE('<p>Nur Text</p>');
    const r = wireForms([file('index.html', html)], { endpoint: '', siteKey: '' }) as WiringResult;
    expect(r.wired).toEqual([]);
    expect(r.skipped).toEqual([]);
    expect(text(r, 'index.html')).toBe(html);
  });

  it('the builder’s own markup inside the form survives exactly', () => {
    const inner = '<label for="e">E-Mail</label><input id="e" name="email" required><!-- ein Kommentar -->';
    const r = wire([file('index.html', PAGE(`<form>${inner}</form>`))]);
    expect(text(r, 'index.html')).toContain(inner);
  });
});

function r0(html: string) {
  return wire([file('index.html', html)]);
}

describe('the refusals — a form Goblin cannot host is not published', () => {
  it('refuses when there is no site key, rather than shipping an unprotected form', () => {
    const r = wireForms([file('index.html', PAGE('<form><input name="a"></form>'))], { endpoint: 'https://api.x', siteKey: '' });
    expect(r).toMatchObject({ ok: false, code: 'no_site_key' });
    expect((r as { message: string }).message).toContain('NICHT');
  });

  it('refuses when there is nowhere to post, rather than shipping a form that swallows messages', () => {
    const r = wireForms([file('index.html', PAGE('<form><input name="a"></form>'))], { endpoint: '', siteKey: '0xkey' });
    expect(r).toMatchObject({ ok: false, code: 'no_endpoint' });
    expect((r as { message: string }).message).toContain('nichts entgegennimmt');
  });
});

describe('the injected snippet', () => {
  const snippet = formSnippet('https://api.justgoblin.com');

  it('is a constant — it carries no app id, because at wiring time there is none', () => {
    expect(snippet).not.toMatch(/appId|app_id/);
    // It reads the label off the page's own address instead, which is also what
    // makes a rename need no re-wiring.
    expect(snippet).toContain("location.hostname.split('.')[0]");
  });

  it('renders the SERVER’s sentence, and authors one only when the request never landed', () => {
    expect(snippet).toContain('answer.message');
    expect(snippet).toContain('NICHT angekommen');
  });

  it('reads no cookies, sets none, and measures nothing', () => {
    expect(snippet).not.toMatch(/document\.cookie|localStorage|navigator\.userAgent|screen\./);
  });

  it('posts to /f/{label}/{formId} on the configured endpoint', () => {
    expect(snippet).toContain('"https://api.justgoblin.com"');
    expect(snippet).toContain("ENDPOINT + '/f/'");
  });

  it('is injected before </body> when there is one', () => {
    const r = wire([file('index.html', PAGE('<form><input name="a"></form>'))]);
    const html = text(r, 'index.html');
    expect(html.indexOf('turnstile/v0/api.js')).toBeLessThan(html.lastIndexOf('</body>'));
  });

  it('is appended when there is no body tag — a fragment is still a page a browser runs', () => {
    const r = wire([file('index.html', '<form><input name="a"></form>')]);
    expect(text(r, 'index.html')).toContain('turnstile/v0/api.js');
  });
});
