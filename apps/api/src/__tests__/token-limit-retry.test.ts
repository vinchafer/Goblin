// B2 (feel-sprint-2b): token-limit matcher + reduced-context retry logic.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// I0: the retry fires a platform_events insert (silent-fail in prod). Mock it so
// the unit test neither hits the DB nor depends on env, and can assert the call.
vi.mock('../lib/platform-events', () => ({ insertPlatformEvent: vi.fn() }));
// eslint-disable-next-line import/first
import { insertPlatformEvent } from '../lib/platform-events';
// eslint-disable-next-line import/first
import { isTokenLimitError, streamWithReducedContextRetry } from '../services/token-limit-retry';

const ev = (obj: Record<string, unknown>) => JSON.stringify(obj);

async function collect(gen: AsyncGenerator<string>): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  for await (const t of gen) out.push(JSON.parse(t) as Record<string, unknown>);
  return out;
}

describe('isTokenLimitError', () => {
  it('matches provider token/size-limit errors', () => {
    // Groq 413 — the report's real failing case (12,975 > 12,000 TPM)
    expect(isTokenLimitError(
      '413 Request too large for model `llama-3.3-70b-versatile` in organization `org_x` on tokens per minute (TPM): Limit 12000, Requested 12975, please reduce your message size and try again.',
    )).toBe(true);
    // OpenAI-compatible context overflow
    expect(isTokenLimitError("This model's maximum context length is 8192 tokens.")).toBe(true);
    expect(isTokenLimitError('Error code: context_length_exceeded')).toBe(true);
    // Anthropic
    expect(isTokenLimitError('prompt is too long: 210000 tokens > 200000 maximum')).toBe(true);
  });

  it('does NOT match unrelated errors (conservative)', () => {
    expect(isTokenLimitError('Rate limit reached for model x on requests per day (RPD): Limit 1000')).toBe(false);
    expect(isTokenLimitError('Invalid API key provided.')).toBe(false);
    expect(isTokenLimitError('The model `foo` does not exist or you do not have access to it.')).toBe(false);
    expect(isTokenLimitError('Stream failed')).toBe(false);
    expect(isTokenLimitError('Das Modell hat nicht rechtzeitig geantwortet.')).toBe(false);
  });
});

describe('streamWithReducedContextRetry', () => {
  const baseParams = { userId: 'u1', projectId: 'p1', message: 'hi', chatHistory: [] };
  beforeEach(() => vi.mocked(insertPlatformEvent).mockClear());
  const TPM_ERROR = ev({
    type: 'error',
    message: 'Request too large for model on tokens per minute (TPM): Limit 12000, Requested 12975',
  });

  function fakeStream(script: (prompt: string | undefined, call: number) => string[]) {
    const calls: Array<string | undefined> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = async function* (params: any): AsyncGenerator<string> {
      calls.push(params.systemPrompt);
      yield* script(params.systemPrompt, calls.length);
    };
    return { fn: fn as never, calls };
  }

  it('retries once with the reduced prompt on a pre-content token-limit error', async () => {
    const { fn, calls } = fakeStream((prompt) =>
      prompt === 'FULL'
        ? [ev({ type: 'meta', model: 'm' }), TPM_ERROR]
        : [ev({ type: 'meta', model: 'm' }), ev({ type: 'delta', content: 'ok' }), ev({ type: 'done' })],
    );
    const events = await collect(streamWithReducedContextRetry({
      params: baseParams, systemPrompt: 'FULL', reducedSystemPrompt: 'REDUCED', streamFn: fn,
    }));
    expect(calls).toEqual(['FULL', 'REDUCED']);
    expect(events.filter((e) => e.type === 'error')).toHaveLength(0);
    expect(events.some((e) => e.type === 'delta' && e.content === 'ok')).toBe(true);
    expect(events.some((e) => e.type === 'done')).toBe(true);
    // I0: the forced retry is persisted as a context_retry platform event.
    expect(insertPlatformEvent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(insertPlatformEvent).mock.calls[0]![0]).toMatchObject({
      eventType: 'context_retry', userId: 'u1', projectId: 'p1',
    });
  });

  it('forwards the error untouched when no reduced prompt is available', async () => {
    const { fn, calls } = fakeStream(() => [TPM_ERROR]);
    const events = await collect(streamWithReducedContextRetry({
      params: baseParams, systemPrompt: 'FULL', streamFn: fn,
    }));
    expect(calls).toEqual(['FULL']);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('error');
  });

  it('forwards non-token-limit errors untouched', async () => {
    const { fn, calls } = fakeStream(() => [ev({ type: 'error', message: 'Invalid API key provided.' })]);
    const events = await collect(streamWithReducedContextRetry({
      params: baseParams, systemPrompt: 'FULL', reducedSystemPrompt: 'REDUCED', streamFn: fn,
    }));
    expect(calls).toEqual(['FULL']);
    expect(events[0]!.type).toBe('error');
  });

  it('does not retry when content already streamed (mid-stream failure)', async () => {
    const { fn, calls } = fakeStream(() => [
      ev({ type: 'delta', content: 'partial' }),
      TPM_ERROR,
    ]);
    const events = await collect(streamWithReducedContextRetry({
      params: baseParams, systemPrompt: 'FULL', reducedSystemPrompt: 'REDUCED', streamFn: fn,
    }));
    expect(calls).toEqual(['FULL']);
    expect(events.map((e) => e.type)).toEqual(['delta', 'error']);
  });

  it('retries at most once — a second token-limit error is forwarded', async () => {
    const { fn, calls } = fakeStream(() => [TPM_ERROR]);
    const events = await collect(streamWithReducedContextRetry({
      params: baseParams, systemPrompt: 'FULL', reducedSystemPrompt: 'REDUCED', streamFn: fn,
    }));
    expect(calls).toEqual(['FULL', 'REDUCED']);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('error');
  });
});
