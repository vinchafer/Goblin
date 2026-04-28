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