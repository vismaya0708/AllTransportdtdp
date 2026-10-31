import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { pwa } from './build/pwa.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), pwa()],
    server: { proxy: { '/api': 'http://127.0.0.1:3000' } },
    test: { environment: 'jsdom', include: ['src/**/*.test.{js,jsx}'], setupFiles: ['./src/test-setup.js'] }
  };
});
