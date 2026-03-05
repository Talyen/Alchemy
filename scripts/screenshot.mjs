/**
 * screenshot.mjs — Capture two animation frames from the running dev server.
 * Start `npm run dev` first, then run `npm run screenshot` in a second terminal.
 *
 * Outputs:
 *   screenshots/frame-0.png  — on load
 *   screenshots/frame-1.png  — 400 ms later (animation progress check)
 */

import { chromium } from '@playwright/test'
import { mkdir } from 'fs/promises'

const BASE = 'http://localhost:5173'
const OUT = 'screenshots'

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setViewportSize({ width: 1280, height: 800 })

console.log(`Connecting to ${BASE}…`)
await page.goto(BASE, { waitUntil: 'domcontentloaded' })

// Give React + sprites time to render their first paint
await page.waitForTimeout(800)

console.log('Capturing frame-0…')
await page.screenshot({ path: `${OUT}/frame-0.png` })

await page.waitForTimeout(400)

console.log('Capturing frame-1…')
await page.screenshot({ path: `${OUT}/frame-1.png` })

await browser.close()
console.log(`Done → ./${OUT}/frame-0.png  ./${OUT}/frame-1.png`)
