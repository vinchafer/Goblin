'use client';

import { useParams } from 'next/navigation';
import { ProviderTutorial, type ProviderTutorialConfig } from '@/components/onboarding/ProviderTutorial';

const GROQ_CONFIG: ProviderTutorialConfig = {
  provider: 'groq',
  slug: 'groq',
  displayName: 'Groq',
  keyPrefix: 'gsk_',
  placeholder: 'gsk_...',
  steps: [
    {
      title: 'Öffne Groq Console',
      description: 'Groq Console ist der Ort wo du deinen API-Key generierst. Du brauchst einen Groq-Account (kostenlos).',
      screenshot: '/brand/onboarding/groq-step-1.png',
      cta: { label: 'console.groq.com öffnen →', url: 'https://console.groq.com' },
      hint: 'Falls noch kein Account: einfach mit Google oder Email registrieren.',
    },
    {
      title: 'Navigiere zu API Keys',
      description: 'Im Sidebar links findest du "API Keys". Klick drauf.',
      screenshot: '/brand/onboarding/groq-step-2.png',
    },
    {
      title: 'Create API Key',
      description: 'Klick auf "Create API Key" oben rechts. Gib einen Namen ein (z.B. "Goblin") und bestätige.',
      screenshot: '/brand/onboarding/groq-step-3.png',
      hint: 'Der Key beginnt mit "gsk_" und wird nur einmal angezeigt — sofort kopieren.',
    },
    {
      title: 'Key hier eintragen',
      description: 'Füge den Key unten ein. Verschlüsselt mit deinem persönlichen Encryption-Key.',
      screenshot: '',
    },
  ],
};

export default function GroqTutorialStep() {
  const params = useParams();
  const raw = (params?.step as string) ?? '';
  const stepKey = raw.replace(/^step-/, '');
  return <ProviderTutorial config={GROQ_CONFIG} stepKey={stepKey} />;
}
