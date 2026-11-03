// ============================================================================
// Gestionnaire d'Événements Web Push & Clics PWA — Thièsdn Billetterie
// Importé automatiquement par Workbox Service Worker via workbox.importScripts
// ============================================================================

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = {
        title: 'Notification Thièsdn',
        body: event.data.text(),
      };
    }
  }

  const title = data.title || '💰 Paiement à valider';
  const options = {
    body: data.body || 'Une commande en attente nécessite votre validation.',
    tag: data.tag || 'order-admin-alert',
    renotify: true,
    vibrate: [300, 150, 300, 150, 600],
    requireInteraction: true,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: {
      url: data.url || '/?tab=orders',
      dateOfArrival: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/?tab=orders';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Si une fenêtre de l'application est déjà ouverte, la focaliser puis naviguer vers l'onglet
      for (const client of windowClients) {
        if ('focus' in client) {
          return client
            .focus()
            .then((focusedClient) => {
              const target = focusedClient || client;
              if ('navigate' in target) {
                return target.navigate(targetUrl).catch(() => {});
              }
            })
            .catch(() => {});
        }
      }

      // 2. Sinon, ouvrir une nouvelle fenêtre vers l'URL cible
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
