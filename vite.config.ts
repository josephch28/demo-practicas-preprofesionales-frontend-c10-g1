import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Las fuentes (@fontsource) se empaquetan como assets con extensión
      // woff/woff2: si no entran al precache, la app arranca sin red pero sin tipografía.
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },
      manifest: {
        name: 'Prácticas preprofesionales',
        short_name: 'Prácticas',
        description: 'Cliente offline-first para gestión de prácticas preprofesionales.',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        theme_color: '#6B4BA8',
        background_color: '#EDF0EE',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
