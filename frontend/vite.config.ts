import { defineConfig } from 'vite';
import analog from '@analogjs/platform';

export default defineConfig(() => ({
  plugins: [
    analog({
      ssr: true,
    }),
  ],
  resolve: {
    mainFields: ['module'],
  },
}));
