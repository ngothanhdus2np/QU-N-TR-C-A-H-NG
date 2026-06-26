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
      plugins: [
        react(),
        {
          name: 'preload-priority',
          transformIndexHtml(html) {
            // Thêm fetchpriority vào modulepreload theo thứ tự ưu tiên:
            // high = react/supabase (cần để render đầu tiên)
            // low  = vendor-misc/pdf (tải sau, không chặn first paint)
            return html
              .replace(
                /(<link rel="modulepreload"[^>]*\/vendor[^->][^>]*)(>)/g,
                '$1 fetchpriority="high"$2'
              )
              .replace(
                /(<link rel="modulepreload"[^>]*vendor-supabase[^>]*)(>)/g,
                '$1 fetchpriority="high"$2'
              )
              .replace(
                /(<link rel="modulepreload"[^>]*vendor-pdf[^>]*)(>)/g,
                '$1 fetchpriority="low"$2'
              )
              .replace(
                /(<link rel="modulepreload"[^>]*vendor-charts[^>]*)(>)/g,
                '$1 fetchpriority="low"$2'
              );
          },
        },
      ],
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                // PDF/chart: lazy-loaded, tách riêng
                if (id.includes('pdfjs-dist') || id.includes('pdf-lib') || id.includes('jspdf')) return 'vendor-pdf';
                if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-')) return 'vendor-charts';
                // Supabase: tách riêng để cache độc lập
                if (id.includes('@supabase')) return 'vendor-supabase';
                // Icons: tách riêng (thường không đổi)
                if (id.includes('lucide-react')) return 'vendor-icons';
                // Tất cả React ecosystem (react, react-dom, react-router, @remix-run, scheduler, @radix-ui...)
                // gom vào 1 chunk để tránh circular dependency
                // vendor-misc cần react/ → nếu react nằm riêng thì tạo vòng tròn
                // Giải pháp: để react + mọi thứ còn lại cùng 1 chunk
                return 'vendor';
              }
            }
          }
        }
      },
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
        exclude: ['supabase/**', 'node_modules/**'],
      },
    };
});
