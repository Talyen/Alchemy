import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  // Don't spin up a server — assumes `npm run dev` is already running
  webServer: undefined,
})
