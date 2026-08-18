// @vitest-environment jsdom
/**
 * FOUNDER-WALK-7 · U9 — the honesty sweep, executed rather than asserted.
 *
 * Every user-facing string this wave introduced or changed, run through the
 * invariants the wave is about. The point of doing it as a test rather than as a
 * paragraph in a report: the report is read once, this fails forever.
 *
 * The invariants, in the form a machine can check:
 *   1. no invented CAUSE   — never state why something failed unless the server said so
 *   2. no invented TIMELINE — never predict that waiting or retrying will work
 *   3. no raw payload      — no stack traces, no `undefined`, no driver strings
 *   4. no self-label       — the product does not narrate itself ("Ich bin ein KI-…")
 *   5. German UI, EN key   — every string has both
 *
 * Invariant 1 is the one D-F1 broke ("Server kurz nicht erreichbar" — a diagnosis)
 * and invariant 2 is the one that made it harmful ("bitte gleich nochmal versuchen"
 * — an instruction to repeat an action that could not succeed by repetition).
 */
import { describe, it, expect } from 'vitest';
import { stcNoticeText } from './stc-outcome';
import { sessionLoadNotice } from './session-load-state';

/** Words that claim a cause the client did not establish. */
const INVENTED_CAUSE = /nicht erreichbar|sind down|Server (ist|war|sind)|Verbindungsproblem|unreachable|is down/i;
/** Words that promise a future. */
const INVENTED_TIMELINE = /gleich nochmal|in Kürze|gleich wieder|demnächst|bald wieder|shortly|in a moment|try again soon/i;
/** Machine debris that must never reach a person. */
const RAW_PAYLOAD = /\bundefined\b|\bNaN\b|\[object |\bat \w+\.(tsx?|jsx?):\d|Error:\s|statement timeout|ECONN/;
/** The product narrating itself at the user. */
const SELF_LABEL = /Ich bin ein|As an AI|Als KI|Sprachmodell|language model/i;

function check(label: string, text: string) {
  expect(text, `${label}: invented cause`).not.toMatch(INVENTED_CAUSE);
  expect(text, `${label}: invented timeline`).not.toMatch(INVENTED_TIMELINE);
  expect(text, `${label}: raw payload`).not.toMatch(RAW_PAYLOAD);
  expect(text, `${label}: self-label`).not.toMatch(SELF_LABEL);
  expect(text.trim().length, `${label}: empty`).toBeGreaterThan(0);
}

/** Every string this wave puts in front of a user, in both languages. */
function waveStrings(lang: 'de' | 'en'): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const outcome of [
    { kind: 'no-session' as const, path: 'index.html' },
    { kind: 'no-file' as const, path: 'index.html' },
  ]) {
    const n = stcNoticeText(outcome, lang)!;
    out.push([`stc/${outcome.kind}/headline`, n.headline], [`stc/${outcome.kind}/detail`, n.detail]);
  }
  for (const error of [
    { kind: 'incomplete' as const },
    { kind: 'unreachable' as const },
    { kind: 'http' as const, status: 500 },
    { kind: 'http' as const, status: 429 },
  ]) {
    const n = sessionLoadNotice(error, lang)!;
    const key = error.kind === 'http' ? `http-${error.status}` : error.kind;
    out.push([`load/${key}/headline`, n.headline], [`load/${key}/detail`, n.detail]);
  }
  return out;
}

describe('U9 honesty sweep — every new user-facing string, both languages', () => {
  for (const lang of ['de', 'en'] as const) {
    for (const [label, text] of waveStrings(lang)) {
      it(`${lang} · ${label}`, () => check(`${lang} ${label}`, text));
    }
  }

  it('the count is stated, not implied — 12 strings per language, 24 total', () => {
    expect(waveStrings('de')).toHaveLength(12);
    expect(waveStrings('en')).toHaveLength(12);
  });

  it('German and English are actually different — no untranslated leak', () => {
    const de = waveStrings('de').map(([, s]) => s);
    const en = waveStrings('en').map(([, s]) => s);
    de.forEach((s, i) => {
      expect(en[i], `string ${i} is identical in both languages — an untranslated leak`).not.toBe(s);
    });
  });

  it('the exact sentence D-F1 was about is gone from every one of them', () => {
    for (const lang of ['de', 'en'] as const) {
      for (const [, text] of waveStrings(lang)) {
        expect(text).not.toContain('Server kurz nicht erreichbar');
        expect(text).not.toContain('bitte gleich nochmal versuchen');
      }
    }
  });
});
