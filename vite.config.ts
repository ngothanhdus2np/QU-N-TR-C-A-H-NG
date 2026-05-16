import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
/// <reference types="vitest" />

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
    return {
      base: '/',
      server: {
        port: Number(process.env.PORT || 3000),
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          '@/lib': path.resolve(__dirname, './src/lib'),
          '@/components': path.resolve(__dirname, './components'),
          '@/hooks': path.resolve(__dirname, './hooks'),
          '@/services': path.resolve(__dirname, './services'),
          '@/constants': path.resolve(__dirname, './constants'),
          '@/types': path.resolve(__dirname, './types'),
        }
      },
      test: {
        environment: 'node',
        include: ['**/*.test.ts'],
      },
    };
});
