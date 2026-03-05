import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

await mkdir('screenshots', { recursive: true })
await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900)
await page.getByRole('button', { name: 'Play' }).click()
await page.waitForTimeout(1000)

const knightButton = page.getByRole('button', { name: /Knight/i })
await knightButton.hover()
await page.waitForTimeout(120)

const panelLabel = page.locator('p', { hasText: /Starting Deck/i })
const panelVisibleAfterKnightHover = await panelLabel.isVisible().catch(() => false)

if (panelVisibleAfterKnightHover) {
  const panelBox = await panelLabel.boundingBox()
  if (panelBox) {
    await page.mouse.move(panelBox.x + 120, panelBox.y + 100)
    await page.waitForTimeout(60)
  }
}

const panelStillVisibleAfterTransfer = await panelLabel.isVisible().catch(() => false)

const metrics = await page.evaluate(() => {
  const menuBtn = document.querySelector('[aria-label="Open character menu"]')
  const menuRect = menuBtn?.getBoundingClientRect() ?? null

  const panelTitle = Array.from(document.querySelectorAll('p')).find(el =>
    el.textContent?.includes('Starting Deck'),
  )
  const panel = panelTitle?.closest('div.rounded-xl')
  const panelRect = panel?.getBoundingClientRect() ?? null

  const cardNodes = Array.from(panel?.querySelectorAll('div.w-\\[192px\\].h-\\[288px\\]') ?? [])
  const cardRects = cardNodes.map(node => node.getBoundingClientRect())
  const maxCardBottom = cardRects.length > 0 ? Math.max(...cardRects.map(r => r.bottom)) : null

  const quirkEl = Array.from(document.querySelectorAll('p')).find(el =>
    el.textContent?.includes('Well-rounded fighter'),
  )
  const quirkRect = quirkEl?.getBoundingClientRect() ?? null

  const knightBtn = Array.from(document.querySelectorAll('button')).find(el =>
    el.textContent?.includes('Knight'),
  )
  const knightRect = knightBtn?.getBoundingClientRect() ?? null

  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    menuRect,
    panelRect,
    cardCount: cardRects.length,
    maxCardBottom,
    panelOverflow: panelRect && maxCardBottom ? maxCardBottom - panelRect.bottom : null,
    quirkRect,
    knightRect,
  }
})

await page.screenshot({ path: 'screenshots/character-select-updated.png', fullPage: true })

console.log(
  JSON.stringify(
    {
      ...metrics,
      panelVisibleAfterKnightHover,
      panelStillVisibleAfterTransfer,
      screenshot: 'screenshots/character-select-updated.png',
    },
    null,
    2,
  ),
)

await browser.close()
