/**
 * screenshot-map.mjs — capture destination screen from preview route.
 * Requires dev server running (npm run dev).
 *
 * Output:
 *   screenshots/destination-screen.png
 */

import { chromium } from '@playwright/test'
import { mkdir } from 'fs/promises'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const URL = `${BASE}/?preview=destination`
const OUT = 'screenshots'

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setViewportSize({ width: 1400, height: 900 })

console.log(`Opening ${URL}…`)
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1000)

await page.screenshot({ path: `${OUT}/destination-screen.png`, fullPage: true })
console.log(`Saved ./${OUT}/destination-screen.png`)

await browser.close()
