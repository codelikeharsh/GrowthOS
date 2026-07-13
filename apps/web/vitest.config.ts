import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: { environment: 'node', exclude: ['e2e/**', 'node_modules/**'] },
})
