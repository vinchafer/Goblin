// Thin bridge to a local Ollama instance (http://localhost:11434).
// Only used when the Tauri desktop app runs in LOCAL mode.
// Cloud API never calls this — it's routed client-side by api-client.ts.

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const FETCH_TIMEOUT_MS = 5000;

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

export async function checkOllamaConnection(): Promise<{ connected: boolean; models: OllamaModel[] }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { connected: false, models: [] };
    const data = await res.json() as { models: OllamaModel[] };
    return { connected: true, models: data.models ?? [] };
  } catch {
    return { connected: false, models: [] };
  }
}

export async function ollamaStreamChat(
  model: string,
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const chunk = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
        if (chunk.message?.content) onChunk(chunk.message.content);
      } catch { /* skip malformed */ }
    }
  }
}
