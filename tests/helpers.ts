import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Navigate to the character select screen */
export async function goToCharacterSelect(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).click({ timeout: 5000 })
  await expect(page.getByRole('button', { name: /Knight/i }).first()).toBeVisible({ timeout: 8000 })
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
  await waitForCombatReady(page)
}

/** Click End Turn via the hamburger menu (End Turn lives inside GlobalScreenMenu) */
export async function clickEndTurn(page: Page) {
  const menuButton = page.getByRole('button', { name: 'Open main menu' })
  const endTurnButton = page.getByRole('button', { name: 'End Turn' })

  if (!(await endTurnButton.isVisible().catch(() => false))) {
    await menuButton.click({ timeout: 4000 }).catch(() => {})
  }

  if (!(await endTurnButton.isVisible().catch(() => false))) {
    await menuButton.click({ timeout: 4000 }).catch(() => {})
  }

  await endTurnButton.click({ timeout: 5000 }).catch(() => {})
  await page.waitForFunction(() => {
    const bodyText = document.body.textContent ?? ''
    return bodyText.includes('Enemy Turn') || bodyText.includes('Your Turn')
  }, undefined, { timeout: 8000 }).catch(() => {})
}

export async function waitForCombatReady(page: Page) {
  await expect(page.locator('button[class*="w-48"]').first()).toBeVisible({ timeout: 12000 })
  await expect(page.locator('[data-testid="player-panel"]')).toBeVisible({ timeout: 12000 })
}
