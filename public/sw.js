// ============================================================================
// Service Worker Officiel PWA & Web Push — Thièsdn Billetterie
// Compilé via vite-plugin-pwa (injectManifest) -> pré-cache offline + Web Push
// ============================================================================

import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

self.skipWaiting();
clientsClaim();

// Pré-cache offline des assets Vite, WASM scanner et Shell SPA
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// Routage SPA offline (exclut les routes serverless /api et aperçus OG /event)
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//, /^\/event\//],
  })
);

// Ne jamais mettre en cache les requêtes temps réel / base de données Supabase
registerRoute(
  /^https:\/\/jgvuzlchemqcfygsylln\.supabase\.co\/.*/i,
  new NetworkOnly(),
  'GET'
);

// Cache adaptatif pour les images proxy WebP
registerRoute(
  /^https:\/\/images\.weserv\.nl\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'weserv-images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
  'GET'
);

// ============================================================================
// Réception Web Push en arrière-plan (même onglet fermé ou téléphone en veille)
// ============================================================================
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {
        title: 'Notification Thièsdn',
        body: event.data.text(),
      };
    }
  }

  const title =
    typeof payload.title === 'string' && payload.title.trim()
      ? payload.title.trim()
      : '🎟️ Notification Thièsdn';

  const body =
    typeof payload.body === 'string' && payload.body.trim()
      ? payload.body.trim()
      : 'Nouvelle activité sur votre espace Thièsdn Billetterie.';

  const targetUrl =
    payload.action_url ||
    payload.url ||
    (payload.data && (payload.data.action_url || payload.data.url)) ||
    '/';

  const options = {
    body,
    tag: payload.tag || 'thiesdn-notification',
    renotify: true,
    vibrate: [300, 150, 300, 150, 600],
    requireInteraction: true,
    icon: payload.icon || '/icon-192x192.png',
    badge: payload.badge || '/icon-192x192.png',
    data: {
      url: targetUrl,
      action_url: targetUrl,
      type: payload.type || 'info',
      dateOfArrival: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ============================================================================
// Clic sur une notification système : focus fenêtre existante ou ouverture PWA
// ============================================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawTarget =
    (event.notification.data &&
      (event.notification.data.action_url || event.notification.data.url)) ||
    '/';

  let absoluteTargetUrl = rawTarget;
  try {
    absoluteTargetUrl = new URL(rawTarget, self.location.origin).href;
  } catch {
    absoluteTargetUrl = `${self.location.origin}/`;
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url && client.url.startsWith(self.location.origin) && 'focus' in client) {
            return client
              .focus()
              .then((focused) => {
                const target = focused || client;
                if ('navigate' in target) {
                  return target.navigate(absoluteTargetUrl).catch(() => {});
                }
                return undefined;
              })
              .catch(() => {});
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(absoluteTargetUrl);
        }
        return undefined;
      })
  );
});

// ============================================================================
// Renouvellement silencieux si le navigateur régénère les clés Push
// ============================================================================
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const oldSub = event.oldSubscription;
        if (!oldSub || !oldSub.options || !oldSub.options.applicationServerKey) return;
        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: oldSub.options.applicationServerKey,
        });
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({
            type: 'PUSH_SUBSCRIPTION_CHANGED',
            subscription: newSub.toJSON(),
          });
        }
      } catch {
        // Ignoré silencieusement si l'utilisateur a révoqué les permissions
      }
    })()
  );
});
