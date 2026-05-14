/**
 * Goblin Hosted — Layer C (Vast.ai / vLLM)
 *
 * Feature-flag: GOBLIN_HOSTED_ENABLED=true/false (default: false)
 * Endpoint:     GOBLIN_HOSTED_URL=https://<vast-instance>.vast.ai:port
 * API Key:      GOBLIN_HOSTED_API_KEY=<vllm-key>
 *
 * Activation: see infra/GOBLIN_HOSTED_ACTIVATION.md
 */

export const GOBLIN_HOSTED_MODELS = [
  {
    id: 'goblin-hosted/qwen-coder-14b',
    name: 'Qwen Coder 14B',
    description: 'Open-source coding model, hosted by Goblin',
    plans: ['build', 'pro', 'power'],
  },
  {
    id: 'goblin-hosted/llama-3.3-70b',
    name: 'Llama 3.3 70B',
    description: 'Meta Llama 70B, hosted by Goblin',
    plans: ['pro', 'power'],
  },
] as const;

export interface GoblinHostedConfig {
  endpoint: string;
  apiKey: string;
}

export function isGoblinHostedEnabled(): boolean {
  return process.env.GOBLIN_HOSTED_ENABLED === 'true';
}

export function getGoblinHostedConfig(): GoblinHostedConfig | null {
  if (!isGoblinHostedEnabled()) return null;

  const endpoint = process.env.GOBLIN_HOSTED_URL ?? process.env.GOBLIN_GPU_ENDPOINT;
  const apiKey = process.env.GOBLIN_HOSTED_API_KEY ?? process.env.GOBLIN_GPU_API_KEY;

  if (!endpoint || !apiKey) return null;

  return { endpoint, apiKey };
}

export function getGoblinHostedStatus(): { enabled: boolean; status: 'active' | 'coming_soon' | 'misconfigured' } {
  if (!isGoblinHostedEnabled()) {
    return { enabled: false, status: 'coming_soon' };
  }
  const config = getGoblinHostedConfig();
  if (!config) {
    return { enabled: false, status: 'misconfigured' };
  }
  return { enabled: true, status: 'active' };
}
