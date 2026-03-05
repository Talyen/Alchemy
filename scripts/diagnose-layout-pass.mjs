import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

await mkdir('screenshots', { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900)

const menuMetrics = await page.evaluate(() => {
  const menu = document.querySelector('[aria-label="Open main menu"]')
  const root = document.querySelector('div[style*="aspect-ratio: 16 / 9"]')
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    menuRect: menu?.getBoundingClientRect() ?? null,
    rootRect: root?.getBoundingClientRect() ?? null,
  }
})

await page.screenshot({ path: 'screenshots/layout-pass-menu.png', fullPage: true })

await page.getByRole('button', { name: 'Play' }).click()
await page.waitForTimeout(1000)

const knightButton = page.getByRole('button', { name: /Knight/i })
await knightButton.hover()
await page.waitForTimeout(250)

const charMetrics = await page.evaluate(() => {
  const menu = document.querySelector('[aria-label="Open main menu"]')
  const root = document.querySelector('div[style*="aspect-ratio: 16 / 9"]')
  const deckTitle = Array.from(document.querySelectorAll('p')).find(el => el.textContent?.includes('Starting Deck'))
  const deckPanel = deckTitle?.closest('div.rounded-xl')
  return {
    menuRect: menu?.getBoundingClientRect() ?? null,
    rootRect: root?.getBoundingClientRect() ?? null,
    deckPanelRect: deckPanel?.getBoundingClientRect() ?? null,
  }
})
await page.screenshot({ path: 'screenshots/layout-pass-character.png', fullPage: true })

await knightButton.click()
await page.waitForTimeout(1100)

const battleMetrics = await page.evaluate(() => {
  const root = document.querySelector('div[style*="aspect-ratio: 16 / 9"]')
  const rootRect = root?.getBoundingClientRect() ?? null
  const menu = document.querySelector('[aria-label="Open main menu"]')
  const turnLabel = Array.from(document.querySelectorAll('span')).find(el => {
    const t = el.textContent?.trim()
    return t === 'Your Turn' || t === 'Enemy Turn'
  })
  const drawLabel = Array.from(document.querySelectorAll('span')).find(el => el.textContent === 'Draw')
  const discardLabel = Array.from(document.querySelectorAll('span')).find(el => el.textContent === 'Discard')
  const manaArea = Array.from(document.querySelectorAll('div')).find(el => {
    const text = el.textContent ?? ''
    return text.includes('Gold') && text.includes('Log')
  })
  const handCards = Array.from(document.querySelectorAll('button'))
    .map(node => node.getBoundingClientRect())
    .filter(rect => rect.width > 150 && rect.height > 220)

  const drawRect = drawLabel?.closest('div.flex.flex-col')?.getBoundingClientRect() ?? null
  const discardRect = discardLabel?.closest('div.flex.flex-col')?.getBoundingClientRect() ?? null
  const manaRect = manaArea?.getBoundingClientRect?.() ?? null
  const menuRect = menu?.getBoundingClientRect() ?? null
  const turnRect = turnLabel?.getBoundingClientRect() ?? null

  const hpBars = Array.from(document.querySelectorAll('[data-testid^="hp-bar-"]')).map(el => el.getBoundingClientRect())
  const hpCenters = hpBars.map(center => center.top + center.height / 2)

  return {
    rootRect,
    menuRect,
    drawRect,
    discardRect,
    manaRect,
    turnRect,
    hpBarY: hpCenters,
    handCardCount: handCards.length,
    handCardSample: handCards.slice(0, 2),
  }
})
await page.screenshot({ path: 'screenshots/layout-pass-battle.png', fullPage: true })

console.log(JSON.stringify({ menuMetrics, charMetrics, battleMetrics }, null, 2))

await browser.close()
