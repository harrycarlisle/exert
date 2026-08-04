/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * GitHub project Pages hosts this app at https://harrycarlisle.github.io/exert/
 * Production builds therefore use base `/exert/`.
 * Local `vite` / `vite preview` default to `/` unless BASE_PATH is set.
 */
export default defineConfig(({ command }) => {
  const base = process.env.BASE_PATH || (command === 'build' ? '/exert/' : '/')
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const appPath = normalizedBase === './' ? '/' : normalizedBase

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
        manifest: {
          id: appPath,
          name: 'Litter Log',
          short_name: 'Litter Log',
          description:
            'One-tap private litter tracking for pee, poo, and tried-to-pee events. Stored only on this device.',
          theme_color: '#2e6f73',
          background_color: '#f7f4ef',
          display: 'standalone',
          orientation: 'portrait',
          // Keep scope/start_url aligned with Vite base ( /exert/ on Pages ).
          scope: appPath,
          start_url: appPath,
          lang: 'en',
          categories: ['medical', 'utilities', 'lifestyle'],
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          // Relative to base — must NOT be root-absolute "/index.html".
          navigateFallback: 'index.html',
          navigateFallbackAllowlist: [/^(?!\/__).*/],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: false,
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      globals: true,
      css: true,
      exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**'],
    },
  }
})
