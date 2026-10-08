import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { pwa } from './pwa-plugin';

export default defineConfig({
  plugins: [react(), tailwindcss(), pwa()],
  build: { sourcemap: false, target: 'es2022', rolldownOptions: { output: { minify: { compress: { dropConsole: true, dropDebugger: true } } } } },
  // production bundles never write to the browser console
  // (rolldown/oxc minifier)
});
