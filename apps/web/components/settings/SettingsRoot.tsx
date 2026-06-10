'use client';

import { useState, useEffect } from 'react';
import { useSheetStack } from '../ui/SheetStack';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';
import { SettingsRow } from '../ui/SettingsRow';
import { ProfileCard } from './ProfileCard';
import { ProfilePage } from './ProfilePage';
import { FeaturesPage } from './FeaturesPage';
import { AppearancePage } from './AppearancePage';
import { LanguagePage } from './LanguagePage';
import { AboutPage } from './AboutPage';
import { BillingPage } from './BillingPage';
import { UsagePage } from './UsagePage';
import { PersonalizationPage } from './PersonalizationPage';
import { ConnectorsPage } from './ConnectorsPage';
import { NotificationsPage } from './NotificationsPage';
import { PrivacyPage } from './PrivacyPage';
import { ReportProblemPage } from './ReportProblemPage';
import { HelpCenterPage } from './HelpCenterPage';
import { ModelsPage } from './ModelsPage';
import { useUser } from '@/lib/hooks/useUser';
import { useAuth } from '@/lib/hooks/useAuth';
import { useApp } from '@/contexts/app-context';

const I = {
  Dollar: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5c0-1 1-2 3-2s3 1 3 2-1 1.5-3 2-3 1-3 2 1 2 3 2 3-1 3-2"/></svg>,
  Chart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>,
  Sparkles: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/></svg>,
  Sliders: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2" fill="var(--panel)"/><circle cx="15" cy="12" r="2" fill="var(--panel)"/><circle cx="11" cy="18" r="2" fill="var(--panel)"/></svg>,
  Plug: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="17.5" x2="21" y2="17.5"/></svg>,
  Key: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/></svg>,
  Moon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Palette: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><circle cx="7" cy="10" r="1.5" fill="currentColor"/><circle cx="12" cy="7" r="1.5" fill="currentColor"/><circle cx="17" cy="10" r="1.5" fill="currentColor"/><circle cx="15" cy="15" r="1.5" fill="currentColor"/></svg>,
  Globe: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>,
  Bell: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>,
  Vibrate: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="8" y="4" width="8" height="16" rx="1"/><line x1="4" y1="9" x2="4" y2="15"/><line x1="20" y1="9" x2="20" y2="15"/></svg>,
  Shield: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l8 4v5a9 9 0 0 1-8 9 9 9 0 0 1-8-9V7l8-4z"/><path d="M9 12l2 2 4-4"/></svg>,
  Flag: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 21V4h12l-2 4 2 4H4"/></svg>,
  Question: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>,
  Info: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/></svg>,
  LogOut: ({ color = 'currentColor' }: { color?: string }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

type Appearance = 'System' | 'Hell' | 'Dunkel';

export function SettingsRoot() {
  const user = useUser();
  const { signOut } = useAuth();
  const { push } = useSheetStack();
  const { settingsInitialItem, setSettingsInitialItem } = useApp();
  const [hapticEnabled, setHapticEnabled] = useState<boolean>(true);
  const [appearance, setAppearance] = useState<Appearance>('System');

  useEffect(() => {
    setHapticEnabled(localStorage.getItem('goblin-haptic') !== 'false');
    const stored = localStorage.getItem('goblin_theme');
    if (stored === 'light') setAppearance('Hell');
    else if (stored === 'dark') setAppearance('Dunkel');
    else setAppearance('System');
  }, []);

  // WALK2-3 (Phase 3): honour the deep-link section on MOBILE too. The desktop
  // modal reads the URL hash, but the mobile sheet always opened at the root — so
  // the GitHub OAuth return (`?settings=connectors&github=connected`) landed on the
  // settings root instead of the Konnektoren page showing "Verbunden". Push the
  // deep-linked section onto the stack once on mount, then clear it.
  useEffect(() => {
    if (!settingsInitialItem) return;
    const map: Record<string, [string, React.ReactNode, string]> = {
      profile: ['profile', <ProfilePage key="p" />, 'Profil'],
      billing: ['billing', <BillingPage key="b" />, 'Abrechnung'],
      usage: ['usage', <UsagePage key="u" />, 'Nutzung'],
      personalization: ['personalization', <PersonalizationPage key="pe" />, 'Personalisierung'],
      features: ['features', <FeaturesPage key="f" />, 'Funktionen'],
      connectors: ['connectors', <ConnectorsPage key="c" />, 'Konnektoren'],
      models: ['models', <ModelsPage key="m" />, 'Modelle'],
      language: ['language', <LanguagePage key="l" />, 'Eingabesprache'],
      notifications: ['notifications', <NotificationsPage key="n" />, 'Benachrichtigungen'],
      privacy: ['privacy', <PrivacyPage key="pr" />, 'Datenschutz'],
      report: ['report', <ReportProblemPage key="r" />, 'Problem melden'],
      help: ['help', <HelpCenterPage key="h" />, 'Hilfecenter'],
      about: ['about', <AboutPage key="a" />, 'Über Goblin'],
    };
    const entry = map[settingsInitialItem];
    setSettingsInitialItem(null);
    if (entry) push(entry[0], entry[1], entry[2]);
    // once on mount — the deep-link is a full navigation into the sheet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleHapticChange = (v: boolean) => {
    setHapticEnabled(v);
    localStorage.setItem('goblin-haptic', String(v));
  };

  const handleAppearanceChange = (v: Appearance) => {
    setAppearance(v);
    const key = v === 'Hell' ? 'light' : v === 'Dunkel' ? 'dark' : 'system';
    localStorage.setItem('goblin_theme', key);
  };

  return (
    <div style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <ProfileCard
        avatarUrl={user.avatarUrl}
        name={user.fullName || 'Vincent'}
        email={user.email}
        plan={user.plan.name}
        onClick={() => push('profile', <ProfilePage />, 'Profil')}
      />

      <SettingsGroup label="Konto">
        <SettingsCard>
          <SettingsRow
            testId="row-abrechnung"
            icon={<I.Dollar />}
            label="Abrechnung"
            right={user.plan.name}
            onClick={() => push('billing', <BillingPage />, 'Abrechnung')}
          />
          <SettingsRow
            testId="row-nutzung"
            icon={<I.Chart />}
            label="Nutzung"
            onClick={() => push('usage', <UsagePage />, 'Nutzung')}
          />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label="Goblin">
        <SettingsCard>
          <SettingsRow
            testId="row-personalisierung"
            icon={<I.Sparkles />}
            label="Personalisierung"
            onClick={() => push('personalization', <PersonalizationPage />, 'Personalisierung')}
          />
          <SettingsRow
            testId="row-funktionen"
            icon={<I.Sliders />}
            label="Funktionen"
            onClick={() => push('features', <FeaturesPage />, 'Funktionen')}
          />
          <SettingsRow
            testId="row-konnektoren"
            icon={<I.Plug />}
            label="Konnektoren"
            onClick={() => push('connectors', <ConnectorsPage />, 'Konnektoren')}
          />
          <SettingsRow
            testId="row-models"
            icon={<I.Key />}
            label="Modelle"
            onClick={() => push('models', <ModelsPage />, 'Modelle')}
          />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label="Design">
        <SettingsCard>
          <SettingsRow
            testId="row-appearance"
            icon={<I.Moon />}
            label="Erscheinungsbild"
            right={appearance}
            rightVariant="dropdown"
            onClick={() => push('appearance', <AppearancePage value={appearance} onChange={handleAppearanceChange} />, 'Erscheinungsbild')}
          />
          <SettingsRow
            testId="row-accent"
            icon={<I.Palette />}
            label="Akzentfarbe"
            right="Bald"
            rightVariant="text"
            disabled
          />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label="App">
        <SettingsCard>
          <SettingsRow
            testId="row-language"
            icon={<I.Globe />}
            label="Eingabesprache"
            right="DE"
            onClick={() => push('language', <LanguagePage />, 'Eingabesprache')}
          />
          <SettingsRow
            testId="row-notifications"
            icon={<I.Bell />}
            label="Benachrichtigungen"
            onClick={() => push('notifications', <NotificationsPage />, 'Benachrichtigungen')}
          />
          <SettingsRow
            testId="row-haptic"
            icon={<I.Vibrate />}
            label="Haptisches Feedback"
            rightVariant="toggle"
            value={hapticEnabled}
            onChange={handleHapticChange}
          />
          <SettingsRow
            testId="row-privacy"
            icon={<I.Shield />}
            label="Datenschutz"
            onClick={() => push('privacy', <PrivacyPage />, 'Datenschutz')}
          />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label="Hilfe">
        <SettingsCard>
          <SettingsRow
            testId="row-report"
            icon={<I.Flag />}
            label="Problem melden"
            onClick={() => push('report', <ReportProblemPage />, 'Problem melden')}
          />
          <SettingsRow
            testId="row-help"
            icon={<I.Question />}
            label="Hilfecenter"
            onClick={() => push('help', <HelpCenterPage />, 'Hilfecenter')}
          />
          <SettingsRow
            testId="row-about"
            icon={<I.Info />}
            label="Über Goblin"
            onClick={() => push('about', <AboutPage />, 'Über Goblin')}
          />
        </SettingsCard>
      </SettingsGroup>

      <button
        onClick={signOut}
        data-testid="row-signout"
        style={{
          width: '100%',
          padding: 16,
          marginTop: 8,
          background: 'var(--panel)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--rust)',
          fontSize: 17,
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          justifyContent: 'center',
        }}
      >
        <I.LogOut color="var(--rust)" /> Abmelden
      </button>
    </div>
  );
}
