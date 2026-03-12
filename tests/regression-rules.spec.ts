import { expect, test } from '@playwright/test'
import { startKnightRun } from './helpers'
import { canAppearAfter } from '../src/lib/destinationRules'

test('destination rules never allow repeated non-combat rooms', async () => {
  const repeatable = new Set(['enemy', 'elite', 'mystery'])
  const allTypes = ['enemy', 'elite', 'rest', 'shop', 'mystery', 'alchemy'] as const

  for (const type of allTypes) {
    const allowed = canAppearAfter(type, type)
    expect(allowed).toBe(repeatable.has(type))
  }

  expect(canAppearAfter('rest', 'shop')).toBe(true)
  expect(canAppearAfter('shop', 'alchemy')).toBe(true)
})

test('bestiary enemy sprites all face right', async ({ page }) => {
  await startKnightRun(page)

  await page.getByRole('button', { name: 'Open main menu' }).click()
  await page.getByRole('button', { name: 'Collection' }).click()
  await expect(page.getByText('Collections')).toBeVisible()
  await page.getByRole('button', { name: 'Bestiary' }).click()
  await expect(page.locator('[data-testid="bestiary-enemy-sprite"]').first()).toBeVisible({ timeout: 5000 })

  const facingDirections = await page.evaluate(() => {
    const sprites = Array.from(document.querySelectorAll('[data-testid="bestiary-enemy-sprite"]')) as HTMLElement[]
    return sprites.map((sprite) => {
      const transform = window.getComputedStyle(sprite).transform
      if (!transform || transform === 'none') return 1
      const matrix = transform.match(/matrix\(([^)]+)\)/)
      if (!matrix) return 1
      const first = Number(matrix[1].split(',')[0])
      if (!Number.isFinite(first)) return 1
      return Math.sign(first) || 1
    })
  })

  expect(facingDirections.length).toBeGreaterThan(0)
  expect(new Set(facingDirections).size).toBe(1)
  expect(facingDirections[0]).toBe(1)
})
