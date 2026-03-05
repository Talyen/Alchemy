/**
 * screenshot-immolate-bg.mjs — capture all cards on Immolate brown background.
 * Requires dev server running (npm run dev).
 *
 * Output:
 *   screenshots/card-immolate-bg.png
 */

import { chromium } from '@playwright/test'
import { mkdir } from 'fs/promises'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const URL = `${BASE}/?preview=card-immolate-bg`
const OUT = 'screenshots'

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setViewportSize({ width: 1600, height: 1000 })

console.log(`Opening ${URL}…`)
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)

await page.screenshot({ path: `${OUT}/card-immolate-bg.png`, fullPage: true })
console.log(`Saved ./${OUT}/card-immolate-bg.png`)

await browser.close()
