import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Configurable base path:
  // - Default './' produces relative asset URLs that work from domain root AND sub-paths.
  // - Set BASE_URL=/ for domain root or BASE_URL=/racer/ for a sub-path deployment.
  base: process.env.BASE_URL || './',
  server: {
    port: 3000,
    host: true,
    open: false,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
        credits: resolve(__dirname, 'credits.html'),
        contact: resolve(__dirname, 'contact.html'),
      },
    },
  },
});
