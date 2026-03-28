import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

// Workbox injects precache manifest here
precacheAndRoute(self.__WB_MANIFEST);

// API routes — always network-only
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly()
);

// SPA navigation fallback
registerRoute(
  new NavigationRoute(async () => {
    const cache = await caches.open('zertz-shell');
    return (await cache.match('/index.html')) || fetch('/index.html');
  })
);

// ─── Push notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Zertz', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Zertz';
  const options = {
    body: data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.type || 'zertz',
    renotify: true,
    data: { roomId: data.roomId || null, url: self.location.origin },
  };

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const appFocused = clients.some((c) => c.focused);
        if (appFocused) return;
        return self.registration.showNotification(title, options);
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url, roomId } = event.notification.data || {};
  const targetUrl = roomId ? `${url}/room/${roomId}` : (url || '/');

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.startsWith(url) && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
