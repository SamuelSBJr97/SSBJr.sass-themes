import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rootDir,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/icon-192.svg', 'icons/icon-512.svg'],
      manifest: {
        name: 'SSBJr Dashboard Demo',
        short_name: 'SSBJr Demo',
        description: 'Demo de dashboard + temas Sass (Bootstrap 4 compat) com presets de UI.',
        start_url: './index.html',
        scope: './',
        display: 'standalone',
        background_color: '#0b1220',
        theme_color: '#0ea5e9',
        icons: [
          { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' }
        ]
      },
      workbox: {
        // Cache de assets gerados pelo Vite + CSS dos temas copiados de /public
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2}']
      }
    })
  ],
  base: './',
  build: {
    outDir: resolve(rootDir, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(rootDir, 'index.html'),
        aurora: resolve(rootDir, 'aurora.html'),
        carbon: resolve(rootDir, 'carbon.html'),
        atlas: resolve(rootDir, 'atlas.html')
      }
    }
  }
});
