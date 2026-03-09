import type { Page } from '@playwright/test'

/** Navigate to the character select screen */
export async function goToCharacterSelect(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).click({ timeout: 5000 })
  await page.waitForTimeout(500)
}

/** Start a Knight run — lands on the first combat screen */
export async function startKnightRun(page: Page) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await goToCharacterSelect(page)
    const knightButton = page.getByRole('button', { name: /Knight/i }).first()
    const visible = await knightButton.isVisible({ timeout: 4000 }).catch(() => false)
    if (visible) {
      await knightButton.click({ timeout: 5000 })
      break
    }
    if (attempt === 1) {
      throw new Error('Could not find Knight character button')
    }
  }
  // Wait until at least one card is visible in the hand before returning
  await page.waitForSelector('button[class*="w-48"]', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(300)
}

/** Click End Turn via the hamburger menu (End Turn lives inside GlobalScreenMenu) */
export async function clickEndTurn(page: Page) {
  await page.getByRole('button', { name: 'Open main menu' }).click({ timeout: 5000 })
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'End Turn' }).click({ timeout: 5000 })
  await page.waitForTimeout(200)
}
