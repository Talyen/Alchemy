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

test('bestiary shade variants face left', async ({ page }) => {
  await startKnightRun(page)

  await page.getByRole('button', { name: 'Open main menu' }).click()
  await page.getByRole('button', { name: 'Collection' }).click()
  await expect(page.getByText('Collections')).toBeVisible()
  await page.getByRole('button', { name: 'Bestiary' }).click()
  await expect(page.locator('[data-testid="bestiary-enemy-sprite"]').first()).toBeVisible({ timeout: 5000 })

  const targets = new Set(['Shade', 'Mirror Shade', 'Prismatic Shade'])
  const found = new Map<string, number>()

  for (let step = 0; step < 12 && found.size < targets.size; step += 1) {
    const snapshot = await page.evaluate(() => {
      const out: Array<{ name: string; scaleX: number }> = []
      const cards = Array.from(document.querySelectorAll('button.group.relative.h-44'))
      for (const card of cards) {
        const nameEl = card.querySelector('p')
        const sprite = card.querySelector('[data-testid="bestiary-enemy-sprite"]') as HTMLElement | null
        if (!nameEl || !sprite) continue

        const transform = window.getComputedStyle(sprite).transform
        let scaleX = 1
        const matrix2d = transform.match(/matrix\(([^)]+)\)/)
        if (matrix2d) {
          const first = Number(matrix2d[1].split(',')[0])
          if (Number.isFinite(first)) scaleX = first
        }
        const matrix3d = transform.match(/matrix3d\(([^)]+)\)/)
        if (matrix3d) {
          const first = Number(matrix3d[1].split(',')[0])
          if (Number.isFinite(first)) scaleX = first
        }

        out.push({ name: (nameEl.textContent ?? '').trim(), scaleX })
      }
      return out
    })

    for (const entry of snapshot) {
      if (!targets.has(entry.name)) continue
      found.set(entry.name, entry.scaleX)
    }

    if (found.size < targets.size) {
      const nextPage = page.getByRole('button', { name: 'Next page' })
      if (!(await nextPage.isVisible().catch(() => false))) break
      await nextPage.click()
      await page.waitForTimeout(250)
    }
  }

  for (const name of targets) {
    expect(found.has(name), `Missing bestiary target ${name}`).toBeTruthy()
    expect(found.get(name)!, `${name} should face left in bestiary`).toBeLessThan(0)
  }
})
