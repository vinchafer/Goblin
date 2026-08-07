/**
 * FOUNDER-WALK-5 · U1 (visual) — one tone system for the chat notice family.
 *
 * ── What was wrong ───────────────────────────────────────────────────────────
 *
 * Both chat surfaces (`standalone-chat.tsx`, `workspace/ChatMessages.tsx`) rendered every
 * notice through a single banner whose colour was decided by a REGEX over the message text:
 *
 *     background: /no model|no key|api key/i.test(error) ? gold : 'var(--danger-soft)'
 *     color:      /no model|no key|api key/i.test(error) ? 'var(--text)' : '#991B1B'
 *
 * Anything that did not mention a key was painted as an error. So the whole recovery family
 * — "Verbindung unterbrochen — ich prüfe, ob deine Antwort fertig geworden ist …", "Sie
 * läuft auf dem Server zu Ende", "Deine Nachricht hat den Server nie erreicht" — arrived in
 * red-on-pink with an error border. None of those is an error. The first is a progress
 * report about work that is fine; the second is good news; the third is a recoverable state
 * with a one-tap fix. Painting them as failures overstates the situation exactly as much as
 * the copy understated it, and it trains the founder to read a real error as noise.
 *
 * Two structural faults, not one bad colour:
 *
 *   ① The tone was INFERRED from prose. A new string silently inherits whatever the regex
 *      happens to think of it — which is how a whole message family ended up mis-toned
 *      without anyone choosing that.
 *   ② The palette was hard-coded (`#FCA5A5`, `#991B1B`) instead of tokenised, so it did not
 *      follow the theme: those literals stay a light-mode red on the dark surface too.
 *
 * ── The rule ─────────────────────────────────────────────────────────────────
 *
 * A notice CARRIES its tone; nothing guesses. `noticeToneFromText` still exists for the
 * legacy strings that reach the banner untagged (upstream model errors), and it is the
 * fallback, never the mechanism.
 *
 * Ink stays `var(--text)` in every tone: it is the one value guaranteed to be readable on
 * both themes, and the tone is carried by the tint and the border — which are token-derived
 * via `color-mix`, so they follow light/dark instead of fighting it. The pattern matches the
 * gold migration notice on /admin/insight, which is the surface in this repo that already
 * gets a non-error notice right.
 */

export type NoticeTone =
  /** Neutral, informational. Nothing is wrong; we are telling the user what is happening. */
  | 'info'
  /** Actionable but not broken: the user can fix it, usually with one tap. */
  | 'warn'
  /** Something failed. Reserved for it. */
  | 'error';

export interface NoticeToneStyle {
  background: string;
  border: string;
  color: string;
}

/** The token each tone draws from. Named once so no component picks a literal again. */
const TONE_TOKEN: Record<NoticeTone, string> = {
  info: 'var(--info)',
  warn: 'var(--warning)',
  error: 'var(--danger)',
};

/**
 * The three values a notice box needs, derived from tokens so both themes work.
 *
 * 10% tint / full-strength border is the same weighting the /admin/insight migration notice
 * uses, so the two surfaces read as one system rather than two accidents.
 */
export function noticeToneStyle(tone: NoticeTone): NoticeToneStyle {
  const token = TONE_TOKEN[tone];
  return {
    background: `color-mix(in srgb, ${token} 10%, transparent)`,
    border: `1px solid color-mix(in srgb, ${token} 45%, transparent)`,
    color: 'var(--text)',
  };
}

/**
 * The recovery family's tones. This is the table the visual defect was missing: every
 * outcome states, once, whether it is news, a nudge, or a failure.
 *
 * Kept as a plain string key rather than importing `RecoveryOutcome` so this module has no
 * dependency on the recovery logic — the banner is shared with surfaces that never run a
 * recovery at all.
 */
export function recoveryTone(kind: string): NoticeTone {
  switch (kind) {
    // "I am checking whether your answer finished" — a progress report. Nothing is wrong.
    case 'checking':
    // The server confirmed the turn is alive and the answer is coming. Good news.
    case 'still-running':
      return 'info';
    // No answer exists and none is coming, but there is a one-tap way out. A nudge, not a
    // failure — the founder did nothing wrong and nothing is broken.
    case 'lost':
    case 'indeterminate':
    case 'never-arrived':
    // We could not reach the server to look. Transient, retryable.
    case 'unreachable':
      return 'warn';
    default:
      return 'error';
  }
}

/**
 * Fallback for notices that arrive as bare prose (upstream model errors surfaced through
 * `friendlyError`). Preserves the one distinction the old regex drew — a missing API key is
 * a setup step, not a fault — and treats everything else as an error, which for this
 * untagged remainder is the safe reading.
 */
export function noticeToneFromText(message: string): NoticeTone {
  if (/no model|no key|api key|not connected|no provider/i.test(message)) return 'warn';
  return 'error';
}
