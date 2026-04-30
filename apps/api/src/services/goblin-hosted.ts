/**
 * Goblin Hosted — Phase 3 GPU Inference (Clore.ai / vLLM)
 *
 * Dieser Service ist ein Placeholder für den späteren Betrieb
 * eigener GPU-Inferenz (vLLM-kompatibel). Momentan nicht aktiv.
 *
 * Env-Vars (werden in .env dokumentiert):
 *   GOBLIN_GPU_ENDPOINT=https://<your-clore-instance>.clore.ai/v1
 *   GOBLIN_GPU_API_KEY=sk-...
 */

export class GoblinHostedNotConfiguredError extends Error {
  constructor() {
    super('Goblin Hosted GPU inference is not configured (Phase 3). Set GOBLIN_GPU_ENDPOINT to enable.');
    this.name = 'GoblinHostedNotConfiguredError';
  }
}

export interface GoblinHostedConfig {
  endpoint: string;
  apiKey: string;
}

export function getGoblinHostedConfig(): GoblinHostedConfig | null {
  const endpoint = process.env.GOBLIN_GPU_ENDPOINT;
  const apiKey = process.env.GOBLIN_GPU_API_KEY;

  if (!endpoint || !apiKey) {
    return null;
  }

  return { endpoint, apiKey };
}

export function getGoblinHostedModels(): string[] {
  // Phase 3: wird später dynamisch von vLLM abgefragt
  // Vorgesehene Modelle: Llama 3.3 70B, DeepSeek-R1, Qwen 2.5 72B
  return ['goblin-hosted-llama-3.3-70b', 'goblin-hosted-deepseek-r1'];
}

/**
 * Erzeugt einen OpenAI-kompatiblen Client für den GPU-Endpoint.
 * (vLLM bietet standard-kompatiblen Chat Completions Endpoint)
 */
export function createGoblinHostedClient() {
  const config = getGoblinHostedConfig();
  if (!config) {
    throw new GoblinHostedNotConfiguredError();
  }

  // Re-export: OpenAI-kompatible Konfiguration
  return {
    baseURL: config.endpoint,
    apiKey: config.apiKey,
    defaultModel: 'goblin-hosted-llama-3.3-70b',
  };
}

import OpenAI from 'openai'

const GPU_ENDPOINT = process.env.GOBLIN_GPU_ENDPOINT
const GPU_API_KEY = process.env.GOBLIN_GPU_API_KEY ?? 'goblin'

export function isGoblinHostedAvailable(): boolean {
  return !!GPU_ENDPOINT
}

export async function goblinHostedStream(
  messages: Array<{role: 'user' | 'assistant' | 'system', content: string}>,
  model: string = 'qwen2.5-coder-32b-instruct',
  onToken: (token: string) => void
): Promise<void> {
  if (!GPU_ENDPOINT) throw new Error('Goblin Hosted not configured')

  const client = new OpenAI({
    baseURL: `${GPU_ENDPOINT}/v1`,
    apiKey: GPU_API_KEY
  })

  const stream = await client.chat.completions.create({
    model,
    messages: messages as any, // Type assertion for OpenAI SDK compatibility
    stream: true,
    max_tokens: 4096
  })

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? ''
    if (token) onToken(token)
  }
}
