export const ROUTES = {
  home: '/',
  login: '/login',
  dashboard: '/dashboard',
  project: (id: string) => `/dashboard/project/${id}`,
  settings: '/dashboard/settings',
  settingsKeys: '/dashboard/settings/keys',
  settingsIntegrations: '/dashboard/settings/integrations',
  settingsBilling: '/dashboard/settings/billing',
  terms: '/terms',
  privacy: '/privacy',
  imprint: '/imprint',
} as const;
