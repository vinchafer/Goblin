import { calculateCost } from '../model-pricing';

export interface EvalCallResult {
  output: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  cost_usd: number;
  error?: string;
}

export interface EvalProvider {
  provider: string;
  model: string;
  call: (prompt: string, maxTokens: number) => Promise<EvalCallResult>;
}

function emptyResult(latency: number, error: string): EvalCallResult {
  return { output: '', tokens_in: 0, tokens_out: 0, latency_ms: latency, cost_usd: 0, error };
}

async function callAnthropic(prompt: string, maxTokens: number): Promise<EvalCallResult> {
  const t0 = Date.now();
  const model = 'claude-sonnet-4-6';
  const apiKey = process.env.EVAL_ANTHROPIC_KEY;
  if (!apiKey) return emptyResult(0, 'EVAL_ANTHROPIC_KEY missing');
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return emptyResult(Date.now() - t0, `${res.status} ${await res.text().catch(() => '')}`);
    const body = await res.json() as { content?: Array<{ text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
    const output = body.content?.[0]?.text ?? '';
    const tokens_in = body.usage?.input_tokens ?? 0;
    const tokens_out = body.usage?.output_tokens ?? 0;
    return { output, tokens_in, tokens_out, latency_ms: Date.now() - t0, cost_usd: calculateCost(model, tokens_in, tokens_out) };
  } catch (e) {
    return emptyResult(Date.now() - t0, (e as Error).message);
  }
}

async function callOpenAI(prompt: string, maxTokens: number): Promise<EvalCallResult> {
  const t0 = Date.now();
  const model = 'gpt-4o-mini';
  const apiKey = process.env.EVAL_OPENAI_KEY;
  if (!apiKey) return emptyResult(0, 'EVAL_OPENAI_KEY missing');
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return emptyResult(Date.now() - t0, `${res.status} ${await res.text().catch(() => '')}`);
    const body = await res.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const output = body.choices?.[0]?.message?.content ?? '';
    const tokens_in = body.usage?.prompt_tokens ?? 0;
    const tokens_out = body.usage?.completion_tokens ?? 0;
    return { output, tokens_in, tokens_out, latency_ms: Date.now() - t0, cost_usd: calculateCost(model, tokens_in, tokens_out) };
  } catch (e) {
    return emptyResult(Date.now() - t0, (e as Error).message);
  }
}

async function callGemini(prompt: string, maxTokens: number): Promise<EvalCallResult> {
  const t0 = Date.now();
  const model = 'gemini-2.5-flash';
  const apiKey = process.env.EVAL_GEMINI_KEY;
  if (!apiKey) return emptyResult(0, 'EVAL_GEMINI_KEY missing');
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return emptyResult(Date.now() - t0, `${res.status} ${await res.text().catch(() => '')}`);
    const body = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const output = body.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const tokens_in = body.usageMetadata?.promptTokenCount ?? 0;
    const tokens_out = body.usageMetadata?.candidatesTokenCount ?? 0;
    return { output, tokens_in, tokens_out, latency_ms: Date.now() - t0, cost_usd: calculateCost(model, tokens_in, tokens_out) };
  } catch (e) {
    return emptyResult(Date.now() - t0, (e as Error).message);
  }
}

async function callGroq(prompt: string, maxTokens: number): Promise<EvalCallResult> {
  const t0 = Date.now();
  const model = 'llama-3.3-70b-versatile';
  const apiKey = process.env.EVAL_GROQ_KEY;
  if (!apiKey) return emptyResult(0, 'EVAL_GROQ_KEY missing');
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return emptyResult(Date.now() - t0, `${res.status} ${await res.text().catch(() => '')}`);
    const body = await res.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const output = body.choices?.[0]?.message?.content ?? '';
    const tokens_in = body.usage?.prompt_tokens ?? 0;
    const tokens_out = body.usage?.completion_tokens ?? 0;
    return { output, tokens_in, tokens_out, latency_ms: Date.now() - t0, cost_usd: calculateCost('llama-3.3-70b', tokens_in, tokens_out) };
  } catch (e) {
    return emptyResult(Date.now() - t0, (e as Error).message);
  }
}

export const EVAL_PROVIDERS: EvalProvider[] = [
  { provider: 'anthropic', model: 'claude-sonnet-4-6', call: callAnthropic },
  { provider: 'openai',    model: 'gpt-4o-mini',       call: callOpenAI },
  { provider: 'google',    model: 'gemini-2.5-flash',  call: callGemini },
  { provider: 'groq',      model: 'llama-3.3-70b',     call: callGroq },
];
