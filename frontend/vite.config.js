import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['Logo.png'],
      manifest: {
        name: 'TrueKicks Store',
        short_name: 'TRUEKICKS',
        description: 'Premium Sneaker Marketplace',
        start_url: '/',
        theme_color: '#FF5500',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/Logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/Logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Pastikan SW baru langsung aktif & hapus cache deploy lama agar chunk lazy tidak stale
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/assets/],

        // Cache file statis
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        runtimeCaching: [
          // 1. Cache API Requests
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 1 hari
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // 2. Cache Gambar Produk (dari Supabase/CDN)
          {
            urlPattern: /^https:\/\/.*\.(jpg|jpeg|png|gif|webp|svg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 hari
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // 3. Cache Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets'
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 tahun
              }
            }
          }
        ]
      }
    })
  ],
  // Build optimization
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Pisahkan vendor libraries ke chunk terpisah
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          ui: ['react-icons', 'react-hot-toast'],
        }
      }
    },
    // Optimasi chunk size
    chunkSizeWarningLimit: 500,
  }
})