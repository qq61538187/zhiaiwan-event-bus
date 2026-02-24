import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify('test'),
  },
  test: {
    globals: false,
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
})
