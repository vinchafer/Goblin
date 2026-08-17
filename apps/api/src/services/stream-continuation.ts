// TRUNC-1 — server-side auto-continuation for generations cut off at the output ceiling.
//
// THE DEFECT THIS CLOSES (tester cohort 1, 2026-08-17):
//   A single-HTML-page task ended after roughly a third of the file. The provider had
//   said why — `finish_reason: length`, the per-request output ceiling
//   (GOBLIN_MAX_TOKENS_PER_REQUEST = 8096) — but NO code path read that field, so the
//   stream's `done` frame looked exactly like a completed answer. "Please complete it"
//   then re-ran the same prompt and the model started over from the top. Four turns for
//   one file.
//
// THE FIX: this wrapper reads the truncation verdict off the `done` frame (plumbed by
// model-router from every provider path) and, instead of forwarding it, issues a
// CONTINUATION request whose history ends with the partial answer as an assistant turn
// — so the model resumes mid-output rather than restarting — then stitches the parts and
// keeps streaming. Invisible to the user, bounded by `maxRounds`.
//
// HONESTY: the bound is real, so exhausting it is reported, not hidden. The final `done`
// then carries `truncated: true` and the client says the answer was cut off and offers a
// continue that CONTINUES. A truncated answer is never presented as a whole one.
//
// CONSUMPTION: every continuation round is a full provider request — see
// docs/GOBLIN_CONSUMPTION_LEDGER.md row M17 for the trigger, formula and knob.

import { streamWithReducedContextRetry } from './token-limit-retry';
import { insertPlatformEvent } from '../lib/platform-events';
import logger from '../lib/logger';

type ContinuationSource = typeof streamWithReducedContextRetry;
type SourceOpts = Parameters<ContinuationSource>[0];

/**
 * How many EXTRA provider requests one user message may cost to finish a cut-off
 * answer. 3 rounds ≈ 4 × 8096 output tokens ≈ a 30k-token answer, which covers the
 * single-file builds the tester hit while keeping the worst case bounded and priceable.
 * Env knob: `MAX_CONTINUATION_ROUNDS` (0 disables auto-continuation entirely — the
 * truncation is then reported honestly on the first `done`).
 */
export function maxContinuationRounds(): number {
  const raw = Number(process.env.MAX_CONTINUATION_ROUNDS);
  if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  return 3;
}

/** How much of the tail we look at when removing a re-emitted overlap at the joint. */
export const OVERLAP_WINDOW = 400;
/**
 * The shortest repeat we will treat as a real overlap. Below this, a coincidental match
 * ("\n", "}", " ") is more likely than an actual re-emission, and trimming it would
 * CORRUPT the output — the joint must be byte-exact in both directions.
 */
export const MIN_OVERLAP = 12;

/**
 * Join a continuation onto what came before, removing a re-emitted overlap.
 *
 * Models asked to continue very often restate the last line or two first. Left alone
 * that duplicates code at the joint; trimmed too eagerly it eats real content. So: take
 * the longest suffix of `previous` (within OVERLAP_WINDOW) that `next` starts with, and
 * only trim it when it is at least MIN_OVERLAP long. No match → plain concatenation,
 * which is the byte-exact behaviour when the model resumes cleanly.
 */
export function stitch(previous: string, next: string): string {
  return previous + trimOverlap(previous, next);
}

/** The continuation with its re-emitted prefix removed (see `stitch`). */
export function trimOverlap(previous: string, next: string): string {
  if (!previous || !next) return next;
  const window = previous.slice(-OVERLAP_WINDOW);
  const max = Math.min(window.length, next.length);
  for (let len = max; len >= MIN_OVERLAP; len--) {
    if (next.startsWith(window.slice(window.length - len))) {
      return next.slice(len);
    }
  }
  return next;
}

/**
 * The instruction that makes the model RESUME instead of RESTART. The tester's four
 * failed turns are the negative example: a plain "please continue" from the user gets a
 * fresh answer, because nothing tells the model where it stopped or forbids a preamble.
 * The literal tail is included because the model's own truncated output is the only
 * reliable anchor for "exactly here".
 */
