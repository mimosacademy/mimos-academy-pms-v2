import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Vitest config for unit tests of pure logic (role model, formatting, api guards).
// Uses the Node environment so it runs fast without a DOM; the `@` alias matches Vite.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    globals: true,
  },
});
