import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  // Base path must match the prod mount point.
  base: '/mod-ledger/',
  plugins: [react()],
  resolve: {
    alias: {
      // import.meta.dirname, not __dirname: vite 8.3's native config
      // loader warns on (and will eventually drop support for) CJS globals.
      '@': resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5174,
  },
});
