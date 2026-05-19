'use client';

import { useParams } from 'next/navigation';
import { ProviderTutorial, type ProviderTutorialConfig } from '@/components/onboarding/ProviderTutorial';

const GEMINI_CONFIG: ProviderTutorialConfig = {
  provider: 'google',
  slug: 'gemini',
  displayName: 'Google Gemini',
  keyPrefix: 'AIza',
  placeholder: 'AIzaSy...',
  steps: [
    {
      title: 'Öffne Google AI Studio',
      description: 'Google AI Studio ist die offizielle Console für Gemini-API-Keys. Du brauchst einen Google-Account (Gmail reicht).',
      screenshot: '/brand/onboarding/gemini-step-1.png',
      cta: { label: 'aistudio.google.com öffnen →', url: 'https://aistudio.google.com' },
      hint: 'Tipp: Öffne den Link in einem neuen Tab, damit du hier weitermachen kannst.',
    },
    {
      title: 'Klick auf "Get API Key"',
      description: 'Oben links im Dashboard findest du den Button "Get API Key" (manchmal auch "Create API Key"). Klick drauf.',
      screenshot: '/brand/onboarding/gemini-step-2.png',
      hint: 'Bei erstmaliger Nutzung musst du eventuell die ToS akzeptieren.',
    },
    {
      title: 'Erstelle einen neuen Key',
      description: 'Klick auf "Create API key in new project" (oder existierendes Projekt wählen falls du schon eins hast). Der Key wird sofort generiert.',
      screenshot: '/brand/onboarding/gemini-step-3.png',
      hint: 'Der Key beginnt typisch mit "AIza" und ist ca. 40 Zeichen lang.',
    },
    {
      title: 'Key hier eintragen',
      description: 'Kopiere den Key aus Google AI Studio und füge ihn unten ein. Wir verschlüsseln ihn sofort — wir können ihn nie lesen.',
      screenshot: '',
    },
  ],
};

export default function GeminiTutorialStep() {
  const params = useParams();
  const raw = (params?.step as string) ?? '';
  const stepKey = raw.replace(/^step-/, '');
  return <ProviderTutorial config={GEMINI_CONFIG} stepKey={stepKey} />;
}
