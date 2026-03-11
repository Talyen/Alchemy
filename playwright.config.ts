import { defineConfig } from '@playwright/test'
import os from 'node:os'

const cpuCount = Math.max(1, os.cpus().length)
const defaultWorkers = Math.max(2, Math.min(8, cpuCount - 1))

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: process.env.CI ? 2 : defaultWorkers,
  retries: process.env.CI ? 1 : 0,
  timeout: 45000,
  expect: {
    timeout: 7000,
  },
  reporter: process.env.CI
    ? [['dot'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'core',
      testIgnore: ['tests/regression-audio.spec.ts', 'tests/regression-assets.spec.ts', 'tests/regression-layout.spec.ts'],
    },
    {
      name: 'extended-regression',
      fullyParallel: false,
      testMatch: ['tests/regression-audio.spec.ts', 'tests/regression-assets.spec.ts', 'tests/regression-layout.spec.ts'],
      timeout: 90000,
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
