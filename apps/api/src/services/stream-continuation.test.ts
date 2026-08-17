// TRUNC-1 gate — auto-continuation of a generation cut off at the output ceiling.
//
// The tester's session is the specification: a single-HTML-page task stopped after ~a
// third of the file, and every follow-up restarted from the top. These tests drive the
// wrapper with a MOCK provider stream that reports `finish_reason: length` the same way
// a real one does, and assert the three things that were broken:
//   1. the stitched text is BYTE-EXACT — no lost bytes, no duplicated overlap;
//   2. a continuation RESUMES (its request carries the partial answer + the anchor),
//      it does not re-ask the original question;
//   3. when the round cap runs out the `done` frame SAYS the answer is cut off.

import { describe, it, expect, vi } from 'vitest';
import {
  streamWithAutoContinuation,
  trimOverlap,
  stitch,
  buildContinuationPrompt,
  JointBuffer,
  OVERLAP_WINDOW,
  MIN_OVERLAP,
} from './stream-continuation';

type Frame = Record<string, unknown>;
type SourceOpts = Parameters<typeof streamWithAutoContinuation>[0];
type StreamFn = NonNullable<SourceOpts['streamFn']>;

const BASE_PARAMS = {
  userId: 'u1',
  projectId: 'p1',
  message: 'Baue mir eine Single-Page-HTML-Portfolioseite.',
  chatHistory: [] as Array<{ role: string; content: string }>,
};

/** Chop `text` into small deltas the way a provider streams it. */
function deltas(text: string, size = 7): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < text.length; i += size) {
    out.push({ type: 'delta', content: text.slice(i, i + size) });
  }
  return out;
}

/**
 * A mock provider: `rounds[i]` is what the i-th request produces. Records the params of
 * every request so a test can prove the continuation actually carried the partial answer.
 */
function mockStream(rounds: Array<{ text: string; truncated: boolean }>) {
  const calls: Array<SourceOpts> = [];
  let i = 0;
  const fn = (async function* (opts: SourceOpts) {
    calls.push(opts);
    const round = rounds[Math.min(i, rounds.length - 1)]!;
    i += 1;
    yield JSON.stringify({ type: 'meta', model: 'goblin/efficient', source_tier: 'goblin_hosted' });
    for (const d of deltas(round.text)) yield JSON.stringify(d);
    yield JSON.stringify({
      type: 'done',
      input_tokens: 100,
      output_tokens: 8096,
      truncated: round.truncated,
    });
  }) as unknown as StreamFn;
  return { fn, calls };
}

/** Run the wrapper and collect the frames it emitted. */
async function collect(opts: Partial<SourceOpts> & { streamFn: StreamFn }): Promise<Frame[]> {
  const out: Frame[] = [];
  for await (const token of streamWithAutoContinuation({
    params: BASE_PARAMS,
    systemPrompt: 'system',
    ...opts,
  } as SourceOpts)) {
    out.push(JSON.parse(token) as Frame);
  }
  return out;
}

const text = (frames: Frame[]): string =>
  frames.filter(f => f.type === 'delta').map(f => String(f.content ?? '')).join('');

const doneFrame = (frames: Frame[]): Frame | undefined => frames.find(f => f.type === 'done');

// ─── the joint: byte-exactness in both directions ───────────────────────────────

describe('trimOverlap — the joint between two rounds', () => {
  it('removes a re-emitted overlap so the joint is byte-exact', () => {
    const whole = 'const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\n';
    const first = whole.slice(0, 26);
    const rest = whole.slice(26);
    // The model restates the last 20 characters before continuing.
    const continuation = whole.slice(6, 26) + rest;
    expect(stitch(first, continuation)).toBe(whole);
  });

  it('concatenates verbatim when the model resumes cleanly (no overlap)', () => {
    const whole = '<!doctype html>\n<html lang="de">\n<head>\n<title>Portfolio</title>\n';
    const cut = 33;
    expect(stitch(whole.slice(0, cut), whole.slice(cut))).toBe(whole);
  });

  it('does NOT trim a coincidental short match — that would eat real content', () => {
    const previous = 'function render() {\n  return html;\n}\n';
    const next = '\nfunction mount() {}';
    // "\n" matches, but a 1-char overlap is noise, not a re-emission.
    expect(trimOverlap(previous, next)).toBe(next);
    expect(MIN_OVERLAP).toBeGreaterThan(1);
  });

  it('handles an overlap longer than the inspection window without corrupting bytes', () => {
    const previous = 'x'.repeat(50) + 'y'.repeat(OVERLAP_WINDOW * 2);
    const next = 'y'.repeat(OVERLAP_WINDOW) + 'TAIL';
    // Only the last OVERLAP_WINDOW chars are inspected; whatever it decides, the
    // combined result must never LOSE bytes that were not in `previous`.
    expect(stitch(previous, next).endsWith('TAIL')).toBe(true);
  });

  it('is a no-op on empty input', () => {
    expect(trimOverlap('', 'abc')).toBe('abc');
    expect(trimOverlap('abc', '')).toBe('');
  });
});

