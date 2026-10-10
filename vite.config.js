import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { Readable } from 'node:stream'

// Serves api/download.js during `npm run dev` (on Vercel it runs as an edge function)
function devApi() {
  return {
    name: 'dev-api-download',
    configureServer(server) {
      server.middlewares.use('/api/download', async (req, res) => {
        try {
          const { default: handler } = await server.ssrLoadModule('/api/download.js')
          const response = await handler(new Request('http://localhost/api/download' + req.url, { method: req.method }))
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          if (response.body) Readable.fromWeb(response.body).pipe(res)
          else res.end()
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(e) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    devApi(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app-icon.svg', 'app-icon-192.png', 'app-icon-512.png'],
      manifest: {
        name: 'GoreadNini',
        short_name: 'GoreadNini',
        description: 'A personal reading sanctuary - her books, her pace, her space.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#14153d',
        theme_color: '#14153d',
        categories: ['books', 'lifestyle'],
        icons: [
          { src: '/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/llrvlycosonztcgurdrt\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-cache', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 } },
          },
        ],
      },
    }),
  ],
})