import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // Avoid the tsx watch IPC socket in a deterministic browser run. The
      // package test command loads the root environment for both child services.
      command:
        'TSX_TSCONFIG_PATH=../api/tsconfig.json node --import ../api/node_modules/tsx/dist/loader.mjs ../api/src/main.ts',
      url: 'http://localhost:3001/api/v1/health/ready',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @growthos/web exec next dev',
      url: 'http://localhost:3000/health',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})
