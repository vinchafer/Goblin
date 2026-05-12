// LiteLLM proxy client — optional, falls back to direct API if LITELLM_BASE_URL not set
// LiteLLM docs: https://docs.litellm.ai/docs/

export class GoblinError extends Error {
  constructor(public code: 'rate_limit' | 'invalid_key' | 'model_not_found' | 'provider_down' | 'timeout' | 'unknown' | 'decryption_error', message: string) {
    super(message);
    this.name = 'GoblinError';
  }
}

export function isGoblinError(e: unknown): e is GoblinError {
  return e instanceof GoblinError;
}

function getLiteLLMBase(): string | null {
  const raw = process.env.LITELLM_BASE_URL;
  if (!raw) return null;
  return raw.startsWith('http') ? raw.replace(/\/$/, '') : `https://${raw.replace(/\/$/, '')}`;
}

/** Map HTTP status + error body to GoblinError */
function mapError(status: number, body: string): GoblinError {
  if (status === 429) return new GoblinError('rate_limit', 'Rate limit reached for this provider');
  if (status === 401 || status === 403) return new GoblinError('invalid_key', 'Invalid or expired API key');
  if (status === 404) return new GoblinError('model_not_found', 'Model not found in LiteLLM');
  if (status >= 500) return new GoblinError('provider_down', `Provider error (${status})`);
  return new GoblinError('unknown', `Request failed (${status}): ${body.slice(0, 200)}`);
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface StreamDelta {
  type: 'delta' | 'usage';
  content?: string;
  input_tokens?: number;
  output_tokens?: number;
}

/**
 * Stream completions via LiteLLM proxy.
 * Falls back to null (caller uses direct SDK) if LITELLM_BASE_URL not set.
 */
export async function* litellmStream(
  model: string,
  messages: ChatMessage[],
  options: { apiKey?: string; timeout?: number } = {},
): AsyncGenerator<StreamDelta> {
  const base = getLiteLLMBase();
  if (!base) return; // Signal: use direct SDK

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout ?? 120_000);

  let response: Response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
      },
      body: JSON.stringify({ model, messages, stream: true, stream_options: { include_usage: true } }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    if ((err as { name?: string }).name === 'AbortError') {
      throw new GoblinError('timeout', 'Request timed out');
    }
    throw new GoblinError('provider_down', 'Failed to reach LiteLLM');
  }

  if (!response.ok || !response.body) {
    clearTimeout(timer);
    const body = await response.text().catch(() => '');
    throw mapError(response.status, body);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const chunk = JSON.parse(data);
          const text = chunk.choices?.[0]?.delta?.content ?? '';
          if (text) yield { type: 'delta', content: text };
          if (chunk.usage) {
            yield {
              type: 'usage',
              input_tokens: chunk.usage.prompt_tokens ?? 0,
              output_tokens: chunk.usage.completion_tokens ?? 0,
            };
          }
        } catch { /* malformed chunk */ }
      }
    }
  } finally {
    clearTimeout(timer);
    reader.cancel().catch(() => {});
  }
}

/** Validate a provider key via LiteLLM (or skip if not configured). */
export async function validateKeyViaLiteLLM(provider: string, key: string): Promise<boolean> {
  const base = getLiteLLMBase();
  if (!base) return true; // Can't validate without LiteLLM, trust the key

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: `${provider}/test`,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });
    return res.status !== 401 && res.status !== 403;
  } catch {
    return true; // Network error → assume valid
  }
}
