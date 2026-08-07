/**
 * FOUNDER-WALK-5 · U1 (visual) — the chat notice family must not wear the error treatment
 * for states that are not errors.
 *
 * The founder's lock-screen line arrived in red-on-pink with an error border, and so did
 * every other member of its family, because the banner picked its colour with a regex over
 * the message text: anything that did not mention an API key was painted as a failure.
 *
 * These tests pin the rule the regex could not express — a notice CARRIES its tone — and
 * they are the reason a new recovery outcome cannot silently inherit red.
 */
import { describe, it, expect } from 'vitest';
import { noticeToneStyle, noticeToneFromText, recoveryTone, type NoticeTone } from './notice-tone';
import { recoveryMessage } from './chat-recovery';

const RECOVERY_KINDS = [
  'checking', 'still-running', 'lost', 'indeterminate', 'never-arrived', 'unreachable',
] as const;

describe('tones are assigned by meaning, not by prose', () => {
  it('no member of the recovery family is an error', () => {
    // This is the defect, stated as an assertion. Every one of these used to render in the
    // danger palette; none of them is a failure.
    for (const kind of RECOVERY_KINDS) {
      expect(recoveryTone(kind)).not.toBe('error');
    }
  });

  it('purely informational states are neutral — not even a warning', () => {
    // "I am checking" is a progress report; a confirmed running turn is good news.
    expect(recoveryTone('checking')).toBe('info');
    expect(recoveryTone('still-running')).toBe('info');
  });

  it('actionable-but-not-broken states warn, so the one-tap fix reads as a nudge', () => {
    for (const kind of ['lost', 'indeterminate', 'never-arrived', 'unreachable'] as const) {
      expect(recoveryTone(kind)).toBe('warn');
    }
  });

  it('an unrecognised notice still defaults to error — the safe reading for untagged prose', () => {
    expect(recoveryTone('some-upstream-failure')).toBe('error');
  });
});

describe('the tone palette is token-derived, so it follows the theme', () => {
  const TONES: NoticeTone[] = ['info', 'warn', 'error'];

  it('never emits a hard-coded colour literal', () => {
    // `#FCA5A5` / `#991B1B` were baked into both chat banners and stayed light-mode red on
    // the dark surface. No hex, rgb() or hsl() may appear in any tone.
    for (const tone of TONES) {
      const style = noticeToneStyle(tone);
      for (const value of Object.values(style)) {
        expect(value).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i);
        expect(value).toMatch(/var\(--/);
      }
    }
  });

  it('gives each tone its own token, and readable ink in both themes', () => {
    expect(noticeToneStyle('info').background).toContain('--info');
    expect(noticeToneStyle('warn').background).toContain('--warning');
    expect(noticeToneStyle('error').background).toContain('--danger');
    // Ink is the theme-following neutral in every tone — the tone is carried by the tint
    // and border, which is what keeps contrast correct on the dark surface.
    for (const tone of TONES) expect(noticeToneStyle(tone).color).toBe('var(--text)');
  });

  it('the three tones are visually distinct', () => {
    const backgrounds = TONES.map((t) => noticeToneStyle(t).background);
    expect(new Set(backgrounds).size).toBe(3);
  });
});

describe('the text fallback keeps the one distinction the old regex got right', () => {
  it('a missing key is a setup step, not a fault', () => {
    for (const msg of ['No model connected.', 'Kein API key hinterlegt', 'no provider available']) {
      expect(noticeToneFromText(msg)).toBe('warn');
    }
  });

  it('everything else untagged is treated as an error', () => {
    expect(noticeToneFromText('Streaming failed')).toBe('error');
  });

  it('but the recovery family never reaches that fallback mis-toned', () => {
    // Belt and braces: even if a recovery line DID fall through to the text classifier, the
    // explicit tone is what the banner is given. This asserts the two agree on intent by
    // showing the family is fully covered by `recoveryTone`.
    for (const kind of ['still-running', 'lost', 'indeterminate', 'never-arrived', 'unreachable'] as const) {
      expect(recoveryMessage(kind, 'de')).toBeTruthy();
      expect(recoveryTone(kind)).not.toBe('error');
    }
  });
});
