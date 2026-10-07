import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: './',
  test: { include: ['src/**/*.test.ts'] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) =>
          id.includes('/three/') || id.includes('/@threlte/') ? 'scene' : undefined,
      },
    },
  },
});
