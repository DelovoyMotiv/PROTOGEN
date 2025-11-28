import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          './services/identity': path.resolve(__dirname, 'services/api-client'),
          './services/mesh': path.resolve(__dirname, 'services/api-client'),
          './services/memory': path.resolve(__dirname, 'services/api-client'),
          './services/kernel': path.resolve(__dirname, 'services/api-client'),
          './services/economy': path.resolve(__dirname, 'services/api-client'),
          './services/gemini': path.resolve(__dirname, 'services/api-client'),
          './services/scheduler': path.resolve(__dirname, 'services/api-client'),
          './services/oracle': path.resolve(__dirname, 'services/api-client'),
        }
      },
      optimizeDeps: {
        include: ['services/survival/earningEngine']
      }
    };
});
