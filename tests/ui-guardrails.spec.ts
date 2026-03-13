import { expect, test } from '@playwright/test'
import { goToCharacterSelect } from './helpers'

const VIEWPORTS = [
  { name: 'small', width: 800, height: 600 },
  { name: 'medium', width: 1280, height: 720 },
  { name: 'large', width: 1920, height: 1080 },
] as const

test('ui diagnostics emit no layout warnings on menu and character select', async ({ page }) => {
  const warnings: string[] = []

  page.on('console', (message) => {
    const text = message.text()
    if (!text.includes('[ui-layout]')) return
    warnings.push(text)
  })

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
      window.localStorage.clear()
    })
    await goToCharacterSelect(page)

    const knight = page.getByRole('button', { name: /Knight/i }).first()
    await expect(knight).toBeVisible()

    await knight.hover()
    await page.waitForTimeout(600)

    const title = page.getByText('Starting Deck')
    await expect(title).toBeVisible()
  }

  expect(warnings, warnings.join('\n')).toEqual([])
})
