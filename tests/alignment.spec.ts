import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

// Helper: get the y-position of both HP bars and assert they match within 2px.
async function assertHpBarsAligned(page: import('@playwright/test').Page) {
  const playerBar = page.locator('[data-testid="hp-bar-player"]')
  const enemyBar  = page.locator('[data-testid="hp-bar-enemy"]')
  const pBox = await playerBar.boundingBox()
  const eBox = await enemyBar.boundingBox()
  expect(pBox).not.toBeNull()
  expect(eBox).not.toBeNull()
  expect(Math.abs(pBox!.y - eBox!.y)).toBeLessThanOrEqual(2)
}

test.beforeEach(async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.locator('button', { hasText: 'Play' }).click()
  await page.waitForTimeout(600) // let game mount + Framer Motion settle
})

test('HP bars are vertically aligned on load', async ({ page }) => {
  await assertHpBarsAligned(page)
})

test('HP bars stay aligned after playing a card', async ({ page }) => {
  // Play the first playable card (any 1-cost card will do)
  const card = page.locator('button', { hasText: 'Deal 6 damage' }).first()
  await card.click()
  await page.waitForTimeout(200)
  await assertHpBarsAligned(page)
})

test('HP bars stay aligned when enemy has block (defend turn)', async ({ page }) => {
  // Cycle through all 3 enemy-pattern steps so the enemy gets to use its defend action.
  // Pattern: attack → attack → defend.  End turn 3 × to hit all three.
  for (let i = 0; i < 3; i++) {
    await page.locator('button', { hasText: 'End Turn' }).click()
    await page.waitForTimeout(700) // wait for enemy action + new-turn animation
  }
  await assertHpBarsAligned(page)
})

test('HP bars stay aligned when status effects are present', async ({ page }) => {
  // End turn once (enemy attacks, may add status) then check alignment.
  await page.locator('button', { hasText: 'End Turn' }).click()
  await page.waitForTimeout(700)
  await assertHpBarsAligned(page)

  // End turn a second time to accumulate more state changes.
  await page.locator('button', { hasText: 'End Turn' }).click()
  await page.waitForTimeout(700)
  await assertHpBarsAligned(page)
})
