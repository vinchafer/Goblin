const GOBLIN_VERSION = new URL(location.href).searchParams.get('v') || '1.2.0';
const SHELL_CACHE = `goblin-shell-${GOBLIN_VERSION}`;
const STATIC_CACHE = `goblin-static-${GOBLIN_VERSION}`;

// App-shell URLs to pre-cache on install
const SHELL_URLS = [
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/badge-72.png',
];

// ── Lifecycle ────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_URLS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('goblin-') && k !== SHELL_CACHE && k !== STATIC_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => clients.claim())
  );
});

// ── Fetch Strategy ───────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, Chrome extensions, and browser-sync
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // API calls → network only (never cache)
  if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Static assets (icons, fonts, _next/static) → cache first
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/')
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML navigation → network first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful HTML responses in shell cache
          if (response.ok) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? caches.match('/offline.html') ?? offlineFallback();
        })
    );
    return;
  }

  // Default → network first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

function offlineFallback() {
  return new Response(
    '<!DOCTYPE html><html><body><h1>Offline</h1><p>Reconnect to continue.</p></body></html>',
    { headers: { 'Content-Type': 'text/html' } }
  );
}

// ── Push Notifications ───────────────────────────────────────────────────────

const NOTIFICATION_ACTIONS = {
  build_complete: [{ action: 'open_preview', title: 'Open Preview →' }],
  build_failed:   [{ action: 'view_logs',    title: 'View Logs →' }],
  code_generated: [{ action: 'review',       title: 'Review Code →' }],
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
      data: { url: data.url ?? '/dashboard', actionUrls: data.actionUrls ?? {} },
      actions,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data ?? {};
  const actionUrls = notifData.actionUrls ?? {};
  const url = (event.action && actionUrls[event.action]) ?? notifData.url ?? '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      const existing = windowClients.find(c => c.url.includes(url));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
