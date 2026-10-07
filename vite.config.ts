import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: './',
  server: { proxy: { '/api/wishes': process.env.WISH_PROXY_TARGET || 'http://127.0.0.1:8787' } },
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