export function buildContinuationPrompt(produced: string): string {
  const tail = produced.slice(-OVERLAP_WINDOW);
  return (
    'Deine letzte Antwort wurde vom Ausgabe-Limit abgeschnitten — sie endet mitten im Text. ' +
    'Setze GENAU an dieser Stelle fort.\n' +
    'ABSOLUTE REGELN für diese Antwort:\n' +
    '1. Fange NICHT von vorn an und fasse nichts zusammen.\n' +
    '2. Schreibe KEINE Einleitung, keine Entschuldigung, keinen Kommentar wie „hier geht es weiter".\n' +
    '3. Wiederhole nichts, was bereits geschrieben wurde.\n' +
    '4. Wenn ein Code-Block (```) noch offen ist, öffne ihn NICHT erneut — schreibe einfach ' +
    'den nächsten Zeichen des Codes und schließe den Block am Ende.\n' +
    '5. Gib ausschließlich die FORTSETZUNG aus, beginnend mit dem nächsten Zeichen.\n\n' +
    'Das Ende deiner bisherigen Antwort lautet wörtlich:\n' +
    '--- ENDE BISHER ---\n' +
    tail +
    '\n--- ENDE BISHER ---'
  );
}

/**
 * The seam between two rounds, as a streaming buffer.
 *
 * The overlap a model re-emits can only be recognised once enough of the continuation
 * has arrived, but deltas arrive a few characters at a time — so the first
 * OVERLAP_WINDOW characters of a continuation round are held back, trimmed against what
 * came before, and released as one delta; everything after that streams straight
 * through. `flush()` releases a short continuation that ended before the window filled.
 *
 * Constructed with `null` for the FIRST round: there is no joint, so nothing is held.
 */
export class JointBuffer {
  private held = '';
  private open: boolean;

  constructor(private readonly previous: string | null) {
    this.open = previous !== null;
  }

  /** Feed a delta; returns the text (possibly none) that may be emitted now. */
  push(content: string): string[] {
    if (!content) return [];
    if (!this.open) return [content];
    this.held += content;
    if (this.held.length < OVERLAP_WINDOW) return [];
    return this.release();
  }

  /** Release whatever is still held (end of round). Idempotent. */
  flush(): string[] {
    if (!this.open) return [];
    return this.release();
  }

  private release(): string[] {
    const trimmed = trimOverlap(this.previous ?? '', this.held);
    this.open = false;
    this.held = '';
    return trimmed ? [trimmed] : [];
  }
}

export interface AutoContinuationOpts {
  params: SourceOpts['params'];
  systemPrompt: string;
  reducedSystemPrompt?: string;
  /** Defaults to `maxContinuationRounds()`. */
  maxRounds?: number;
  /** Injectable for tests (defaults to the reduced-context-retry stream). */
  streamFn?: ContinuationSource;
}

interface Frame {
  type?: string;
  content?: string;
  truncated?: boolean;
  input_tokens?: number;
  output_tokens?: number;
  [k: string]: unknown;
}

/**
 * Stream a chat completion, transparently continuing it when the provider cuts it off
 * at the output ceiling.
 *
 * Frame contract for the layer above (unchanged except for the additions):
 *  • `meta`  — forwarded once, from the FIRST attempt. A continuation round routes to the
 *              same model, so a second `meta` would only make the client re-render.
 *  • `delta` — forwarded continuously; continuation deltas are emitted with the
 *              re-emitted overlap already removed, so the transcript is the stitched text.
 *  • `done`  — emitted ONCE, at the very end, with tokens summed over every round,
 *              `continuation_rounds` (how many extra requests this answer cost) and
 *              `truncated` (true ONLY if the cap ran out and the answer really is cut off).
 *  • `error` — forwarded verbatim and ends the stream, in any round.
 */
