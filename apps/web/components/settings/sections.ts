/**
 * SETTINGS SECTION REGISTRY — Source of truth for the DESKTOP
 * Settings modal (SettingsModal.tsx).
 *
 * MOBILE NOTE: The mobile sheet (SettingsRoot.tsx) currently
 * maintains its OWN inline list of sections because individual
 * rows carry runtime-dynamic right-side values (plan name,
 * current theme, language code) that can't be expressed
 * statically here without restructuring the mobile UX.
 *
 * This means section ORDERING and GROUPING live in TWO places:
 *   1. SETTINGS_SECTIONS below (desktop modal)
 *   2. SettingsRoot.tsx inline pushes (mobile sheet)
 *
 * When adding a new section, add it to BOTH places. When
 * reordering, update BOTH places. The section COMPONENTS
 * themselves are shared (registry references them directly).
 *
 * Future work: collapse to single SSOT once the mobile sheet's
 * dynamic-right-values can be captured per-row in the registry.
 */
import type { ComponentType } from 'react';
import { createElement as h } from 'react';
import { ProfilePage } from './ProfilePage';
import { BillingPage } from './BillingPage';
import { UsagePage } from './UsagePage';
import { PersonalizationPage } from './PersonalizationPage';
import { FeaturesPage } from './FeaturesPage';
import { ConnectorsPage } from './ConnectorsPage';
import { ModelsPage } from './ModelsPage';
import { SetupTourPage } from './SetupTourPage';
import { AppearanceSection } from './AppearanceSection';
import { LanguagePage } from './LanguagePage';
import { NotificationsPage } from './NotificationsPage';
import { PrivacyPage } from './PrivacyPage';
import { ReportProblemPage } from './ReportProblemPage';
import { HelpCenterPage } from './HelpCenterPage';
import { AboutPage } from './AboutPage';

// Single source of truth for the navigable Settings sections, consumed by the
// desktop SettingsModal. Icons + labels match SettingsRoot's canonical mobile
// list verbatim (§A5.6). Non-page rows on mobile (Akzentfarbe disabled,
// Haptisches Feedback toggle, Abmelden action) are NOT sections and are not
// listed here. Section components are referenced, never modified.

type IconCmp = ComponentType;

const svg = (...children: ReturnType<typeof h>[]) =>
  h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }, ...children);

