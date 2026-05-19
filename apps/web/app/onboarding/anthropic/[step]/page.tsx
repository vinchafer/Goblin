'use client';

import { useParams } from 'next/navigation';
import { ProviderTutorial, type ProviderTutorialConfig } from '@/components/onboarding/ProviderTutorial';

const ANTHROPIC_CONFIG: ProviderTutorialConfig = {
  provider: 'anthropic',
  slug: 'anthropic',
  displayName: 'Anthropic Claude',
  keyPrefix: 'sk-ant-',
  placeholder: 'sk-ant-...',
  steps: [
    {
      title: 'Öffne Anthropic Console',
      description: 'Anthropic Console ist der Ort wo du Claude-API-Keys generierst. Anthropic hat keinen Free-Tier — du brauchst Kreditkarte. Erste $5 kostenlos beim Signup.',
      screenshot: '/brand/onboarding/anthropic-step-1.png',
      cta: { label: 'console.anthropic.com öffnen →', url: 'https://console.anthropic.com' },
      hint: 'Tipp: Setze ein monatliches Budget-Limit von $20 in den Settings. Damit kannst du nicht überraschend zu viel ausgeben.',
    },
    {
      title: 'API Keys → Create Key',
      description: 'Settings → API Keys → Create Key. Name: "Goblin". Kopiere den Key sofort — er wird nur einmal angezeigt.',
      screenshot: '/brand/onboarding/anthropic-step-2.png',
      hint: 'Der Key beginnt mit "sk-ant-" und ist ca. 100 Zeichen lang.',
    },
    {
      title: 'Key hier eintragen',
      description: 'Füge den Key unten ein. Test-Request läuft automatisch.',
      screenshot: '',
    },
  ],
};

export default function AnthropicTutorialStep() {
  const params = useParams();
  const raw = (params?.step as string) ?? '';
  const stepKey = raw.replace(/^step-/, '');
  return <ProviderTutorial config={ANTHROPIC_CONFIG} stepKey={stepKey} />;
}
