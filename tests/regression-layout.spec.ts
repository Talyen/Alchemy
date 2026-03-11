import { expect, test } from '@playwright/test'
import { goToCharacterSelect, startKnightRun } from './helpers'

test('starting deck preview cards stay above panel bottom border', async ({ page }) => {
  await goToCharacterSelect(page)

  const knight = page.getByRole('button', { name: /Knight/i }).first()
  await knight.hover()
  await expect(knight).toBeVisible()

  const metrics = await page.evaluate(() => {
    const title = Array.from(document.querySelectorAll('p')).find(node => node.textContent?.includes('Starting Deck'))
    const panel = title?.closest('div.rounded-xl') as HTMLDivElement | null
    if (!panel) return null

    const panelRect = panel.getBoundingClientRect()
    const cards = Array.from(panel.querySelectorAll('button'))
      .map(node => node.getBoundingClientRect())
      .filter(rect => rect.width > 150 && rect.height > 220)
      .sort((a, b) => a.left - b.left)

    if (cards.length < 2) return null

    const leftMost = cards[0]
    const rightMost = cards[cards.length - 1]

    return {
      leftBottomGap: panelRect.bottom - leftMost.bottom,
      rightBottomGap: panelRect.bottom - rightMost.bottom,
    }
  })

  expect(metrics).not.toBeNull()
  expect(metrics!.leftBottomGap).toBeGreaterThan(4)
  expect(metrics!.rightBottomGap).toBeGreaterThan(4)
})

test('inventory icon does not overlap draw pile', async ({ page }) => {
  await startKnightRun(page)

  const overlapArea = await page.evaluate(() => {
    const inventoryButton = Array.from(document.querySelectorAll('button')).find(node => {
      const img = node.querySelector('img[alt="Inventory"]')
      return Boolean(img)
    })
    const drawButton = Array.from(document.querySelectorAll('button')).find(node => node.textContent?.includes('Draw'))

    const inventoryRect = inventoryButton?.getBoundingClientRect() ?? null
    const drawRect = drawButton?.querySelector('div.relative.w-16.h-24')?.getBoundingClientRect() ?? null
    if (!drawRect || !inventoryRect) return null

    const intersectionArea = (a: DOMRect, b: DOMRect) => {
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      return x * y
    }

    return intersectionArea(inventoryRect, drawRect)
  })

  expect(overlapArea).not.toBeNull()
  expect(overlapArea!).toBe(0)
})

test('turn indicator label is below character sprite wells', async ({ page }) => {
  await startKnightRun(page)

  const ok = await page.evaluate(() => {
    const turnLabel = Array.from(document.querySelectorAll('span')).find(el => {
      const text = el.textContent?.trim()
      return text === 'Your Turn' || text === 'Enemy Turn'
    })

    const spriteWells = Array.from(document.querySelectorAll('div.h-40'))
      .map(node => node.getBoundingClientRect())

    if (!turnLabel || spriteWells.length < 2) return null

    const labelRect = turnLabel.getBoundingClientRect()
    const lowestSpriteBottom = Math.max(...spriteWells.map(rect => rect.bottom))

    return labelRect.top > lowestSpriteBottom
  })

  expect(ok).not.toBeNull()
  expect(ok).toBeTruthy()
})

test('card keyword tooltip stays within viewport bounds at balanced resolution', async ({ page }) => {
  await startKnightRun(page)

  const hoveredCard = page.locator('button[class*="w-48"]').first()
  await expect(hoveredCard).toBeVisible()
  await hoveredCard.hover()
  await page.waitForTimeout(520)

  const bounds = await page.evaluate(() => {
    const tooltip = Array.from(document.querySelectorAll('div.fixed')).find(node => node.textContent?.includes('Keywords'))
    if (!tooltip) return null
    const rect = tooltip.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: window.innerWidth,
      height: window.innerHeight,
    }
  })

  if (bounds) {
    expect(bounds.left).toBeGreaterThanOrEqual(0)
    expect(bounds.top).toBeGreaterThanOrEqual(0)
    expect(bounds.right).toBeLessThanOrEqual(bounds.width)
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.height)
  }
})

test('draw pile opens as centered modal and cards do not overlap', async ({ page }) => {
  await startKnightRun(page)

  await page.locator('span', { hasText: 'Draw' }).first().click()
  const modal = page.locator('div.fixed.inset-0').first()
  await expect(modal).toBeVisible()

  const cardRects = await page.locator('div.fixed.inset-0 button[class*="w-48"]').evaluateAll(nodes =>
    nodes.slice(0, 6).map(node => node.getBoundingClientRect()),
  )

  expect(cardRects.length).toBeGreaterThan(1)
  for (let i = 0; i < cardRects.length - 1; i++) {
    for (let j = i + 1; j < cardRects.length; j++) {
      const a = cardRects[i]
      const b = cardRects[j]
      const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      expect(overlapX * overlapY).toBe(0)
    }
  }
})
