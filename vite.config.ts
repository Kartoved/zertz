import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'ZERTZ — абстрактная стратегическая игра',
        short_name: 'ZERTZ',
        description: 'Browser implementation of the ZERTZ board game',
        theme_color: '#4f46e5',
        background_color: '#1f2937',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
})
