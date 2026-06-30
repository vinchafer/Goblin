'use client';

// Preference Flow — re-runnable onboarding from Settings (Sprint 11).
// Internal name "Preference Flow"; user-facing label "Einrichtung & Tour" /
// "Setup & Tour" (FOUNDER TO CONFIRM the label). Two clear choices:
//   • Manuell einstellen — configure via the existing settings sections.
//   • Durch den Flow führen lassen — replay the guided /welcome flow.
// Re-running NEVER resets the account: it only re-shows the steps. We set a
// one-shot localStorage flag the onboarding chrome honors to allow re-entry for
// an already-completed user, then navigate to the first step.
import { useRouter } from 'next/navigation';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsRow } from '../ui/SettingsRow';
import { SettingsGroup } from '../ui/SettingsGroup';
import { useOnbLang } from '../../app/welcome/_components/i18n';

type Lang = 'de' | 'en';

const COPY: Record<Lang, {
  title: string; intro: string;
  guidedLabel: string; guidedHelp: string;
  manualLabel: string; manualHelp: string;
  note: string;
}> = {
  de: {
    title: 'Einrichtung & Tour',
    intro: 'Zu schnell durchgeklickt? Lass dich neu durch die Einrichtung führen — oder stell alles von Hand ein. Deine Projekte und Daten bleiben unberührt.',
    guidedLabel: 'Durch den Flow führen lassen',
    guidedHelp: 'Spielt die geführte Tour erneut ab: Modelle, Verbrauch und dein erster Build.',
    manualLabel: 'Manuell einstellen',
    manualHelp: 'Konfiguriere direkt über die Abschnitte Modelle, Konnektoren und Eingabesprache.',
    note: 'Das Wiederholen setzt nichts zurück — es zeigt nur die Schritte erneut.',
  },
  en: {
    title: 'Setup & Tour',
    intro: 'Clicked through too fast? Run the guided setup again — or configure everything by hand. Your projects and data stay untouched.',
    guidedLabel: 'Run the guided flow',
    guidedHelp: 'Replays the guided tour: models, consumption, and your first build.',
    manualLabel: 'Set up manually',
    manualHelp: 'Configure directly via the Models, Connectors and Input language sections.',
    note: 'Re-running resets nothing — it only re-shows the steps.',
  },
};

export function SetupTourPage() {
  const router = useRouter();
  // Reuse the onboarding language hook (reads goblin:preferred-lang, SSR-safe).
  const lang: Lang = useOnbLang();
  const t = COPY[lang];

  function runGuided() {
    try { window.localStorage.setItem('goblin:rerun-flow', '1'); } catch { /* ignore */ }
    router.push('/welcome/language');
  }

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <p className="helper-text" style={{ fontSize: 13, color: 'var(--text-meta)', margin: '8px 4px 16px', lineHeight: 1.5 }}>
        {t.intro}
      </p>

      <SettingsGroup label={t.title}>
        <SettingsCard>
          <SettingsRow label={t.guidedLabel} onClick={runGuided} />
          <div className="helper-text" style={{ fontSize: 12.5, color: 'var(--text-meta)', padding: '0 16px 12px', lineHeight: 1.5 }}>
            {t.guidedHelp}
          </div>
          <SettingsRow label={t.manualLabel} onClick={() => router.push('/dashboard/settings/keys')} />
          <div className="helper-text" style={{ fontSize: 12.5, color: 'var(--text-meta)', padding: '0 16px 12px', lineHeight: 1.5 }}>
            {t.manualHelp}
          </div>
        </SettingsCard>
      </SettingsGroup>

      <p className="helper-text" style={{ fontSize: 12, color: 'var(--text-meta)', margin: '12px 4px 0', lineHeight: 1.5 }}>
        {t.note}
      </p>
    </div>
  );
}
