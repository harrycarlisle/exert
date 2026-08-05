/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function resolveBuildSha(): string {
  if (process.env.GITHUB_SHA && process.env.GITHUB_SHA.trim()) {
    return process.env.GITHUB_SHA.trim()
  }
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

function litterLogVersionPlugin(sha: string, builtAt: string): Plugin {
  const shortSha = sha === 'dev' ? 'dev' : sha.slice(0, 7)
  const payload = JSON.stringify(
    {
      sha,
      shortSha,
      builtAt,
    },
    null,
    2,
  )
  return {
    name: 'litter-log-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${payload}\n`,
      })
    },
  }
}

/**
 * GitHub project Pages hosts this app at https://harrycarlisle.github.io/exert/
 * Production builds therefore use base `/exert/`.
 * Local `vite` / `vite preview` default to `/` unless BASE_PATH is set.
 */
export default defineConfig(({ command }) => {
  const base = process.env.BASE_PATH || (command === 'build' ? '/exert/' : '/')
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const appPath = normalizedBase === './' ? '/' : normalizedBase
  const buildSha = resolveBuildSha()
  const buildTime = new Date().toISOString()

  return {
    base,
    define: {
      __LITTER_LOG_BUILD_SHA__: JSON.stringify(buildSha),
      __LITTER_LOG_BUILD_TIME__: JSON.stringify(buildTime),
    },
    plugins: [
      react(),
      litterLogVersionPlugin(buildSha, buildTime),
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
          // Never precache version.json — it must always be network-fetched.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          globIgnores: ['**/version.json'],
          // Relative to base — must NOT be root-absolute "/index.html".
          navigateFallback: 'index.html',
          navigateFallbackAllowlist: [/^(?!\/__).*/],
          // Drop outdated precaches so Home Screen PWAs pick up new hashed assets.
          cleanupOutdatedCaches: true,
          // Claim clients after skipWaiting so Update now activates the new bundle.
          clientsClaim: true,
          // Keep false so activation waits for an explicit Update now action.
          skipWaiting: false,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.endsWith('/version.json'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'litter-log-navigations',
                networkTimeoutSeconds: 4,
              },
            },
            {
              urlPattern: ({ request, url }) =>
                request.destination === 'script' ||
                request.destination === 'style' ||
                request.destination === 'image' ||
                /\/assets\/.+\.[a-f0-9]{8}\.(js|css)$/.test(url.pathname),
              handler: 'CacheFirst',
              options: {
                cacheName: 'litter-log-immutable-assets',
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
          ],
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
