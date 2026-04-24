import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import cesium from 'vite-plugin-cesium'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss(), cesium()],
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: { global: 'globalThis' },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    hmr: {
      protocol: 'wss',
      host: 'localhost',
      clientPort: 443,
      path: '/vite-dev',
    },
    watch: { usePolling: true, interval: 300 },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('leaflet') || id.includes('markercluster')) {
            return 'map-vendor'
          }
          if (id.includes('three') || id.includes('cesium')) {
            return '3d-vendor'
          }
          if (id.includes('@stomp') || id.includes('sockjs-client')) {
            return 'realtime-vendor'
          }

          return 'vendor'
        },
      },
    },
  },
})