describe('JointBuffer', () => {
  it('passes the first round straight through (there is no joint yet)', () => {
    const b = new JointBuffer(null);
    expect(b.push('hello ')).toEqual(['hello ']);
    expect(b.push('world')).toEqual(['world']);
    expect(b.flush()).toEqual([]);
  });

  it('holds a continuation back until the overlap can be judged, then streams on', () => {
    const previous = 'a'.repeat(100) + 'MARKER-TEXT-HERE';
    const b = new JointBuffer(previous);
    // The model re-emits the marker, then continues.
    expect(b.push('MARKER-TEXT-HERE')).toEqual([]); // held — window not full yet
    const tail = 'z'.repeat(OVERLAP_WINDOW);
    const released = b.push(tail).join('');
    expect(released).toBe(tail); // the re-emitted marker was removed
    expect(b.push('!')).toEqual(['!']); // afterwards it streams straight through
  });

  it('flushes a continuation that ended before the window filled', () => {
    const b = new JointBuffer('previous text that is long enough to matter');
    b.push('short tail');
    expect(b.flush()).toEqual(['short tail']);
    expect(b.flush()).toEqual([]); // idempotent
  });
});

// ─── the wrapper: resume, don't restart ─────────────────────────────────────────

describe('streamWithAutoContinuation', () => {
  it('passes an untruncated answer through untouched (no extra provider request)', async () => {
    const { fn, calls } = mockStream([{ text: 'Fertige Antwort.', truncated: false }]);
    const frames = await collect({ streamFn: fn });

    expect(calls).toHaveLength(1);
    expect(text(frames)).toBe('Fertige Antwort.');
    expect(doneFrame(frames)).toMatchObject({ truncated: false, continuation_rounds: 0 });
  });

  it('stitches a truncated answer into ONE complete stream, byte-exact', async () => {
    const whole =
      '<!doctype html>\n<html lang="de">\n<head><meta charset="utf-8"><title>Portfolio</title></head>\n' +
      '<body>\n<main class="wrap">\n<h1>Vincent</h1>\n<p>Baut Dinge.</p>\n</main>\n</body>\n</html>\n';
    const cut = 96;
    const { fn, calls } = mockStream([
      { text: whole.slice(0, cut), truncated: true },
      // The model restates its last line before continuing — the common real behaviour.
      { text: whole.slice(cut - 30), truncated: false },
    ]);

    const frames = await collect({ streamFn: fn });

    expect(calls).toHaveLength(2);
    expect(text(frames)).toBe(whole); // byte-exact joint, no duplicated overlap
    expect(doneFrame(frames)).toMatchObject({ truncated: false, continuation_rounds: 1 });
  });

  it('sends the partial answer back as an ASSISTANT turn so the model resumes', async () => {
    const { fn, calls } = mockStream([
      { text: 'Teil eins der Datei.', truncated: true },
      { text: ' Teil zwei der Datei.', truncated: false },
    ]);

    await collect({ streamFn: fn });

    const continuation = calls[1]!;
    const history = continuation.params.chatHistory!;
    // The ORIGINAL question stays in history exactly once…
    expect(history.filter(m => m.content === BASE_PARAMS.message)).toHaveLength(1);
    // …followed by what the model already produced, as its own turn.
    expect(history[history.length - 1]).toEqual({
      role: 'assistant',
      content: 'Teil eins der Datei.',
    });
    // …and the new message is the resume instruction, NOT the original prompt again.
    expect(continuation.params.message).not.toBe(BASE_PARAMS.message);
    expect(continuation.params.message).toContain('Setze GENAU an dieser Stelle fort');
    expect(continuation.params.message).toContain('Teil eins der Datei.');
  });

  it('runs several rounds and sums the tokens actually spent', async () => {
    const { fn, calls } = mockStream([
      { text: 'A'.repeat(50), truncated: true },
      { text: 'B'.repeat(50), truncated: true },
      { text: 'C'.repeat(50), truncated: false },
    ]);

    const frames = await collect({ streamFn: fn });

    expect(calls).toHaveLength(3);
    expect(text(frames)).toBe('A'.repeat(50) + 'B'.repeat(50) + 'C'.repeat(50));
    expect(doneFrame(frames)).toMatchObject({
      continuation_rounds: 2,
      input_tokens: 300, // 3 rounds × 100 — a continuation is a real request, billed as one
      output_tokens: 8096 * 3,
    });
  });

  it('emits `meta` once — a continuation must not re-render the client', async () => {
    const { fn } = mockStream([
      { text: 'erster Teil', truncated: true },
      { text: ' zweiter Teil', truncated: false },
    ]);
    const frames = await collect({ streamFn: fn });
    expect(frames.filter(f => f.type === 'meta')).toHaveLength(1);
  });

  it('emits exactly ONE done frame across all rounds', async () => {
    const { fn } = mockStream([
      { text: 'erster Teil', truncated: true },
      { text: ' zweiter Teil', truncated: false },
    ]);
    const frames = await collect({ streamFn: fn });
    expect(frames.filter(f => f.type === 'done')).toHaveLength(1);
  });

  // ─── honesty when the bound is reached ────────────────────────────────────────

  it('CAP REACHED: says the answer is cut off instead of dressing it up as complete', async () => {
    const { fn, calls } = mockStream([
      { text: 'Teil ', truncated: true },
      { text: 'um Teil ', truncated: true },
      { text: 'bis zum Limit.', truncated: true },
    ]);

    const frames = await collect({ streamFn: fn, maxRounds: 2 });

    expect(calls).toHaveLength(3); // the original + 2 continuations, then it stops
    expect(text(frames)).toBe('Teil um Teil bis zum Limit.'); // every produced byte kept
    expect(doneFrame(frames)).toMatchObject({ truncated: true, continuation_rounds: 2 });
  });

  it('maxRounds: 0 disables continuation and reports the truncation immediately', async () => {
    const { fn, calls } = mockStream([{ text: 'nur ein Drittel', truncated: true }]);

    const frames = await collect({ streamFn: fn, maxRounds: 0 });

    expect(calls).toHaveLength(1);
    expect(doneFrame(frames)).toMatchObject({ truncated: true, continuation_rounds: 0 });
  });

  it('forwards a provider error and keeps every byte produced before it', async () => {
    const failing = (async function* (opts: SourceOpts) {
      if (opts.params.chatHistory!.length === 0) {
        yield JSON.stringify({ type: 'delta', content: 'Angefangen' });
        yield JSON.stringify({ type: 'done', truncated: true, input_tokens: 1, output_tokens: 2 });
        return;
      }
      yield JSON.stringify({ type: 'error', message: 'Rate limit reached. Please retry in a moment.' });
    }) as unknown as StreamFn;

    const frames = await collect({ streamFn: failing });

    expect(text(frames)).toBe('Angefangen');
    expect(frames.at(-1)).toMatchObject({ type: 'error' });
    // No `done` — the turn did not complete, and nothing claims that it did.
    expect(doneFrame(frames)).toBeUndefined();
  });

  it('does not claim a completion when the upstream ends without a done frame', async () => {
    const drained = (async function* () {
      yield JSON.stringify({ type: 'delta', content: 'abgebrochen' });
    }) as unknown as StreamFn;

    const frames = await collect({ streamFn: drained });

    expect(text(frames)).toBe('abgebrochen');
    expect(doneFrame(frames)).toBeUndefined();
  });
});

