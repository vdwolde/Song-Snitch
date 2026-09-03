import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Frontend dev server proxies /api to the Fastify backend. The backend port can be
// overridden with API_PORT so the dev launcher can pick a free port when the default
// is already taken.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': `http://localhost:${process.env.API_PORT ?? 5178}`,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
