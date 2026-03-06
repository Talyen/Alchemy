import { expect, test } from '@playwright/test'

async function goToCharacterSelect(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForTimeout(500)
}

async function startKnightRun(page: import('@playwright/test').Page) {
  await goToCharacterSelect(page)
  await page.getByRole('button', { name: /Knight/i }).first().click()
  await page.waitForTimeout(900)
}

test('starting deck preview cards stay above panel bottom border', async ({ page }) => {
  await goToCharacterSelect(page)

  const knight = page.getByRole('button', { name: /Knight/i }).first()
  await knight.hover()
  await page.waitForTimeout(250)

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

test('battle HUD piles do not overlap playable hand cards', async ({ page }) => {
  await startKnightRun(page)

  const overlapArea = await page.evaluate(() => {
    const drawLabel = Array.from(document.querySelectorAll('span')).find(el => el.textContent === 'Draw')
    const discardLabel = Array.from(document.querySelectorAll('span')).find(el => el.textContent === 'Discard')

    const drawRect = drawLabel?.closest('div.flex.flex-col')?.getBoundingClientRect() ?? null
    const discardRect = discardLabel?.closest('div.flex.flex-col')?.getBoundingClientRect() ?? null

    const cards = Array.from(document.querySelectorAll('button'))
      .map(node => node.getBoundingClientRect())
      .filter(rect => rect.width > 150 && rect.height > 220)

    if (!drawRect || !discardRect || cards.length === 0) return null

    const intersectionArea = (a: DOMRect, b: DOMRect) => {
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      return x * y
    }

    let maxOverlap = 0
    for (const card of cards) {
      maxOverlap = Math.max(maxOverlap, intersectionArea(card, drawRect), intersectionArea(card, discardRect))
    }

    return maxOverlap
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
