import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { uiGuardrailsPlugin } from './src/ui/guardrails/viteUiGuardrails'

const base = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  base,
  envPrefix: ['VITE_', 'UI_'],
  plugins: [
    uiGuardrailsPlugin(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
