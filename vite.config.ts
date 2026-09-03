import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Frontend dev server proxies /api, /auth, /callback and the /ws WebSocket to the
// Fastify backend. The backend port can be overridden with API_PORT.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // phones on the LAN can reach the Vite dev server too
    open: '/host',
    proxy: {
      '/api': `http://127.0.0.1:${process.env.API_PORT ?? 5178}`,
      '/auth': `http://127.0.0.1:${process.env.API_PORT ?? 5178}`,
      '/callback': `http://127.0.0.1:${process.env.API_PORT ?? 5178}`,
      '/ws': { target: `ws://127.0.0.1:${process.env.API_PORT ?? 5178}`, ws: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
