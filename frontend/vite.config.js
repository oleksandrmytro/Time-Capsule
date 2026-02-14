// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,          // сам HTTP‑сервер
    hmr: {
      protocol: 'ws',
      host: 'localhost', // как браузер обращается к сайту
      clientPort: 80,    // !! порт, КОТОРЫЙ видит БРАУЗЕР
      path: '/vite-dev'  // без /ws — Vite сам добавит
    },
    watch: { usePolling: true, interval: 300 }
  }
});
