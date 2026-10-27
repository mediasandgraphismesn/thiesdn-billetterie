import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo-tight.png', 'logo.png', 'poster-kmou-jango.jpg', 'poster-saly-jazz.jpg'],
        manifest: {
          name: 'Thiès Days and Nights',
          short_name: 'Thièsdn',
          description: 'La billetterie officielle des événements de prestige au Sénégal.',
          theme_color: '#0A0A0A',
          background_color: '#0A0A0A',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/logo-tight.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/logo-tight.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 Mo pour autoriser le precache du bundle
          globPatterns: ['**/*.{js,css,html,png,svg,woff2,ico}'],
          runtimeCaching: [
            {
              // Ne JAMAIS mettre en cache les requêtes de base de données ou d'authentification Supabase
              urlPattern: /^https:\/\/jgvuzlchemqcfygsylln\.supabase\.co\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              // Cache adaptatif pour les images proxy WebP
              urlPattern: /^https:\/\/images\.weserv\.nl\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'weserv-images-cache',
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 7 * 24 * 60 * 60, // 7 jours
                },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
