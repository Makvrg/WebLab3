import { defineConfig } from 'vite';
import analog from '@analogjs/platform';

export default defineConfig(() => ({
  plugins: [
    analog({
      ssr: true,
      nitro: {
        routeRules: {
          '/api/**': {
            proxy: 'http://127.0.0.1:5000/**',
          },
        },
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  resolve: {
    mainFields: ['module'],
  },
}));
