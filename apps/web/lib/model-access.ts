export type ModelAccessType = 'free' | 'free-then-byok' | 'byok';

export interface ModelAccessInfo {
  type: ModelAccessType;
  label: string;
  description: string;
  setupHref: string;
}

const FALLBACK: ModelAccessInfo = {
  type: 'byok',
  label: 'BYOK',
  description: 'Benötigt einen eigenen API-Key des Providers. Pay-as-you-go.',
  setupHref: '/dashboard/settings/keys',
};

export const PROVIDER_ACCESS: Record<string, ModelAccessInfo> = {
  google: {
    type: 'free',
    label: 'Free',
    description: 'Kostenlos nutzbar mit einem Google-AI-Studio-Key. 1500 Anfragen/Tag gratis.',
    setupHref: '/onboarding/gemini/step-1',
  },
  groq: {
    type: 'free',
    label: 'Free',
    description: 'Kostenlos nutzbar mit einem Groq-Key. Sehr schnelle Antworten dank LPUs.',
    setupHref: '/onboarding/groq/step-1',
  },
  anthropic: {
    type: 'byok',
    label: 'BYOK',
    description: 'Benötigt einen eigenen Anthropic-Key. Pay-as-you-go, kein Free-Tier.',
    setupHref: '/onboarding/anthropic/step-1',
  },
  openai: {
    type: 'byok',
    label: 'BYOK',
    description: 'Benötigt einen eigenen OpenAI-Key. Pay-as-you-go.',
    setupHref: '/dashboard/settings/keys',
  },
  mistral: {
    type: 'free-then-byok',
    label: 'Free → BYOK',
    description: 'Mistral-Konsole bietet begrenzten Free-Tier, danach Pay-as-you-go.',
    setupHref: '/dashboard/settings/keys',
  },
  deepseek: {
    type: 'byok',
    label: 'BYOK',
    description: 'Benötigt einen eigenen DeepSeek-Key. Sehr günstig pro Token.',
    setupHref: '/dashboard/settings/keys',
  },
  xai: {
    type: 'byok',
    label: 'BYOK',
    description: 'Benötigt einen eigenen xAI-Key.',
    setupHref: '/dashboard/settings/keys',
  },
  openrouter: {
    type: 'byok',
    label: 'BYOK',
    description: 'OpenRouter-Key — ein Konto, viele Modelle. Du zahlst pro Anfrage.',
    setupHref: '/dashboard/settings/keys',
  },
};

export function getModelAccess(provider: string): ModelAccessInfo {
  return PROVIDER_ACCESS[provider.toLowerCase()] ?? FALLBACK;
}

export const ACCESS_COLORS: Record<ModelAccessType, { bg: string; fg: string; border: string }> = {
  'free': {
    bg: 'rgba(45, 74, 43, 0.10)',
    fg: 'var(--moss)',
    border: 'rgba(45, 74, 43, 0.24)',
  },
  'free-then-byok': {
    bg: 'rgba(201, 147, 58, 0.10)',
    fg: 'var(--ochre-dark, #8a6420)',
    border: 'rgba(201, 147, 58, 0.30)',
  },
  'byok': {
    bg: 'rgba(0, 0, 0, 0.04)',
    fg: 'var(--text-meta, #6b655a)',
    border: 'rgba(0, 0, 0, 0.10)',
  },
};