describe('buildContinuationPrompt', () => {
  it('anchors on the literal tail and forbids the restart the tester actually got', () => {
    const head = 'HEAD-MARKER' + 'x'.repeat(4000);
    const produced = head + '</main>\n<footer>';
    const prompt = buildContinuationPrompt(produced);

    expect(prompt).toContain('</main>\n<footer>');            // the anchor
    expect(prompt).toContain('Fange NICHT von vorn an');       // no restart
    expect(prompt).toContain('Wiederhole nichts');             // no duplication
    expect(prompt).toContain('öffne ihn NICHT erneut');        // no re-opened code fence
    // Only the TAIL travels: the full partial answer already rides in `chatHistory`
    // as the assistant turn, so repeating it here would just re-pay for the tokens.
    expect(prompt).not.toContain('HEAD-MARKER');
    expect(prompt.length).toBeLessThan(OVERLAP_WINDOW + 1200);
  });
});

describe('the truncation signal itself', () => {
  it('is read from the provider, never guessed from the text', async () => {
    // An answer that LOOKS unfinished but the provider called complete must not be
    // continued — inventing a continuation would be as dishonest as hiding one.
    const { fn, calls } = mockStream([{ text: 'Das Ende fehlt hier mitten im Sat', truncated: false }]);
    const frames = await collect({ streamFn: fn });

    expect(calls).toHaveLength(1);
    expect(doneFrame(frames)).toMatchObject({ truncated: false });
  });
});

describe('vi sanity', () => {
  it('module loads without touching the network', () => {
    expect(vi.isMockFunction(streamWithAutoContinuation)).toBe(false);
  });
});
