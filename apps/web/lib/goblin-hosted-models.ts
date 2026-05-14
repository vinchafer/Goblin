export const GOBLIN_HOSTED_MODELS = [
  {
    id: 'goblin-hosted/qwen-coder-14b',
    name: 'Qwen Coder 14B',
    description: 'Open-source coding model, hosted by Goblin on Vast.ai',
    plans: ['build', 'pro', 'power'] as string[],
  },
  {
    id: 'goblin-hosted/llama-3.3-70b',
    name: 'Llama 3.3 70B',
    description: 'Meta Llama 70B — available on Pro and Power plans',
    plans: ['pro', 'power'] as string[],
  },
] as const;

export const GOBLIN_HOSTED_ENABLED = process.env.NEXT_PUBLIC_GOBLIN_HOSTED_ENABLED === 'true';
