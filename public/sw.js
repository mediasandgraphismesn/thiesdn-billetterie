// ============================================================================
// Service Worker Officiel PWA & Web Push — Thièsdn Billetterie
// Compilé via vite-plugin-pwa (injectManifest) -> pré-cache offline + Web Push
// ============================================================================

import { clientsClaim, setCacheNameDetails } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  matchPrecache,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

const CACHE_VERSION = 'v2026-11-16-2';

setCacheNameDetails({
  prefix: 'thiesdn',
  suffix: CACHE_VERSION,
  precache: 'precache',
  runtime: 'runtime',
});

self.skipWaiting();
clientsClaim();

// Purge immédiate des anciens caches ne correspondant pas à la version courante
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => !name.includes(CACHE_VERSION) && name !== 'weserv-images-cache')
          .map((name) => caches.delete(name))
      )
    )
  );
});

// Empêche de servir ou mettre en cache une réponse HTML à la place d'un bundle JS/CSS
const rejectHtmlForAssetPlugin = {
  fetchDidSucceed: async ({ response }) => {
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html')) {
      throw new Error('Invalid MIME type text/html received for JS/CSS asset');
    }
    return response;
  },
  cacheWillUpdate: async ({ response }) => {
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!response || !response.ok || contentType.includes('text/html')) {
      return null;
    }
    return response;
  },
};

const assetsNetworkFirst = new NetworkFirst({
  cacheName: `thiesdn-assets-${CACHE_VERSION}`,
  networkTimeoutSeconds: 4,
  plugins: [
    rejectHtmlForAssetPlugin,
    new ExpirationPlugin({
      maxEntries: 80,
      maxAgeSeconds: 7 * 24 * 60 * 60,
    }),
  ],
});

// Stratégie NetworkFirst pour .js, .css et .html (zéro chunk obsolète / zéro erreur MIME text/html)
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    (request.destination === 'script' ||
      request.destination === 'style' ||
      /\.(?:js|mjs|css)$/i.test(url.pathname)),
  async (params) => {
    try {
      const response = await assetsNetworkFirst.handle(params);
      if (response) return response;
    } catch {
      // Fallback vers le precache offline si réseau indisponible
    }
    const precached = await matchPrecache(params.request.url);
    return precached || Response.error();
  },
  'GET'
);

// Pré-cache offline des assets Vite, WASM scanner et Shell SPA
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

const pagesNetworkFirst = new NetworkFirst({
  cacheName: `thiesdn-pages-${CACHE_VERSION}`,
  networkTimeoutSeconds: 4,
  plugins: [
    new ExpirationPlugin({
      maxEntries: 20,
      maxAgeSeconds: 24 * 60 * 60,
    }),
  ],
});

// Routage SPA NetworkFirst pour les pages HTML (exclut /api, /event, /assets et extensions fichiers)
registerRoute(
  new NavigationRoute(
    async (params) => {
      try {
        const response = await pagesNetworkFirst.handle(params);
        if (response) return response;
      } catch {
        // Fallback offline vers le shell index.html pré-caché
      }
      const cached = await matchPrecache('index.html');
      return cached || Response.error();
    },
    {
      denylist: [/^\/api\//, /^\/event\//, /^\/assets\//, /\.[a-zA-Z0-9]{1,8}$/],
    }
  )
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
