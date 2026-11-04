import { defineConfig } from 'vite';
import analog from '@analogjs/platform';

export default defineConfig(() => ({
  plugins: [
    analog({
      ssr: true,
      nitro: {
        routeRules: {
          '/api/**': {
            proxy: 'http://localhost:8080/api/**'
          }
        }
      }
    })
  ],
  resolve: {
    mainFields: ['module']
  }
}));
