// B2 (feel-sprint-2b): reduced-context retry on provider token limits.
//
// U1 injects project file CONTENTS into the chat system prompt. On small free
// tiers (e.g. Groq 12k TPM) that can push a single request over the provider's
// hard token/size limit — the user gets a raw provider error instead of an
// answer. This wrapper watches the completion stream: if the provider rejects
// the request with a token-limit-class error BEFORE any content streamed, it
// retries ONCE with a reduced system prompt (file names+sizes only, plus an
// honest German note so the model knows contents are unavailable — the E7
// fabrication rule then applies naturally). Any other error, any error after
// content already streamed, or a second failure is forwarded untouched.

import { streamCompletionGuarded } from './model-router';

type StreamParams = Parameters<typeof streamCompletionGuarded>[0];

// Conservative matcher for "the request itself is too big" provider errors.
// Deliberately narrow: generic rate limits (RPM/RPD), auth or model errors must
// NOT trigger a retry — the same request would just fail again or mask a real
// problem. Every match is logged with the original message.
const TOKEN_LIMIT_PATTERNS: RegExp[] = [
  /request too large/i, // Groq 413 (request exceeds TPM limit outright)
  /tokens per minute \(TPM\)/i, // Groq TPM rejection (the report's failing case)
  /maximum context length/i, // OpenAI-compatible context overflow
  /context_length_exceeded/i, // OpenAI error code variant
  /prompt is too long/i, // Anthropic
  /input is too long/i, // Anthropic variant
];

export function isTokenLimitError(message: string): boolean {
  return TOKEN_LIMIT_PATTERNS.some((p) => p.test(message));
}

/**
 * Stream a chat completion; on a pre-content token-limit rejection, retry once
 * with `reducedSystemPrompt`. Events of the failed attempt up to (excluding)
 * the swallowed error are forwarded as they arrive — the client simply sees a
 * fresh `meta` from the retry attempt.
 */
export async function* streamWithReducedContextRetry(opts: {
  params: Omit<StreamParams, 'systemPrompt'>;
  systemPrompt: string;
  /** Fallback prompt without file contents; absent = never retry. */
  reducedSystemPrompt?: string;
  /** Injectable for tests. */
  streamFn?: typeof streamCompletionGuarded;
}): AsyncGenerator<string, void, unknown> {
  const stream = opts.streamFn ?? streamCompletionGuarded;
  let sawContent = false;

  for await (const token of stream({ ...opts.params, systemPrompt: opts.systemPrompt })) {
    let parsed: { type?: string; message?: string } = {};
    try {
      parsed = JSON.parse(token) as { type?: string; message?: string };
    } catch {
      /* non-JSON token — forward untouched */
    }
    if (parsed.type === 'delta') sawContent = true;

    if (
      parsed.type === 'error' &&
      !sawContent &&
      opts.reducedSystemPrompt &&
      typeof parsed.message === 'string' &&
      isTokenLimitError(parsed.message)
    ) {
      console.warn(
        '[chat] provider token-limit rejection — retrying once with reduced project context:',
        parsed.message,
      );
      yield* stream({ ...opts.params, systemPrompt: opts.reducedSystemPrompt });
      return;
    }

    yield token;
  }
}
