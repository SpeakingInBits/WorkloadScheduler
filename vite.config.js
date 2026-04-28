import { defineConfig } from 'vite';

export default defineConfig({
  // Required for GitHub Pages deployment under /WorkloadScheduler/
  base: '/WorkloadScheduler/',

  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.js'],
    setupFiles: ['tests/unit/setup.js'],
  },
});
