import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'sapphire-development-csp',
    apply: 'serve',
    transformIndexHtml: {
      order: 'post',
      handler: html => html.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';").replace("connect-src 'self' ", "connect-src 'self' ws://localhost:5173 "),
    },
  }],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/.tools/**', '**/.recovery/**', '**/.test-output/**', '**/.smoke-profile/**', '**/release/**', '**/native/publish/**', '**/native/test-output/**', '**/dist-electron/**'] },
  },
});
