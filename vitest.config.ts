import { defineConfig } from 'vitest/config'

// Unit tests for server code that doesn't need Nuxt running (see test/)
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node'
  }
})
