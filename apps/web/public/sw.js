const GOBLIN_VERSION = '1.0.0';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

const NOTIFICATION_ACTIONS = {
  build_complete: [
    { action: 'open_preview', title: 'Open Preview →' },
  ],
  build_failed: [
    { action: 'view_logs', title: 'View Logs →' },
  ],
  code_generated: [
    { action: 'review', title: 'Review Code →' },
  ],
};

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const actions = data.actions ?? NOTIFICATION_ACTIONS[data.tag] ?? [];
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Goblin', {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag ?? 'goblin-notification',
      data: { url: data.url ?? '/dashboard', actions: data.actionUrls ?? {} },
      actions,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data ?? {};
  const actionUrls = notifData.actions ?? {};
  // Use action-specific URL if available, otherwise fall back to notification URL
  const url = (event.action && actionUrls[event.action]) ?? notifData.url ?? '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      const existing = windowClients.find(c => c.url.includes(url));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