export async function* streamWithAutoContinuation(
  opts: AutoContinuationOpts,
): AsyncGenerator<string, void, unknown> {
  const source = opts.streamFn ?? streamWithReducedContextRetry;
  const maxRounds = opts.maxRounds ?? maxContinuationRounds();

  const baseHistory = opts.params.chatHistory ?? [];
  const originalMessage = opts.params.message;

  let produced = '';
  let rounds = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let lastDone: Frame | null = null;

  for (;;) {
    const isContinuation = rounds > 0;
    const params: SourceOpts['params'] = isContinuation
      ? {
          ...opts.params,
          // The partial answer goes back as an ASSISTANT turn — that is what makes the
          // next tokens a continuation of it rather than a fresh answer to the prompt.
          chatHistory: [
            ...baseHistory,
            { role: 'user', content: originalMessage },
            { role: 'assistant', content: produced },
          ],
          message: buildContinuationPrompt(produced),
        }
      : opts.params;

    let truncated = false;
    let sawDone = false;
    // A continuation's first bytes may restate the tail, and the overlap can only be
    // judged once enough of them have arrived. `joint` holds them back until then; it is
    // always drained before the round ends, so nothing is ever dropped.
    const joint = new JointBuffer(isContinuation ? produced : null);

    /** Emit deltas through the joint buffer and keep `produced` in sync. */
    const emitDelta = function* (content: string): Generator<string> {
      for (const out of joint.push(content)) {
        produced += out;
        yield JSON.stringify({ type: 'delta', content: out });
      }
    };

    /** Drain whatever the joint is still holding (end of round, or an error frame). */
    const flushJoint = function* (): Generator<string> {
      for (const out of joint.flush()) {
        produced += out;
        yield JSON.stringify({ type: 'delta', content: out });
      }
    };

    for await (const token of source({
      params,
      systemPrompt: opts.systemPrompt,
      reducedSystemPrompt: opts.reducedSystemPrompt,
    })) {
      let frame: Frame = {};
      try {
        frame = JSON.parse(token) as Frame;
      } catch {
        // Non-JSON token — the router never emits one, but forward it untouched rather
        // than swallowing content we cannot classify.
        yield token;
        continue;
      }

      if (frame.type === 'delta') {
        yield* emitDelta(frame.content ?? '');
        continue;
      }

      if (frame.type === 'meta') {
        if (!isContinuation) yield token;
        continue;
      }

      if (frame.type === 'done') {
        sawDone = true;
        truncated = frame.truncated === true;
        inputTokens += frame.input_tokens ?? 0;
        outputTokens += frame.output_tokens ?? 0;
        lastDone = frame;
        continue;
      }

      if (frame.type === 'error') {
        // Flush anything held back before the stream ends, so a failed round still leaves
        // the user with every byte the model did produce.
        yield* flushJoint();

        // A CONTINUATION round that fails is not the same event as a first round that
        // fails, and treating it the same loses the user's answer. The routes persist on
        // `done` and abandon the turn on `error` — so forwarding the error here would
        // throw away text the user already watched stream in, which is the opposite of
        // what continuation is for. (The concrete case: the per-round fair-use gate trips
        // between rounds, because round 1 is what pushed the user over.)
        //
        // What is true at this point: there IS an answer, and it is cut off. That is
        // exactly `done` + `truncated`, so the partial persists and the UI says it is
        // unfinished — and the continue button, when tapped, surfaces the real reason
        // from a fresh request rather than this stale one.
        if (isContinuation && produced) {
          logger.warn(
            { rounds, userId: opts.params.userId, reason: frame.message ?? null },
            'continuation round failed — keeping the partial answer and reporting it as truncated',
          );
          yield JSON.stringify({
            ...(lastDone ?? { type: 'done' }),
            type: 'done',
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            continuation_rounds: rounds,
            truncated: true,
          });
          return;
        }

        yield token;
        return;
      }

      yield token;
    }

    yield* flushJoint();

    // The generator ended without a `done` (upstream aborted / drained). Nothing more to
    // continue: hand back what we have without claiming a completion we did not see.
    if (!sawDone) return;

    if (!truncated || rounds >= maxRounds) {
      const exhausted = truncated && rounds >= maxRounds;
      if (rounds > 0) {
        logger.info(
          { rounds, exhausted, userId: opts.params.userId, projectId: opts.params.projectId ?? null },
          exhausted ? 'auto-continuation cap reached — reporting truncation honestly' : 'auto-continuation stitched a truncated answer',
        );
        // Measurable from the DB (silent-fail, no-op pre-migration) so the ledger row M17
        // frequency assumption can be checked against reality instead of guessed.
        void insertPlatformEvent({
          eventType: 'continuation_rounds',
          userId: opts.params.userId,
          projectId: opts.params.projectId ?? null,
          model: opts.params.modelPreference ?? null,
          meta: { rounds, exhausted },
        });
      }
      yield JSON.stringify({
        ...(lastDone ?? { type: 'done' }),
        type: 'done',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        continuation_rounds: rounds,
        // TRUTH: only still-cut-off answers carry this. A stitched answer is complete.
        truncated: exhausted,
      });
      return;
    }

    rounds += 1;
  }
}
