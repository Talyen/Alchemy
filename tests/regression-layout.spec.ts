import { expect, test } from '@playwright/test'
import { goToCharacterSelect, startKnightRun } from './helpers'
import { CRITICAL_CONTROL_RULES } from '../src/ui/qa/criticalControlMatrix'

const BATTLE_VIEWPORTS = [
  { width: 800, height: 600 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]

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
    const drawButton = document.querySelector('[data-testid="pile-draw"]')

    const inventoryRect = inventoryButton?.getBoundingClientRect() ?? null
    const drawRect = drawButton?.getBoundingClientRect() ?? null
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
    const card = document.querySelector('button[class*="w-48"]')
    if (!tooltip || !card) return null
    const cardRect = card.getBoundingClientRect()
    const rect = tooltip.getBoundingClientRect()
    const overlapX = Math.max(0, Math.min(rect.right, cardRect.right) - Math.max(rect.left, cardRect.left))
    const overlapY = Math.max(0, Math.min(rect.bottom, cardRect.bottom) - Math.max(rect.top, cardRect.top))
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      cardTop: cardRect.top,
      overlapArea: overlapX * overlapY,
      width: window.innerWidth,
      height: window.innerHeight,
    }
  })

  expect(bounds).not.toBeNull()
  expect(bounds!.left).toBeGreaterThanOrEqual(0)
  expect(bounds!.top).toBeGreaterThanOrEqual(0)
  expect(bounds!.right).toBeLessThanOrEqual(bounds!.width)
  expect(bounds!.bottom).toBeLessThanOrEqual(bounds!.height)
  expect(bounds!.bottom).toBeLessThanOrEqual(bounds!.cardTop)
  expect(bounds!.overlapArea).toBe(0)
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

test('battle menu does not overlap draw/discard pile controls', async ({ page }) => {
  await startKnightRun(page)

  for (const viewport of BATTLE_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(300)

    for (const rule of CRITICAL_CONTROL_RULES) {
      const result = await page.evaluate((input) => {
        const primary = document.querySelector(input.primarySelector)
        const secondary = document.querySelector(input.secondarySelector)
        if (!primary || !secondary) return null

        const a = primary.getBoundingClientRect()
        const b = secondary.getBoundingClientRect()
        const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
        const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
        const overlap = overlapX * overlapY

        const horizontalGap = Math.max(0, Math.max(a.left - b.right, b.left - a.right))
        const verticalGap = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom))
        let gap = 0
        if (!(horizontalGap === 0 && verticalGap === 0)) {
          gap = horizontalGap === 0
            ? verticalGap
            : verticalGap === 0
              ? horizontalGap
              : Math.hypot(horizontalGap, verticalGap)
        }

        return { overlap, gap }
      }, rule)

      expect(result, `${rule.id} probes missing at ${viewport.width}x${viewport.height}`).not.toBeNull()
      expect(result!.overlap, `${rule.id} overlaps at ${viewport.width}x${viewport.height}`).toBe(0)
      expect(result!.gap, `${rule.id} gap below ${rule.minGap}px at ${viewport.width}x${viewport.height}`).toBeGreaterThanOrEqual(rule.minGap)
    }
  }
})

test('bestiary enemies face left and key sprites stay vertically centered', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Collection' }).click()
  await page.getByRole('button', { name: 'Bestiary' }).click()
  await page.waitForTimeout(600)

  const targets = new Set(['Shade', 'Mirror Shade', 'Prismatic Shade', 'Flaming Skull', 'Prismatic Skull'])
  const found = new Map<string, { scaleX: number; bottomGap: number }>()

  for (let step = 0; step < 16 && found.size < targets.size; step += 1) {
    const snapshot = await page.evaluate(() => {
      const entries: Array<{ name: string; scaleX: number; bottomGap: number }> = []
      const cards = Array.from(document.querySelectorAll('button.group.relative.h-44'))
      for (const card of cards) {
        const nameEl = card.querySelector('p')
        const sprite = card.querySelector('img[data-testid="bestiary-enemy-sprite"]') as HTMLImageElement | null
        if (!nameEl || !sprite) continue

        const transform = getComputedStyle(sprite).transform
        let scaleX = 1
        const m2d = transform.match(/^matrix\(([^)]+)\)$/)
        if (m2d) {
          const first = Number(m2d[1].split(',')[0])
          if (Number.isFinite(first)) scaleX = first
        }
        const m3d = transform.match(/^matrix3d\(([^)]+)\)$/)
        if (m3d) {
          const first = Number(m3d[1].split(',')[0])
          if (Number.isFinite(first)) scaleX = first
        }

        const cardRect = card.getBoundingClientRect()
        const spriteRect = sprite.getBoundingClientRect()
        entries.push({
          name: (nameEl.textContent ?? '').trim(),
          scaleX,
          bottomGap: cardRect.bottom - spriteRect.bottom,
        })
      }
      return entries
    })

    for (const entry of snapshot) {
      if (!targets.has(entry.name)) continue
      found.set(entry.name, { scaleX: entry.scaleX, bottomGap: entry.bottomGap })
    }

    if (found.size < targets.size) {
      const nextPage = page.getByRole('button', { name: 'Next page' })
      if (!(await nextPage.isVisible().catch(() => false))) break
      await nextPage.click()
      await page.waitForTimeout(280)
    }
  }

  for (const name of targets) {
    expect(found.has(name), `Missing bestiary target ${name}`).toBeTruthy()
    const metric = found.get(name)!
    expect(metric.scaleX, `${name} should face left in bestiary`).toBeLessThan(0)
    expect(metric.bottomGap, `${name} sprite sits too low in bestiary tile`).toBeGreaterThanOrEqual(10)
  }
})
