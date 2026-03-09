import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
  },
  projects: [
    {
      name: 'core',
      testIgnore: ['tests/regression-audio.spec.ts', 'tests/regression-assets.spec.ts'],
    },
    {
      name: 'extended-regression',
      testMatch: ['tests/regression-audio.spec.ts', 'tests/regression-assets.spec.ts'],
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