export const Icons = {
  User:     (() => svg(h('circle', { cx: 12, cy: 8, r: 4, key: 'c' }), h('path', { d: 'M4 21a8 8 0 0 1 16 0', key: 'p' }))) as IconCmp,
  Dollar:   (() => svg(h('circle', { cx: 12, cy: 12, r: 9, key: 'c' }), h('path', { d: 'M12 7v10M9 9.5c0-1 1-2 3-2s3 1 3 2-1 1.5-3 2-3 1-3 2 1 2 3 2 3-1 3-2', key: 'p' }))) as IconCmp,
  Chart:    (() => svg(h('path', { d: 'M3 3v18h18', key: 'a' }), h('path', { d: 'M7 14l4-4 3 3 5-6', key: 'b' }))) as IconCmp,
  Sparkles: (() => svg(h('path', { d: 'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z', key: 'a' }))) as IconCmp,
  Sliders:  (() => svg(h('line', { x1: 4, y1: 6, x2: 20, y2: 6, key: 'a' }), h('line', { x1: 4, y1: 12, x2: 20, y2: 12, key: 'b' }), h('line', { x1: 4, y1: 18, x2: 20, y2: 18, key: 'c' }), h('circle', { cx: 9, cy: 6, r: 2, fill: 'var(--surface-1)', key: 'd' }), h('circle', { cx: 15, cy: 12, r: 2, fill: 'var(--surface-1)', key: 'e' }), h('circle', { cx: 11, cy: 18, r: 2, fill: 'var(--surface-1)', key: 'f' }))) as IconCmp,
  Plug:     (() => svg(h('rect', { x: 3, y: 3, width: 7, height: 7, key: 'a' }), h('rect', { x: 14, y: 3, width: 7, height: 7, key: 'b' }), h('rect', { x: 3, y: 14, width: 7, height: 7, key: 'c' }), h('line', { x1: 14, y1: 17.5, x2: 21, y2: 17.5, key: 'd' }))) as IconCmp,
  Key:      (() => svg(h('circle', { cx: 8, cy: 15, r: 4, key: 'a' }), h('path', { d: 'M11 12l9-9M16 7l3 3', key: 'b' }))) as IconCmp,
  Moon:     (() => svg(h('path', { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z', key: 'a' }))) as IconCmp,
  Globe:    (() => svg(h('circle', { cx: 12, cy: 12, r: 9, key: 'a' }), h('path', { d: 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18', key: 'b' }))) as IconCmp,
  Compass:  (() => svg(h('circle', { cx: 12, cy: 12, r: 9, key: 'a' }), h('path', { d: 'M16 8l-2.5 5.5L8 16l2.5-5.5L16 8z', key: 'b' }))) as IconCmp,
  Bell:     (() => svg(h('path', { d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', key: 'a' }), h('path', { d: 'M10 21a2 2 0 0 0 4 0', key: 'b' }))) as IconCmp,
  Shield:   (() => svg(h('path', { d: 'M12 3l8 4v5a9 9 0 0 1-8 9 9 9 0 0 1-8-9V7l8-4z', key: 'a' }), h('path', { d: 'M9 12l2 2 4-4', key: 'b' }))) as IconCmp,
  Flag:     (() => svg(h('path', { d: 'M4 21V4h12l-2 4 2 4H4', key: 'a' }))) as IconCmp,
  Question: (() => svg(h('circle', { cx: 12, cy: 12, r: 9, key: 'a' }), h('path', { d: 'M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5', key: 'b' }), h('circle', { cx: 12, cy: 17, r: 0.5, fill: 'currentColor', key: 'c' }))) as IconCmp,
  Info:     (() => svg(h('circle', { cx: 12, cy: 12, r: 9, key: 'a' }), h('line', { x1: 12, y1: 11, x2: 12, y2: 16, key: 'b' }), h('circle', { cx: 12, cy: 8, r: 0.5, fill: 'currentColor', key: 'c' }))) as IconCmp,
};

export type SettingsGroupId = 'konto' | 'goblin' | 'design' | 'app' | 'hilfe';

export interface SettingsSectionDef {
  id: string;
  label: string;
  labelEn: string;
  icon: IconCmp;
  Component: ComponentType;
  group: SettingsGroupId;
}

export const GROUP_LABELS: Record<SettingsGroupId, string> = {
  konto: 'Konto',
  goblin: 'Goblin',
  design: 'Design',
  app: 'App',
  hilfe: 'Hilfe',
};

export const GROUP_LABELS_EN: Record<SettingsGroupId, string> = {
  konto: 'Account',
  goblin: 'Goblin',
  design: 'Design',
  app: 'App',
  hilfe: 'Help',
};

export const GROUP_ORDER: SettingsGroupId[] = ['konto', 'goblin', 'design', 'app', 'hilfe'];

export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  { id: 'profile',         label: 'Profil',             labelEn: 'Profile',          icon: Icons.User,     Component: ProfilePage,         group: 'konto' },
  { id: 'billing',         label: 'Abrechnung',         labelEn: 'Billing',          icon: Icons.Dollar,   Component: BillingPage,         group: 'konto' },
  { id: 'usage',           label: 'Nutzung',            labelEn: 'Usage',            icon: Icons.Chart,    Component: UsagePage,           group: 'konto' },
  { id: 'personalization', label: 'Personalisierung',   labelEn: 'Personalization',  icon: Icons.Sparkles, Component: PersonalizationPage, group: 'goblin' },
  { id: 'setup-tour',      label: 'Einrichtung & Tour', labelEn: 'Setup & Tour',     icon: Icons.Compass,  Component: SetupTourPage,       group: 'goblin' },
  { id: 'features',        label: 'Funktionen',         labelEn: 'Features',         icon: Icons.Sliders,  Component: FeaturesPage,        group: 'goblin' },
  { id: 'connectors',      label: 'Konnektoren',        labelEn: 'Connectors',       icon: Icons.Plug,     Component: ConnectorsPage,      group: 'goblin' },
  { id: 'models',          label: 'Modelle',            labelEn: 'Models',           icon: Icons.Key,      Component: ModelsPage,          group: 'goblin' },
  { id: 'appearance',      label: 'Erscheinungsbild',   labelEn: 'Appearance',       icon: Icons.Moon,     Component: AppearanceSection,   group: 'design' },
  { id: 'language',        label: 'Eingabesprache',     labelEn: 'Input language',   icon: Icons.Globe,    Component: LanguagePage,        group: 'app' },
  { id: 'notifications',   label: 'Benachrichtigungen', labelEn: 'Notifications',    icon: Icons.Bell,     Component: NotificationsPage,   group: 'app' },
  { id: 'privacy',         label: 'Datenschutz',        labelEn: 'Privacy',          icon: Icons.Shield,   Component: PrivacyPage,         group: 'app' },
  { id: 'report',          label: 'Problem melden',     labelEn: 'Report a problem', icon: Icons.Flag,     Component: ReportProblemPage,   group: 'hilfe' },
  { id: 'help',            label: 'Hilfecenter',        labelEn: 'Help center',      icon: Icons.Question, Component: HelpCenterPage,       group: 'hilfe' },
  { id: 'about',           label: 'Über Goblin',        labelEn: 'About Goblin',     icon: Icons.Info,     Component: AboutPage,            group: 'hilfe' },
];
