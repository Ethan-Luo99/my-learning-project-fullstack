import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue() as any],
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 60000,
    hookTimeout: 60000,
    isolate: false,
    maxWorkers: 1,
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', '.nuxt', 'dist'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['server/**/*', 'pages/**/*'],
      exclude: ['node_modules', '.nuxt', 'dist', 'tests']
    }
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, '.'),
      '@': resolve(__dirname, '.')
    }
  }
})
